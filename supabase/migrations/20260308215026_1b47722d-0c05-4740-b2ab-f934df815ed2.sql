
-- Create kickoff_questions table
CREATE TABLE public.kickoff_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'General',
  question_text text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kickoff_questions ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage kickoff questions"
ON public.kickoff_questions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'pragma_admin'));

-- Index for fast lookups
CREATE INDEX idx_kickoff_questions_client_id ON public.kickoff_questions(client_id);
