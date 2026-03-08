
CREATE TABLE public.asset_section_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  section_name text NOT NULL,
  comment_text text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_section_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all section comments"
ON public.asset_section_comments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'pragma_admin'::app_role));

CREATE POLICY "Clients can insert their own section comments"
ON public.asset_section_comments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = asset_section_comments.client_id
    AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their own section comments"
ON public.asset_section_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = asset_section_comments.client_id
    AND clients.user_id = auth.uid()
  )
);
