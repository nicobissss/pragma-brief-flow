
-- Create activity_log table
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'prospect', 'client', 'asset'
  entity_id uuid NOT NULL,
  entity_name text, -- for display without joins
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage activity logs"
ON public.activity_log
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'pragma_admin'::app_role));

-- Index for fast recent queries
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Trigger: log prospect status changes
CREATE OR REPLACE FUNCTION public.log_prospect_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
    VALUES ('prospect', NEW.id, NEW.name,
      CASE NEW.status
        WHEN 'new' THEN 'submitted a briefing'
        WHEN 'proposal_ready' THEN 'proposal marked as ready'
        WHEN 'call_scheduled' THEN 'call scheduled'
        WHEN 'accepted' THEN 'accepted as client'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'archived' THEN 'archived'
        ELSE 'status changed to ' || NEW.status
      END
    );
  END IF;
  IF OLD.call_status IS DISTINCT FROM NEW.call_status AND NEW.call_status != 'not_scheduled' THEN
    INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
    VALUES ('prospect', NEW.id, NEW.name,
      CASE NEW.call_status
        WHEN 'scheduled' THEN 'call scheduled'
        WHEN 'done_positive' THEN 'call marked as Done - Positive'
        WHEN 'done_negative' THEN 'call marked as Done - Negative'
        WHEN 'no_show' THEN 'call marked as No Show'
        ELSE 'call status changed'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prospect_status_change
AFTER UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.log_prospect_status_change();

-- Trigger: log new prospect (briefing submitted)
CREATE OR REPLACE FUNCTION public.log_new_prospect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
  VALUES ('prospect', NEW.id, NEW.name, 'submitted a briefing');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_new_prospect
AFTER INSERT ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.log_new_prospect();

-- Trigger: log asset status changes
CREATE OR REPLACE FUNCTION public.log_asset_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT c.name INTO client_name FROM public.clients c WHERE c.id = NEW.client_id;
    INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
    VALUES ('asset', NEW.id, COALESCE(client_name, 'Unknown'),
      CASE NEW.status
        WHEN 'approved' THEN 'approved ' || NEW.asset_name
        WHEN 'change_requested' THEN 'requested changes on ' || NEW.asset_name
        WHEN 'pending_review' THEN NEW.asset_name || ' submitted for review'
        ELSE 'asset status changed'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_asset_status_change
AFTER UPDATE ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.log_asset_status_change();

-- Trigger: log proposal generation
CREATE OR REPLACE FUNCTION public.log_proposal_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prospect_name text;
BEGIN
  SELECT p.name INTO prospect_name FROM public.prospects p WHERE p.id = NEW.prospect_id;
  INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
  VALUES ('prospect', NEW.prospect_id, COALESCE(prospect_name, 'Unknown'), 'proposal generated');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proposal_created
AFTER INSERT ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.log_proposal_created();
