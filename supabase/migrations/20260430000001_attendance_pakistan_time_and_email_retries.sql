-- Keep attendance records anchored to Pakistan Standard Time while preserving UK
-- snapshots for reporting.

UPDATE public.attendance_time_zones
SET is_active = true
WHERE time_zone = 'Asia/Karachi';

ALTER TABLE public.office_settings
ALTER COLUMN break_duration SET DEFAULT '45 minutes'::interval;

UPDATE public.office_settings
SET break_duration = '45 minutes'::interval
WHERE break_duration IS NULL
   OR break_duration = '01:00:00'::interval;

ALTER TABLE public.duty_schedule_templates
ADD COLUMN IF NOT EXISTS break_duration interval DEFAULT '45 minutes'::interval;

INSERT INTO public.attendance_time_zones (name, time_zone, is_active)
VALUES ('Pakistan Time', 'Asia/Karachi', true)
ON CONFLICT (name) DO UPDATE
SET time_zone = EXCLUDED.time_zone,
    is_active = true,
    updated_at = now();

UPDATE public.attendance
SET attendance_time_zone_name = COALESCE(attendance_time_zone_name, 'Pakistan Time'),
    attendance_time_zone = COALESCE(attendance_time_zone, 'Asia/Karachi')
WHERE attendance_time_zone IS NULL;

CREATE OR REPLACE FUNCTION public.get_employee_break_minutes(_employee_id uuid, _date date)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_row record;
  template_row record;
  office_break interval;
  day_name text;
BEGIN
  SELECT id, office_id, duty_schedule_template_id
  INTO employee_row
  FROM public.employees
  WHERE id = _employee_id;

  IF employee_row.id IS NULL THEN
    RETURN 45;
  END IF;

  day_name := lower(to_char(_date, 'FMDay'));

  IF employee_row.duty_schedule_template_id IS NOT NULL THEN
    SELECT break_duration, work_days
    INTO template_row
    FROM public.duty_schedule_templates
    WHERE id = employee_row.duty_schedule_template_id
      AND is_active = true;

    IF template_row.break_duration IS NOT NULL
      AND (
        template_row.work_days IS NULL
        OR lower(day_name) = ANY(SELECT lower(unnest(template_row.work_days)))
      )
    THEN
      RETURN GREATEST(0, floor(EXTRACT(EPOCH FROM template_row.break_duration) / 60)::integer);
    END IF;
  END IF;

  SELECT break_duration
  INTO office_break
  FROM public.office_settings
  WHERE office_id = employee_row.office_id;

  RETURN COALESCE(GREATEST(0, floor(EXTRACT(EPOCH FROM office_break) / 60)::integer), 45);
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

  attendance_zone := 'Asia/Karachi';
  expected_local := NEW.date::timestamp + checkout_time;

  IF NEW.in_time IS NOT NULL AND checkout_time <= NEW.in_time THEN
    expected_local := expected_local + interval '1 day';
  END IF;

  NEW.expected_check_out_at := expected_local AT TIME ZONE attendance_zone;
  RETURN NEW;
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
  attendance_zone text;
  checkout_time time;
  break_minutes integer;
  sop_break_minutes integer;
  billable_break_minutes integer;
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

  attendance_zone := COALESCE(NULLIF(attendance_row.attendance_time_zone, ''), 'Asia/Karachi');
  checkout_time := (_checkout_at AT TIME ZONE 'Asia/Karachi')::time;
  break_minutes := COALESCE(attendance_row.break_total_minutes, 0);
  sop_break_minutes := public.get_employee_break_minutes(attendance_row.employee_id, attendance_row.date);

  IF attendance_row.break_start_at IS NOT NULL THEN
    break_minutes := break_minutes + GREATEST(0, floor(EXTRACT(EPOCH FROM (_checkout_at - attendance_row.break_start_at)) / 60)::integer);
  END IF;

  billable_break_minutes := GREATEST(break_minutes, sop_break_minutes);
  work_minutes := GREATEST(0, floor(EXTRACT(EPOCH FROM (_checkout_at - attendance_row.check_in_at)) / 60)::integer - billable_break_minutes);

  UPDATE public.attendance
  SET out_time = checkout_time,
      check_out_at = _checkout_at,
      attendance_time_zone_name = COALESCE(attendance_row.attendance_time_zone_name, 'Pakistan Time'),
      attendance_time_zone = COALESCE(attendance_row.attendance_time_zone, 'Asia/Karachi'),
      check_out_local_time = to_char(_checkout_at AT TIME ZONE attendance_zone, 'HH24:MI:SS'),
      check_out_uk_time = to_char(_checkout_at AT TIME ZONE 'Europe/London', 'HH24:MI:SS'),
      break_start_at = NULL,
      break_total_minutes = billable_break_minutes,
      break_duration = (billable_break_minutes || ' minutes')::interval,
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

  employee_email := NULLIF(attendance_row.email, '');
  employee_name := attendance_row.full_name;
  IF employee_email IS NOT NULL THEN
    INSERT INTO public.email_outbox (recipient_user_id, recipient_email, subject, body)
    VALUES (
      attendance_row.user_id,
      employee_email,
      'Flow attendance auto checkout',
      'Hi ' || COALESCE(employee_name, 'there') || E',\n\nYou missed your scheduled checkout. Flow auto checked you out after the 15 minute grace period.\n\nIf this was incorrect, please contact your Team Lead or Admin.'
    );

    UPDATE public.attendance
    SET auto_checkout_email_sent_at = now()
    WHERE id = _attendance_id;
  END IF;

  RETURN true;
END;
$$;

UPDATE public.attendance
SET check_in_at = check_in_at
WHERE check_in_at IS NOT NULL
  AND check_out_at IS NULL;
