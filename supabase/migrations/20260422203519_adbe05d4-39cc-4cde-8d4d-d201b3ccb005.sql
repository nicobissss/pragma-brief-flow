-- 1. Add city + website_url to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS website_url text;

COMMENT ON COLUMN public.clients.activated_tools IS 'DEPRECATED — use client_platforms as single source of truth';

-- 2. Add vertical + sub_niche to kickoff_questions
ALTER TABLE public.kickoff_questions
  ADD COLUMN IF NOT EXISTS vertical text,
  ADD COLUMN IF NOT EXISTS sub_niche text;

-- 3. CHECK constraint on client_context_snapshots.snapshot_type (incluso 'kickoff_prompts' esistente)
ALTER TABLE public.client_context_snapshots
  DROP CONSTRAINT IF EXISTS client_context_snapshots_snapshot_type_check;
ALTER TABLE public.client_context_snapshots
  ADD CONSTRAINT client_context_snapshots_snapshot_type_check
  CHECK (snapshot_type IS NULL OR snapshot_type IN (
    'voc','competitor','winning_pattern','kickoff_summary',
    'manual','generation','kickoff_prompts','campaign_brief','proposal'
  ));

-- 4. kickoff_question_templates
CREATE TABLE IF NOT EXISTS public.kickoff_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical text NOT NULL,
  sub_niche text,
  category text NOT NULL DEFAULT 'General',
  question_text text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kqt_vertical ON public.kickoff_question_templates(vertical, sub_niche) WHERE is_active = true;
ALTER TABLE public.kickoff_question_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage kickoff_question_templates" ON public.kickoff_question_templates;
CREATE POLICY "Admins manage kickoff_question_templates"
  ON public.kickoff_question_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

-- 5. client_competitor_analyses
CREATE TABLE IF NOT EXISTS public.client_competitor_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  competitor_name text,
  competitor_url text,
  competitor_ig_handle text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  ai_summary text,
  positioning_gaps jsonb DEFAULT '[]'::jsonb,
  treatments jsonb DEFAULT '[]'::jsonb,
  pricing_observed jsonb DEFAULT '{}'::jsonb,
  hooks jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cca_client ON public.client_competitor_analyses(client_id);
ALTER TABLE public.client_competitor_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage competitor analyses" ON public.client_competitor_analyses;
CREATE POLICY "Admins manage competitor analyses"
  ON public.client_competitor_analyses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));
DROP POLICY IF EXISTS "Clients view their competitor analyses" ON public.client_competitor_analyses;
CREATE POLICY "Clients view their competitor analyses"
  ON public.client_competitor_analyses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_competitor_analyses.client_id AND c.user_id = auth.uid()));

-- 6. client_winning_patterns
CREATE TABLE IF NOT EXISTS public.client_winning_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  asset_type text,
  source_label text,
  source_content text,
  performance_metric text,
  extracted_patterns jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cwp_client ON public.client_winning_patterns(client_id);
ALTER TABLE public.client_winning_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage winning patterns" ON public.client_winning_patterns;
CREATE POLICY "Admins manage winning patterns"
  ON public.client_winning_patterns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));
DROP POLICY IF EXISTS "Clients view their winning patterns" ON public.client_winning_patterns;
CREATE POLICY "Clients view their winning patterns"
  ON public.client_winning_patterns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_winning_patterns.client_id AND c.user_id = auth.uid()));

-- 7. vertical_pattern_suggestions
CREATE TABLE IF NOT EXISTS public.vertical_pattern_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical text NOT NULL,
  sub_niche text,
  rule_text text NOT NULL,
  client_count integer NOT NULL DEFAULT 0,
  example_client_ids uuid[] DEFAULT '{}',
  approved_as_default boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vps_vertical ON public.vertical_pattern_suggestions(vertical, sub_niche);
ALTER TABLE public.vertical_pattern_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage vertical pattern suggestions" ON public.vertical_pattern_suggestions;
CREATE POLICY "Admins manage vertical pattern suggestions"
  ON public.vertical_pattern_suggestions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

-- 8. Helper RPC: clone kickoff_question_templates → kickoff_questions for a client
CREATE OR REPLACE FUNCTION public.clone_kickoff_questions_for_client(
  p_client_id uuid,
  p_vertical text,
  p_sub_niche text DEFAULT NULL,
  p_replace boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_replace THEN
    DELETE FROM public.kickoff_questions WHERE client_id = p_client_id;
  END IF;

  INSERT INTO public.kickoff_questions (client_id, category, question_text, order_index, vertical, sub_niche, is_checked)
  SELECT p_client_id, t.category, t.question_text, t.order_index, t.vertical, t.sub_niche, false
  FROM public.kickoff_question_templates t
  WHERE t.is_active = true
    AND (t.vertical = p_vertical OR t.vertical = 'all')
    AND (t.sub_niche IS NULL OR p_sub_niche IS NULL OR t.sub_niche = p_sub_niche);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;