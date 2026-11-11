-- ====================================================================
-- 066: Names, not address fragments
--
-- Until now, an account created without a name got the part of its email
-- address before the @ as full_name ("alex.bianchi"), which the app then
-- showed as if it were a name. From now on:
--   * sign-up keeps full_name empty when no name was given;
--   * existing names equal to that part of the address are cleared;
--   * bw_display_name (used by notifications and push) falls back to the
--     whole address, never to a fragment of it.
-- The app shows the address while there is no name and asks for one in
-- the profile (src/lib/personName.ts). Same rule as the emails.
-- Safe to run more than once.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    nullif(trim(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS SETOF band_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  result band_members;
  _email TEXT;
BEGIN
  _email := auth.jwt() ->> 'email';

  -- Ensure a profile row exists (handles admin-created accounts without trigger).
  -- No name yet: the person adds it in the app.
  INSERT INTO profiles (id, email, full_name)
  VALUES (auth.uid(), _email, NULL)
  ON CONFLICT (id) DO NOTHING;

  FOR inv IN
    SELECT id, band_id, role
    FROM band_invitations
    WHERE lower(email) = lower(_email)
    AND status = 'pending'
  LOOP
    INSERT INTO band_members (band_id, user_id, role, is_active)
    VALUES (inv.band_id, auth.uid(), COALESCE(inv.role, 'member')::user_role, true)
    ON CONFLICT (band_id, user_id) DO UPDATE SET is_active = true, role = EXCLUDED.role
    RETURNING * INTO result;

    UPDATE band_invitations SET status = 'accepted' WHERE id = inv.id;

    RETURN NEXT result;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.bw_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    CASE WHEN lower(trim(full_name)) IN (lower(split_part(email, '@', 1)), lower(email)) THEN NULL
         ELSE nullif(trim(full_name), '') END,
    nullif(email, ''),
    'A member')
  FROM public.profiles WHERE id = p_user_id;
$$;

-- Existing accounts: a "name" that is just the start of the address is not a name.
UPDATE public.profiles
SET full_name = NULL
WHERE full_name IS NOT NULL
  AND lower(trim(full_name)) = lower(split_part(email, '@', 1));
