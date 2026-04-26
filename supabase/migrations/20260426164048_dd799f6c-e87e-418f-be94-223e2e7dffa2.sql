-- 1. Aggancio campagna → offerta del catalogo
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS client_offering_id UUID;

CREATE INDEX IF NOT EXISTS idx_campaigns_client_offering_id
  ON public.campaigns(client_offering_id);

-- 2. campaign_master_assets (N per campagna)
CREATE TABLE IF NOT EXISTS public.campaign_master_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Master',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  brand_kit JSONB NOT NULL DEFAULT '{}'::jsonb,
  visual_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_image_url TEXT,
  visual_preview_url TEXT,
  context_used JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_assets_campaign ON public.campaign_master_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_master_assets_client ON public.campaign_master_assets(client_id);

-- Vincolo: max 1 master "primary" per campagna
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_assets_one_primary_per_campaign
  ON public.campaign_master_assets(campaign_id) WHERE is_primary = true;

ALTER TABLE public.campaign_master_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaign_master_assets"
  ON public.campaign_master_assets FOR ALL
  USING (has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'pragma_admin'::app_role));

CREATE POLICY "Clients view their approved master assets"
  ON public.campaign_master_assets FOR SELECT
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = campaign_master_assets.client_id AND c.user_id = auth.uid()
    )
  );

-- 3. campaign_flows (1 versionato per campagna)
CREATE TABLE IF NOT EXISTS public.campaign_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  generated_from_offering BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_flows_campaign ON public.campaign_flows(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_flows_share_token ON public.campaign_flows(share_token);

ALTER TABLE public.campaign_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaign_flows"
  ON public.campaign_flows FOR ALL
  USING (has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'pragma_admin'::app_role));

CREATE POLICY "Clients view their published flows"
  ON public.campaign_flows FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = campaign_flows.client_id AND c.user_id = auth.uid()
    )
  );

-- Lettura pubblica via share_token (no auth) — gestita da edge function dedicata via service role.
-- Niente policy "anon": preferiamo passare per una function controllata.

-- 4. campaign_touchpoints
CREATE TABLE IF NOT EXISTS public.campaign_touchpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES public.campaign_flows(id) ON DELETE SET NULL,
  flow_node_id TEXT NOT NULL,
  master_asset_id UUID REFERENCES public.campaign_master_assets(id) ON DELETE SET NULL,
  channel TEXT,
  sub_tool_key TEXT,
  brief TEXT,
  week INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','dispatched','completed','failed','cancelled')),
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_touchpoints_campaign ON public.campaign_touchpoints(campaign_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_status ON public.campaign_touchpoints(status);

ALTER TABLE public.campaign_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaign_touchpoints"
  ON public.campaign_touchpoints FOR ALL
  USING (has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'pragma_admin'::app_role));

CREATE POLICY "Clients view their touchpoints"
  ON public.campaign_touchpoints FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = campaign_touchpoints.client_id AND c.user_id = auth.uid()
  ));

-- 5. sub_tool_registry
CREATE TABLE IF NOT EXISTS public.sub_tool_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  webhook_url TEXT,
  secret_name TEXT,
  payload_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_tool_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sub_tool_registry"
  ON public.sub_tool_registry FOR ALL
  USING (has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'pragma_admin'::app_role));

-- 6. updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_master_assets_touch BEFORE UPDATE ON public.campaign_master_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_campaign_flows_touch BEFORE UPDATE ON public.campaign_flows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touchpoints_touch BEFORE UPDATE ON public.campaign_touchpoints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_sub_tool_registry_touch BEFORE UPDATE ON public.sub_tool_registry
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Aggiornamento ai_agent_settings
-- Rinomina la chiave del vecchio Brief Enrichment di campagna se presente
UPDATE public.ai_agent_settings
   SET agent_key = 'master_asset_brief_enrichment',
       display_name = 'Master Asset · Brief Enrichment',
       description = 'Suggerisce miglioramenti al brand kit del Master Asset (slogan, hook, value prop, audience, CTA). L''admin clicca Aplicar per accettare.'
 WHERE agent_key = 'briefer_enrichment_campaign';

-- Insert nuovi agenti (idempotente)
INSERT INTO public.ai_agent_settings (agent_key, display_name, description, enabled, category, trigger_type, sort_order)
VALUES
  ('master_asset_generator', 'Master Asset · Generator',
   'Genera un draft di Master Asset (brand kit + layout visuale) a partire dal contesto completo del cliente. L''admin lo edita e poi lo approva manualmente.',
   false, 'generation', 'manual', 50),
  ('campaign_flow_generator', 'Campaign Flow · Generator',
   'Espande i deliverables dell''offerta in nodi del flow e li arricchisce con dipendenze, tempistiche e nodi standard. L''admin pubblica il flow manualmente.',
   false, 'generation', 'manual', 51),
  ('master_asset_variations', 'Master Asset · A/B Variations',
   'Genera 3 varianti draft di un Master approvato (hook diverso, CTA diversa, tono diverso). Crea draft, non muta nulla di approvato.',
   false, 'generation', 'manual', 52),
  ('master_asset_brief_enrichment', 'Master Asset · Brief Enrichment',
   'Suggerisce miglioramenti al brand kit del Master Asset. Mai mutazione automatica: l''admin clicca Aplicar.',
   false, 'enrichment', 'manual', 49)
ON CONFLICT (agent_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      trigger_type = EXCLUDED.trigger_type,
      sort_order = EXCLUDED.sort_order;