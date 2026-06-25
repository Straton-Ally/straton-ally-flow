CREATE OR REPLACE FUNCTION public.attendance_location_check_reason(
  _employee_id UUID,
  _verified_location JSONB,
  _verified_ip TEXT,
  _verified_at TIMESTAMPTZ,
  _is_update BOOLEAN,
  _previous_verified_at TIMESTAMPTZ
)
RETURNS TEXT
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
BEGIN
  SELECT e.id, e.user_id, e.office_id, e.work_location
  INTO employee_row
  FROM public.employees e
  WHERE e.id = _employee_id;

  IF NOT FOUND THEN
    RETURN 'employee record not found';
  END IF;

  IF employee_row.work_location = 'remote' THEN
    RETURN NULL;
  END IF;

  IF employee_row.office_id IS NULL THEN
    RETURN 'no office assigned';
  END IF;

  SELECT o.id, o.is_active
  INTO office_row
  FROM public.offices o
  WHERE o.id = employee_row.office_id;

  IF NOT FOUND THEN
    RETURN 'office not found';
  END IF;

  IF NOT office_row.is_active THEN
    RETURN 'office is inactive';
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
    RETURN NULL;
  END IF;

  require_ip := COALESCE(settings_row.require_ip_whitelist, false);
  require_geo := COALESCE(settings_row.geo_fencing_enabled, false);

  IF NOT require_ip AND NOT require_geo THEN
    RETURN NULL;
  END IF;

  IF _verified_at IS NULL THEN
    RETURN 'missing fresh verification timestamp';
  END IF;

  IF _verified_at < now() - interval '5 minutes' THEN
    RETURN 'verification is stale';
  END IF;

  IF _verified_at > now() + interval '2 minutes' THEN
    RETURN 'device time is ahead of server time';
  END IF;

  IF _is_update AND _verified_at IS NOT DISTINCT FROM _previous_verified_at THEN
    RETURN 'verification was not refreshed for this action';
  END IF;

  IF require_ip THEN
    effective_ip := COALESCE(public.request_ip_address(), NULLIF(_verified_ip, ''));
    IF NOT public.ip_matches_any_range(effective_ip, settings_row.allowed_ip_ranges) THEN
      RETURN 'current public IP is not in allowed office IP ranges';
    END IF;
  END IF;

  IF require_geo THEN
    IF settings_row.latitude IS NULL OR settings_row.longitude IS NULL THEN
      RETURN 'office geofence coordinates are not configured';
    END IF;

    BEGIN
      location_lat := (_verified_location ->> 'lat')::DOUBLE PRECISION;
      location_lng := (_verified_location ->> 'lng')::DOUBLE PRECISION;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN 'invalid geolocation payload';
    END;

    IF location_lat IS NULL OR location_lng IS NULL THEN
      RETURN 'missing geolocation payload';
    END IF;

    allowed_radius_meters := COALESCE(settings_row.radius_meters, 100);
    distance_meters := public.geo_distance_meters(
      location_lat,
      location_lng,
      settings_row.latitude::DOUBLE PRECISION,
      settings_row.longitude::DOUBLE PRECISION
    );

    IF distance_meters > allowed_radius_meters THEN
      RETURN format('outside office geofence: %s meters from office, allowed radius %s meters', round(distance_meters::NUMERIC), allowed_radius_meters);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendance_location_check_passes(
  _employee_id UUID,
  _verified_location JSONB,
  _verified_ip TEXT,
  _verified_at TIMESTAMPTZ,
  _is_update BOOLEAN,
  _previous_verified_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.attendance_location_check_reason(
    _employee_id,
    _verified_location,
    _verified_ip,
    _verified_at,
    _is_update,
    _previous_verified_at
  ) IS NULL;
$$;

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
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
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
