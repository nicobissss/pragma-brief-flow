
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
