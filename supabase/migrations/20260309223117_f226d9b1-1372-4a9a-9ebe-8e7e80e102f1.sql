
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) OR (
    current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role' = _role::text
  ) OR (
    current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'role' = _role::text
  );
END;
$$;
