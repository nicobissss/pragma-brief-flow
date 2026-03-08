
CREATE TABLE public.connected_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connected_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage connected tools"
  ON public.connected_tools
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'pragma_admin'::app_role));
