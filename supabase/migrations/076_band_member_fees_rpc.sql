-- 076 · Band member fees through an RPC (step 1 of 2).
--
-- band_members.default_fee and fee_percentage are readable today by every
-- member of the band, so each member sees what the colleagues are paid.
-- Decided on 2026-11-13: members see only their own fee.
--
-- Step 1 (this migration): bw_band_member_fees() returns every row of the
-- bands the caller administers and only the caller's own row elsewhere. The
-- app reads band_members with an explicit column list and takes the fees
-- from here. Nothing is revoked yet, so installed apps keep working.
--
-- Step 2 (077, once the apps are updated): revoke direct SELECT on the two
-- fee columns, like event_members.fee in 071.

BEGIN;

CREATE OR REPLACE FUNCTION public.bw_band_member_fees(p_band_ids uuid[])
RETURNS TABLE (band_id uuid, user_id uuid, default_fee numeric, fee_percentage numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT bm.band_id, bm.user_id, bm.default_fee, bm.fee_percentage
  FROM band_members bm
  WHERE auth.uid() IS NOT NULL
    AND bm.band_id = ANY (p_band_ids)
    AND (bm.user_id = auth.uid() OR public.bw_is_band_admin(bm.band_id));
$$;

REVOKE ALL ON FUNCTION public.bw_band_member_fees(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_band_member_fees(uuid[]) TO authenticated;

COMMIT;
