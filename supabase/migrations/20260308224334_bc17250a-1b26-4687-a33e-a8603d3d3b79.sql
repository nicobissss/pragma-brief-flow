
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'pragma_admin'::app_role));

-- Drop the old connected_tools table
DROP TABLE IF EXISTS public.connected_tools;
