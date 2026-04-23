ALTER TABLE public.kickoff_briefs
ADD COLUMN IF NOT EXISTS structured_info jsonb NOT NULL DEFAULT '{}'::jsonb;