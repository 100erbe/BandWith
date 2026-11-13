-- ====================================================================
-- 084: deputy requests with a reply link
--
-- When a member can't play, an admin asks a deputy (band_deputies, 069)
-- from "Find a deputy". Deputies don't have the app, so each request gets a
-- secret link to a small web page (/deputy.html?t=...) where the deputy
-- answers "Available", "Not sure yet, I'll confirm later" or "Can't make
-- it", and can change the answer until the gig. The admins get a push.
-- Once available, the page also shows the address and "Add to calendar".
--
-- 1. deputy_requests: one row per deputy asked for a gig. Admins only.
-- 2. bw_deputy_request_open: creates the request (or reuses the open one
--    for the same deputy and gig) and returns its link token. Admins only.
-- 3. bw_deputy_request_view / bw_deputy_request_reply: what the web page
--    calls with the token (no account). They return only what the deputy
--    needs: band, gig title, date, times, venue and city, role and the
--    offered fee. The street address is shown only once they said yes.
--    Never the client, the gig fee or other members' data.
-- 4. Changes after the answer: when the deputy answers, the gig details
--    (date, times, venue) are saved in answer_snapshot. If the band changes
--    them later, the page lists what changed and asks "Still OK?", and the
--    app flags the deputy so an admin can send the update in one tap.
-- 5. bw_deputy_feed: the deputy's confirmed gigs as a calendar
--    subscription (edge function deputy-calendar), so their personal
--    calendar follows every change and cancellation by itself.
-- 6. Push for the new notification type 'deputy_reply'.
--
-- Safe to run more than once.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.deputy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  deputy_id uuid REFERENCES public.band_deputies(id) ON DELETE SET NULL,
  deputy_name text NOT NULL CHECK (length(btrim(deputy_name)) BETWEEN 1 AND 120),
  replaces_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text CHECK (role IS NULL OR length(role) <= 120),
  fee_offered numeric CHECK (fee_offered IS NULL OR fee_offered >= 0),
  currency text CHECK (currency IS NULL OR length(currency) <= 8),
  -- 64 hex characters from two random UUIDs (244 random bits).
  token text NOT NULL UNIQUE
    DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    CHECK (token ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'maybe', 'unavailable', 'cancelled')),
  reply_note text CHECK (reply_note IS NULL OR length(reply_note) <= 500),
  responded_at timestamptz,
  -- Gig details when the deputy last answered (see bw_deputy_event_snapshot).
  answer_snapshot jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deputy_requests_event_idx ON public.deputy_requests (event_id, deputy_id);
CREATE INDEX IF NOT EXISTS deputy_requests_band_idx ON public.deputy_requests (band_id);

ALTER TABLE public.deputy_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deputy_requests_admin_select ON public.deputy_requests;
CREATE POLICY deputy_requests_admin_select ON public.deputy_requests
  FOR SELECT TO authenticated USING (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS deputy_requests_admin_update ON public.deputy_requests;
CREATE POLICY deputy_requests_admin_update ON public.deputy_requests
  FOR UPDATE TO authenticated
  USING (public.bw_is_band_admin(band_id))
  WITH CHECK (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS deputy_requests_admin_delete ON public.deputy_requests;
CREATE POLICY deputy_requests_admin_delete ON public.deputy_requests
  FOR DELETE TO authenticated USING (public.bw_is_band_admin(band_id));

-- Rows are created by bw_deputy_request_open only.
REVOKE ALL ON public.deputy_requests FROM anon, authenticated;
GRANT SELECT, DELETE ON public.deputy_requests TO authenticated;
-- Admins may only cancel (or reopen) a request from the app.
GRANT UPDATE (status, updated_at) ON public.deputy_requests TO authenticated;

-- --------------------------------------------------------------------
-- Open a request (admin): returns the link token
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_deputy_request_open(
  p_event_id uuid,
  p_deputy_id uuid,
  p_replaces_user_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_fee numeric DEFAULT NULL
)
RETURNS TABLE (id uuid, token text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band uuid;
  v_currency text;
  v_name text;
  v_row public.deputy_requests;
BEGIN
  SELECT e.band_id, e.currency INTO v_band, v_currency FROM public.events e WHERE e.id = p_event_id;
  IF v_band IS NULL OR NOT public.bw_is_band_admin(v_band) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT d.name INTO v_name FROM public.band_deputies d WHERE d.id = p_deputy_id AND d.band_id = v_band;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Deputy not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT r.* INTO v_row FROM public.deputy_requests r
   WHERE r.event_id = p_event_id AND r.deputy_id = p_deputy_id AND r.status <> 'cancelled'
   ORDER BY r.created_at DESC LIMIT 1;

  IF v_row.id IS NULL THEN
    INSERT INTO public.deputy_requests (band_id, event_id, deputy_id, deputy_name, replaces_user_id, role, fee_offered, currency, created_by)
    VALUES (v_band, p_event_id, p_deputy_id, v_name, p_replaces_user_id, nullif(left(btrim(coalesce(p_role, '')), 120), ''),
            CASE WHEN p_fee >= 0 THEN p_fee END, left(v_currency, 8), auth.uid())
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.deputy_requests r
       SET deputy_name = v_name,
           replaces_user_id = coalesce(p_replaces_user_id, r.replaces_user_id),
           role = coalesce(nullif(left(btrim(coalesce(p_role, '')), 120), ''), r.role),
           fee_offered = CASE WHEN p_fee >= 0 THEN p_fee ELSE r.fee_offered END,
           updated_at = now()
     WHERE r.id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN QUERY SELECT v_row.id, v_row.token, v_row.status;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_deputy_request_open(uuid, uuid, uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_deputy_request_open(uuid, uuid, uuid, text, numeric) TO authenticated;

-- --------------------------------------------------------------------
-- The gig details a deputy agrees to. Internal: only the functions below.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_deputy_event_snapshot(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'date', coalesce(e.event_date, e.date),
           'load_in', left(e.load_in_time::text, 5),
           'soundcheck', left(e.soundcheck_time::text, 5),
           'start', left(coalesce(e.start_time, e.time)::text, 5),
           'end', left(e.end_time::text, 5),
           'venue', coalesce(e.venue_name, e.venue),
           'city', e.venue_city,
           'address', e.venue_address
         )
    FROM public.events e
   WHERE e.id = p_event_id;
$$;
REVOKE ALL ON FUNCTION public.bw_deputy_event_snapshot(uuid) FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- The web page: read a request by its token (no account)
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_deputy_request_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
  v_snap jsonb;
  v_now jsonb;
  v_status text;
  v_changes jsonb := '[]'::jsonb;
  v_before jsonb := '{}'::jsonb;
  k text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT r.answer_snapshot, r.status, public.bw_deputy_event_snapshot(r.event_id)
    INTO v_snap, v_status, v_now
    FROM public.deputy_requests r WHERE r.token = p_token;
  -- What changed since the answer. The address counts only once they said
  -- yes (before that they never saw it).
  IF v_snap IS NOT NULL AND v_status IN ('available', 'maybe') THEN
    FOREACH k IN ARRAY ARRAY['date', 'load_in', 'soundcheck', 'start', 'end', 'venue', 'city', 'address'] LOOP
      CONTINUE WHEN k = 'address' AND v_status <> 'available';
      IF (v_snap->>k) IS DISTINCT FROM (v_now->>k) THEN
        v_changes := v_changes || to_jsonb(k);
        v_before := v_before || jsonb_build_object(k, v_snap->k);
      END IF;
    END LOOP;
  END IF;

  SELECT jsonb_build_object(
           'status', r.status,
           'deputy_name', r.deputy_name,
           'role', r.role,
           'fee', r.fee_offered,
           'currency', coalesce(r.currency, e.currency),
           'reply_note', r.reply_note,
           'responded_at', r.responded_at,
           'band_name', b.name,
           'event_title', e.title,
           'event_type', e.event_type,
           'event_date', coalesce(e.event_date, e.date),
           'start_time', coalesce(e.start_time, e.time),
           'end_time', e.end_time,
           'load_in_time', e.load_in_time,
           'soundcheck_time', e.soundcheck_time,
           'venue_name', coalesce(e.venue_name, e.venue),
           'venue_city', e.venue_city,
           -- The street address only after they said yes.
           'venue_address', CASE WHEN r.status = 'available' THEN e.venue_address END,
           'event_cancelled', coalesce(e.status, '') = 'cancelled',
           'event_updated_at', e.updated_at,
           'changes', v_changes,
           'before', v_before,
           -- A day of slack for time zones.
           'closed', r.status = 'cancelled' OR coalesce(e.status, '') = 'cancelled'
                     OR coalesce(e.event_date, e.date) < current_date - 1
         )
    INTO v
    FROM public.deputy_requests r
    JOIN public.events e ON e.id = r.event_id
    JOIN public.bands b ON b.id = r.band_id
   WHERE r.token = p_token;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_deputy_request_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_deputy_request_view(text) TO anon, authenticated;

-- --------------------------------------------------------------------
-- The web page: the deputy answers (no account). Admins get a push.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_deputy_request_reply(p_token text, p_answer text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_view jsonb;
  v_row public.deputy_requests;
  v_new text := lower(btrim(coalesce(p_answer, '')));
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_title text;
  v_date date;
  v_snap jsonb;
  v_ack boolean;
BEGIN
  IF v_new NOT IN ('available', 'maybe', 'unavailable') THEN
    RAISE EXCEPTION 'Answer must be available, maybe or unavailable' USING ERRCODE = '22023';
  END IF;
  v_view := public.bw_deputy_request_view(p_token);
  IF v_view IS NULL THEN RETURN NULL; END IF;
  IF (v_view->>'closed')::boolean THEN RETURN v_view; END IF;

  SELECT * INTO v_row FROM public.deputy_requests WHERE token = p_token FOR UPDATE;
  v_snap := CASE WHEN v_new = 'unavailable' THEN NULL ELSE public.bw_deputy_event_snapshot(v_row.event_id) END;
  -- Same answer again after the gig changed = "still OK with the new details".
  v_ack := v_row.status = v_new AND v_new <> 'unavailable'
           AND jsonb_array_length(coalesce(v_view->'changes', '[]'::jsonb)) > 0;
  IF v_row.status = v_new AND v_row.reply_note IS NOT DISTINCT FROM v_note AND NOT v_ack THEN
    RETURN v_view;
  END IF;

  UPDATE public.deputy_requests
     SET status = v_new, reply_note = v_note, answer_snapshot = v_snap,
         responded_at = now(), updated_at = now()
   WHERE id = v_row.id;

  -- Tell the band's admins when the answer changes or the deputy confirms
  -- the new details (not for a note edit).
  IF v_row.status IS DISTINCT FROM v_new OR v_ack THEN
    SELECT e.title, coalesce(e.event_date, e.date) INTO v_title, v_date FROM public.events e WHERE e.id = v_row.event_id;
    INSERT INTO public.notifications (user_id, band_id, type, title, body, data)
    SELECT bm.user_id, v_row.band_id, 'deputy_reply',
           CASE WHEN v_ack AND v_new = 'available' THEN v_row.deputy_name || ' is OK with the changes'
                WHEN v_ack THEN v_row.deputy_name || ' saw the changes, will confirm later'
                WHEN v_new = 'available' THEN v_row.deputy_name || ' is available'
                WHEN v_new = 'maybe' THEN v_row.deputy_name || ' will confirm later'
                ELSE v_row.deputy_name || ' can''t make it' END,
           coalesce(v_title, 'Gig') || coalesce(' · ' || to_char(v_date, 'Dy DD Mon'), '')
             || coalesce(' · "' || v_note || '"', ''),
           jsonb_build_object(
             'event_id', v_row.event_id,
             'deputy_request_id', v_row.id,
             'deputy_name', v_row.deputy_name,
             'answer', v_new,
             'acknowledged', v_ack,
             'eventTitle', v_title
           )
      FROM public.band_members bm
     WHERE bm.band_id = v_row.band_id AND bm.role = 'admin' AND coalesce(bm.is_active, true);
  END IF;

  RETURN public.bw_deputy_request_view(p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.bw_deputy_request_reply(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_deputy_request_reply(text, text, text) TO anon, authenticated;

-- --------------------------------------------------------------------
-- Calendar subscription: the deputy's gigs with this band, by any of
-- their request tokens. Confirmed gigs, plus the ones they had answered
-- that were cancelled since (so the calendar marks them cancelled).
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_deputy_feed(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.deputy_requests;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT * INTO v_req FROM public.deputy_requests WHERE token = p_token;
  IF v_req.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'band_name', (SELECT b.name FROM public.bands b WHERE b.id = v_req.band_id),
    'deputy_name', v_req.deputy_name,
    'gigs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id,
               'token', r.token,
               'cancelled', r.status = 'cancelled' OR coalesce(e.status, '') = 'cancelled',
               'role', r.role,
               'event_title', e.title,
               'event_date', coalesce(e.event_date, e.date),
               'start_time', coalesce(e.start_time, e.time),
               'end_time', e.end_time,
               'load_in_time', e.load_in_time,
               'soundcheck_time', e.soundcheck_time,
               'venue_name', coalesce(e.venue_name, e.venue),
               'venue_city', e.venue_city,
               'venue_address', e.venue_address,
               'updated_at', greatest(e.updated_at, r.updated_at)
             ) ORDER BY coalesce(e.event_date, e.date))
        FROM public.deputy_requests r
        JOIN public.events e ON e.id = r.event_id
       WHERE r.band_id = v_req.band_id
         AND (r.id = v_req.id OR (v_req.deputy_id IS NOT NULL AND r.deputy_id = v_req.deputy_id))
         AND (r.status = 'available' OR (r.status = 'cancelled' AND r.answer_snapshot IS NOT NULL))
         AND coalesce(e.event_date, e.date) >= current_date - 60
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bw_deputy_feed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_deputy_feed(text) TO anon, authenticated;

-- --------------------------------------------------------------------
-- Push: same as 068, plus 'deputy_reply'
-- --------------------------------------------------------------------

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
    'chat_message', 'chat_mention', 'deputy_reply'
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
