
-- The "Anyone can create a prospect" policy uses WITH CHECK (true) intentionally
-- because the briefing form is public. Let's restrict to authenticated or anon role
-- and add input validation constraints instead.
DROP POLICY "Anyone can create a prospect" ON public.prospects;
CREATE POLICY "Anyone can submit a briefing" ON public.prospects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND
    company_name IS NOT NULL AND
    email IS NOT NULL AND
    char_length(name) <= 200 AND
    char_length(company_name) <= 200 AND
    char_length(email) <= 255
  );
