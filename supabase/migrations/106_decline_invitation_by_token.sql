-- 106: decline a band invitation from its link, before signing in.
--
-- "Decline invitation" on the invite landing (the link /?invite=<token>) is
-- usually tapped by someone without an account. bw_decline_invitation (044)
-- needs a signed-in user whose email matches, so for them it raised
-- not_authenticated, the app swallowed it, and the invitation stayed pending:
-- the admin was never told and the reminder emails kept coming.
--
-- This function declines by token. Holding the token is the proof, exactly as
-- for bw_preview_invitation (044), which anon can already call: the token is
-- a random UUID sent only to the invitee. It can only move that one pending,
-- unexpired invitation to 'declined'; it returns nothing and reads nothing.
--
-- anon has no table privileges since 101; this SECURITY DEFINER function is
-- granted explicitly, like the preview.

CREATE OR REPLACE FUNCTION public.bw_decline_invitation_by_token(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE band_invitations
  SET status = 'declined'
  WHERE token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_decline_invitation_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_decline_invitation_by_token(uuid) TO anon, authenticated;
