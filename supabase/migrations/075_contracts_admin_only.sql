-- 075 · Contracts and riders: only active admins read and write.
--
-- Writes were already admin-only, but every active member could read every
-- contract of the band, with the client's name, email, phone, company,
-- address, the fee and the terms ("Users can view contracts of their bands").
--
-- Decided on 2026-11-13: members see only their own fee and the logistics
-- data, never the client or the gig price. Contracts hold both, so they become
-- admin-only. The app hides "Contracts & docs" for members.
--
-- The three write policies keep the same rule (active admin) and only move to
-- the shared helper bw_is_band_admin, like events, setlists and templates.
-- Replaces the policies exported in 073 for this table.

BEGIN;

DROP POLICY IF EXISTS "Users can view contracts of their bands" ON public.contracts;
DROP POLICY IF EXISTS "Admins can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
DROP POLICY IF EXISTS contracts_update ON public.contracts;
DROP POLICY IF EXISTS contracts_delete ON public.contracts;

CREATE POLICY contracts_select ON public.contracts
  FOR SELECT TO authenticated
  USING (public.bw_is_band_admin(band_id));

CREATE POLICY contracts_insert ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_is_band_admin(band_id));

CREATE POLICY contracts_update ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.bw_is_band_admin(band_id))
  WITH CHECK (public.bw_is_band_admin(band_id));

CREATE POLICY contracts_delete ON public.contracts
  FOR DELETE TO authenticated
  USING (public.bw_is_band_admin(band_id));

COMMIT;
