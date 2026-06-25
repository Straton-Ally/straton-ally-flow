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
  is_restricted BOOLEAN;
BEGIN
  SELECT e.id, e.user_id, e.office_id, e.work_location
  INTO employee_row
  FROM public.employees e
  WHERE e.id = _employee_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF employee_row.work_location = 'remote' THEN
    RETURN true;
  END IF;

  IF employee_row.office_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT o.id, o.is_active
  INTO office_row
  FROM public.offices o
  WHERE o.id = employee_row.office_id;

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

  is_restricted := COALESCE(settings_row.require_ip_whitelist, false) OR COALESCE(settings_row.geo_fencing_enabled, false);

  IF is_restricted THEN
    IF _verified_at IS NULL OR _verified_at < now() - interval '2 minutes' OR _verified_at > now() + interval '30 seconds' THEN
      RETURN false;
    END IF;

    IF _is_update AND _verified_at IS NOT DISTINCT FROM _previous_verified_at THEN
      RETURN false;
    END IF;
  END IF;

  IF COALESCE(settings_row.require_ip_whitelist, false) THEN
    effective_ip := COALESCE(public.request_ip_address(), NULLIF(_verified_ip, ''));
    IF NOT public.ip_matches_any_range(effective_ip, settings_row.allowed_ip_ranges) THEN
      RETURN false;
    END IF;
  END IF;

  IF COALESCE(settings_row.geo_fencing_enabled, false) THEN
    IF settings_row.latitude IS NULL OR settings_row.longitude IS NULL THEN
      RETURN false;
    END IF;

    BEGIN
      location_lat := (_verified_location ->> 'lat')::DOUBLE PRECISION;
      location_lng := (_verified_location ->> 'lng')::DOUBLE PRECISION;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN false;
    END;

    IF location_lat IS NULL OR location_lng IS NULL THEN
      RETURN false;
    END IF;

    allowed_radius_meters := COALESCE(settings_row.radius_meters, 100);
    distance_meters := public.geo_distance_meters(
      location_lat,
      location_lng,
      settings_row.latitude::DOUBLE PRECISION,
      settings_row.longitude::DOUBLE PRECISION
    );

    IF distance_meters > allowed_radius_meters THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;
