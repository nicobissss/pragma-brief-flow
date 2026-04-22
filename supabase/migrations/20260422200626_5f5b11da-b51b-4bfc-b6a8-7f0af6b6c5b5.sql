
-- 1. Cleanup duplicate proposals
DELETE FROM public.proposals p1
USING public.proposals p2
WHERE p1.prospect_id = p2.prospect_id AND p1.created_at < p2.created_at;

-- 2. UNIQUE on proposals.prospect_id (skip if exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_prospect_id_key'
  ) THEN
    ALTER TABLE public.proposals ADD CONSTRAINT proposals_prospect_id_key UNIQUE (prospect_id);
  END IF;
END $$;

-- 3. Add recommended_offering_code
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS recommended_offering_code TEXT;

-- 4. Drop pitch_suggestions
ALTER TABLE public.proposals DROP COLUMN IF EXISTS pitch_suggestions;

-- 5. Drop legacy flow tables/function
DROP FUNCTION IF EXISTS public.get_flow_with_details(uuid);
DROP VIEW IF EXISTS public.v_flows_summary;
DROP TABLE IF EXISTS public.pragma_flows CASCADE;
DROP TABLE IF EXISTS public.pragma_flow_types CASCADE;

-- 6. Drop linked_flow_ids
ALTER TABLE public.offering_templates DROP COLUMN IF EXISTS linked_flow_ids;

-- 7. Triggers: pipeline sync from offering
CREATE OR REPLACE FUNCTION public.sync_pipeline_from_offering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pipeline text; v_asset_count int; v_pending_review int; v_approved_count int;
BEGIN
  IF NEW.status = 'proposed' THEN v_pipeline := 'kickoff';
  ELSIF NEW.status = 'accepted' THEN v_pipeline := 'materiales';
  ELSIF NEW.status = 'active' THEN
    SELECT count(*), count(*) FILTER (WHERE status='pending_review'), count(*) FILTER (WHERE status='approved')
    INTO v_asset_count, v_pending_review, v_approved_count
    FROM public.assets WHERE client_id = NEW.client_id;
    IF v_asset_count = 0 THEN v_pipeline := 'materiales';
    ELSIF v_pending_review > 0 THEN v_pipeline := 'revisión';
    ELSIF v_approved_count = v_asset_count THEN v_pipeline := 'completado';
    ELSE v_pipeline := 'producción'; END IF;
  ELSIF NEW.status = 'completed' THEN v_pipeline := 'completado';
  ELSE RETURN NEW; END IF;
  UPDATE public.clients SET pipeline_status = v_pipeline WHERE id = NEW.client_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_pipeline_from_offering ON public.client_offerings;
CREATE TRIGGER trg_sync_pipeline_from_offering
AFTER INSERT OR UPDATE OF status ON public.client_offerings
FOR EACH ROW EXECUTE FUNCTION public.sync_pipeline_from_offering();

-- 8. Triggers: pipeline sync from assets
CREATE OR REPLACE FUNCTION public.sync_pipeline_from_assets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active_offering boolean; v_total int; v_pending int; v_approved int; v_pipeline text; v_target_client uuid;
BEGIN
  v_target_client := COALESCE(NEW.client_id, OLD.client_id);
  SELECT EXISTS (SELECT 1 FROM public.client_offerings WHERE client_id = v_target_client AND status IN ('active','accepted'))
  INTO v_active_offering;
  IF NOT v_active_offering THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE status='pending_review'), count(*) FILTER (WHERE status='approved')
  INTO v_total, v_pending, v_approved
  FROM public.assets WHERE client_id = v_target_client;
  IF v_total = 0 THEN v_pipeline := 'materiales';
  ELSIF v_pending > 0 THEN v_pipeline := 'revisión';
  ELSIF v_approved = v_total THEN v_pipeline := 'completado';
  ELSE v_pipeline := 'producción'; END IF;
  UPDATE public.clients SET pipeline_status = v_pipeline WHERE id = v_target_client;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_pipeline_from_assets ON public.assets;
CREATE TRIGGER trg_sync_pipeline_from_assets
AFTER INSERT OR UPDATE OF status ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.sync_pipeline_from_assets();

-- 9. Activity log triggers
CREATE OR REPLACE FUNCTION public.log_kickoff_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_name text;
BEGIN
  IF NEW.pragma_approved = true AND COALESCE(OLD.pragma_approved, false) = false THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
    VALUES ('client', NEW.client_id, COALESCE(v_client_name,'Unknown'), 'kickoff completado');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_kickoff_approved ON public.kickoff_briefs;
CREATE TRIGGER trg_log_kickoff_approved
AFTER UPDATE OF pragma_approved ON public.kickoff_briefs
FOR EACH ROW EXECUTE FUNCTION public.log_kickoff_approved();

CREATE OR REPLACE FUNCTION public.log_offering_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_name text; v_offering_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    SELECT COALESCE(NEW.custom_name, ot.name) INTO v_offering_name
    FROM public.offering_templates ot WHERE ot.id = NEW.offering_template_id;
    INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
    VALUES ('client', NEW.client_id, COALESCE(v_client_name,'Unknown'),
      CASE NEW.status
        WHEN 'accepted' THEN 'oferta aceptada: ' || COALESCE(v_offering_name,'')
        WHEN 'active' THEN 'oferta activada: ' || COALESCE(v_offering_name,'')
        WHEN 'completed' THEN 'oferta completada: ' || COALESCE(v_offering_name,'')
        WHEN 'proposed' THEN 'propuesta creada: ' || COALESCE(v_offering_name,'')
        ELSE 'oferta ' || NEW.status || ': ' || COALESCE(v_offering_name,'')
      END);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_offering_status_change ON public.client_offerings;
CREATE TRIGGER trg_log_offering_status_change
AFTER INSERT OR UPDATE OF status ON public.client_offerings
FOR EACH ROW EXECUTE FUNCTION public.log_offering_status_change();

CREATE OR REPLACE FUNCTION public.log_task_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_id uuid; v_client_name text;
BEGIN
  IF NEW.status = 'done' AND COALESCE(OLD.status,'') <> 'done' THEN
    SELECT c.id, c.name INTO v_client_id, v_client_name
    FROM public.client_offerings co JOIN public.clients c ON c.id = co.client_id
    WHERE co.id = NEW.client_offering_id;
    INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
    VALUES ('client', v_client_id, COALESCE(v_client_name,'Unknown'),
      'task completado (' || NEW.assignee || '): ' || NEW.title);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_task_completed ON public.action_plan_tasks;
CREATE TRIGGER trg_log_task_completed
AFTER UPDATE OF status ON public.action_plan_tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_completed();

CREATE OR REPLACE FUNCTION public.log_tool_generation_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client_name text;
BEGIN
  IF NEW.status = 'content_ready' AND COALESCE(OLD.status,'') <> 'content_ready' THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    INSERT INTO public.activity_log (entity_type, entity_id, entity_name, action)
    VALUES ('client', NEW.client_id, COALESCE(v_client_name,'Unknown'),
      'campaign brief listo: ' || NEW.tool_name);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_tool_generation_ready ON public.tool_generations;
CREATE TRIGGER trg_log_tool_generation_ready
AFTER UPDATE OF status ON public.tool_generations
FOR EACH ROW EXECUTE FUNCTION public.log_tool_generation_ready();

-- 10. Email template
INSERT INTO public.email_templates (type, subject, body_html, variables, is_active)
SELECT 'task_completed',
  'Cliente {{client_name}} completó una tarea',
  '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#F5F2EC;border-radius:12px;"><h2 style="color:#1a1a1a;">✅ Tarea completada</h2><p>El cliente <strong>{{client_name}}</strong> acaba de marcar como completada la siguiente tarea:</p><div style="background:white;padding:16px;border-radius:8px;border:1px solid #e5e0d6;margin:16px 0;"><p style="margin:0;font-weight:600;">{{task_title}}</p></div><p style="color:#666;font-size:14px;">Revisa el progreso en tu panel de admin.</p><a href="{{app_url}}/admin/clients" style="display:inline-block;background:#5B7FBE;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Ver cliente</a></div>',
  '["client_name","task_title","app_url"]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'task_completed');
