-- Create public bucket for client assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload
CREATE POLICY "Admins can upload client assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-assets'
  AND public.has_role(auth.uid(), 'pragma_admin')
);

-- Allow admins to manage
CREATE POLICY "Admins can manage client assets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND public.has_role(auth.uid(), 'pragma_admin')
);

-- Allow anyone to read (public bucket)
CREATE POLICY "Public can read client assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'client-assets');