-- Track when a campaign brief was last updated (used to flag stale prompts)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS brief_updated_at timestamp with time zone DEFAULT now();

-- Materials selected per campaign
CREATE TABLE IF NOT EXISTS public.campaign_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  material_ref text NOT NULL,
  material_type text NOT NULL,
  material_label text,
  material_url text,
  usage_hint text,
  selected boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, material_ref)
);

CREATE INDEX IF NOT EXISTS idx_campaign_materials_campaign ON public.campaign_materials(campaign_id);

ALTER TABLE public.campaign_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaign materials"
  ON public.campaign_materials
  FOR ALL
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

CREATE POLICY "Clients view their campaign materials"
  ON public.campaign_materials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns ca
      JOIN public.clients c ON c.id = ca.client_id
      WHERE ca.id = campaign_materials.campaign_id
        AND c.user_id = auth.uid()
    )
  );

-- Trigger to keep brief_updated_at fresh when campaign brief fields change
CREATE OR REPLACE FUNCTION public.touch_campaign_brief_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.objective IS DISTINCT FROM OLD.objective)
     OR (NEW.target_audience IS DISTINCT FROM OLD.target_audience)
     OR (NEW.key_message IS DISTINCT FROM OLD.key_message)
     OR (NEW.timeline IS DISTINCT FROM OLD.timeline)
     OR (NEW.description IS DISTINCT FROM OLD.description) THEN
    NEW.brief_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaigns_brief_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_brief_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_campaign_brief_updated_at();