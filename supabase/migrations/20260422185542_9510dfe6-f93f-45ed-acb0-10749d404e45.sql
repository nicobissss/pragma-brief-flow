
-- 1. pragma_flow_types
CREATE TABLE IF NOT EXISTS public.pragma_flow_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE public.pragma_flow_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage flow types" ON public.pragma_flow_types
  FOR ALL USING (public.has_role(auth.uid(), 'pragma_admin'));

CREATE POLICY "Authenticated read flow types" ON public.pragma_flow_types
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.pragma_flow_types (id, name, description, icon, sort_order) VALUES
    ('acquisition', 'Adquisición', 'Captar nuevos clientes con ofertas y promociones', '🎯', 1),
    ('post_booking', 'Post-Reserva', 'Secuencia después de que alguien reserva una cita', '📅', 2),
    ('nurturing', 'Nurturing', 'Educar y calentar leads que no han convertido', '🌱', 3),
    ('reengagement', 'Re-engagement', 'Reactivar clientes que no han vuelto', '🔄', 4),
    ('upsell', 'Upsell/Cross-sell', 'Ofrecer servicios adicionales a clientes existentes', '⬆️', 5),
    ('onboarding', 'Onboarding', 'Bienvenida y educación para nuevos clientes', '👋', 6),
    ('loyalty', 'Fidelización', 'Mantener engagement con clientes activos', '💎', 7)
ON CONFLICT (id) DO NOTHING;

-- 2. Estendi pragma_flows
ALTER TABLE public.pragma_flows
  ADD COLUMN IF NOT EXISTS internal_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS flow_type TEXT REFERENCES public.pragma_flow_types(id),
  ADD COLUMN IF NOT EXISTS use_case TEXT,
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_conversion_rate FLOAT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_pragma_flows_type ON public.pragma_flows(flow_type);
CREATE INDEX IF NOT EXISTS idx_pragma_flows_active ON public.pragma_flows(is_active) WHERE is_active = true;

-- 3. Estendi pragma_rules
ALTER TABLE public.pragma_rules
  ADD COLUMN IF NOT EXISTS applies_to_vertical TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 4. Vista v_flows_summary
CREATE OR REPLACE VIEW public.v_flows_summary AS
SELECT
    f.id,
    f.name,
    f.internal_code,
    ft.name as flow_type_name,
    ft.icon as flow_type_icon,
    f.vertical,
    f.description,
    f.trigger_type,
    f.estimated_total_days,
    f.is_recommended,
    f.is_active,
    jsonb_array_length(COALESCE(f.steps, '[]'::jsonb)) as step_count,
    f.times_used,
    f.created_at
FROM public.pragma_flows f
LEFT JOIN public.pragma_flow_types ft ON f.flow_type = ft.id
WHERE f.is_active = true
ORDER BY f.vertical, ft.sort_order, f.is_recommended DESC;

-- 5. Funzione get_flow_with_details
CREATE OR REPLACE FUNCTION public.get_flow_with_details(flow_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'flow', row_to_json(f),
        'flow_type', row_to_json(ft),
        'applicable_rules', (
            SELECT json_agg(row_to_json(r))
            FROM public.pragma_rules r
            WHERE r.is_active = true
            AND (r.applies_to_vertical IS NULL OR r.applies_to_vertical = f.vertical)
        )
    )
    INTO result
    FROM public.pragma_flows f
    LEFT JOIN public.pragma_flow_types ft ON f.flow_type = ft.id
    WHERE f.id = flow_id;

    RETURN result;
END;
$$;
