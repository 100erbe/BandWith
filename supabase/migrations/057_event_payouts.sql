-- 057: per-member payout status for the Fee & payouts sheet (Figma 23:1104).
--
-- event_members.paid_at: when the band paid this musician for the event
-- (NULL = pending). The app shows PAID / PENDING badges and an admin-only
-- "Mark all as paid" action; it hides both when this column is missing.
--
-- Who can write it:
--   * UPDATE on event_members is already limited by RLS to the member's own
--     row (users_can_update_own_membership, 026) and band admins
--     (admins_can_update_memberships, 026) / personal-gig creators (029).
--   * The own-row policy would let a member stamp their own paid_at, so the
--     042 guard trigger (which already stops members changing fee/role) now
--     covers paid_at too: only band admins, or the creator of a personal gig,
--     may change it. Service-role jobs (auth.uid() IS NULL) are unaffected.
--
-- Idempotent.

ALTER TABLE public.event_members
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.event_members.paid_at IS
  'When the band paid this member for the event (NULL = payout pending). Set by band admins from Fee & payouts.';

CREATE OR REPLACE FUNCTION public.bw_guard_event_member_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / server-side jobs
  END IF;
  IF NEW.fee IS NOT DISTINCT FROM OLD.fee
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at THEN
    RETURN NEW;
  END IF;
  SELECT band_id, created_by INTO ev FROM events WHERE id = NEW.event_id;
  IF (ev.band_id IS NOT NULL AND public.bw_is_band_admin(ev.band_id))
     OR (ev.band_id IS NULL AND ev.created_by = auth.uid()) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Only band admins can change fees, roles or payouts' USING ERRCODE = '42501';
END;
$$;

-- The trigger itself (042) is unchanged; recreate it in case 042 was not applied.
DROP TRIGGER IF EXISTS bw_guard_event_member_update ON public.event_members;
CREATE TRIGGER bw_guard_event_member_update
  BEFORE UPDATE ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.bw_guard_event_member_update();
