-- ====================================================================
-- 105: quote link fixes (audit C1, C8) and the rider preview (C10)
--
-- 1. bw_quote_link_publish: while the link is still a draft (the client
--    has never been sent it) a different summary replaces version 1
--    instead of adding version 2. Before, opening the share sheet made v1
--    with default settings and the real send made v2, so the client's
--    first visit already said "Updated on …".
-- 2. bw_quote_link_set_outcome (new, admins): the client answered by phone
--    or in person and the admin tapped Accepted / Declined in the app. The
--    client's page now shows that answer (and stops offering Accept /
--    Decline on an accepted quote) and the timeline records it. No
--    notification: the admin did it. A draft link (never sent) and an
--    acceptance the client gave on the page stay as they are.
-- 3. bw_rider_view gets p_preview (default false): the band checking its
--    own link (/rider.html?…&preview=1) no longer marks the rider "Seen".
--    The function is recreated with the extra parameter, so its anon
--    grant is given again.
--
-- No table changes. anon gets EXECUTE only on bw_rider_view, as before.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. Publish: a draft link keeps version 1
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_quote_link_publish(
  p_quote_id uuid,
  p_snapshot jsonb,
  p_lang text DEFAULT NULL,
  p_pdf_url text DEFAULT NULL
)
RETURNS TABLE (token text, status text, version int, revoked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid := public.bw_quote_admin_band(p_quote_id);
  v_link public.quote_links;
  v_lang text := lower(left(btrim(coalesce(p_lang, '')), 2));
  v_pdf text := nullif(btrim(coalesce(p_pdf_url, '')), '');
  v_changed boolean;
BEGIN
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR octet_length(p_snapshot::text) > 48000 THEN
    RAISE EXCEPTION 'Invalid quote summary' USING ERRCODE = '22023';
  END IF;
  IF v_lang NOT IN ('en', 'it', 'es', 'fr', 'de', 'pt') THEN v_lang := NULL; END IF;
  -- Only a PDF of this band in the public "quotes" bucket.
  IF v_pdf IS NOT NULL AND v_pdf !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/quotes/quotes/' || v_band::text || '/[A-Za-z0-9._%-]+$') THEN
    RAISE EXCEPTION 'Invalid PDF link' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.quote_links (quote_id, band_id, lang)
  VALUES (p_quote_id, v_band, coalesce(v_lang, 'en'))
  ON CONFLICT (quote_id) DO NOTHING;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.quote_id = p_quote_id FOR UPDATE;

  v_changed := v_link.snapshot IS DISTINCT FROM p_snapshot;
  IF v_changed AND v_link.status = 'draft' AND v_link.version >= 1 THEN
    -- Never sent: the client has seen no version yet, so this one is still
    -- version 1 (or the draft's current version, for links made before 105).
    INSERT INTO public.quote_link_versions (quote_id, band_id, version, snapshot, pdf_url)
    VALUES (p_quote_id, v_band, v_link.version, p_snapshot, v_pdf)
    ON CONFLICT (quote_id, version) DO UPDATE
      SET snapshot = EXCLUDED.snapshot, pdf_url = EXCLUDED.pdf_url, created_at = now();
  ELSIF v_changed THEN
    v_link.version := v_link.version + 1;
    INSERT INTO public.quote_link_versions (quote_id, band_id, version, snapshot, pdf_url)
    VALUES (p_quote_id, v_band, v_link.version, p_snapshot, v_pdf);
    -- After the first send, an edit is news for the client and the timeline.
    IF v_link.status <> 'draft' AND v_link.version > 1 THEN
      INSERT INTO public.quote_activity (quote_id, band_id, kind, version, actor_id)
      VALUES (p_quote_id, v_band, 'updated', v_link.version, auth.uid());
    END IF;
  ELSIF v_pdf IS NOT NULL THEN
    UPDATE public.quote_link_versions qv SET pdf_url = v_pdf
     WHERE qv.quote_id = p_quote_id AND qv.version = v_link.version;
  END IF;

  UPDATE public.quote_links l
     SET snapshot = p_snapshot,
         version = v_link.version,
         version_at = CASE WHEN v_changed THEN now() ELSE l.version_at END,
         lang = coalesce(v_lang, l.lang),
         -- A new version without its PDF yet hides the old PDF.
         pdf_url = CASE WHEN v_pdf IS NOT NULL THEN v_pdf WHEN v_changed THEN NULL ELSE l.pdf_url END,
         pdf_version = CASE WHEN v_pdf IS NOT NULL THEN v_link.version WHEN v_changed THEN NULL ELSE l.pdf_version END,
         updated_at = now()
   WHERE l.id = v_link.id
  RETURNING * INTO v_link;

  RETURN QUERY SELECT v_link.token, v_link.status, v_link.version, v_link.revoked_at IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_publish(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_publish(uuid, jsonb, text, text) TO authenticated;

-- --------------------------------------------------------------------
-- 2. The answer the admin recorded in the app
-- --------------------------------------------------------------------

-- Returns the link's status afterwards, or NULL when the quote has no link.
CREATE OR REPLACE FUNCTION public.bw_quote_link_set_outcome(
  p_quote_id uuid,
  p_outcome text,
  p_reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid := public.bw_quote_admin_band(p_quote_id);
  v_outcome text := lower(btrim(coalesce(p_outcome, '')));
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 1000), '');
  v_link public.quote_links;
  v_name text;
BEGIN
  IF v_outcome NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Outcome must be accepted or declined' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.quote_id = p_quote_id FOR UPDATE;
  IF v_link.id IS NULL THEN RETURN NULL; END IF;
  -- Never sent, or already accepted on the page: nothing to change.
  IF v_link.status IN ('draft', 'accepted') OR v_link.status = v_outcome THEN
    RETURN v_link.status;
  END IF;

  IF v_outcome = 'accepted' THEN
    SELECT nullif(left(regexp_replace(btrim(coalesce(q.client_name, '')), '\s+', ' ', 'g'), 120), '')
      INTO v_name FROM public.quotes q WHERE q.id = p_quote_id;
    UPDATE public.quote_links l
       SET status = 'accepted', responded_at = now(), accepted_name = v_name,
           accepted_version = l.version, accepted_snapshot = l.snapshot,
           accepted_pdf_url = CASE WHEN l.pdf_version = l.version THEN l.pdf_url END,
           decline_reason = NULL, updated_at = now()
     WHERE l.id = v_link.id;
    INSERT INTO public.quote_activity (quote_id, band_id, kind, body, version, actor_id)
    VALUES (p_quote_id, v_band, 'accepted', v_name, v_link.version, auth.uid());
  ELSE
    UPDATE public.quote_links l
       SET status = 'declined', responded_at = now(), decline_reason = v_reason, updated_at = now()
     WHERE l.id = v_link.id;
    INSERT INTO public.quote_activity (quote_id, band_id, kind, body, version, actor_id)
    VALUES (p_quote_id, v_band, 'declined', v_reason, v_link.version, auth.uid());
  END IF;
  RETURN v_outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_set_outcome(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_set_outcome(uuid, text, text) TO authenticated;

-- --------------------------------------------------------------------
-- 3. The rider page: the band's own preview is not "Seen"
-- --------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.bw_rider_view(text);

CREATE FUNCTION public.bw_rider_view(p_token text, p_preview boolean DEFAULT false)
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

  -- Seen: the first time someone outside the band opens it (not a preview).
  IF NOT coalesce(p_preview, false) AND (auth.uid() IS NULL OR NOT public.bw_is_band_member(v_c.band_id)) THEN
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

REVOKE ALL ON FUNCTION public.bw_rider_view(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_rider_view(text, boolean) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
