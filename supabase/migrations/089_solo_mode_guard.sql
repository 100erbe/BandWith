-- 089 · "Solo" mode never hides a band the user belongs to.
--
-- Solo mode (profiles.user_mode = 'solo') shows a personal calendar and hides
-- every band. It is meant for accounts with no band. If an account that is an
-- active member of a band lands in solo mode (for example by going through
-- onboarding again after a sign-in, when the app could not load its bands),
-- all its gigs, setlists and chats look gone although nothing was deleted.
--
-- 1) Puts such accounts back in band mode: 'band_admin' when they run at
--    least one of their bands, 'member' otherwise.
-- 2) From now on, a write of user_mode = 'solo' for an account with an
--    active membership stores the band mode instead (034 already does the
--    reverse when a solo user is added to a band).
--
-- Only user_mode changes; role, sub_tier and the band data are untouched.

BEGIN;

CREATE OR REPLACE FUNCTION public.bw_band_mode_for(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM band_members
      WHERE user_id = p_user AND is_active IS TRUE AND role::text = 'admin'
    ) THEN 'band_admin'
    WHEN EXISTS (
      SELECT 1 FROM band_members
      WHERE user_id = p_user AND is_active IS TRUE
    ) THEN 'member'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.bw_band_mode_for(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bw_profiles_no_solo_with_band()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  band_mode text;
BEGIN
  IF NEW.user_mode = 'solo' THEN
    band_mode := public.bw_band_mode_for(NEW.id);
    IF band_mode IS NOT NULL THEN
      NEW.user_mode := band_mode;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_profiles_no_solo_with_band() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_no_solo_with_band ON public.profiles;
CREATE TRIGGER trg_profiles_no_solo_with_band
BEFORE INSERT OR UPDATE OF user_mode ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.bw_profiles_no_solo_with_band();

-- Heal the accounts already in that state.
UPDATE public.profiles p
SET user_mode = public.bw_band_mode_for(p.id)
WHERE p.user_mode = 'solo'
  AND public.bw_band_mode_for(p.id) IS NOT NULL;

COMMIT;
