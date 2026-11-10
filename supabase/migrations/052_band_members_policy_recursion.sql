-- 052: break the band_members <-> band_invitations RLS recursion.
--
-- "Users can join via invitation" (band_members INSERT) read band_invitations,
-- whose "Band admins can manage invitations" policy read band_members again.
-- Postgres rejects that with 42P17 for EVERY insert into band_members made
-- with RLS, including an admin adding a member. Both checks now go through
-- SECURITY DEFINER helpers, which read the tables without re-entering RLS.

CREATE OR REPLACE FUNCTION public.bw_has_pending_invite(p_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_invitations bi
    WHERE bi.band_id = p_band_id
      AND lower(bi.email) = lower(auth.jwt() ->> 'email')
      AND bi.status = 'pending'
      AND (bi.expires_at IS NULL OR bi.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.bw_has_pending_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_has_pending_invite(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can join via invitation" ON public.band_members;
CREATE POLICY "Users can join via invitation"
  ON public.band_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'::user_role
    AND public.bw_has_pending_invite(band_id)
  );

DROP POLICY IF EXISTS "Band admins can manage invitations" ON public.band_invitations;
CREATE POLICY "Band admins can manage invitations"
  ON public.band_invitations
  FOR ALL
  TO authenticated
  USING (public.bw_is_band_admin(band_id))
  WITH CHECK (public.bw_is_band_admin(band_id));
