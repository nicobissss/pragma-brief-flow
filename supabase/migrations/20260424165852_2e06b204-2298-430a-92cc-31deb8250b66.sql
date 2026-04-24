-- Add per-client overrides for AI agents
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS ai_agent_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.ai_agent_overrides IS
'Per-client overrides for AI agents. Format: { "<agent_key>": "on" | "off" }. Missing keys = inherit from global settings.';

-- New function: per-client effective enablement
CREATE OR REPLACE FUNCTION public.is_ai_agent_enabled_for_client(_agent_key TEXT, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override TEXT;
BEGIN
  IF _client_id IS NOT NULL THEN
    SELECT ai_agent_overrides ->> _agent_key INTO v_override
    FROM public.clients WHERE id = _client_id;

    IF v_override = 'on' THEN
      RETURN true;
    ELSIF v_override = 'off' THEN
      RETURN false;
    END IF;
  END IF;

  -- Fallback to global setting
  RETURN public.is_ai_agent_enabled(_agent_key);
END;
$$;

-- Update QA trigger to honor per-client overrides
CREATE OR REPLACE FUNCTION public.invoke_qa_on_new_asset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  IF NEW.status::text <> 'pending_review' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_ai_agent_enabled_for_client('qa_asset_review', NEW.client_id) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
  END;

  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://udhlikcjuyirtkdjzscc.supabase.co';
  END IF;

  IF v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/qa-asset-review',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('asset_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;