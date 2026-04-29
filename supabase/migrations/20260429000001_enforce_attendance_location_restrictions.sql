ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_verified_ip TEXT,
ADD COLUMN IF NOT EXISTS last_verified_location JSONB;

CREATE OR REPLACE FUNCTION public.request_ip_address()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  headers JSONB;
  forwarded_for TEXT;
  header_ip TEXT;
BEGIN
  headers := COALESCE(NULLIF(current_setting('request.headers', true), '')::JSONB, '{}'::JSONB);
  forwarded_for := headers ->> 'x-forwarded-for';
  header_ip := COALESCE(
    headers ->> 'cf-connecting-ip',
    headers ->> 'x-real-ip',
    CASE
      WHEN forwarded_for IS NULL THEN NULL
      ELSE btrim(split_part(forwarded_for, ',', 1))
    END
  );

  RETURN NULLIF(header_ip, '');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ip_matches_any_range(_ip TEXT, _ranges TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  range_text TEXT;
BEGIN
  IF _ip IS NULL OR _ranges IS NULL OR array_length(_ranges, 1) IS NULL THEN
    RETURN false;
  END IF;

  FOREACH range_text IN ARRAY _ranges LOOP
    BEGIN
      IF _ip::INET <<= range_text::CIDR THEN
        RETURN true;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        CONTINUE;
    END;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.geo_distance_meters(_lat1 DOUBLE PRECISION, _lng1 DOUBLE PRECISION, _lat2 DOUBLE PRECISION, _lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((_lat2 - _lat1) / 2)), 2)
      + cos(radians(_lat1)) * cos(radians(_lat2)) * power(sin(radians((_lng2 - _lng1) / 2)), 2)
    )
  );
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
  radius_meters INTEGER;
  distance_meters DOUBLE PRECISION;
  is_restricted BOOLEAN;
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

  SELECT allowed_ip_ranges, require_ip_whitelist, geo_fencing_enabled, latitude, longitude, radius_meters
  INTO settings_row
  FROM public.office_settings
  WHERE office_id = employee_row.office_id;

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

    radius_meters := COALESCE(settings_row.radius_meters, 100);
    distance_meters := public.geo_distance_meters(location_lat, location_lng, settings_row.latitude::DOUBLE PRECISION, settings_row.longitude::DOUBLE PRECISION);

    IF distance_meters > radius_meters THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_attendance_location_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_update BOOLEAN;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  is_update := TG_OP = 'UPDATE';

  IF NOT public.attendance_location_check_passes(
    NEW.employee_id,
    NEW.last_verified_location,
    NEW.last_verified_ip,
    NEW.last_verified_at,
    is_update,
    CASE WHEN is_update THEN OLD.last_verified_at ELSE NULL END
  ) THEN
    RAISE EXCEPTION 'Attendance location or network restriction failed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_attendance_location_restrictions ON public.attendance;
CREATE TRIGGER enforce_attendance_location_restrictions
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_attendance_location_restrictions();
