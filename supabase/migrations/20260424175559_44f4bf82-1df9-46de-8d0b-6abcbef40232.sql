ALTER TABLE public.proposal_critique_reports
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS client_offering_id uuid;

CREATE INDEX IF NOT EXISTS idx_proposal_critique_reports_scope
  ON public.proposal_critique_reports(prospect_id, scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposal_critique_reports_offering
  ON public.proposal_critique_reports(client_offering_id, created_at DESC)
  WHERE client_offering_id IS NOT NULL;