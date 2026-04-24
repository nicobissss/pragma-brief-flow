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
  -- Only trigger for assets that arrive in pending_review
  IF NEW.status::text <> 'pending_review' THEN
    RETURN NEW;
  END IF;

  -- Quick exit if agent is globally disabled (avoids HTTP overhead)
  IF NOT public.is_ai_agent_enabled('qa_asset_review') THEN
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
  -- Never block asset creation on QA failure
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoke_qa_on_new_asset ON public.assets;
CREATE TRIGGER trg_invoke_qa_on_new_asset
AFTER INSERT ON public.assets
FOR EACH ROW
EXECUTE FUNCTION public.invoke_qa_on_new_asset();