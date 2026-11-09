-- ====================================================================
-- 044 — Band invitations: one table, server-side acceptance
--
-- Before: the onboarding read/wrote an `invitations` table, the edge
-- functions wrote `band_invitations`, and joiners tried to INSERT
-- themselves into band_members from the client (blocked by RLS, and unsafe
-- if it ever worked: any band_id would do).
--
-- After:
--   * band_invitations is the only invitations table (pending rows from the
--     legacy `invitations` table are copied over; that table is left alone).
--   * bw_preview_invitation(token)        → band info for an invite link/code
--                                           (anon + authenticated).
--   * bw_accept_invitation(token | id)    → joins the band. The invitation
--                                           email must match the caller's
--                                           account email.
--   * bw_decline_invitation(id)
--   * bw_my_pending_invitations()          → invites waiting for the caller.
--
-- Requires 042 (bw_is_band_admin etc.). Idempotent.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. band_invitations shape
-- --------------------------------------------------------------------
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS invited_by UUID;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.band_invitations SET token = gen_random_uuid() WHERE token IS NULL;
ALTER TABLE public.band_invitations ALTER COLUMN token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_band_invitations_token ON public.band_invitations(token);

-- Emails are compared case-insensitively everywhere: store them lowercased.
UPDATE public.band_invitations SET email = lower(trim(email)) WHERE email <> lower(trim(email));

-- One invitation per (band, email). Keep the newest row of any duplicates,
-- then add the constraint the edge function's upsert relies on.
DELETE FROM public.band_invitations a
USING public.band_invitations b
WHERE a.band_id = b.band_id
  AND a.email = b.email
  AND (a.created_at, a.id) < (b.created_at, b.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'band_invitations_band_email_key'
  ) THEN
    ALTER TABLE public.band_invitations
      ADD CONSTRAINT band_invitations_band_email_key UNIQUE (band_id, email);
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. Copy pending rows from the legacy `invitations` table, if present
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.invitations') IS NOT NULL THEN
    INSERT INTO public.band_invitations (band_id, email, role, status, token, created_at)
    SELECT i.band_id,
           lower(trim(i.email)),
           CASE WHEN i.role = 'admin' THEN 'admin' ELSE 'member' END,
           'pending',
           COALESCE(i.token, gen_random_uuid()),
           COALESCE(i.created_at, now())
    FROM public.invitations i
    WHERE i.status = 'pending'
      AND i.band_id IS NOT NULL
      AND i.email IS NOT NULL
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Copied pending rows from public.invitations into band_invitations. The legacy table is no longer used by the app.';
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 3. Preview an invitation by token (shown before sign-up)
--    The token is a random UUID delivered only to the invitee, so holding
--    it is enough to see which band is inviting them.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_preview_invitation(p_token uuid)
RETURNS TABLE (
  id uuid,
  band_id uuid,
  email text,
  role text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  band_name text,
  band_logo_url text,
  band_description text,
  member_count bigint,
  inviter_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bi.id,
         bi.band_id,
         bi.email::text,
         bi.role::text,
         bi.status::text,
         bi.created_at,
         bi.expires_at,
         b.name::text,
         b.logo_url::text,
         b.description::text,
         (SELECT count(*) FROM band_members bm WHERE bm.band_id = bi.band_id AND COALESCE(bm.is_active, true)),
         p.full_name::text
  FROM band_invitations bi
  JOIN bands b ON b.id = bi.band_id
  LEFT JOIN profiles p ON p.id = bi.invited_by
  WHERE bi.token = p_token
    AND bi.status = 'pending'
    AND (bi.expires_at IS NULL OR bi.expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.bw_preview_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_preview_invitation(uuid) TO anon, authenticated;

-- --------------------------------------------------------------------
-- 4. Pending invitations for the signed-in user (in-app banner)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_my_pending_invitations()
RETURNS TABLE (
  id uuid,
  band_id uuid,
  role text,
  created_at timestamptz,
  expires_at timestamptz,
  band_name text,
  band_logo_url text,
  member_count bigint,
  inviter_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bi.id,
         bi.band_id,
         bi.role::text,
         bi.created_at,
         bi.expires_at,
         b.name::text,
         b.logo_url::text,
         (SELECT count(*) FROM band_members bm WHERE bm.band_id = bi.band_id AND COALESCE(bm.is_active, true)),
         p.full_name::text
  FROM band_invitations bi
  JOIN bands b ON b.id = bi.band_id
  LEFT JOIN profiles p ON p.id = bi.invited_by
  WHERE auth.uid() IS NOT NULL
    AND bi.email = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
    AND bi.status = 'pending'
    AND (bi.expires_at IS NULL OR bi.expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = bi.band_id AND bm.user_id = auth.uid() AND COALESCE(bm.is_active, true)
    )
  ORDER BY bi.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.bw_my_pending_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_my_pending_invitations() TO authenticated;

-- --------------------------------------------------------------------
-- 5. Accept: by token (link / code) or by id (email lookup, in-app banner)
--    Errors use stable messages the client maps to copy:
--      invite_not_found | invite_expired | invite_email_mismatch | not_authenticated
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_accept_invitation(
  p_token uuid DEFAULT NULL,
  p_invitation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv band_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_uid;

  SELECT * INTO v_inv
  FROM band_invitations bi
  WHERE (p_token IS NOT NULL AND bi.token = p_token)
     OR (p_token IS NULL AND p_invitation_id IS NOT NULL AND bi.id = p_invitation_id)
  FOR UPDATE;

  IF NOT FOUND OR v_inv.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.email IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'invite_email_mismatch' USING ERRCODE = '42501';
  END IF;

  -- Accepting twice is harmless: return the band.
  IF v_inv.status = 'accepted' AND v_inv.accepted_by = v_uid THEN
    RETURN v_inv.band_id;
  ELSIF v_inv.status = 'accepted' THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at <= now() THEN
    UPDATE band_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invite_expired' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO band_members (band_id, user_id, role, is_active, left_at)
  VALUES (v_inv.band_id, v_uid, COALESCE(v_inv.role, 'member'), true, NULL)
  ON CONFLICT (band_id, user_id) DO UPDATE
    SET is_active = true,
        left_at = NULL,
        -- never downgrade an existing admin through an invitation
        role = CASE WHEN band_members.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END;

  UPDATE band_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  -- Joiners become 'member' unless they already run their own band.
  UPDATE profiles
  SET user_mode = 'member'
  WHERE id = v_uid AND (user_mode IS NULL OR user_mode = 'solo');

  RETURN v_inv.band_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_accept_invitation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_accept_invitation(uuid, uuid) TO authenticated;

-- --------------------------------------------------------------------
-- 6. Decline
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_decline_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE band_invitations
  SET status = 'declined'
  WHERE id = p_invitation_id
    AND status = 'pending'
    AND email = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()));
END;
$$;

REVOKE ALL ON FUNCTION public.bw_decline_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_decline_invitation(uuid) TO authenticated;

-- --------------------------------------------------------------------
-- 7. The invitee may read their own rows (matched on the verified auth email
--    from the JWT, not on the editable profiles.email).
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can see their invitations" ON public.band_invitations;
CREATE POLICY "Users can see their invitations" ON public.band_invitations
  FOR SELECT TO authenticated USING (
    email = lower(auth.jwt() ->> 'email')
  );

COMMIT;
