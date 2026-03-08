-- Create enum for asset request status
CREATE TYPE public.asset_request_status AS ENUM ('pending', 'partial', 'complete');

-- Create the client_asset_requests table
CREATE TABLE public.client_asset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status asset_request_status NOT NULL DEFAULT 'pending',
  pragma_notified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_asset_requests ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage all asset requests"
ON public.client_asset_requests FOR ALL
USING (has_role(auth.uid(), 'pragma_admin'));

-- Clients can view their own requests
CREATE POLICY "Clients can view their own asset requests"
ON public.client_asset_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clients WHERE clients.id = client_asset_requests.client_id AND clients.user_id = auth.uid()
));

-- Clients can update their own requests (to upload files)
CREATE POLICY "Clients can update their own asset requests"
ON public.client_asset_requests FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM clients WHERE clients.id = client_asset_requests.client_id AND clients.user_id = auth.uid()
));