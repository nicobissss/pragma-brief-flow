
-- Create enums
CREATE TYPE public.briefing_vertical AS ENUM ('all', 'salud', 'elearning', 'deporte');
CREATE TYPE public.briefing_question_type AS ENUM ('text', 'select', 'multiselect', 'number', 'url', 'boolean');

-- Create briefing_questions table
CREATE TABLE public.briefing_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step INTEGER NOT NULL CHECK (step >= 1 AND step <= 4),
  vertical briefing_vertical NOT NULL DEFAULT 'all',
  field_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type briefing_question_type NOT NULL DEFAULT 'text',
  options JSONB DEFAULT NULL,
  placeholder TEXT DEFAULT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.briefing_questions ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage briefing questions"
  ON public.briefing_questions FOR ALL
  USING (has_role(auth.uid(), 'pragma_admin'::app_role));

-- Anyone can read active questions (needed for public briefing form)
CREATE POLICY "Anyone can read active briefing questions"
  ON public.briefing_questions FOR SELECT
  USING (is_active = true);

-- Seed Step 1 questions
INSERT INTO public.briefing_questions (step, vertical, field_key, question_text, question_type, options, placeholder, is_required, order_index) VALUES
(1, 'all', 'name', 'Full name', 'text', NULL, 'Your full name', true, 1),
(1, 'all', 'company_name', 'Company name', 'text', NULL, 'Company name', true, 2),
(1, 'all', 'email', 'Email', 'text', NULL, 'your@email.com', true, 3),
(1, 'all', 'phone', 'Phone', 'text', NULL, '+34 600 000 000', false, 4),
(1, 'all', 'market', 'Market', 'select', '["España", "Italia", "Argentina"]', 'Select market', true, 5),
(1, 'all', 'vertical', 'Vertical', 'select', '["Salud & Estética", "E-Learning", "Deporte Offline"]', 'Select vertical', true, 6),
(1, 'all', 'sub_niche', 'Sub-niche', 'select', NULL, 'Select sub-niche', true, 7);

-- Seed Step 2 questions
INSERT INTO public.briefing_questions (step, vertical, field_key, question_text, question_type, options, placeholder, is_required, order_index) VALUES
(2, 'all', 'years_in_operation', 'Years in operation', 'number', NULL, 'e.g. 5', true, 1),
(2, 'all', 'monthly_new_clients', 'How many new clients/students do you get per month?', 'number', NULL, 'e.g. 20', true, 2),
(2, 'all', 'client_sources', 'How do most new clients find you today?', 'multiselect', '["Word of mouth", "Google", "Social media", "Paid ads", "Referrals", "Walk-in", "Other"]', NULL, true, 3),
(2, 'all', 'runs_paid_ads', 'Do you currently run paid ads?', 'boolean', NULL, NULL, true, 4),
(2, 'all', 'ad_platforms', 'Which platforms?', 'multiselect', '["Meta", "Google", "TikTok", "LinkedIn", "Other"]', NULL, false, 5),
(2, 'all', 'monthly_budget', 'Monthly budget available for digital marketing (ads included)?', 'select', '["<€500", "€500–1.000", "€1.000–3.000", "€3.000+"]', 'Select budget range', true, 6),
(2, 'all', 'has_email_list', 'Do you have an active email list?', 'boolean', NULL, NULL, true, 7),
(2, 'all', 'email_list_size', 'Approx. email list size', 'select', '["<500", "500–5.000", "5.000+"]', 'Select size', false, 8),
(2, 'all', 'has_website', 'Do you have a website?', 'boolean', NULL, NULL, true, 9),
(2, 'all', 'website_url', 'Website URL', 'url', NULL, 'https://www.example.com', false, 10),
(2, 'all', 'uses_crm', 'Do you use a CRM or booking system?', 'boolean', NULL, NULL, true, 11),
(2, 'all', 'crm_name', 'Which CRM/booking system?', 'text', NULL, 'e.g. HubSpot, Calendly...', false, 12);

-- Seed Step 3 questions (all verticals)
INSERT INTO public.briefing_questions (step, vertical, field_key, question_text, question_type, options, placeholder, is_required, order_index) VALUES
(3, 'all', 'main_goal', 'What is your main goal right now?', 'select', '["Get more new clients", "Retain existing clients", "Both equally", "Launch a new offer"]', 'Select your main goal', true, 1),
(3, 'all', 'average_ticket', 'Average ticket / monthly fee per client', 'number', NULL, 'e.g. 150', true, 2),
(3, 'all', 'biggest_challenge', 'Biggest challenge getting new clients?', 'text', NULL, 'Tell us about your biggest challenge...', true, 3),
(3, 'all', 'differentiator', 'What makes you different from competitors?', 'text', NULL, 'Your unique value proposition...', true, 4),
(3, 'all', 'additional_info', 'Anything else you want us to know?', 'text', NULL, 'Any additional context...', false, 5);
