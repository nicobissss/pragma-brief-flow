
CREATE TABLE IF NOT EXISTS public.proposal_critique_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL,
  proposal_id uuid,
  version integer NOT NULL DEFAULT 1,
  overall_score integer NOT NULL,
  clarity_score integer,
  persuasion_score integer,
  pricing_score integer,
  objection_handling_score integer,
  brief_alignment_score integer,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  model_used text,
  cost_estimate_eur numeric DEFAULT 0,
  tokens_used integer DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'auto',
  triggered_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_critique_prospect ON public.proposal_critique_reports(prospect_id);
CREATE INDEX IF NOT EXISTS idx_proposal_critique_proposal ON public.proposal_critique_reports(proposal_id);

ALTER TABLE public.proposal_critique_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage proposal_critique_reports"
ON public.proposal_critique_reports
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'pragma_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'pragma_admin'::app_role));

INSERT INTO public.ai_agent_settings (agent_key, display_name, description, category, trigger_type, sort_order, enabled, config)
VALUES (
  'proposal_critique',
  'Critica Propuestas',
  'Revisa la propuesta generada por IA y sugiere mejoras de claridad, persuasión, manejo de objeciones y pricing.',
  'critique',
  'event',
  20,
  false,
  '{"model": "google/gemini-2.5-pro", "auto_on_generate": true}'::jsonb
)
ON CONFLICT (agent_key) DO NOTHING;
