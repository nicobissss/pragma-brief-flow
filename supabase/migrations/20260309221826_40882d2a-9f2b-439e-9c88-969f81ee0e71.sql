
-- Create briefing_submissions table
CREATE TABLE public.briefing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.briefing_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage briefing submissions"
  ON public.briefing_submissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'));

CREATE POLICY "Clients can view their own briefing submissions"
  ON public.briefing_submissions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = briefing_submissions.client_id
    AND clients.user_id = auth.uid()
  ));

-- Add activated_tools column to clients
ALTER TABLE public.clients ADD COLUMN activated_tools jsonb DEFAULT '[]'::jsonb;
