
-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'client-assets';

-- 2. Drop existing policies on storage.objects for this bucket (clean slate)
DROP POLICY IF EXISTS "client_assets_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "client_assets_client_read" ON storage.objects;
DROP POLICY IF EXISTS "client_assets_client_insert" ON storage.objects;
DROP POLICY IF EXISTS "client_assets_public_read" ON storage.objects;

-- 3. Admin: full access to client-assets bucket
CREATE POLICY "client_assets_admin_all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'client-assets' AND public.has_role(auth.uid(), 'pragma_admin'::app_role))
WITH CHECK (bucket_id = 'client-assets' AND public.has_role(auth.uid(), 'pragma_admin'::app_role));

-- 4. Clients: read files in their own client_id folder (first path segment = client_id)
CREATE POLICY "client_assets_client_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-assets'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND (storage.foldername(name))[1] = c.id::text
  )
);

-- 5. Clients: upload files only to their own client_id folder
CREATE POLICY "client_assets_client_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-assets'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.user_id = auth.uid()
      AND (storage.foldername(name))[1] = c.id::text
  )
);
