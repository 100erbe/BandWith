-- 072: events follow the same admin rule as 071
--
-- The band-event policies had piled up across migrations. Some counted as
-- admin anyone with role 'admin' even after leaving the band (is_active
-- false), and "Band admins can update events" also let the creator edit a
-- band event after losing the admin role. src/lib/permissions.ts gives
-- members no event create/edit/delete rights.
--
-- After this migration, for band events:
--   read                  active members of the band
--   create/edit/delete    active admins of the band
-- Personal gigs (band_id null) keep the "Users can ... own personal events"
-- policies from 029: the creator only.
--
-- Idempotent.

-- Older admin helper still used by functions written before 042.
CREATE OR REPLACE FUNCTION public.user_is_band_admin(p_user_id uuid, p_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.bw_is_band_admin(p_band_id, p_user_id);
$$;

-- Duplicates of events_*_policy with weaker checks.
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Band admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Band admins can update events" ON public.events;

DROP POLICY IF EXISTS events_select_policy ON public.events;
CREATE POLICY events_select_policy ON public.events
  FOR SELECT TO authenticated
  USING (band_id IS NOT NULL AND public.bw_is_band_member(band_id));

DROP POLICY IF EXISTS events_insert_policy ON public.events;
CREATE POLICY events_insert_policy ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (band_id IS NOT NULL AND public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS events_update_policy ON public.events;
CREATE POLICY events_update_policy ON public.events
  FOR UPDATE TO authenticated
  USING (band_id IS NOT NULL AND public.bw_is_band_admin(band_id))
  WITH CHECK (band_id IS NOT NULL AND public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS events_delete_policy ON public.events;
CREATE POLICY events_delete_policy ON public.events
  FOR DELETE TO authenticated
  USING (band_id IS NOT NULL AND public.bw_is_band_admin(band_id));
