-- 061: joining a band from an invitation always failed.
--
-- band_members.role is the enum user_role, but bw_accept_invitation inserted
-- band_invitations.role, which is text. Postgres has no implicit text -> enum
-- cast, so every accept raised "column role is of type user_role but
-- expression is of type text" and the app showed a generic connection error.
-- Same function as 044, with an explicit cast.

CREATE OR REPLACE FUNCTION public.bw_accept_invitation(p_token uuid DEFAULT NULL::uuid, p_invitation_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  VALUES (v_inv.band_id, v_uid, COALESCE(v_inv.role, 'member')::user_role, true, NULL)
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
$function$;
