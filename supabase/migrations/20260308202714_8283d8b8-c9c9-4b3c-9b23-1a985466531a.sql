CREATE POLICY "Clients can view their linked prospect"
ON public.prospects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.prospect_id = prospects.id
    AND clients.user_id = auth.uid()
  )
);