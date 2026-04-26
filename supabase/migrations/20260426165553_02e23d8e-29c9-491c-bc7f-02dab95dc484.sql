
-- Allow public (anon) read of published campaign flows via share_token
CREATE POLICY "Public can read published flows"
ON public.campaign_flows
FOR SELECT
TO anon, authenticated
USING (status = 'published' AND share_token IS NOT NULL);

-- And allow reading the campaign name for the public flow header
CREATE POLICY "Public can read campaign name for published flows"
ON public.campaigns
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaign_flows f
    WHERE f.campaign_id = campaigns.id
      AND f.status = 'published'
      AND f.share_token IS NOT NULL
  )
);
