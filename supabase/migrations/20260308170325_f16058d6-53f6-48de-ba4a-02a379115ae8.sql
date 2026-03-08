
-- Enums
CREATE TYPE public.market AS ENUM ('es', 'it', 'ar');
CREATE TYPE public.prospect_status AS ENUM ('new', 'proposal_ready', 'call_scheduled', 'accepted', 'rejected', 'archived');
CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'churned');
CREATE TYPE public.transcript_status AS ENUM ('pending', 'processing', 'ready');
CREATE TYPE public.asset_type AS ENUM ('landing_page', 'email_flow', 'social_post', 'blog_article');
CREATE TYPE public.asset_status AS ENUM ('pending_review', 'change_requested', 'approved');
CREATE TYPE public.revision_requested_by AS ENUM ('client', 'pragma');
CREATE TYPE public.app_role AS ENUM ('pragma_admin', 'client');

-- User roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'pragma_admin'));

-- Prospects
CREATE TABLE public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    vertical TEXT NOT NULL,
    sub_niche TEXT NOT NULL,
    market market NOT NULL,
    status prospect_status NOT NULL DEFAULT 'new',
    briefing_answers JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a prospect" ON public.prospects
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all prospects" ON public.prospects
  FOR SELECT USING (public.has_role(auth.uid(), 'pragma_admin'));
CREATE POLICY "Admins can update prospects" ON public.prospects
  FOR UPDATE USING (public.has_role(auth.uid(), 'pragma_admin'));
CREATE POLICY "Admins can delete prospects" ON public.prospects
  FOR DELETE USING (public.has_role(auth.uid(), 'pragma_admin'));

-- Clients
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    prospect_id UUID REFERENCES public.prospects(id),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    vertical TEXT NOT NULL,
    sub_niche TEXT NOT NULL,
    market market NOT NULL,
    status client_status NOT NULL DEFAULT 'active'
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all clients" ON public.clients
  FOR ALL USING (public.has_role(auth.uid(), 'pragma_admin'));
CREATE POLICY "Clients can view their own record" ON public.clients
  FOR SELECT USING (user_id = auth.uid());

-- Proposals
CREATE TABLE public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recommended_flow TEXT,
    recommended_tools JSONB,
    pricing JSONB,
    timeline TEXT,
    pitch_suggestions TEXT,
    full_proposal_content JSONB,
    pragma_notes TEXT
);
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage proposals" ON public.proposals
  FOR ALL USING (public.has_role(auth.uid(), 'pragma_admin'));

-- Kickoff briefs
CREATE TABLE public.kickoff_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    suggested_questions JSONB,
    transcript_text TEXT,
    audio_file_url TEXT,
    transcript_status transcript_status DEFAULT 'pending',
    generated_prompts JSONB,
    pragma_approved BOOLEAN DEFAULT false
);
ALTER TABLE public.kickoff_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kickoff briefs" ON public.kickoff_briefs
  FOR ALL USING (public.has_role(auth.uid(), 'pragma_admin'));

-- Assets
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    asset_type asset_type NOT NULL,
    asset_name TEXT NOT NULL,
    file_url TEXT,
    content JSONB,
    status asset_status NOT NULL DEFAULT 'pending_review',
    client_comment TEXT,
    version INT NOT NULL DEFAULT 1
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all assets" ON public.assets
  FOR ALL USING (public.has_role(auth.uid(), 'pragma_admin'));
CREATE POLICY "Clients can view their own assets" ON public.assets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clients WHERE clients.id = assets.client_id AND clients.user_id = auth.uid())
  );
CREATE POLICY "Clients can update their own assets" ON public.assets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.clients WHERE clients.id = assets.client_id AND clients.user_id = auth.uid())
  );

-- Revision rounds
CREATE TABLE public.revision_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
    round_number INT NOT NULL,
    comment TEXT,
    requested_by revision_requested_by NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.revision_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage revision rounds" ON public.revision_rounds
  FOR ALL USING (public.has_role(auth.uid(), 'pragma_admin'));
CREATE POLICY "Clients can view their revision rounds" ON public.revision_rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = revision_rounds.asset_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "Clients can create revision rounds" ON public.revision_rounds
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assets a
      JOIN public.clients c ON c.id = a.client_id
      WHERE a.id = revision_rounds.asset_id AND c.user_id = auth.uid()
    )
  );

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;
