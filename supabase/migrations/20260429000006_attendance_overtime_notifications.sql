ALTER TABLE public.work_notifications
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS action_url text;

ALTER TABLE public.work_notifications
DROP CONSTRAINT IF EXISTS work_notifications_type_check;

ALTER TABLE public.work_notifications
ADD CONSTRAINT work_notifications_type_check
CHECK (
  type IN (
    'mention',
    'message',
    'attendance_checkout_reminder',
    'attendance_auto_checkout',
    'overtime_request',
    'overtime_approved',
    'overtime_declined',
    'early_checkout_response'
  )
);

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS expected_check_out_at timestamptz,
ADD COLUMN IF NOT EXISTS checkout_reminder_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS auto_checked_out_at timestamptz,
ADD COLUMN IF NOT EXISTS auto_checkout_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_attendance_location_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_update BOOLEAN;
  failure_reason TEXT;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
    OR auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  THEN
    RETURN NEW;
  END IF;

  is_update := TG_OP = 'UPDATE';
  failure_reason := public.attendance_location_check_reason(
    NEW.employee_id,
    NEW.last_verified_location,
    NEW.last_verified_ip,
    NEW.last_verified_at,
    is_update,
    CASE WHEN is_update THEN OLD.last_verified_at ELSE NULL END
  );

  IF failure_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Attendance location or network restriction failed: %', failure_reason;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS is_team_lead boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS duty_schedule_template_id uuid,
ADD COLUMN IF NOT EXISTS custom_work_start_time time,
ADD COLUMN IF NOT EXISTS custom_work_end_time time,
ADD COLUMN IF NOT EXISTS work_location text DEFAULT 'on_site';

CREATE TABLE IF NOT EXISTS public.duty_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name text NOT NULL,
  shift_type text NOT NULL DEFAULT 'regular' CHECK (shift_type IN ('regular', 'rotating', 'flexible', 'night')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  work_days text[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.duty_schedule_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view duty schedule templates" ON public.duty_schedule_templates;
CREATE POLICY "Everyone can view duty schedule templates" ON public.duty_schedule_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage duty schedule templates" ON public.duty_schedule_templates;
CREATE POLICY "Admins can manage duty schedule templates" ON public.duty_schedule_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_duty_schedule_templates_updated_at ON public.duty_schedule_templates;
CREATE TRIGGER update_duty_schedule_templates_updated_at
BEFORE UPDATE ON public.duty_schedule_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS attendance_due_checkout_idx
  ON public.attendance (expected_check_out_at)
  WHERE check_out_at IS NULL AND expected_check_out_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_overtime_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text NOT NULL DEFAULT 'Working overtime',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  response_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attendance_id, employee_id)
);

CREATE INDEX IF NOT EXISTS attendance_overtime_requests_employee_date_idx
  ON public.attendance_overtime_requests (employee_id, date DESC);

CREATE INDEX IF NOT EXISTS attendance_overtime_requests_status_idx
  ON public.attendance_overtime_requests (status, created_at DESC);

ALTER TABLE public.attendance_overtime_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_outbox_status_created_at_idx
  ON public.email_outbox (status, created_at);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage email outbox" ON public.email_outbox;
CREATE POLICY "Admins can manage email outbox" ON public.email_outbox
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own email outbox" ON public.email_outbox;
CREATE POLICY "Users can view own email outbox" ON public.email_outbox
  FOR SELECT USING (recipient_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_team_lead_for_employee(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees lead_employee
    JOIN public.employees target_employee ON target_employee.id = _employee_id
    WHERE lead_employee.user_id = _user_id
      AND lead_employee.is_team_lead = true
      AND lead_employee.office_id IS NOT DISTINCT FROM target_employee.office_id
  )
$$;

DROP POLICY IF EXISTS "Users can view own overtime requests" ON public.attendance_overtime_requests;
DROP POLICY IF EXISTS "Users can submit own overtime requests" ON public.attendance_overtime_requests;
DROP POLICY IF EXISTS "Admins and leads can view overtime requests" ON public.attendance_overtime_requests;
DROP POLICY IF EXISTS "Admins and leads can review overtime requests" ON public.attendance_overtime_requests;

CREATE POLICY "Users can view own overtime requests" ON public.attendance_overtime_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.employees
      WHERE employees.id = attendance_overtime_requests.employee_id
        AND employees.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can submit own overtime requests" ON public.attendance_overtime_requests
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.attendance a
      JOIN public.employees e ON e.id = a.employee_id
      WHERE a.id = attendance_overtime_requests.attendance_id
        AND a.employee_id = attendance_overtime_requests.employee_id
        AND a.check_out_at IS NULL
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and leads can view overtime requests" ON public.attendance_overtime_requests
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_lead_for_employee(auth.uid(), attendance_overtime_requests.employee_id)
  );

CREATE POLICY "Admins and leads can review overtime requests" ON public.attendance_overtime_requests
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_lead_for_employee(auth.uid(), attendance_overtime_requests.employee_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_lead_for_employee(auth.uid(), attendance_overtime_requests.employee_id)
  );

CREATE OR REPLACE FUNCTION public.get_employee_checkout_time(_employee_id uuid, _date date)
RETURNS time
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_row record;
  template_row record;
  office_end time;
  day_name text;
BEGIN
  SELECT id, office_id, duty_schedule_template_id, custom_work_end_time
  INTO employee_row
  FROM public.employees
  WHERE id = _employee_id;

  IF employee_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF employee_row.custom_work_end_time IS NOT NULL THEN
    RETURN employee_row.custom_work_end_time;
  END IF;

  day_name := lower(to_char(_date, 'FMDay'));

  IF employee_row.duty_schedule_template_id IS NOT NULL THEN
    SELECT end_time, work_days
    INTO template_row
    FROM public.duty_schedule_templates
    WHERE id = employee_row.duty_schedule_template_id
      AND is_active = true;

    IF template_row.end_time IS NOT NULL
      AND (
        template_row.work_days IS NULL
        OR lower(day_name) = ANY(SELECT lower(unnest(template_row.work_days)))
      )
    THEN
      RETURN template_row.end_time;
    END IF;
  END IF;

  SELECT work_end_time
  INTO office_end
  FROM public.office_settings
  WHERE office_id = employee_row.office_id;

  RETURN office_end;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_attendance_expected_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  checkout_time time;
  attendance_zone text;
  expected_local timestamp;
BEGIN
  IF NEW.check_in_at IS NULL OR NEW.out_time IS NOT NULL OR NEW.check_out_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  checkout_time := public.get_employee_checkout_time(NEW.employee_id, NEW.date);
  IF checkout_time IS NULL THEN
    RETURN NEW;
  END IF;

  attendance_zone := COALESCE(NEW.attendance_time_zone, 'UTC');
  expected_local := NEW.date::timestamp + checkout_time;

  IF NEW.in_time IS NOT NULL AND checkout_time <= NEW.in_time THEN
    expected_local := expected_local + interval '1 day';
  END IF;

  NEW.expected_check_out_at := expected_local AT TIME ZONE attendance_zone;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_attendance_expected_checkout ON public.attendance;
CREATE TRIGGER set_attendance_expected_checkout
BEFORE INSERT OR UPDATE OF employee_id, date, in_time, check_in_at, out_time, check_out_at, attendance_time_zone
ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.set_attendance_expected_checkout();

UPDATE public.attendance
SET check_in_at = check_in_at
WHERE check_in_at IS NOT NULL
  AND check_out_at IS NULL
  AND expected_check_out_at IS NULL;

CREATE OR REPLACE FUNCTION public.attendance_reviewer_user_ids(_employee_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  UNION
  SELECT DISTINCT lead_employee.user_id
  FROM public.employees lead_employee
  JOIN public.employees target_employee ON target_employee.id = _employee_id
  WHERE lead_employee.is_team_lead = true
    AND lead_employee.office_id IS NOT DISTINCT FROM target_employee.office_id
$$;

CREATE OR REPLACE FUNCTION public.submit_overtime_request(_attendance_id uuid, _reason text DEFAULT 'Working overtime')
RETURNS public.attendance_overtime_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attendance_row record;
  request_row public.attendance_overtime_requests;
BEGIN
  SELECT a.id, a.employee_id, a.date, a.check_out_at, e.user_id
  INTO attendance_row
  FROM public.attendance a
  JOIN public.employees e ON e.id = a.employee_id
  WHERE a.id = _attendance_id;

  IF attendance_row.id IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;

  IF attendance_row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only request overtime for your own attendance';
  END IF;

  IF attendance_row.check_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'You are already checked out';
  END IF;

  INSERT INTO public.attendance_overtime_requests (attendance_id, employee_id, date, reason)
  VALUES (_attendance_id, attendance_row.employee_id, attendance_row.date, COALESCE(NULLIF(trim(_reason), ''), 'Working overtime'))
  ON CONFLICT (attendance_id, employee_id) DO UPDATE
    SET status = CASE
        WHEN public.attendance_overtime_requests.status = 'declined' THEN 'pending'
        ELSE public.attendance_overtime_requests.status
      END,
      reason = EXCLUDED.reason,
      requested_at = now(),
      reviewed_at = NULL,
      reviewed_by = NULL,
      response_notes = NULL,
      updated_at = now()
  RETURNING * INTO request_row;

  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_checkout_attendance(_attendance_id uuid, _checkout_at timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attendance_row record;
  checkout_time time;
  break_minutes integer;
  work_minutes integer;
  employee_email text;
  employee_name text;
BEGIN
  SELECT a.*, e.user_id, p.email, p.full_name
  INTO attendance_row
  FROM public.attendance a
  JOIN public.employees e ON e.id = a.employee_id
  JOIN public.profiles p ON p.id = e.user_id
  WHERE a.id = _attendance_id
  FOR UPDATE;

  IF attendance_row.id IS NULL OR attendance_row.check_out_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance_overtime_requests ot
    WHERE ot.attendance_id = _attendance_id
      AND ot.status IN ('pending', 'approved')
  ) THEN
    RETURN false;
  END IF;

  checkout_time := (_checkout_at AT TIME ZONE COALESCE(attendance_row.attendance_time_zone, 'UTC'))::time;
  break_minutes := COALESCE(attendance_row.break_total_minutes, 0);
  IF attendance_row.break_start_at IS NOT NULL THEN
    break_minutes := break_minutes + GREATEST(0, floor(EXTRACT(EPOCH FROM (_checkout_at - attendance_row.break_start_at)) / 60)::integer);
  END IF;
  work_minutes := GREATEST(0, floor(EXTRACT(EPOCH FROM (_checkout_at - attendance_row.check_in_at)) / 60)::integer - break_minutes);

  UPDATE public.attendance
  SET out_time = checkout_time,
      check_out_at = _checkout_at,
      check_out_local_time = to_char(_checkout_at AT TIME ZONE COALESCE(attendance_row.attendance_time_zone, 'UTC'), 'HH24:MI:SS'),
      check_out_uk_time = to_char(_checkout_at AT TIME ZONE 'Europe/London', 'HH24:MI:SS'),
      break_start_at = NULL,
      break_total_minutes = break_minutes,
      break_duration = (break_minutes || ' minutes')::interval,
      total_work_minutes = work_minutes,
      auto_checked_out_at = now(),
      notes = concat_ws(E'\n', NULLIF(attendance_row.notes, ''), 'Auto checked out after missed scheduled checkout. Total hours: ' || lpad((work_minutes / 60)::text, 2, '0') || ':' || lpad((work_minutes % 60)::text, 2, '0'))
  WHERE id = _attendance_id;

  INSERT INTO public.work_notifications (user_id, type, title, body, action_url, metadata)
  VALUES (
    attendance_row.user_id,
    'attendance_auto_checkout',
    'You were auto checked out',
    'You missed your scheduled checkout. Flow auto checked you out after the 15 minute grace period.',
    '/employee/attendance',
    jsonb_build_object('attendance_id', _attendance_id)
  );

  employee_email := attendance_row.email;
  employee_name := attendance_row.full_name;
  IF employee_email IS NOT NULL THEN
    INSERT INTO public.email_outbox (recipient_user_id, recipient_email, subject, body)
    VALUES (
      attendance_row.user_id,
      employee_email,
      'Flow attendance auto checkout',
      'Hi ' || COALESCE(employee_name, 'there') || E',\n\nYou missed your scheduled checkout. Flow auto checked you out after the 15 minute grace period.\n\nIf this was incorrect, please contact your Team Lead or Admin.'
    );
  END IF;

  UPDATE public.attendance
  SET auto_checkout_email_sent_at = now()
  WHERE id = _attendance_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_process_due_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attendance_row record;
  processed integer := 0;
BEGIN
  FOR attendance_row IN
    SELECT a.id, a.employee_id, a.expected_check_out_at, e.user_id
    FROM public.attendance a
    JOIN public.employees e ON e.id = a.employee_id
    WHERE a.check_in_at IS NOT NULL
      AND a.check_out_at IS NULL
      AND a.expected_check_out_at IS NOT NULL
      AND a.checkout_reminder_sent_at IS NULL
      AND now() >= a.expected_check_out_at - interval '15 minutes'
  LOOP
    INSERT INTO public.work_notifications (user_id, type, title, body, action_url, metadata)
    VALUES (
      attendance_row.user_id,
      'attendance_checkout_reminder',
      'Checkout reminder',
      'Your scheduled checkout is in about 15 minutes. Dismiss this or request overtime if you need to keep working.',
      '/employee/attendance',
      jsonb_build_object('attendance_id', attendance_row.id, 'expected_check_out_at', attendance_row.expected_check_out_at)
    );

    UPDATE public.attendance
    SET checkout_reminder_sent_at = now()
    WHERE id = attendance_row.id;

    processed := processed + 1;
  END LOOP;

  FOR attendance_row IN
    SELECT a.id, a.expected_check_out_at
    FROM public.attendance a
    WHERE a.check_in_at IS NOT NULL
      AND a.check_out_at IS NULL
      AND a.expected_check_out_at IS NOT NULL
      AND now() >= a.expected_check_out_at + interval '15 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM public.attendance_overtime_requests ot
        WHERE ot.attendance_id = a.id
          AND ot.status IN ('pending', 'approved')
      )
  LOOP
    IF public.auto_checkout_attendance(attendance_row.id, now()) THEN
      processed := processed + 1;
    END IF;
  END LOOP;

  RETURN processed;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_overtime_request_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_row record;
  reviewer uuid;
BEGIN
  SELECT e.employee_id, e.user_id, p.full_name
  INTO employee_row
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.id = NEW.employee_id;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'pending' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    FOR reviewer IN SELECT user_id FROM public.attendance_reviewer_user_ids(NEW.employee_id) LOOP
      IF reviewer IS NULL OR reviewer = employee_row.user_id THEN
        CONTINUE;
      END IF;
      INSERT INTO public.work_notifications (user_id, actor_id, type, title, body, action_url, metadata)
      VALUES (
        reviewer,
        employee_row.user_id,
        'overtime_request',
        'Overtime request',
        COALESCE(employee_row.full_name, employee_row.employee_id, 'An employee') || ' requested overtime approval.',
        '/admin/attendance',
        jsonb_build_object('overtime_request_id', NEW.id, 'attendance_id', NEW.attendance_id)
      );
    END LOOP;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'declined') THEN
    INSERT INTO public.work_notifications (user_id, actor_id, type, title, body, action_url, metadata)
    VALUES (
      employee_row.user_id,
      NEW.reviewed_by,
      CASE WHEN NEW.status = 'approved' THEN 'overtime_approved' ELSE 'overtime_declined' END,
      CASE WHEN NEW.status = 'approved' THEN 'Overtime approved' ELSE 'Overtime declined' END,
      CASE
        WHEN NEW.status = 'approved' THEN 'Your overtime request was approved. You can stay checked in and check out when finished.'
        ELSE 'Your overtime request was declined. Auto checkout will apply if you are past the grace period.'
      END,
      '/employee/attendance',
      jsonb_build_object('overtime_request_id', NEW.id, 'attendance_id', NEW.attendance_id, 'response_notes', NEW.response_notes)
    );

    IF NEW.status = 'declined' THEN
      PERFORM public.attendance_process_due_events();
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_overtime_request_notifications ON public.attendance_overtime_requests;
CREATE TRIGGER on_overtime_request_notifications
AFTER INSERT OR UPDATE OF status ON public.attendance_overtime_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_overtime_request_notifications();

DROP TRIGGER IF EXISTS update_attendance_overtime_requests_updated_at ON public.attendance_overtime_requests;
CREATE TRIGGER update_attendance_overtime_requests_updated_at
BEFORE UPDATE ON public.attendance_overtime_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_early_checkout_response_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'declined') THEN
    SELECT user_id INTO target_user
    FROM public.employees
    WHERE id = NEW.employee_id;

    INSERT INTO public.work_notifications (user_id, actor_id, type, title, body, action_url, metadata)
    VALUES (
      target_user,
      NEW.reviewed_by,
      'early_checkout_response',
      CASE WHEN NEW.status = 'approved' THEN 'Early check-out approved' ELSE 'Early check-out declined' END,
      COALESCE(NEW.response_notes, CASE WHEN NEW.status = 'approved' THEN 'Your early check-out request was approved.' ELSE 'Your early check-out request was declined.' END),
      '/employee/attendance',
      jsonb_build_object('early_checkout_request_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_early_checkout_response_notification ON public.early_checkout_requests;
CREATE TRIGGER on_early_checkout_response_notification
AFTER UPDATE OF status ON public.early_checkout_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_early_checkout_response_notification();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_overtime_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-due-events') THEN
      PERFORM cron.schedule(
        'attendance-due-events',
        '* * * * *',
        'select public.attendance_process_due_events();'
      );
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_function OR undefined_table THEN NULL;
END $$;
