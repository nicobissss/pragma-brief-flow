-- 1) Normalize legacy English pipeline_status values → Spanish (matches DB triggers)
UPDATE public.clients SET pipeline_status = 'materiales' WHERE pipeline_status = 'materials';
UPDATE public.clients SET pipeline_status = 'producción' WHERE pipeline_status = 'production';
UPDATE public.clients SET pipeline_status = 'revisión' WHERE pipeline_status = 'review';
UPDATE public.clients SET pipeline_status = 'completado' WHERE pipeline_status = 'completed';

-- 2) Translate briefing_questions IT → ES (only rows that look Italian)
UPDATE public.briefing_questions SET question_text = 'Años de operación', placeholder = COALESCE(placeholder, 'Ej. 5')
  WHERE field_key = 'years_in_operation' AND (question_text ILIKE '%anni%' OR question_text ILIKE '%operatività%' OR question_text ILIKE '%attività%');
UPDATE public.briefing_questions SET question_text = 'Nuevos clientes al mes'
  WHERE field_key = 'monthly_new_clients' AND (question_text ILIKE '%nuovi%' OR question_text ILIKE '%mese%');
UPDATE public.briefing_questions SET question_text = '¿De dónde vienen tus clientes?'
  WHERE field_key = 'client_sources' AND (question_text ILIKE '%vengono%' OR question_text ILIKE '%clienti%');
UPDATE public.briefing_questions SET question_text = '¿Haces publicidad pagada?'
  WHERE field_key = 'runs_paid_ads' AND (question_text ILIKE '%pubblicità%' OR question_text ILIKE '%annunci%');
UPDATE public.briefing_questions SET question_text = '¿Qué plataformas de ads usas?'
  WHERE field_key = 'ad_platforms' AND (question_text ILIKE '%piattaforme%' OR question_text ILIKE '%quali%');
UPDATE public.briefing_questions SET question_text = '¿Tienes lista de email?'
  WHERE field_key = 'has_email_list' AND question_text ILIKE '%hai%';
UPDATE public.briefing_questions SET question_text = '¿Tienes sitio web?'
  WHERE field_key = 'has_website' AND question_text ILIKE '%sito%';
UPDATE public.briefing_questions SET question_text = 'URL del sitio web'
  WHERE field_key = 'website_url' AND question_text ILIKE '%sito%';
UPDATE public.briefing_questions SET question_text = '¿Usas un CRM?'
  WHERE field_key = 'uses_crm' AND question_text ILIKE '%usi%';
UPDATE public.briefing_questions SET question_text = '¿Cuál es tu objetivo principal?'
  WHERE field_key = 'main_goal' AND (question_text ILIKE '%obiettivo%' OR question_text ILIKE '%principale%');
UPDATE public.briefing_questions SET question_text = '¿Cuál es tu mayor reto hoy?'
  WHERE field_key = 'biggest_challenge' AND (question_text ILIKE '%sfida%' OR question_text ILIKE '%difficolt%');
UPDATE public.briefing_questions SET question_text = '¿Qué te diferencia de la competencia?'
  WHERE field_key = 'differentiator' AND (question_text ILIKE '%differenz%' OR question_text ILIKE '%distingue%');

-- 3) Translate kickoff_questions IT → ES (heuristic: rows with Italian markers)
UPDATE public.kickoff_questions SET category = 'Negocio'        WHERE category ILIKE 'Business' OR category ILIKE 'Attività';
UPDATE public.kickoff_questions SET category = 'Marketing'      WHERE category ILIKE 'Marketing';
UPDATE public.kickoff_questions SET category = 'Producción'     WHERE category ILIKE 'Produzione';
UPDATE public.kickoff_questions SET category = 'Audiencia'      WHERE category ILIKE 'Pubblico' OR category ILIKE 'Audience';
UPDATE public.kickoff_questions SET category = 'Objetivos'      WHERE category ILIKE 'Obiettivi' OR category ILIKE 'Goals';
UPDATE public.kickoff_questions SET category = 'General'        WHERE category ILIKE 'Generale';

-- Bulk-fix common Italian connectors → Spanish equivalents in question_text
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, ' della ', ' de la ')         WHERE question_text ILIKE '% della %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, ' degli ',  ' de los ')        WHERE question_text ILIKE '% degli %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, ' delle ',  ' de las ')        WHERE question_text ILIKE '% delle %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, ' dello ',  ' del ')           WHERE question_text ILIKE '% dello %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, 'Quali sono', '¿Cuáles son')   WHERE question_text ILIKE 'Quali sono%';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, 'Qual è',    '¿Cuál es')       WHERE question_text ILIKE 'Qual è%';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, 'Come ',     '¿Cómo ')         WHERE question_text ILIKE 'Come %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, 'Perché ',   '¿Por qué ')      WHERE question_text ILIKE 'Perché %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, 'Hai ',      '¿Tienes ')       WHERE question_text ILIKE 'Hai %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, 'Quanti ',   '¿Cuántos ')      WHERE question_text ILIKE 'Quanti %';
UPDATE public.kickoff_questions SET question_text = REPLACE(question_text, 'Quante ',   '¿Cuántas ')      WHERE question_text ILIKE 'Quante %';

-- 4) Email template task_completed (idempotent upsert by type)
INSERT INTO public.email_templates (type, subject, body_html, variables, is_active)
VALUES (
  'task_completed',
  '✅ Tarea completada por {{client_name}}',
  '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px"><h2 style="color:#1e3a5f;margin:0 0 12px">Tarea completada</h2><p>El cliente <strong>{{client_name}}</strong> acaba de completar:</p><blockquote style="border-left:4px solid #2563eb;padding:8px 12px;background:#f3f6fb;border-radius:4px;margin:16px 0">{{task_title}}</blockquote><p style="color:#555;font-size:14px">Revisa el estado del proyecto en el panel admin.</p><a href="{{app_url}}/admin/client/{{client_id}}" style="display:inline-block;margin-top:8px;padding:10px 18px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:6px">Abrir cliente</a></div>',
  '["client_name","task_title","client_id","app_url"]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;