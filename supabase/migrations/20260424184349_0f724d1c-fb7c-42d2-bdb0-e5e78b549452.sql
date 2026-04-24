CREATE OR REPLACE FUNCTION public.invoke_feedback_loop_on_asset_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Only react to relevant transitions
  IF NEW.status NOT IN ('approved', 'change_requested') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(OLD.status::text, '') = NEW.status::text THEN
    RETURN NEW;
  END IF;

  -- Gating: respect agent setting + per-client override
  IF NOT public.is_ai_agent_enabled_for_client('feedback_loop_weekly', NEW.client_id) THEN
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
    url := v_supabase_url || '/functions/v1/feedback-loop-extract',
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
$function$;

DROP TRIGGER IF EXISTS trg_invoke_feedback_loop_on_asset_status ON public.assets;
CREATE TRIGGER trg_invoke_feedback_loop_on_asset_status
AFTER UPDATE OF status ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.invoke_feedback_loop_on_asset_status();