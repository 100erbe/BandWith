-- 079 · Band member fees: no direct read (2.3c step 2 of 2).
--
-- Apply only once every installed app reads band_members with an explicit
-- column list and the fees through bw_band_member_fees() (076). An older app
-- that still asks for select('*') would get "permission denied".
--
-- Like event_members in 071: SELECT on every column except default_fee and
-- fee_percentage. New columns on band_members must be added to this GRANT.
-- Writes are unchanged: admins still set fees (bw_guard_band_member_update).

BEGIN;

REVOKE SELECT ON public.band_members FROM anon, authenticated;
GRANT SELECT (id, band_id, user_id, role, instrument, stage_name, is_active, joined_at, left_at)
  ON public.band_members TO authenticated;

COMMIT;
