-- FlowMath Attendance-Based Payroll Enhancement
-- Adds late tracking, scheduled times, and attendance-based deductions to payroll

-- =============================================
-- 1. Add attendance tracking columns
-- =============================================
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduled_start_time TIME,
ADD COLUMN IF NOT EXISTS scheduled_end_time TIME;

CREATE INDEX IF NOT EXISTS idx_attendance_is_late ON public.attendance(employee_id, is_late, date);

-- =============================================
-- 1b. Update status check constraint to allow 'late_day'
-- =============================================
ALTER TABLE public.attendance
DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance
ADD CONSTRAINT attendance_status_check
CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'late_day'));

-- =============================================
-- 2. Add payroll item columns for attendance penalties
-- =============================================
ALTER TABLE public.flowmath_payroll_items
ADD COLUMN IF NOT EXISTS late_days INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS half_days INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS absent_equivalents NUMERIC(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS attendance_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS attendance_details JSONB DEFAULT '{}'::jsonb;

-- =============================================
-- 3. Helper: get employee scheduled check-in time
-- =============================================
CREATE OR REPLACE FUNCTION public.get_employee_checkin_time(_employee_id UUID, _date DATE)
RETURNS TIME
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_row RECORD;
  template_row RECORD;
  office_start TIME;
  day_name TEXT;
BEGIN
  SELECT id, office_id, duty_schedule_template_id, custom_work_start_time
  INTO employee_row
  FROM public.employees
  WHERE id = _employee_id;

  IF employee_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF employee_row.custom_work_start_time IS NOT NULL THEN
    RETURN employee_row.custom_work_start_time;
  END IF;

  day_name := lower(to_char(_date, 'FMDay'));

  IF employee_row.duty_schedule_template_id IS NOT NULL THEN
    SELECT start_time, work_days
    INTO template_row
    FROM public.duty_schedule_templates
    WHERE id = employee_row.duty_schedule_template_id
      AND is_active = true;

    IF template_row.start_time IS NOT NULL
      AND (
        template_row.work_days IS NULL
        OR lower(day_name) = ANY(SELECT lower(unnest(template_row.work_days)))
      )
    THEN
      RETURN template_row.start_time;
    END IF;
  END IF;

  SELECT work_start_time
  INTO office_start
  FROM public.office_settings
  WHERE office_id = employee_row.office_id;

  RETURN COALESCE(office_start, '09:00:00'::time);
END;
$$;

-- =============================================
-- 4. Helper: get employee scheduled check-out time (existing enhanced)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_employee_checkout_time(_employee_id UUID, _date DATE)
RETURNS TIME
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_row RECORD;
  template_row RECORD;
  office_end TIME;
  day_name TEXT;
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

  RETURN COALESCE(office_end, '17:00:00'::time);
END;
$$;

-- =============================================
-- 5. Evaluate attendance status and lateness
--    Returns: present, late_day, half_day, absent, leave
--    Rules:
--      - Present: total_work_minutes >= 450 (7.5h)
--      - Late day: total_work_minutes >= 360 (6h) AND < 450 (7.5h)
--      - Half day: total_work_minutes >= 240 (4h) AND < 360 (6h)
--      - Absent: total_work_minutes < 240 (4h) OR no check-in
--      - is_late: checked in after scheduled_start + 15 min grace
--      - Grace period: 15 minutes for check-in and check-out
-- =============================================
CREATE OR REPLACE FUNCTION public.evaluate_attendance_status(
  _employee_id UUID,
  _date DATE,
  _in_time TIME,
  _out_time TIME,
  _total_work_minutes INTEGER,
  _break_total_minutes INTEGER DEFAULT 0
)
RETURNS TABLE (
  evaluated_status TEXT,
  evaluated_is_late BOOLEAN,
  evaluated_late_minutes INTEGER,
  evaluated_scheduled_start TIME,
  evaluated_scheduled_end TIME
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sched_start TIME;
  sched_end TIME;
  grace_minutes INTEGER := 15;
  is_late_flag BOOLEAN := false;
  late_mins INTEGER := 0;
  effective_work_minutes INTEGER;
  status_result TEXT;
BEGIN
  sched_start := public.get_employee_checkin_time(_employee_id, _date);
  sched_end := public.get_employee_checkout_time(_employee_id, _date);

  effective_work_minutes := COALESCE(_total_work_minutes, 0);

  -- If no check-in, mark absent
  IF _in_time IS NULL THEN
    RETURN QUERY SELECT 'absent'::text, false::boolean, 0::integer, sched_start, sched_end;
    RETURN;
  END IF;

  -- Determine lateness based on check-in vs scheduled start + grace
  IF sched_start IS NOT NULL THEN
    IF _in_time > sched_start + (grace_minutes || ' minutes')::interval THEN
      is_late_flag := true;
      late_mins := EXTRACT(EPOCH FROM (_in_time - sched_start))::integer / 60;
    END IF;
  END IF;

  -- Also consider early departure as lateness if work minutes are below threshold
  IF sched_end IS NOT NULL AND _out_time IS NOT NULL THEN
    IF _out_time < sched_end - (grace_minutes || ' minutes')::interval THEN
      -- Early departure: mark as late if not already, add to late minutes
      IF NOT is_late_flag THEN
        is_late_flag := true;
      END IF;
      late_mins := GREATEST(late_mins, EXTRACT(EPOCH FROM (sched_end - _out_time))::integer / 60);
    END IF;
  END IF;

  -- Classify based on total work minutes
  IF effective_work_minutes >= 450 THEN
    status_result := 'present';
  ELSIF effective_work_minutes >= 360 THEN
    status_result := 'late_day';
  ELSIF effective_work_minutes >= 240 THEN
    status_result := 'half_day';
  ELSE
    status_result := 'absent';
  END IF;

  -- If status is present but they were late, downgrade to late_day
  IF status_result = 'present' AND is_late_flag THEN
    status_result := 'late_day';
  END IF;

  RETURN QUERY SELECT status_result, is_late_flag, late_mins, sched_start, sched_end;
END;
$$;

-- =============================================
-- 6. Trigger to auto-evaluate attendance on insert/update
-- =============================================
CREATE OR REPLACE FUNCTION public.attendance_auto_evaluate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eval_result RECORD;
BEGIN
  -- Only evaluate when check-in exists and record is being finalized (has out_time or checkout)
  IF NEW.in_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if already manually set to leave
  IF NEW.status = 'leave' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO eval_result
  FROM public.evaluate_attendance_status(
    NEW.employee_id,
    NEW.date,
    NEW.in_time,
    NEW.out_time,
    NEW.total_work_minutes,
    NEW.break_total_minutes
  );

  NEW.status := eval_result.evaluated_status;
  NEW.is_late := eval_result.evaluated_is_late;
  NEW.late_minutes := eval_result.evaluated_late_minutes;
  NEW.scheduled_start_time := eval_result.evaluated_scheduled_start;
  NEW.scheduled_end_time := eval_result.evaluated_scheduled_end;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_auto_evaluate_trigger ON public.attendance;
CREATE TRIGGER attendance_auto_evaluate_trigger
  BEFORE INSERT OR UPDATE OF in_time, out_time, check_in_at, check_out_at, total_work_minutes, break_total_minutes, status
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_auto_evaluate();

-- =============================================
-- 7. Backfill existing attendance records
-- =============================================
DO $$
DECLARE
  att_record RECORD;
  eval_result RECORD;
BEGIN
  FOR att_record IN
    SELECT id, employee_id, date, in_time, out_time, total_work_minutes, break_total_minutes, status
    FROM public.attendance
    WHERE in_time IS NOT NULL
      AND status <> 'leave'
  LOOP
    SELECT * INTO eval_result
    FROM public.evaluate_attendance_status(
      att_record.employee_id,
      att_record.date,
      att_record.in_time,
      att_record.out_time,
      att_record.total_work_minutes,
      att_record.break_total_minutes
    );

    UPDATE public.attendance
    SET status = eval_result.evaluated_status,
        is_late = eval_result.evaluated_is_late,
        late_minutes = eval_result.evaluated_late_minutes,
        scheduled_start_time = eval_result.evaluated_scheduled_start,
        scheduled_end_time = eval_result.evaluated_scheduled_end
    WHERE id = att_record.id;
  END LOOP;
END $$;

-- =============================================
-- 8. Count working days in a period (excluding weekends)
-- =============================================
CREATE OR REPLACE FUNCTION public.count_working_days(_period_start DATE, _period_end DATE)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM generate_series(_period_start, _period_end, '1 day'::interval) AS d
  WHERE extract(dow from d::date) NOT IN (0, 6)
$$;

-- =============================================
-- 9. Updated payroll run creation with attendance-based deductions
-- =============================================
CREATE OR REPLACE FUNCTION public.create_flowmath_payroll_run(_period_start DATE, _period_end DATE)
RETURNS public.flowmath_payroll_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.flowmath_payroll_runs;
  emp_row RECORD;
  working_days INTEGER;
  per_day_salary NUMERIC(14,2);
  present_count INTEGER;
  late_count INTEGER;
  half_count INTEGER;
  absent_count INTEGER;
  leave_count INTEGER;
  absent_equivalents NUMERIC(14,2);
  attendance_deduction NUMERIC(14,2);
  net_calc NUMERIC(14,2);
  existing_run public.flowmath_payroll_runs;
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to create payroll runs';
  END IF;

  -- Check for duplicate period
  SELECT * INTO existing_run
  FROM public.flowmath_payroll_runs
  WHERE period_start = _period_start AND period_end = _period_end;

  IF existing_run.id IS NOT NULL THEN
    RAISE EXCEPTION 'A payroll run already exists for the period % to % (run: %). Delete the existing run first or choose a different period.', _period_start, _period_end, existing_run.run_no;
  END IF;

  working_days := public.count_working_days(_period_start, _period_end);
  IF working_days <= 0 THEN
    working_days := 1;
  END IF;

  INSERT INTO public.flowmath_payroll_runs (run_no, period_start, period_end, created_by)
  VALUES (public.flowmath_next_number('PR'), _period_start, _period_end, auth.uid())
  RETURNING * INTO run_row;

  FOR emp_row IN
    SELECT
      e.id AS employee_id,
      s.id AS salary_id,
      COALESCE(s.amount, 0) AS amount
    FROM public.employees e
    LEFT JOIN public.salaries s ON s.employee_id = e.id AND s.is_current = true
    GROUP BY e.id, s.id, s.amount
    HAVING COALESCE(s.amount, 0) > 0
  LOOP
    -- Count attendance categories
    SELECT
      COALESCE(count(*) FILTER (WHERE a.status = 'present'), 0)::integer,
      COALESCE(count(*) FILTER (WHERE a.status = 'late_day'), 0)::integer,
      COALESCE(count(*) FILTER (WHERE a.status = 'half_day'), 0)::integer,
      COALESCE(count(*) FILTER (WHERE a.status = 'absent'), 0)::integer,
      COALESCE(count(*) FILTER (WHERE a.status = 'leave'), 0)::integer
    INTO present_count, late_count, half_count, absent_count, leave_count
    FROM public.attendance a
    WHERE a.employee_id = emp_row.employee_id
      AND a.date BETWEEN _period_start AND _period_end;

    -- Calculate absent equivalents
    -- 3 late days = 1 absent, 2 half days = 1 absent
    absent_equivalents := absent_count
      + FLOOR(late_count::numeric / 3)
      + FLOOR(half_count::numeric / 2);

    -- Per-day salary and attendance deduction
    per_day_salary := emp_row.amount / working_days;
    attendance_deduction := per_day_salary * absent_equivalents;
    net_calc := emp_row.amount - attendance_deduction;

    IF net_calc < 0 THEN
      net_calc := 0;
    END IF;

    INSERT INTO public.flowmath_payroll_items (
      payroll_run_id,
      employee_id,
      salary_id,
      base_salary,
      net_salary,
      present_days,
      absent_days,
      leave_days,
      late_days,
      half_days,
      absent_equivalents,
      attendance_deduction,
      total_work_minutes,
      attendance_details
    )
    VALUES (
      run_row.id,
      emp_row.employee_id,
      emp_row.salary_id,
      emp_row.amount,
      net_calc,
      present_count,
      absent_count,
      leave_count,
      late_count,
      half_count,
      absent_equivalents,
      attendance_deduction,
      COALESCE((SELECT sum(total_work_minutes) FROM public.attendance WHERE employee_id = emp_row.employee_id AND date BETWEEN _period_start AND _period_end), 0)::integer,
      jsonb_build_object(
        'period_days', working_days,
        'per_day_salary', round(per_day_salary, 2),
        'penalty_rules', '3 late days = 1 absent, 2 half days = 1 absent'
      )
    );
  END LOOP;

  -- Update run totals
  UPDATE public.flowmath_payroll_runs r
  SET gross_amount = totals.gross_amount,
      allowance_amount = totals.allowance_amount,
      deduction_amount = totals.deduction_amount,
      net_amount = totals.net_amount,
      updated_at = now()
  FROM (
    SELECT
      i.payroll_run_id,
      COALESCE(sum(i.base_salary), 0) AS gross_amount,
      COALESCE(sum(i.allowances), 0) AS allowance_amount,
      COALESCE(sum(i.deductions + i.attendance_deduction), 0) AS deduction_amount,
      COALESCE(sum(i.net_salary), 0) AS net_amount
    FROM public.flowmath_payroll_items i
    WHERE i.payroll_run_id = run_row.id
    GROUP BY i.payroll_run_id
  ) totals
  WHERE r.id = totals.payroll_run_id
  RETURNING r.* INTO run_row;

  RETURN run_row;
END;
$$;

-- =============================================
-- 10. Updated refresh totals to include attendance_deduction
-- =============================================
CREATE OR REPLACE FUNCTION public.refresh_flowmath_payroll_totals(_payroll_run_id UUID)
RETURNS public.flowmath_payroll_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.flowmath_payroll_runs;
BEGIN
  UPDATE public.flowmath_payroll_items
  SET net_salary = base_salary + allowances - deductions - attendance_deduction,
      updated_at = now()
  WHERE payroll_run_id = _payroll_run_id;

  UPDATE public.flowmath_payroll_runs r
  SET gross_amount = COALESCE(t.gross_amount, 0),
      allowance_amount = COALESCE(t.allowance_amount, 0),
      deduction_amount = COALESCE(t.deduction_amount, 0),
      net_amount = COALESCE(t.net_amount, 0),
      updated_at = now()
  FROM (
    SELECT
      i.payroll_run_id,
      sum(i.base_salary) AS gross_amount,
      sum(i.allowances) AS allowance_amount,
      sum(i.deductions + i.attendance_deduction) AS deduction_amount,
      sum(i.net_salary) AS net_amount
    FROM public.flowmath_payroll_items i
    WHERE i.payroll_run_id = _payroll_run_id
    GROUP BY i.payroll_run_id
  ) t
  WHERE r.id = t.payroll_run_id
  RETURNING r.* INTO run_row;

  RETURN run_row;
END;
$$;

-- =============================================
-- 10b. Delete payroll run (draft or void only)
-- =============================================
CREATE OR REPLACE FUNCTION public.delete_flowmath_payroll_run(_payroll_run_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.flowmath_payroll_runs;
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to delete payroll runs';
  END IF;

  SELECT * INTO run_row
  FROM public.flowmath_payroll_runs
  WHERE id = _payroll_run_id;

  IF run_row.id IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;

  IF run_row.status NOT IN ('draft', 'void') THEN
    RAISE EXCEPTION 'Only draft or void payroll runs can be deleted. Current status: %', run_row.status;
  END IF;

  DELETE FROM public.flowmath_payroll_items WHERE payroll_run_id = _payroll_run_id;
  DELETE FROM public.flowmath_payroll_runs WHERE id = _payroll_run_id;

  RETURN true;
END;
$$;

-- =============================================
-- 11. Updated auto-checkout to populate new fields
-- =============================================
CREATE OR REPLACE FUNCTION public.auto_checkout_attendance(_attendance_id UUID, _checkout_at TIMESTAMPTZ DEFAULT now())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attendance_row RECORD;
  attendance_zone TEXT;
  checkout_time TIME;
  break_minutes INTEGER;
  work_minutes INTEGER;
  employee_email TEXT;
  employee_name TEXT;
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
  work_minutes := GREATEST(0, floor(EXTRACT(EPOCH FROM (_checkout_at - attendance_row.check_in_at)) / 60)::integer - break_minutes);

  UPDATE public.attendance
  SET out_time = checkout_time,
      check_out_at = _checkout_at,
      attendance_time_zone_name = COALESCE(attendance_row.attendance_time_zone_name, 'Pakistan Time'),
      attendance_time_zone = COALESCE(attendance_row.attendance_time_zone, 'Asia/Karachi'),
      check_out_local_time = to_char(_checkout_at AT TIME ZONE attendance_zone, 'HH24:MI:SS'),
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

-- =============================================
-- 12. Update manual checkout handler to also evaluate attendance
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_checkout_attendance_evaluation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eval_result RECORD;
BEGIN
  IF NEW.out_time IS NULL OR OLD.out_time IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'leave' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO eval_result
  FROM public.evaluate_attendance_status(
    NEW.employee_id,
    NEW.date,
    NEW.in_time,
    NEW.out_time,
    NEW.total_work_minutes,
    NEW.break_total_minutes
  );

  NEW.status := eval_result.evaluated_status;
  NEW.is_late := eval_result.evaluated_is_late;
  NEW.late_minutes := eval_result.evaluated_late_minutes;
  NEW.scheduled_start_time := eval_result.evaluated_scheduled_start;
  NEW.scheduled_end_time := eval_result.evaluated_scheduled_end;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_checkout_evaluate ON public.attendance;
CREATE TRIGGER attendance_checkout_evaluate
  BEFORE UPDATE OF out_time, check_out_at ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_checkout_attendance_evaluation();

-- =============================================
-- 13. Enable RLS and policies for any new implied tables (already covered by existing policies)
-- =============================================
-- No new tables; existing RLS policies cover the added columns

-- =============================================
-- 14. Add comments for documentation
-- =============================================
COMMENT ON COLUMN public.attendance.is_late IS 'Whether employee was late beyond 15-minute grace period or left early';
COMMENT ON COLUMN public.attendance.late_minutes IS 'Total late minutes (late arrival + early departure)';
COMMENT ON COLUMN public.attendance.scheduled_start_time IS 'Scheduled check-in time for this date';
COMMENT ON COLUMN public.attendance.scheduled_end_time IS 'Scheduled check-out time for this date';
COMMENT ON COLUMN public.flowmath_payroll_items.late_days IS 'Number of late days in the payroll period';
COMMENT ON COLUMN public.flowmath_payroll_items.half_days IS 'Number of half days in the payroll period';
COMMENT ON COLUMN public.flowmath_payroll_items.absent_equivalents IS 'Total absent equivalents: absents + floor(late_days/3) + floor(half_days/2)';
COMMENT ON COLUMN public.flowmath_payroll_items.attendance_deduction IS 'Salary deduction calculated from absent equivalents';
COMMENT ON COLUMN public.flowmath_payroll_items.attendance_details IS 'JSONB with per-day breakdown and penalty rules applied';
