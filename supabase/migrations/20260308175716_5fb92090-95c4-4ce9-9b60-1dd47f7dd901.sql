
-- Knowledge base text blocks
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage knowledge base"
  ON public.knowledge_base FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'));

-- Seed the 4 categories
INSERT INTO public.knowledge_base (category, content) VALUES
  ('flows_processes', ''),
  ('pricing', ''),
  ('suite_tools', ''),
  ('pitch_guidelines', '');

-- Documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  extracted_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage documents"
  ON public.documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'));

-- Storage bucket for KB documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kb-documents', 'kb-documents', false);

CREATE POLICY "Admins can upload KB docs"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'kb-documents' AND public.has_role(auth.uid(), 'pragma_admin'))
  WITH CHECK (bucket_id = 'kb-documents' AND public.has_role(auth.uid(), 'pragma_admin'));
