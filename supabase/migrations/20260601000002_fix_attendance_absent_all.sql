-- Fix: attendance records incorrectly marked as absent
-- Issue: the auto-evaluate trigger marked all open check-ins and historical
-- records without total_work_minutes as absent because COALESCE(NULL,0)=0.

-- =============================================
-- 1. Fix auto-evaluate trigger to skip open records
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
  -- Only evaluate when check-in exists
  IF NEW.in_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if manually set to leave
  IF NEW.status = 'leave' THEN
    RETURN NEW;
  END IF;

  -- Skip evaluation for records that are still open and have no work minutes yet.
  -- When an employee checks in, total_work_minutes is NULL. We should NOT
  -- downgrade them to absent until they check out and we can compute real hours.
  IF NEW.out_time IS NULL AND (NEW.total_work_minutes IS NULL OR NEW.total_work_minutes = 0) THEN
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

-- =============================================
-- 2. Recovery: fix records already damaged
-- =============================================
DO $$
DECLARE
  att_record RECORD;
  eval_result RECORD;
  checkin_time TIME;
  checkout_time TIME;
BEGIN
  -- 2a. Currently open records (checked in, not out): set back to present
  FOR att_record IN
    SELECT id, employee_id, date
    FROM public.attendance
    WHERE status = 'absent'
      AND in_time IS NOT NULL
      AND out_time IS NULL
      AND (total_work_minutes IS NULL OR total_work_minutes = 0)
  LOOP
    checkin_time := public.get_employee_checkin_time(att_record.employee_id, att_record.date);
    checkout_time := public.get_employee_checkout_time(att_record.employee_id, att_record.date);

    UPDATE public.attendance
    SET status = 'present',
        is_late = false,
        late_minutes = 0,
        scheduled_start_time = checkin_time,
        scheduled_end_time = checkout_time
    WHERE id = att_record.id;
  END LOOP;

  -- 2b. Records with work minutes already populated but incorrectly marked absent:
  --     re-evaluate properly (they will stay absent only if genuinely < 4 hours)
  FOR att_record IN
    SELECT id, employee_id, date, in_time, out_time, total_work_minutes, break_total_minutes
    FROM public.attendance
    WHERE status = 'absent'
      AND in_time IS NOT NULL
      AND total_work_minutes IS NOT NULL
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
-- 3. Improve evaluate_attendance_status to handle missing total_work_minutes
--    by approximating from in_time/out_time for historical records
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
  in_minutes INTEGER;
  out_minutes INTEGER;
BEGIN
  sched_start := public.get_employee_checkin_time(_employee_id, _date);
  sched_end := public.get_employee_checkout_time(_employee_id, _date);

  -- Determine effective work minutes
  IF _total_work_minutes IS NOT NULL AND _total_work_minutes > 0 THEN
    effective_work_minutes := _total_work_minutes;
  ELSIF _in_time IS NOT NULL AND _out_time IS NOT NULL THEN
    -- Approximate from in_time / out_time when total_work_minutes is missing
    in_minutes := EXTRACT(HOUR FROM _in_time)::integer * 60 + EXTRACT(MINUTE FROM _in_time)::integer;
    out_minutes := EXTRACT(HOUR FROM _out_time)::integer * 60 + EXTRACT(MINUTE FROM _out_time)::integer;
    IF out_minutes >= in_minutes THEN
      effective_work_minutes := GREATEST(0, out_minutes - in_minutes - COALESCE(_break_total_minutes, 0));
    ELSE
      -- Shift crossed midnight, assume full day
      effective_work_minutes := GREATEST(0, (1440 - in_minutes) + out_minutes - COALESCE(_break_total_minutes, 0));
    END IF;
  ELSE
    effective_work_minutes := 0;
  END IF;

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

  -- Also consider early departure as lateness
  IF sched_end IS NOT NULL AND _out_time IS NOT NULL THEN
    IF _out_time < sched_end - (grace_minutes || ' minutes')::interval THEN
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
-- 4. Re-backfill any historical records that still need scheduled times
-- =============================================
DO $$
DECLARE
  att_record RECORD;
  checkin_time TIME;
  checkout_time TIME;
BEGIN
  FOR att_record IN
    SELECT id, employee_id, date
    FROM public.attendance
    WHERE scheduled_start_time IS NULL
      OR scheduled_end_time IS NULL
  LOOP
    checkin_time := public.get_employee_checkin_time(att_record.employee_id, att_record.date);
    checkout_time := public.get_employee_checkout_time(att_record.employee_id, att_record.date);

    UPDATE public.attendance
    SET scheduled_start_time = COALESCE(scheduled_start_time, checkin_time),
        scheduled_end_time = COALESCE(scheduled_end_time, checkout_time)
    WHERE id = att_record.id;
  END LOOP;
END $$;
