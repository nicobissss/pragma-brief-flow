-- AI Agents Control Panel
CREATE TABLE public.ai_agent_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  last_cost_estimate_eur NUMERIC(10,4) DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_cost_estimate_eur NUMERIC(10,4) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'automation',
  trigger_type TEXT NOT NULL DEFAULT 'event',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_agent_settings"
ON public.ai_agent_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'pragma_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'pragma_admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_ai_agent_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ai_agent_settings_updated_at
BEFORE UPDATE ON public.ai_agent_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_ai_agent_settings_updated_at();

-- Helper to check if an agent (and master switch) is enabled
CREATE OR REPLACE FUNCTION public.is_ai_agent_enabled(_agent_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_master BOOLEAN; v_agent BOOLEAN;
BEGIN
  SELECT enabled INTO v_master FROM public.ai_agent_settings WHERE agent_key = 'master_switch';
  IF COALESCE(v_master, false) = false THEN RETURN false; END IF;
  SELECT enabled INTO v_agent FROM public.ai_agent_settings WHERE agent_key = _agent_key;
  RETURN COALESCE(v_agent, false);
END; $$;

-- QA Asset Reports
CREATE TABLE public.asset_qa_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  client_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  overall_score INTEGER NOT NULL,
  brand_score INTEGER,
  rules_score INTEGER,
  brief_alignment_score INTEGER,
  predicted_approval_score INTEGER,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules_violated JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  blocked BOOLEAN NOT NULL DEFAULT false,
  reviewed_by_admin BOOLEAN NOT NULL DEFAULT false,
  model_used TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_estimate_eur NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_qa_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage asset_qa_reports"
ON public.asset_qa_reports
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'pragma_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'pragma_admin'::app_role));

CREATE INDEX idx_asset_qa_reports_asset ON public.asset_qa_reports(asset_id, version DESC);
CREATE INDEX idx_asset_qa_reports_client ON public.asset_qa_reports(client_id, created_at DESC);