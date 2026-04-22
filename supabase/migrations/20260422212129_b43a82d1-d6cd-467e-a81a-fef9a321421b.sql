-- Trigger to notify admins when a new prospect arrives (e.g. from external Briefer webhook)
-- Uses pg_net to call the send-transactional-email edge function asynchronously.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_admin_new_prospect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
  v_app_url text := 'https://pragma-brief-flow.lovable.app';
  v_payload jsonb;
BEGIN
  -- Read secrets from vault if available, otherwise fall back to current_setting
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
    -- Cannot send without service key; skip silently (logged via activity_log already)
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'templateName', 'new-prospect-received',
    'recipientEmail', 'dev@pragmarketers.com',
    'idempotencyKey', 'new-prospect-' || NEW.id::text,
    'templateData', jsonb_build_object(
      'prospectName', NEW.name,
      'companyName', NEW.company_name,
      'vertical', NEW.vertical,
      'subNiche', NEW.sub_niche,
      'market', NEW.market,
      'adminUrl', v_app_url || '/admin/prospects/' || NEW.id::text
    )
  );

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block prospect insertion on email failure
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_prospect ON public.prospects;
CREATE TRIGGER trg_notify_admin_new_prospect
  AFTER INSERT ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_prospect();