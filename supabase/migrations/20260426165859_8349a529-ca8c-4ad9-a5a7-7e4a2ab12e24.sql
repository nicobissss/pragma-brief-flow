-- Phase 4: refactor triggers
-- 1) Disable auto-QA for assets that belong to a campaign (campaign assets go through Master/Flow review instead)
CREATE OR REPLACE FUNCTION public.invoke_qa_on_new_asset()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  IF NEW.status::text <> 'pending_review' THEN
    RETURN NEW;
  END IF;

  -- Skip auto-QA for campaign assets (handled by master/flow review)
  IF NEW.campaign_id IS NOT NULL THEN
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
$function$;

-- 2) Move feedback-loop trigger from assets onto campaign_touchpoints (status = completed)
CREATE OR REPLACE FUNCTION public.invoke_feedback_loop_on_touchpoint()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(OLD.status, '') = 'completed' THEN
    RETURN NEW;
  END IF;

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
    body := jsonb_build_object('touchpoint_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- Attach trigger to campaign_touchpoints
DROP TRIGGER IF EXISTS trg_feedback_loop_on_touchpoint ON public.campaign_touchpoints;
CREATE TRIGGER trg_feedback_loop_on_touchpoint
AFTER UPDATE ON public.campaign_touchpoints
FOR EACH ROW
EXECUTE FUNCTION public.invoke_feedback_loop_on_touchpoint();
