-- 093 · Rider linked to the gig (version, sent / seen) and per-musician payouts.
--
-- 1. contracts.version: riders (and contracts) carry a version number, "v3".
--    "New version" in the app bumps it and clears sent / seen.
-- 2. contracts.view_token: the rider's read-only web link for the venue
--    (/rider.html?t=…). Opening it stamps viewed_at, which is how the band
--    learns the venue has seen it ("seen 2 Dec"). Only admins read contracts
--    (075), so only they ever see the token.
-- 3. bw_rider_share_link(contract): admins get (or create) that token.
-- 4. bw_rider_view(token): the web page, no account. Returns the rider and the
--    gig's stage (plot, inputs, who brings what) and logistics; never the
--    client, the fee or the terms of the contract. An admin of the band
--    opening their own link does not count as "seen".
-- 5. bw_event_rider(event): the rider linked to a gig with its version and
--    sent / seen dates, for every active member of the band (contracts
--    themselves stay admin-only: no client, no money in what this returns).
-- 6. bw_set_member_paid(event, user, paid): admins mark one musician paid or
--    not paid (071 only had "mark all paid"). A member still reads only their
--    own row through bw_event_member_money.
--
-- New readable columns: version and view_token get their own GRANT below.

BEGIN;

-- ---------------------------------------------------------------- columns --

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_version_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_version_check CHECK (version BETWEEN 1 AND 999);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS view_token text;
ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_view_token_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_view_token_check CHECK (view_token IS NULL OR view_token ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_view_token ON public.contracts(view_token) WHERE view_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_event_id ON public.contracts(event_id) WHERE event_id IS NOT NULL;

-- Readable by admins only, through the contracts_select policy (075).
GRANT SELECT (version, view_token) ON public.contracts TO authenticated;

-- ------------------------------------------------------- share link (admin) --

CREATE OR REPLACE FUNCTION public.bw_rider_share_link(p_contract_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid;
  v_type text;
  v_token text;
BEGIN
  SELECT c.band_id, c.type, c.view_token INTO v_band, v_type, v_token
    FROM public.contracts c WHERE c.id = p_contract_id;
  IF v_band IS NULL OR NOT public.bw_is_band_admin(v_band) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_type <> 'rider' THEN
    RAISE EXCEPTION 'Only riders have a web link' USING ERRCODE = '22023';
  END IF;
  IF v_token IS NULL THEN
    -- 64 hex characters from two random UUIDs (244 random bits), as 084.
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.contracts SET view_token = v_token, updated_at = now() WHERE id = p_contract_id;
  END IF;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_rider_share_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_rider_share_link(uuid) TO authenticated;

-- ------------------------------------------------- the web page (no account) --

CREATE OR REPLACE FUNCTION public.bw_rider_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.contracts;
  v jsonb;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT * INTO v_c FROM public.contracts c WHERE c.view_token = p_token AND c.type = 'rider';
  IF v_c.id IS NULL THEN RETURN NULL; END IF;

  -- Seen: the first time someone outside the band opens it.
  IF auth.uid() IS NULL OR NOT public.bw_is_band_member(v_c.band_id) THEN
    UPDATE public.contracts c
       SET viewed_at = coalesce(c.viewed_at, now()),
           sent_at = coalesce(c.sent_at, now()),
           status = CASE WHEN c.status IN ('draft', 'sent') THEN 'viewed' ELSE c.status END,
           updated_at = CASE WHEN c.viewed_at IS NULL THEN now() ELSE c.updated_at END
     WHERE c.id = v_c.id
    RETURNING * INTO v_c;
  END IF;

  SELECT jsonb_build_object(
           'title', v_c.title,
           'version', v_c.version,
           'notes', v_c.content,
           'band_name', b.name,
           'event_title', coalesce(e.title, v_c.event_name),
           'event_date', coalesce(e.event_date, e.date, v_c.event_date),
           'start_time', coalesce(e.start_time, e.time),
           'end_time', e.end_time,
           'load_in_time', e.load_in_time,
           'soundcheck_time', e.soundcheck_time,
           'venue_name', coalesce(e.venue_name, e.venue),
           'venue_city', e.venue_city,
           'stage', CASE WHEN s.event_id IS NULL THEN NULL ELSE jsonb_build_object(
             'plots', s.plots,
             'inputs', s.inputs,
             'mixer', s.mixer,
             'band_brings', s.band_brings,
             'venue_provides', s.venue_provides,
             'venue_agreed', s.venue_agreed
           ) END
         )
    INTO v
    FROM public.bands b
    LEFT JOIN public.events e ON e.id = v_c.event_id
    LEFT JOIN public.event_stage s ON s.event_id = v_c.event_id
   WHERE b.id = v_c.band_id;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_rider_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_rider_view(text) TO anon, authenticated;

-- ------------------------------------------- rider status on the gig (members) --

CREATE OR REPLACE FUNCTION public.bw_event_rider(p_event_id uuid)
RETURNS TABLE (id uuid, title text, version integer, status text, sent_at timestamptz, viewed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.title::text, c.version, c.status::text, c.sent_at, c.viewed_at
    FROM public.contracts c
   WHERE c.event_id = p_event_id
     AND c.type = 'rider'
     AND auth.uid() IS NOT NULL
     AND public.bw_is_band_member(c.band_id)
   ORDER BY c.version DESC, c.created_at DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.bw_event_rider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_event_rider(uuid) TO authenticated;

-- ------------------------------------------------ one musician paid (admin) --

CREATE OR REPLACE FUNCTION public.bw_set_member_paid(p_event_id uuid, p_user_id uuid, p_paid boolean)
RETURNS TABLE (user_id uuid, paid_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bw_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION 'Only band admins can mark payouts' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    UPDATE event_members em
       SET paid_at = CASE WHEN p_paid THEN coalesce(em.paid_at, now()) ELSE NULL END
     WHERE em.event_id = p_event_id
       AND em.user_id = p_user_id
       AND COALESCE(em.status, '') <> 'declined'
    RETURNING em.user_id, em.paid_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such musician on this event' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_set_member_paid(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_set_member_paid(uuid, uuid, boolean) TO authenticated;

COMMIT;
