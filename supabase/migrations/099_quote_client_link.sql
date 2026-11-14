-- ====================================================================
-- 099: the client confirms a quote from a link
--
-- Like the deputy reply link (084): the admin sends the client a message
-- (WhatsApp, SMS, email or a copied link) with a personal link to a small
-- web page, /quote.html?t=<token>. Without an account the client sees the
-- quote summary and the PDF, and can Accept (typed name + "I accept"),
-- Decline (optional reason) or Discuss (messages; the band answers from
-- the app and the reply shows on the same page). The admins get a push
-- and an in-app notification when the client opens the quote, accepts,
-- declines or writes, in their own language (as 088-090).
--
-- 1. quote_links: one per quote. The token, the client's language, the
--    client-facing summary the app publishes (the same numbers and labels
--    as the PDF, in the client's language) and its version, the PDF link,
--    and where the client is: draft → sent → viewed → discussing →
--    accepted / declined. Admins only.
-- 2. quote_link_versions: every summary the client could see. Editing a
--    sent quote publishes a new version; the link always shows the latest
--    ("updated on …"). An acceptance locks the version it was given on.
-- 3. quote_activity: the quote's timeline (sent, reminded, viewed,
--    updated, messages both ways, accepted, declined, link rotated or
--    turned off). Admins only.
-- 4. Admin RPCs: publish the summary, record a send / reminder, reply,
--    rotate or revoke the link.
-- 5. Page RPCs (no account, SECURITY DEFINER, by token): view, seen,
--    respond (accept / decline), message. They return only the published
--    client summary, the band's name and the conversation. Never the
--    musicians, their fees, internal notes or anything else of the band.
--    The quotes table itself stays closed to anon.
-- 6. Notifications: quote_viewed, quote_accepted, quote_declined,
--    quote_message to the band's active admins, translated by a BEFORE
--    INSERT trigger from profiles.preferred_language, and pushed.
--
-- Safe to run more than once.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quote_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL UNIQUE REFERENCES public.quotes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  -- 64 hex characters from two random UUIDs (244 random bits), as 084.
  token text NOT NULL UNIQUE
    DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    CHECK (token ~ '^[0-9a-f]{64}$'),
  lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'it', 'es', 'fr', 'de', 'pt')),
  -- What the client sees (built by the app, see src/lib/services/quoteLinks.ts).
  snapshot jsonb,
  version int NOT NULL DEFAULT 0,
  version_at timestamptz,
  -- Public PDF of the version pdf_version (bucket "quotes", as the share sheet).
  pdf_url text CHECK (pdf_url IS NULL OR length(pdf_url) <= 600),
  pdf_version int,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'discussing', 'accepted', 'declined')),
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  responded_at timestamptz,
  accepted_name text CHECK (accepted_name IS NULL OR length(accepted_name) <= 120),
  accepted_version int,
  accepted_snapshot jsonb,
  accepted_pdf_url text,
  decline_reason text CHECK (decline_reason IS NULL OR length(decline_reason) <= 1000),
  revoked_at timestamptz,
  -- send-email: at most one quote email a minute (set by the function).
  last_emailed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_links_band_idx ON public.quote_links (band_id);

CREATE TABLE IF NOT EXISTS public.quote_link_versions (
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  pdf_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quote_id, version)
);

CREATE TABLE IF NOT EXISTS public.quote_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'sent', 'resent', 'reminded', 'viewed', 'updated', 'client_message', 'band_reply',
    'accepted', 'declined', 'link_rotated', 'link_revoked'
  )),
  body text CHECK (body IS NULL OR length(body) <= 2000),
  channel text CHECK (channel IS NULL OR channel IN ('whatsapp', 'sms', 'email', 'copy', 'share')),
  version int,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_activity_quote_idx ON public.quote_activity (quote_id, created_at);

ALTER TABLE public.quote_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_link_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_links_admin_select ON public.quote_links;
CREATE POLICY quote_links_admin_select ON public.quote_links
  FOR SELECT TO authenticated USING (public.bw_is_band_admin(band_id));
DROP POLICY IF EXISTS quote_link_versions_admin_select ON public.quote_link_versions;
CREATE POLICY quote_link_versions_admin_select ON public.quote_link_versions
  FOR SELECT TO authenticated USING (public.bw_is_band_admin(band_id));
DROP POLICY IF EXISTS quote_activity_admin_select ON public.quote_activity;
CREATE POLICY quote_activity_admin_select ON public.quote_activity
  FOR SELECT TO authenticated USING (public.bw_is_band_admin(band_id));

-- Read by admins (RLS above); every write goes through the functions below.
REVOKE ALL ON public.quote_links, public.quote_link_versions, public.quote_activity FROM anon, authenticated;
GRANT SELECT ON public.quote_links, public.quote_link_versions, public.quote_activity TO authenticated;

-- --------------------------------------------------------------------
-- Helpers (internal)
-- --------------------------------------------------------------------

-- The quote's admins, for notifications.
CREATE OR REPLACE FUNCTION public.bw_quote_notify(p_quote_id uuid, p_type text, p_title text, p_body text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid;
BEGIN
  SELECT q.band_id INTO v_band FROM public.quotes q WHERE q.id = p_quote_id;
  IF v_band IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, band_id, type, title, body, data)
  SELECT bm.user_id, v_band, p_type, left(p_title, 255), p_body,
         coalesce(p_data, '{}'::jsonb) || jsonb_build_object('quote_id', p_quote_id, 'source', 'quote_link')
    FROM public.band_members bm
   WHERE bm.band_id = v_band AND bm.role = 'admin' AND coalesce(bm.is_active, true) AND bm.user_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_notify(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- The admin check every admin RPC starts with; returns the band.
CREATE OR REPLACE FUNCTION public.bw_quote_admin_band(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid;
BEGIN
  SELECT q.band_id INTO v_band FROM public.quotes q WHERE q.id = p_quote_id;
  IF v_band IS NULL OR NOT public.bw_is_band_admin(v_band) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN v_band;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_admin_band(uuid) FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- 4. Admin RPCs
-- --------------------------------------------------------------------

-- Publish what the client sees (creates the link the first time). A
-- different summary is a new version; once the quote was sent, the
-- timeline says it was updated. Returns the link.
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
  IF v_changed THEN
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

-- The message with the link left through a channel: first send, a resend
-- or a reminder. A draft quote becomes sent.
CREATE OR REPLACE FUNCTION public.bw_quote_link_mark_sent(p_quote_id uuid, p_kind text DEFAULT 'sent', p_channel text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid := public.bw_quote_admin_band(p_quote_id);
  v_link public.quote_links;
  v_kind text;
  v_channel text := nullif(lower(btrim(coalesce(p_channel, ''))), '');
BEGIN
  IF v_channel IS NOT NULL AND v_channel NOT IN ('whatsapp', 'sms', 'email', 'copy', 'share') THEN v_channel := NULL; END IF;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.quote_id = p_quote_id FOR UPDATE;
  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Publish the quote first' USING ERRCODE = 'P0002';
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'The link is turned off' USING ERRCODE = '22023';
  END IF;
  v_kind := CASE WHEN p_kind = 'reminded' THEN 'reminded'
                 WHEN v_link.status = 'draft' THEN 'sent' ELSE 'resent' END;

  INSERT INTO public.quote_activity (quote_id, band_id, kind, channel, version, actor_id)
  VALUES (p_quote_id, v_band, v_kind, v_channel, v_link.version, auth.uid());

  IF v_link.status = 'draft' THEN
    UPDATE public.quote_links l SET status = 'sent', sent_at = now(), updated_at = now() WHERE l.id = v_link.id;
    v_link.status := 'sent';
  END IF;
  UPDATE public.quotes q SET status = 'sent', sent_at = coalesce(q.sent_at, now()), updated_at = now()
   WHERE q.id = p_quote_id AND coalesce(q.status, 'draft') = 'draft';
  RETURN v_link.status;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_mark_sent(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_mark_sent(uuid, text, text) TO authenticated;

-- The band answers in the conversation (shown on the page).
CREATE OR REPLACE FUNCTION public.bw_quote_reply(p_quote_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid := public.bw_quote_admin_band(p_quote_id);
  v_body text := nullif(left(btrim(coalesce(p_body, '')), 2000), '');
  v_link public.quote_links;
  v_id uuid;
BEGIN
  IF v_body IS NULL THEN RAISE EXCEPTION 'Empty message' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.quote_id = p_quote_id;
  IF v_link.id IS NULL THEN RAISE EXCEPTION 'Publish the quote first' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.quote_activity (quote_id, band_id, kind, body, version, actor_id)
  VALUES (p_quote_id, v_band, 'band_reply', v_body, v_link.version, auth.uid())
  RETURNING id INTO v_id;
  UPDATE public.quote_links l SET updated_at = now() WHERE l.id = v_link.id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_quote_reply(uuid, text) TO authenticated;

-- A new link (the old one stops working; also turns a revoked link back on).
CREATE OR REPLACE FUNCTION public.bw_quote_link_rotate(p_quote_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid := public.bw_quote_admin_band(p_quote_id);
  v_token text;
BEGIN
  UPDATE public.quote_links l
     SET token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
         revoked_at = NULL, updated_at = now()
   WHERE l.quote_id = p_quote_id
  RETURNING l.token INTO v_token;
  IF v_token IS NULL THEN RAISE EXCEPTION 'No link yet' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.quote_activity (quote_id, band_id, kind, actor_id) VALUES (p_quote_id, v_band, 'link_rotated', auth.uid());
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_rotate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_rotate(uuid) TO authenticated;

-- Turn the link off: the page says it no longer works.
CREATE OR REPLACE FUNCTION public.bw_quote_link_revoke(p_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid := public.bw_quote_admin_band(p_quote_id);
BEGIN
  UPDATE public.quote_links l SET revoked_at = now(), updated_at = now()
   WHERE l.quote_id = p_quote_id AND l.revoked_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.quote_activity (quote_id, band_id, kind, actor_id) VALUES (p_quote_id, v_band, 'link_revoked', auth.uid());
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_revoke(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_revoke(uuid) TO authenticated;

-- --------------------------------------------------------------------
-- 5. The web page (no account), by token
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_quote_link_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.quote_links;
  v_band text;
  v_client text;
  v_snap jsonb;
  v_valid date;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.token = p_token;
  IF v_link.id IS NULL OR v_link.revoked_at IS NOT NULL OR v_link.snapshot IS NULL THEN RETURN NULL; END IF;
  SELECT b.name, q.client_name INTO v_band, v_client
    FROM public.quotes q JOIN public.bands b ON b.id = q.band_id WHERE q.id = v_link.quote_id;
  -- Accepted: what the client accepted, whatever was edited afterwards.
  v_snap := CASE WHEN v_link.status = 'accepted' THEN coalesce(v_link.accepted_snapshot, v_link.snapshot) ELSE v_link.snapshot END;
  BEGIN
    v_valid := nullif(v_snap ->> 'validUntil', '')::date;
  EXCEPTION WHEN others THEN v_valid := NULL;
  END;

  RETURN jsonb_build_object(
    'status', v_link.status,
    'lang', v_link.lang,
    'band_name', v_band,
    'client_name', v_client,
    'quote', v_snap,
    'version', CASE WHEN v_link.status = 'accepted' THEN coalesce(v_link.accepted_version, v_link.version) ELSE v_link.version END,
    'updated_at', CASE WHEN v_link.version > 1 THEN v_link.version_at END,
    'pdf_url', CASE WHEN v_link.status = 'accepted' THEN v_link.accepted_pdf_url
                    WHEN v_link.pdf_version = v_link.version THEN v_link.pdf_url END,
    'accepted_name', v_link.accepted_name,
    'accepted_at', CASE WHEN v_link.status = 'accepted' THEN v_link.responded_at END,
    'declined_at', CASE WHEN v_link.status = 'declined' THEN v_link.responded_at END,
    'decline_reason', CASE WHEN v_link.status = 'declined' THEN v_link.decline_reason END,
    -- A day of slack for time zones.
    'expired', v_link.status <> 'accepted' AND v_valid IS NOT NULL AND v_valid < current_date - 1,
    'messages', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'from', CASE a.kind WHEN 'client_message' THEN 'client' ELSE 'band' END,
               'body', a.body,
               'at', a.created_at
             ) ORDER BY a.created_at)
        FROM public.quote_activity a
       WHERE a.quote_id = v_link.quote_id AND a.kind IN ('client_message', 'band_reply')
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_view(text) TO anon, authenticated;

-- The page was opened. The first time: Viewed, and the admins hear it.
CREATE OR REPLACE FUNCTION public.bw_quote_link_seen(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.quote_links;
  v_title text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.token = p_token FOR UPDATE;
  IF v_link.id IS NULL OR v_link.revoked_at IS NOT NULL OR v_link.snapshot IS NULL THEN RETURN NULL; END IF;

  IF v_link.first_viewed_at IS NULL THEN
    UPDATE public.quote_links l
       SET first_viewed_at = now(), last_viewed_at = now(),
           status = CASE WHEN l.status IN ('draft', 'sent') THEN 'viewed' ELSE l.status END,
           updated_at = now()
     WHERE l.id = v_link.id;
    INSERT INTO public.quote_activity (quote_id, band_id, kind, version)
    VALUES (v_link.quote_id, v_link.band_id, 'viewed', v_link.version);
    UPDATE public.quotes q
       SET status = CASE WHEN coalesce(q.status, 'draft') IN ('draft', 'sent') THEN 'viewed' ELSE q.status END,
           viewed_at = coalesce(q.viewed_at, now())
     WHERE q.id = v_link.quote_id;
    v_title := v_link.snapshot ->> 'title';
    PERFORM public.bw_quote_notify(v_link.quote_id, 'quote_viewed',
      coalesce((SELECT q.client_name FROM public.quotes q WHERE q.id = v_link.quote_id), 'The client') || ' opened the quote',
      coalesce(v_title, 'Quote') || coalesce(' · ' || (v_link.snapshot ->> 'ref'), ''),
      jsonb_build_object('kind', 'viewed', 'eventTitle', v_title, 'ref', v_link.snapshot ->> 'ref'));
  ELSIF v_link.last_viewed_at IS NULL OR v_link.last_viewed_at < now() - interval '5 minutes' THEN
    UPDATE public.quote_links l SET last_viewed_at = now() WHERE l.id = v_link.id;
  END IF;
  RETURN public.bw_quote_link_view(p_token);
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_seen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_seen(text) TO anon, authenticated;

-- Accept (typed name, on the version the client saw) or decline.
-- An acceptance is final on the page; a decline can still become an
-- acceptance. A stale version (the band changed the quote meanwhile)
-- returns the new view with "stale": true and records nothing.
CREATE OR REPLACE FUNCTION public.bw_quote_link_respond(
  p_token text,
  p_action text,
  p_name text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_version int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.quote_links;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_name text := nullif(left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 120), '');
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 1000), '');
  v_view jsonb;
  v_title text;
  v_client text;
BEGIN
  IF v_action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Action must be accept or decline' USING ERRCODE = '22023';
  END IF;
  v_view := public.bw_quote_link_view(p_token);
  IF v_view IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.token = p_token FOR UPDATE;
  IF v_link.status = 'accepted' THEN RETURN v_view; END IF;
  IF p_version IS NOT NULL AND p_version <> v_link.version THEN
    RETURN v_view || jsonb_build_object('stale', true);
  END IF;
  v_title := v_link.snapshot ->> 'title';
  SELECT q.client_name INTO v_client FROM public.quotes q WHERE q.id = v_link.quote_id;

  IF v_action = 'accept' THEN
    IF v_name IS NULL OR length(v_name) < 2 THEN
      RAISE EXCEPTION 'Type your name to accept' USING ERRCODE = '22023';
    END IF;
    IF (v_view ->> 'expired')::boolean THEN RETURN v_view; END IF;
    UPDATE public.quote_links l
       SET status = 'accepted', responded_at = now(), accepted_name = v_name,
           accepted_version = l.version, accepted_snapshot = l.snapshot,
           accepted_pdf_url = CASE WHEN l.pdf_version = l.version THEN l.pdf_url END,
           decline_reason = NULL, updated_at = now()
     WHERE l.id = v_link.id;
    INSERT INTO public.quote_activity (quote_id, band_id, kind, body, version)
    VALUES (v_link.quote_id, v_link.band_id, 'accepted', v_name, v_link.version);
    UPDATE public.quotes q
       SET status = 'accepted', accepted_at = now(), responded_at = now(), response_type = 'accepted',
           rejection_reason = NULL, updated_at = now()
     WHERE q.id = v_link.quote_id;
    PERFORM public.bw_quote_notify(v_link.quote_id, 'quote_accepted',
      coalesce(v_client, 'The client') || ' accepted the quote',
      coalesce(v_title, 'Quote') || coalesce(' · ' || (v_link.snapshot ->> 'totalLabel'), ''),
      jsonb_build_object('kind', 'accepted', 'eventTitle', v_title, 'ref', v_link.snapshot ->> 'ref',
                         'accepted_name', v_name, 'total', v_link.snapshot ->> 'totalLabel'));
  ELSE
    UPDATE public.quote_links l
       SET status = 'declined', responded_at = now(), decline_reason = v_reason, updated_at = now()
     WHERE l.id = v_link.id;
    INSERT INTO public.quote_activity (quote_id, band_id, kind, body, version)
    VALUES (v_link.quote_id, v_link.band_id, 'declined', v_reason, v_link.version);
    UPDATE public.quotes q
       SET status = 'declined', responded_at = now(), response_type = 'declined',
           rejection_reason = v_reason, updated_at = now()
     WHERE q.id = v_link.quote_id;
    PERFORM public.bw_quote_notify(v_link.quote_id, 'quote_declined',
      coalesce(v_client, 'The client') || ' declined the quote',
      coalesce(v_title, 'Quote') || coalesce(' · "' || left(v_reason, 140) || '"', ''),
      jsonb_build_object('kind', 'declined', 'eventTitle', v_title, 'ref', v_link.snapshot ->> 'ref',
                         'reason', left(v_reason, 140)));
  END IF;
  RETURN public.bw_quote_link_view(p_token);
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_respond(text, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_respond(text, text, text, text, int) TO anon, authenticated;

-- The client writes to the band. Before an answer the quote is now
-- under discussion. At most 20 messages an hour per link.
CREATE OR REPLACE FUNCTION public.bw_quote_link_message(p_token text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.quote_links;
  v_body text := nullif(left(btrim(coalesce(p_body, '')), 2000), '');
  v_recent int;
  v_title text;
  v_client text;
BEGIN
  IF v_body IS NULL THEN RAISE EXCEPTION 'Empty message' USING ERRCODE = '22023'; END IF;
  IF public.bw_quote_link_view(p_token) IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_link FROM public.quote_links l WHERE l.token = p_token FOR UPDATE;
  SELECT count(*) INTO v_recent FROM public.quote_activity a
   WHERE a.quote_id = v_link.quote_id AND a.kind = 'client_message' AND a.created_at > now() - interval '1 hour';
  IF v_recent >= 20 THEN
    RAISE EXCEPTION 'Too many messages, try again later' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.quote_activity (quote_id, band_id, kind, body, version)
  VALUES (v_link.quote_id, v_link.band_id, 'client_message', v_body, v_link.version);
  IF v_link.status IN ('draft', 'sent', 'viewed', 'declined') THEN
    UPDATE public.quote_links l SET status = 'discussing', updated_at = now() WHERE l.id = v_link.id;
    UPDATE public.quotes q SET status = 'negotiating', updated_at = now()
     WHERE q.id = v_link.quote_id AND coalesce(q.status, 'draft') NOT IN ('accepted', 'archived');
  END IF;

  v_title := v_link.snapshot ->> 'title';
  SELECT q.client_name INTO v_client FROM public.quotes q WHERE q.id = v_link.quote_id;
  PERFORM public.bw_quote_notify(v_link.quote_id, 'quote_message',
    coalesce(v_client, 'The client') || ' wrote about the quote',
    coalesce(v_title, 'Quote') || ': "' || left(v_body, 140) || '"',
    jsonb_build_object('kind', 'message', 'eventTitle', v_title, 'ref', v_link.snapshot ->> 'ref',
                       'excerpt', left(v_body, 140)));
  RETURN public.bw_quote_link_view(p_token);
END;
$$;
REVOKE ALL ON FUNCTION public.bw_quote_link_message(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_quote_link_message(text, text) TO anon, authenticated;

-- --------------------------------------------------------------------
-- 6. Notifications in the reader's language (as 088) and push
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_quote_text(p_key text, p_lang text, p_vars jsonb DEFAULT '{}'::jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  k text;
BEGIN
  v := (CASE p_key
    WHEN 'viewed' THEN '{"it":"{name} ha aperto il preventivo","es":"{name} ha abierto el presupuesto","fr":"{name} a ouvert le devis","de":"{name} hat das Angebot geöffnet","pt":"{name} abriu o orçamento"}'
    WHEN 'accepted' THEN '{"it":"{name} ha accettato il preventivo","es":"{name} ha aceptado el presupuesto","fr":"{name} a accepté le devis","de":"{name} hat das Angebot angenommen","pt":"{name} aceitou o orçamento"}'
    WHEN 'declined' THEN '{"it":"{name} ha rifiutato il preventivo","es":"{name} ha rechazado el presupuesto","fr":"{name} a refusé le devis","de":"{name} hat das Angebot abgelehnt","pt":"{name} recusou o orçamento"}'
    WHEN 'message' THEN '{"it":"{name} ha scritto sul preventivo","es":"{name} ha escrito sobre el presupuesto","fr":"{name} a écrit à propos du devis","de":"{name} hat zum Angebot geschrieben","pt":"{name} escreveu sobre o orçamento"}'
    WHEN 'client' THEN '{"it":"Il cliente","es":"El cliente","fr":"Le client","de":"Der Kunde","pt":"O cliente"}'
    WHEN 'quote' THEN '{"it":"Preventivo","es":"Presupuesto","fr":"Devis","de":"Angebot","pt":"Orçamento"}'
    WHEN 'accepted_by' THEN '{"it":"accettato da {who}","es":"aceptado por {who}","fr":"accepté par {who}","de":"angenommen von {who}","pt":"aceite por {who}"}'
  END)::jsonb ->> p_lang;
  IF v IS NULL THEN RETURN NULL; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(p_vars, '{}'::jsonb)) LOOP
    v := replace(v, '{' || k || '}', coalesce(p_vars ->> k, ''));
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.bw_trg_quote_notification_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb := coalesce(NEW.data, '{}'::jsonb);
  v_lang text;
  v_kind text := d ->> 'kind';
  v_name text;
  v_title text;
  v_head text;
  v_body text;
BEGIN
  SELECT lower(left(btrim(p.preferred_language), 2)) INTO v_lang FROM public.profiles p WHERE p.id = NEW.user_id;
  IF v_lang IS NULL OR v_lang NOT IN ('it', 'es', 'fr', 'de', 'pt') OR v_kind IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT q.client_name INTO v_name FROM public.quotes q WHERE q.id = nullif(d ->> 'quote_id', '')::uuid;
  EXCEPTION WHEN others THEN v_name := NULL;
  END;
  v_name := coalesce(nullif(btrim(v_name), ''), public.bw_quote_text('client', v_lang));
  v_title := coalesce(nullif(d ->> 'eventTitle', ''), public.bw_quote_text('quote', v_lang));
  v_head := public.bw_quote_text(v_kind, v_lang, jsonb_build_object('name', v_name));
  v_body := CASE v_kind
    WHEN 'viewed' THEN v_title || coalesce(' · ' || nullif(d ->> 'ref', ''), '')
    WHEN 'accepted' THEN v_title || coalesce(' · ' || nullif(d ->> 'total', ''), '')
                         || coalesce(' · ' || public.bw_quote_text('accepted_by', v_lang, jsonb_build_object('who', nullif(d ->> 'accepted_name', ''))), '')
    WHEN 'declined' THEN v_title || coalesce(' · "' || nullif(d ->> 'reason', '') || '"', '')
    WHEN 'message' THEN v_title || ': "' || coalesce(d ->> 'excerpt', '') || '"'
  END;
  NEW.title := left(coalesce(v_head, NEW.title), 255);
  NEW.body := coalesce(v_body, NEW.body);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_quote_notification_text() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_notifications_quote_text ON public.notifications;
CREATE TRIGGER bw_notifications_quote_text
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type IN ('quote_viewed', 'quote_accepted', 'quote_declined', 'quote_message')
        AND coalesce(NEW.data ->> 'source', '') = 'quote_link')
  EXECUTE FUNCTION public.bw_trg_quote_notification_text();

-- Push: same as 086, plus the quote link types.
CREATE OR REPLACE FUNCTION public.bw_trg_dispatch_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text;
  v_secret text;
  v_push_pref text;
BEGIN
  -- Rows created by send-push itself were already pushed.
  IF coalesce(NEW.data->>'skip_push', 'false') = 'true' THEN RETURN NEW; END IF;

  IF NEW.type NOT IN (
    'invite_received', 'event_invite', 'event_update', 'event_cancelled',
    'event_reminder', 'rehearsal_reminder', 'member_dropped_out',
    'rehearsal_poll', 'rehearsal_proposal',
    'quote_accepted', 'payment_due', 'payment_overdue', 'fee_changed',
    'chat_message', 'chat_mention', 'deputy_reply',
    'deputy_joined', 'deputy_request', 'deputy_gig_changed',
    'quote_viewed', 'quote_declined', 'quote_message'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT notification_preferences->>'push' INTO v_push_pref FROM public.profiles WHERE id = NEW.user_id;
  IF coalesce(v_push_pref, 'true') = 'false' THEN RETURN NEW; END IF;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'bw_project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'bw_push_dispatch_secret' LIMIT 1;
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bw-dispatch-secret', v_secret),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      -- send-push requires a body; fall back to the title.
      'body', coalesce(nullif(NEW.body, ''), NEW.title),
      'create_in_app', false,
      'data', coalesce(NEW.data, '{}'::jsonb) || jsonb_build_object(
        'type', NEW.type,
        'notification_id', NEW.id,
        'band_id', NEW.band_id
      )
    ),
    timeout_milliseconds := 8000
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_dispatch_push: %', SQLERRM;
  RETURN NEW;
END;
$function$;
