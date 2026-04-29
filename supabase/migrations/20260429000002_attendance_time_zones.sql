CREATE TABLE IF NOT EXISTS public.attendance_time_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  time_zone TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_time_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view attendance time zones" ON public.attendance_time_zones;
DROP POLICY IF EXISTS "Admins can manage attendance time zones" ON public.attendance_time_zones;

CREATE POLICY "Everyone can view attendance time zones" ON public.attendance_time_zones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage attendance time zones" ON public.attendance_time_zones
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_attendance_time_zones_updated_at ON public.attendance_time_zones;
CREATE TRIGGER update_attendance_time_zones_updated_at
  BEFORE UPDATE ON public.attendance_time_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS attendance_time_zone_id UUID REFERENCES public.attendance_time_zones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attendance_time_zone_name TEXT,
ADD COLUMN IF NOT EXISTS attendance_time_zone TEXT,
ADD COLUMN IF NOT EXISTS check_in_local_time TEXT,
ADD COLUMN IF NOT EXISTS check_out_local_time TEXT,
ADD COLUMN IF NOT EXISTS check_in_uk_time TEXT,
ADD COLUMN IF NOT EXISTS check_out_uk_time TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_time_zones_active ON public.attendance_time_zones(is_active, name);
CREATE INDEX IF NOT EXISTS idx_attendance_time_zone_id ON public.attendance(attendance_time_zone_id);

INSERT INTO public.attendance_time_zones (name, time_zone, is_active)
VALUES
  ('UK Time', 'Europe/London', true),
  ('Pakistan Time', 'Asia/Karachi', true)
ON CONFLICT (time_zone) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = true,
  updated_at = now();
