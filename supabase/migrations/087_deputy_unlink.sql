-- ============================================================================
-- 087: an admin unlinks a deputy's BandWith account
-- ----------------------------------------------------------------------------
-- 086 links a deputy entry to the account that opened the reply link. When the
-- wrong person opened it (a forwarded link), or the deputy changed account, an
-- admin of the band clears the link here:
--  - band_deputies.user_id goes back to NULL: no more pushes, and the account
--    no longer sees the band's gigs in "Deputy gigs";
--  - every request of that deputy gets a new token, so the old reply page,
--    calendar feed and app link stop working for whoever holds them. Answers
--    stay as they are. The next request sent by message carries the new
--    link, and opening it from the app links the right account again.
-- Returns 'unlinked', or 'not_linked' when there was nothing to clear.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bw_deputy_unlink(p_deputy_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.band_deputies;
BEGIN
  SELECT * INTO v_dep FROM public.band_deputies d WHERE d.id = p_deputy_id FOR UPDATE;
  IF v_dep.id IS NULL OR NOT public.bw_is_band_admin(v_dep.band_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_dep.user_id IS NULL THEN
    RETURN 'not_linked';
  END IF;

  UPDATE public.band_deputies SET user_id = NULL, updated_at = now() WHERE id = v_dep.id;

  UPDATE public.deputy_requests r
     SET token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
   WHERE r.deputy_id = v_dep.id;

  RETURN 'unlinked';
END;
$$;

REVOKE ALL ON FUNCTION public.bw_deputy_unlink(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_deputy_unlink(uuid) TO authenticated;
