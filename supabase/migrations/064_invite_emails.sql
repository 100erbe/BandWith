-- ====================================================================
-- 064: Invite reminder and invite expired emails (daily job)
--
--   * reminder -> the invited address, once, when a pending invite has
--                 2 days or less left (and is at least a day old)
--   * expired  -> the admin who sent it, once, after a pending invite runs
--                 out (only invites that expired in the last 3 days, so old
--                 ones never flood anyone)
--
-- Every day at 08:00 UTC, pg_cron runs bw_email_invite_sweep(), which claims
-- each invitation (sets the *_sent_at column first, so nothing is sent twice)
-- and calls send-email through bw_dispatch_email (063). send-email re-reads
-- the invitation and skips it if it was accepted or declined meanwhile.
-- Re-inviting the same address resets both columns (invite-member).
-- Safe to run more than once.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.band_invitations
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

-- Invites that had already run out before this migration never get an email.
UPDATE public.band_invitations
SET expiry_notified_at = now()
WHERE status = 'pending' AND expires_at <= now() AND expiry_notified_at IS NULL;

CREATE OR REPLACE FUNCTION public.bw_email_invite_sweep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    UPDATE public.band_invitations
    SET reminder_sent_at = now()
    WHERE status = 'pending'
      AND reminder_sent_at IS NULL
      AND expires_at > now()
      AND expires_at <= now() + interval '2 days'
      AND created_at <= now() - interval '1 day'
    RETURNING id
  LOOP
    PERFORM public.bw_dispatch_email('onboarding_reminder', jsonb_build_object('invitationId', v_id));
  END LOOP;

  FOR v_id IN
    UPDATE public.band_invitations
    SET expiry_notified_at = now()
    WHERE status = 'pending'
      AND expiry_notified_at IS NULL
      AND invited_by IS NOT NULL
      AND expires_at <= now()
      AND expires_at > now() - interval '3 days'
    RETURNING id
  LOOP
    PERFORM public.bw_dispatch_email('invite_expired', jsonb_build_object('invitationId', v_id));
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_email_invite_sweep() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('bw-invite-emails')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bw-invite-emails');
  PERFORM cron.schedule('bw-invite-emails', '0 8 * * *', 'SELECT public.bw_email_invite_sweep()');
END;
$$;
