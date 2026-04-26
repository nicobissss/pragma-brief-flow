
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END; $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END; $$;

DO $$
DECLARE t text;
DECLARE internal_tables text[] := ARRAY[
  'action_plan_tasks','activity_log','ai_agent_settings','app_settings',
  'asset_qa_reports','asset_section_comments','assets','briefing_submissions',
  'campaign_master_assets','campaign_materials','campaign_touchpoints',
  'client_asset_requests','client_competitor_analyses','client_context_snapshots',
  'client_notes','client_offerings','client_platforms','client_winning_patterns',
  'clients','documents','email_log','email_send_log','email_send_state',
  'email_templates','events','kickoff_briefs','kickoff_question_templates',
  'kickoff_questions','knowledge_base','pragma_rules','proposal_critique_reports',
  'proposals','prospects'
];
BEGIN
  FOREACH t IN ARRAY internal_tables LOOP
    BEGIN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_agent_run(
  _agent_key text, _status text, _cost_eur numeric DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.ai_agent_settings
  SET total_runs = total_runs + 1,
      total_cost_estimate_eur = total_cost_estimate_eur + COALESCE(_cost_eur, 0),
      last_cost_estimate_eur = COALESCE(_cost_eur, 0),
      last_run_status = _status,
      last_run_at = now()
  WHERE agent_key = _agent_key;
END; $$;

GRANT EXECUTE ON FUNCTION public.record_agent_run(text, text, numeric) TO authenticated, service_role;
