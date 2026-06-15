-- Public logo bucket for ManagePay company branding.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'managepay-company-logos',
  'managepay-company-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "ManagePay company logos are publicly accessible" ON storage.objects;
CREATE POLICY "ManagePay company logos are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'managepay-company-logos');

DROP POLICY IF EXISTS "Admins upload ManagePay company logos" ON storage.objects;
CREATE POLICY "Admins upload ManagePay company logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'managepay-company-logos'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins update ManagePay company logos" ON storage.objects;
CREATE POLICY "Admins update ManagePay company logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'managepay-company-logos'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins delete ManagePay company logos" ON storage.objects;
CREATE POLICY "Admins delete ManagePay company logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'managepay-company-logos'
    AND public.has_role(auth.uid(), 'admin')
  );
