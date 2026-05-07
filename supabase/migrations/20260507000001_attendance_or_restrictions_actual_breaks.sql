CREATE OR REPLACE FUNCTION public.attendance_location_check_passes(
  _employee_id UUID,
  _verified_location JSONB,
  _verified_ip TEXT,
  _verified_at TIMESTAMPTZ,
  _is_update BOOLEAN,
  _previous_verified_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_row RECORD;
  office_row RECORD;
  settings_row RECORD;
  effective_ip TEXT;
  location_lat DOUBLE PRECISION;
  location_lng DOUBLE PRECISION;
  allowed_radius_meters INTEGER;
  distance_meters DOUBLE PRECISION;
  require_ip BOOLEAN;
  require_geo BOOLEAN;
  ip_passes BOOLEAN := false;
  geo_passes BOOLEAN := false;
BEGIN
  SELECT id, user_id, office_id, work_location
  INTO employee_row
  FROM public.employees
  WHERE id = _employee_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF employee_row.work_location = 'remote' THEN
    RETURN true;
  END IF;

  IF employee_row.office_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, is_active
  INTO office_row
  FROM public.offices
  WHERE id = employee_row.office_id;

  IF NOT FOUND OR NOT office_row.is_active THEN
    RETURN false;
  END IF;

  SELECT
    os.allowed_ip_ranges,
    os.require_ip_whitelist,
    os.geo_fencing_enabled,
    os.latitude,
    os.longitude,
    os.radius_meters
  INTO settings_row
  FROM public.office_settings os
  WHERE os.office_id = employee_row.office_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  require_ip := COALESCE(settings_row.require_ip_whitelist, false);
  require_geo := COALESCE(settings_row.geo_fencing_enabled, false);

  IF NOT require_ip AND NOT require_geo THEN
    RETURN true;
  END IF;

  IF _verified_at IS NULL OR _verified_at < now() - interval '2 minutes' OR _verified_at > now() + interval '30 seconds' THEN
    RETURN false;
  END IF;

  IF _is_update AND _verified_at IS NOT DISTINCT FROM _previous_verified_at THEN
    RETURN false;
  END IF;

  IF require_ip THEN
    effective_ip := COALESCE(public.request_ip_address(), NULLIF(_verified_ip, ''));
    ip_passes := public.ip_matches_any_range(effective_ip, settings_row.allowed_ip_ranges);
  END IF;

  IF require_geo THEN
    IF settings_row.latitude IS NOT NULL AND settings_row.longitude IS NOT NULL THEN
      BEGIN
        location_lat := (_verified_location ->> 'lat')::DOUBLE PRECISION;
        location_lng := (_verified_location ->> 'lng')::DOUBLE PRECISION;
      EXCEPTION
        WHEN OTHERS THEN
          location_lat := NULL;
          location_lng := NULL;
      END;

      IF location_lat IS NOT NULL AND location_lng IS NOT NULL THEN
        allowed_radius_meters := COALESCE(settings_row.radius_meters, 100);
        distance_meters := public.geo_distance_meters(
          location_lat,
          location_lng,
          settings_row.latitude::DOUBLE PRECISION,
          settings_row.longitude::DOUBLE PRECISION
        );
        geo_passes := distance_meters <= allowed_radius_meters;
      END IF;
    END IF;
  END IF;

  IF require_ip AND require_geo THEN
    RETURN ip_passes OR geo_passes;
  END IF;

  RETURN (require_ip AND ip_passes) OR (require_geo AND geo_passes);
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
