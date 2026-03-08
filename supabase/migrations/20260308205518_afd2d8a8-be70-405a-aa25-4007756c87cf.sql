
-- Create campaign status enum
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'completed');

-- Create campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  objective text DEFAULT '',
  target_audience text DEFAULT '',
  key_message text DEFAULT '',
  timeline text DEFAULT '',
  status campaign_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add campaign_id to assets
ALTER TABLE public.assets ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL DEFAULT NULL;

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaigns
CREATE POLICY "Admins can manage all campaigns" ON public.campaigns FOR ALL TO authenticated USING (has_role(auth.uid(), 'pragma_admin'));

CREATE POLICY "Clients can view their own campaigns" ON public.campaigns FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM clients WHERE clients.id = campaigns.client_id AND clients.user_id = auth.uid())
);
