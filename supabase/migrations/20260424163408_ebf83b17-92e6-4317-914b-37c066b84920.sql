
-- 1. Dedup pragma_rules: keep oldest by id (alphabetic) per (name, category)
DELETE FROM public.pragma_rules p
WHERE EXISTS (
  SELECT 1 FROM public.pragma_rules p2
  WHERE p2.name = p.name AND p2.category = p.category AND p2.id < p.id
);

-- Also dedup near-duplicate "Pragma SEO GEO" vs "Pragma SEO & GEO": keep "& GEO"
DELETE FROM public.pragma_rules WHERE name = 'Pragma SEO GEO';

-- 2. Harden RLS on admin tables (replace permissive "authenticated" policies)
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.pragma_rules;
CREATE POLICY "Admins manage pragma_rules" ON public.pragma_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.email_log;
CREATE POLICY "Admins manage email_log" ON public.email_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.events;
CREATE POLICY "Admins manage events" ON public.events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.email_templates;
CREATE POLICY "Admins manage email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.client_notes;
CREATE POLICY "Admins manage client_notes" ON public.client_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.client_context_snapshots;
CREATE POLICY "Admins manage client_context_snapshots" ON public.client_context_snapshots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.tool_generations;
CREATE POLICY "Admins manage tool_generations" ON public.tool_generations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.tool_results;
CREATE POLICY "Admins manage tool_results" ON public.tool_results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.webhook_log;
CREATE POLICY "Admins manage webhook_log" ON public.webhook_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

DROP POLICY IF EXISTS "Enable all for authenticated" ON public.slotty_workspace_requests;
CREATE POLICY "Admins manage slotty_workspace_requests" ON public.slotty_workspace_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pragma_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'pragma_admin'::app_role));

-- 3. Auto-task generation when client_offering becomes 'accepted'
CREATE OR REPLACE FUNCTION public.auto_generate_tasks_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_existing int;
BEGIN
  IF NEW.status = 'accepted' AND COALESCE(OLD.status,'') <> 'accepted' THEN
    SELECT count(*) INTO v_existing FROM public.action_plan_tasks WHERE client_offering_id = NEW.id;
    IF v_existing = 0 THEN
      PERFORM public.generate_tasks_for_offering(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_tasks ON public.client_offerings;
CREATE TRIGGER trg_auto_generate_tasks
  AFTER UPDATE ON public.client_offerings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_tasks_on_accept();
