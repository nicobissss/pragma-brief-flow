-- =====================================================
-- 1. SUPPORTED PLATFORMS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.supported_platforms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT,
    integration_type TEXT,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE public.supported_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read supported platforms"
ON public.supported_platforms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage supported platforms"
ON public.supported_platforms FOR ALL
USING (public.has_role(auth.uid(), 'pragma_admin'));

INSERT INTO public.supported_platforms (id, name, category, integration_type, sort_order) VALUES
('mailchimp', 'MailChimp', 'email', 'api', 1),
('activecampaign', 'ActiveCampaign', 'email', 'api', 2),
('brevo', 'Brevo (Sendinblue)', 'email', 'api', 3),
('mailerlite', 'MailerLite', 'email', 'api', 4),
('klaviyo', 'Klaviyo', 'email', 'api', 5),
('hubspot', 'HubSpot', 'email', 'api', 6),
('twilio', 'Twilio', 'sms', 'api', 10),
('messagebird', 'MessageBird', 'sms', 'api', 11),
('labsmobile', 'LabsMobile', 'sms', 'api', 12),
('doctoralia', 'Doctoralia', 'booking', 'manual', 20),
('mdsaude', 'MDSaude', 'booking', 'manual', 21),
('dentalink', 'Dentalink', 'crm', 'manual', 22),
('klinikare', 'Klinikare', 'crm', 'manual', 23),
('ciro', 'Ciro', 'booking', 'manual', 24),
('calendly', 'Calendly', 'calendar', 'api', 30),
('google_calendar', 'Google Calendar', 'calendar', 'api', 31),
('make_com', 'Make.com', 'automation', 'native', 40),
('zapier', 'Zapier', 'automation', 'api', 41),
('salesforce', 'Salesforce', 'crm', 'api', 50),
('pipedrive', 'Pipedrive', 'crm', 'api', 51),
('holded', 'Holded', 'crm', 'api', 52),
('wordpress', 'WordPress', 'web', 'manual', 60),
('wix', 'Wix', 'web', 'manual', 61),
('squarespace', 'Squarespace', 'web', 'manual', 62),
('custom_html', 'HTML Custom', 'web', 'manual', 63)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. OFFERING TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.offering_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    tier INTEGER NOT NULL,
    category TEXT NOT NULL,
    applicable_verticals JSONB DEFAULT '[]',
    applicable_sub_niches JSONB DEFAULT '[]',
    description TEXT,
    value_proposition TEXT,
    use_cases TEXT[],
    deliverables JSONB NOT NULL,
    required_platforms JSONB DEFAULT '[]',
    recommended_platforms JSONB DEFAULT '[]',
    optional_platforms JSONB DEFAULT '[]',
    setup_fee_eur INTEGER,
    monthly_fee_eur INTEGER,
    one_shot_fee_eur INTEGER,
    currency TEXT DEFAULT 'EUR',
    setup_hours_estimate INTEGER,
    monthly_hours_estimate INTEGER,
    linked_flow_ids JSONB DEFAULT '[]',
    expected_outcomes JSONB DEFAULT '[]',
    task_templates JSONB DEFAULT '[]',
    recommendation_rules JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT
);

ALTER TABLE public.offering_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage offering templates"
ON public.offering_templates FOR ALL
USING (public.has_role(auth.uid(), 'pragma_admin'));

CREATE POLICY "Authenticated can read active offering templates"
ON public.offering_templates FOR SELECT
TO authenticated
USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_offering_templates_active
  ON public.offering_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_offering_templates_tier
  ON public.offering_templates(tier);

-- =====================================================
-- 3. CLIENT OFFERINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.client_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    offering_template_id UUID NOT NULL REFERENCES public.offering_templates(id),
    custom_name TEXT,
    custom_price_eur INTEGER,
    custom_deliverables JSONB,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    was_recommended BOOLEAN DEFAULT false,
    recommendation_score FLOAT,
    recommendation_reasons JSONB,
    proposed_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_outcomes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    CONSTRAINT valid_status CHECK (status IN ('proposed', 'accepted', 'active', 'on_hold', 'completed', 'cancelled'))
);

ALTER TABLE public.client_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client offerings"
ON public.client_offerings FOR ALL
USING (public.has_role(auth.uid(), 'pragma_admin'));

CREATE POLICY "Clients view their offerings"
ON public.client_offerings FOR SELECT
USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_offerings.client_id AND clients.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_client_offerings_client ON public.client_offerings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_offerings_status ON public.client_offerings(status);

-- =====================================================
-- 4. CLIENT PLATFORMS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.client_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    platform_id TEXT NOT NULL REFERENCES public.supported_platforms(id),
    has_access BOOLEAN DEFAULT false,
    access_notes TEXT,
    account_identifier TEXT,
    list_size INTEGER,
    monthly_volume INTEGER,
    plan_tier TEXT,
    integration_status TEXT DEFAULT 'not_setup',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, platform_id)
);

ALTER TABLE public.client_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client platforms"
ON public.client_platforms FOR ALL
USING (public.has_role(auth.uid(), 'pragma_admin'));

CREATE POLICY "Clients view their platforms"
ON public.client_platforms FOR SELECT
USING (EXISTS (SELECT 1 FROM public.clients WHERE clients.id = client_platforms.client_id AND clients.user_id = auth.uid()));

-- =====================================================
-- 5. ACTION PLAN TASKS
-- (NOTE: 'generated_assets' doesn't exist in this project — using 'assets' instead)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.action_plan_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_offering_id UUID NOT NULL REFERENCES public.client_offerings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    blocked_reason TEXT,
    assignee TEXT NOT NULL,
    assignee_user_id UUID,
    order_index INTEGER DEFAULT 0,
    depends_on_task_ids JSONB DEFAULT '[]',
    estimated_hours FLOAT,
    due_date DATE,
    related_asset_id UUID REFERENCES public.assets(id),
    related_platform_id TEXT REFERENCES public.supported_platforms(id),
    action_url TEXT,
    checklist JSONB DEFAULT '[]',
    completion_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    CONSTRAINT valid_task_status CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'skipped')),
    CONSTRAINT valid_assignee CHECK (assignee IN ('admin', 'client', 'system'))
);

ALTER TABLE public.action_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all tasks"
ON public.action_plan_tasks FOR ALL
USING (public.has_role(auth.uid(), 'pragma_admin'));

CREATE POLICY "Clients view their tasks"
ON public.action_plan_tasks FOR SELECT
USING (
  client_offering_id IN (
    SELECT co.id FROM public.client_offerings co
    JOIN public.clients c ON c.id = co.client_id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Clients update their own tasks"
ON public.action_plan_tasks FOR UPDATE
USING (
  assignee = 'client' AND client_offering_id IN (
    SELECT co.id FROM public.client_offerings co
    JOIN public.clients c ON c.id = co.client_id
    WHERE c.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_action_plan_tasks_offering ON public.action_plan_tasks(client_offering_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_tasks_status ON public.action_plan_tasks(status);
CREATE INDEX IF NOT EXISTS idx_action_plan_tasks_assignee ON public.action_plan_tasks(assignee);

-- =====================================================
-- 6. FUNCTION: generate_tasks_for_offering
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_tasks_for_offering(p_client_offering_id UUID)
RETURNS SETOF public.action_plan_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template_id UUID;
    v_task_templates JSONB;
    v_task JSONB;
    v_order INTEGER := 0;
BEGIN
    SELECT offering_template_id INTO v_template_id
    FROM public.client_offerings WHERE id = p_client_offering_id;

    SELECT task_templates INTO v_task_templates
    FROM public.offering_templates WHERE id = v_template_id;

    FOR v_task IN SELECT * FROM jsonb_array_elements(v_task_templates)
    LOOP
        v_order := v_order + 1;
        INSERT INTO public.action_plan_tasks (
            client_offering_id, title, description, category, assignee,
            order_index, estimated_hours, checklist
        ) VALUES (
            p_client_offering_id,
            v_task->>'title',
            v_task->>'description',
            COALESCE(v_task->>'category', 'setup'),
            COALESCE(v_task->>'assignee', 'admin'),
            COALESCE((v_task->>'order')::INTEGER, v_order),
            (v_task->>'estimated_hours')::FLOAT,
            COALESCE(v_task->'checklist', '[]'::jsonb)
        );
    END LOOP;

    RETURN QUERY
    SELECT * FROM public.action_plan_tasks
    WHERE client_offering_id = p_client_offering_id
    ORDER BY order_index;
END;
$$;

-- =====================================================
-- 7. VIEW: v_client_action_plan
-- =====================================================
CREATE OR REPLACE VIEW public.v_client_action_plan
WITH (security_invoker=on) AS
SELECT
    t.*,
    co.status as offering_status,
    co.client_id,
    ot.name as offering_name,
    ot.code as offering_code,
    c.company_name,
    CASE
        WHEN t.status = 'done' THEN 1.0
        WHEN t.status = 'in_progress' THEN 0.5
        ELSE 0.0
    END as progress_weight
FROM public.action_plan_tasks t
JOIN public.client_offerings co ON co.id = t.client_offering_id
JOIN public.offering_templates ot ON ot.id = co.offering_template_id
JOIN public.clients c ON c.id = co.client_id;