-- ====================================================================
-- 086: deputies in the app
--
-- A deputy who got a reply link (084) can install BandWith. Their account
-- is then linked to the band's deputy entry, and from then on the band asks
-- them through the app (push + answer in the app) instead of WhatsApp/SMS.
--
-- 1. band_deputies.user_id: the deputy's account, set only by
--    bw_deputy_claim (admins can read it but not write it).
-- 2. bw_deputy_claim(token): links the signed-in user to the deputy of that
--    request (unless another account is linked already, or they are a
--    member of the band) and tells the admins ('deputy_joined').
-- 3. bw_my_deputy_gigs(): the caller's requests across bands, with the same
--    deputy-safe fields as the reply page (bw_deputy_request_view: their
--    own offered fee, logistics, the address only after a yes; never the
--    client, the gig fee or other members), plus the token so the app can
--    answer with bw_deputy_request_reply.
-- 4. Pushes to a linked deputy (band_id NULL: it's not their band):
--    'deputy_request' when an admin asks them (new request, or "Ask in the
--    app" again with bw_deputy_request_ping), 'deputy_gig_changed' when the
--    date, times, venue or address change after they answered, or when the
--    gig or their request is cancelled.
-- 5. Push for the new types (bw_trg_dispatch_push, same as 084 otherwise).
--
-- Safe to run more than once.
-- ====================================================================

ALTER TABLE public.band_deputies
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS band_deputies_user_idx ON public.band_deputies (user_id) WHERE user_id IS NOT NULL;

-- Admins keep reading every column (table-level SELECT, 069) but may only
-- write the contact fields: the account link comes from the deputy only.
REVOKE INSERT, UPDATE ON public.band_deputies FROM authenticated;
GRANT INSERT (band_id, name, instrument, phone, email, notes, default_fee) ON public.band_deputies TO authenticated;
GRANT UPDATE (name, instrument, phone, email, notes, default_fee, updated_at) ON public.band_deputies TO authenticated;

-- --------------------------------------------------------------------
-- Internal: push to the deputy linked to a request. Not callable by users.
-- p_kind: request | recap | changed | cancelled | withdrawn
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_deputy_notify(p_request_id uuid, p_kind text, p_changes text[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.deputy_requests;
  v_uid uuid;
  v_band text;
  v_title text;
  v_date date;
  v_venue text;
  v_when text;
  v_type text := CASE WHEN p_kind IN ('request', 'recap') THEN 'deputy_request' ELSE 'deputy_gig_changed' END;
  v_head text;
  v_body text;
BEGIN
  SELECT * INTO v_req FROM public.deputy_requests WHERE id = p_request_id;
  IF v_req.id IS NULL OR v_req.deputy_id IS NULL THEN RETURN 0; END IF;
  SELECT d.user_id INTO v_uid FROM public.band_deputies d WHERE d.id = v_req.deputy_id;
  IF v_uid IS NULL THEN RETURN 0; END IF;

  SELECT b.name INTO v_band FROM public.bands b WHERE b.id = v_req.band_id;
  SELECT coalesce(e.title, 'Gig'), coalesce(e.event_date, e.date),
         nullif(concat_ws(', ', nullif(coalesce(e.venue_name, e.venue), ''), nullif(e.venue_city, '')), '')
    INTO v_title, v_date, v_venue
    FROM public.events e WHERE e.id = v_req.event_id;
  v_when := coalesce(to_char(v_date, 'Dy DD Mon'), 'date TBD');

  v_head := CASE p_kind
    WHEN 'request' THEN coalesce(v_band, 'A band') || ': can you play?'
    WHEN 'recap' THEN 'You''re confirmed: ' || v_title
    WHEN 'changed' THEN v_title || ' has changed'
    WHEN 'cancelled' THEN v_title || ' is cancelled'
    ELSE coalesce(v_band, 'The band') || ' no longer needs you'
  END;
  v_body := CASE p_kind
    WHEN 'changed' THEN v_title || ' · ' || v_when || ' — new '
                        || coalesce(array_to_string(p_changes, ', '), 'details') || '. Still OK?'
    WHEN 'cancelled' THEN v_title || ' · ' || v_when || ' was cancelled by ' || coalesce(v_band, 'the band') || '.'
    WHEN 'withdrawn' THEN v_title || ' · ' || v_when || ': the request was withdrawn.'
    ELSE v_title || ' · ' || v_when || coalesce(' · ' || v_venue, '')
  END;

  RETURN public.bw_notify(
    ARRAY[v_uid], NULL, v_type, v_head, v_body,
    jsonb_build_object(
      'deputy_request_id', v_req.id,
      'kind', p_kind,
      'band_name', v_band,
      'event_title', v_title,
      'event_date', v_date,
      'changes', to_jsonb(coalesce(p_changes, '{}'::text[]))
    ),
    v_req.id, 'deputy_request',
    -- No double push for a double tap or a burst of edits.
    CASE WHEN p_kind IN ('request', 'recap', 'changed') THEN interval '2 minutes' END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bw_deputy_notify(uuid, text, text[]) FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- Open a request (admin): same as 084, plus a push to a linked deputy
-- when the request is new.
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
    PERFORM public.bw_deputy_notify(v_row.id, 'request');
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
-- "Ask in the app" on a request that already exists (admin): pushes the
-- request again, the recap after a yes, or "Still OK?" after a change.
-- Returns sent | not_linked | closed | throttled.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_deputy_request_ping(p_request_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.deputy_requests;
  v_view jsonb;
  v_linked boolean;
  v_changes text[];
  v_kind text;
BEGIN
  SELECT * INTO v_req FROM public.deputy_requests WHERE id = p_request_id;
  IF v_req.id IS NULL OR NOT public.bw_is_band_admin(v_req.band_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT d.user_id IS NOT NULL INTO v_linked FROM public.band_deputies d WHERE d.id = v_req.deputy_id;
  IF NOT coalesce(v_linked, false) THEN RETURN 'not_linked'; END IF;
  v_view := public.bw_deputy_request_view(v_req.token);
  IF v_view IS NULL OR (v_view->>'closed')::boolean THEN RETURN 'closed'; END IF;
  SELECT coalesce(array_agg(x), '{}') INTO v_changes FROM jsonb_array_elements_text(coalesce(v_view->'changes', '[]'::jsonb)) x;
  v_kind := CASE
    WHEN v_req.status IN ('available', 'maybe') AND cardinality(v_changes) > 0 THEN 'changed'
    WHEN v_req.status = 'available' THEN 'recap'
    ELSE 'request' END;
  IF public.bw_deputy_notify(v_req.id, v_kind, CASE WHEN v_kind = 'changed' THEN v_changes END) > 0 THEN
    RETURN 'sent';
  END IF;
  RETURN 'throttled';
END;
$$;
REVOKE ALL ON FUNCTION public.bw_deputy_request_ping(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_deputy_request_ping(uuid) TO authenticated;

-- --------------------------------------------------------------------
-- The deputy installs the app: link their account (by a request token)
-- Returns {status: linked | already | taken | member | not_found, ...}
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_deputy_claim(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.deputy_requests;
  v_dep public.band_deputies;
  v_band text;
  v_title text;
  v_who text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  SELECT * INTO v_req FROM public.deputy_requests WHERE token = p_token;
  IF v_req.id IS NULL OR v_req.deputy_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  SELECT * INTO v_dep FROM public.band_deputies WHERE id = v_req.deputy_id FOR UPDATE;
  IF v_dep.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  SELECT b.name INTO v_band FROM public.bands b WHERE b.id = v_dep.band_id;

  IF v_dep.user_id = v_uid THEN
    RETURN jsonb_build_object('status', 'already', 'band_name', v_band, 'deputy_name', v_dep.name);
  END IF;
  IF v_dep.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'taken', 'band_name', v_band);
  END IF;
  -- A band member opening the link (an admin trying it) is not the deputy.
  IF EXISTS (SELECT 1 FROM public.band_members bm
              WHERE bm.band_id = v_dep.band_id AND bm.user_id = v_uid AND coalesce(bm.is_active, true)) THEN
    RETURN jsonb_build_object('status', 'member', 'band_name', v_band);
  END IF;

  UPDATE public.band_deputies SET user_id = v_uid, updated_at = now() WHERE id = v_dep.id;

  SELECT nullif(btrim(p.full_name), '') INTO v_who FROM public.profiles p WHERE p.id = v_uid;
  SELECT e.title INTO v_title FROM public.events e WHERE e.id = v_req.event_id;
  PERFORM public.bw_notify(
    ARRAY(SELECT bm.user_id FROM public.band_members bm
           WHERE bm.band_id = v_dep.band_id AND bm.role = 'admin' AND coalesce(bm.is_active, true)),
    v_dep.band_id, 'deputy_joined',
    v_dep.name || ' is on BandWith',
    'From now on you can ask them in the app.' || coalesce(' Account: ' || v_who || '.', ''),
    jsonb_build_object('deputy_id', v_dep.id, 'deputy_name', v_dep.name, 'account_name', v_who,
                       'event_id', v_req.event_id, 'eventTitle', v_title),
    v_dep.id, 'band_deputy'
  );

  RETURN jsonb_build_object('status', 'linked', 'band_name', v_band, 'deputy_name', v_dep.name);
END;
$$;
REVOKE ALL ON FUNCTION public.bw_deputy_claim(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_deputy_claim(text) TO authenticated;

-- --------------------------------------------------------------------
-- The deputy's gigs in the app: the bands they're linked to and their
-- requests from the last 30 days on, each as the reply page sees it.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_my_deputy_gigs()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'bands', coalesce((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('band_name', b.name, 'deputy_name', d.name))
        FROM public.band_deputies d JOIN public.bands b ON b.id = d.band_id
       WHERE d.user_id = v_uid
    ), '[]'::jsonb),
    'gigs', coalesce((
      SELECT jsonb_agg(public.bw_deputy_request_view(r.token) || jsonb_build_object('id', r.id, 'token', r.token)
                       ORDER BY coalesce(e.event_date, e.date), coalesce(e.start_time, e.time), r.created_at)
        FROM public.deputy_requests r
        JOIN public.band_deputies d ON d.id = r.deputy_id
        JOIN public.events e ON e.id = r.event_id
       WHERE d.user_id = v_uid
         AND coalesce(e.status, '') <> 'draft'
         AND (coalesce(e.event_date, e.date) IS NULL OR coalesce(e.event_date, e.date) >= current_date - 30)
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.bw_my_deputy_gigs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_my_deputy_gigs() TO authenticated;

-- --------------------------------------------------------------------
-- The gig changes or is cancelled: tell the linked deputies.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_trg_deputy_gig_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes text[] := '{}';
  v_address boolean := false;
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(OLD.status, '') NOT IN ('draft', 'cancelled') THEN
      FOR r IN SELECT q.id FROM public.deputy_requests q JOIN public.band_deputies d ON d.id = q.deputy_id
                WHERE q.event_id = OLD.id AND d.user_id IS NOT NULL AND q.status IN ('pending', 'available', 'maybe') LOOP
        PERFORM public.bw_deputy_notify(r.id, 'cancelled');
      END LOOP;
    END IF;
    RETURN OLD;
  END IF;

  IF coalesce(NEW.status, '') = 'draft' THEN RETURN NEW; END IF;

  IF coalesce(NEW.status, '') = 'cancelled' THEN
    IF coalesce(OLD.status, '') <> 'cancelled' THEN
      FOR r IN SELECT q.id FROM public.deputy_requests q JOIN public.band_deputies d ON d.id = q.deputy_id
                WHERE q.event_id = NEW.id AND d.user_id IS NOT NULL AND q.status IN ('pending', 'available', 'maybe') LOOP
        PERFORM public.bw_deputy_notify(r.id, 'cancelled');
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  IF coalesce(NEW.event_date, NEW.date) IS DISTINCT FROM coalesce(OLD.event_date, OLD.date) THEN
    v_changes := array_append(v_changes, 'date'::text);
  END IF;
  IF coalesce(NEW.start_time, NEW.time) IS DISTINCT FROM coalesce(OLD.start_time, OLD.time)
     OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    v_changes := array_append(v_changes, 'time'::text);
  END IF;
  IF NEW.load_in_time IS DISTINCT FROM OLD.load_in_time OR NEW.soundcheck_time IS DISTINCT FROM OLD.soundcheck_time THEN
    v_changes := array_append(v_changes, 'load-in / soundcheck'::text);
  END IF;
  IF coalesce(NEW.venue_name, NEW.venue) IS DISTINCT FROM coalesce(OLD.venue_name, OLD.venue)
     OR NEW.venue_city IS DISTINCT FROM OLD.venue_city THEN
    v_changes := array_append(v_changes, 'venue'::text);
  END IF;
  v_address := NEW.venue_address IS DISTINCT FROM OLD.venue_address;

  IF cardinality(v_changes) = 0 AND NOT v_address THEN RETURN NEW; END IF;

  -- Only deputies who answered yes or maybe (the address only counts for a
  -- yes: before that they never saw it).
  FOR r IN SELECT q.id, q.status FROM public.deputy_requests q JOIN public.band_deputies d ON d.id = q.deputy_id
            WHERE q.event_id = NEW.id AND d.user_id IS NOT NULL AND q.status IN ('available', 'maybe') LOOP
    IF cardinality(v_changes) > 0 THEN
      PERFORM public.bw_deputy_notify(r.id, 'changed',
        CASE WHEN v_address AND r.status = 'available' AND NOT ('venue' = ANY (v_changes))
             THEN array_append(v_changes, 'address'::text) ELSE v_changes END);
    ELSIF r.status = 'available' THEN
      PERFORM public.bw_deputy_notify(r.id, 'changed', ARRAY['address']::text[]);
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Never block the calendar because of a notification.
  RAISE WARNING 'bw_trg_deputy_gig_changed: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_deputy_gig_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_event_deputy_notify ON public.events;
CREATE TRIGGER bw_event_deputy_notify AFTER UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_deputy_gig_changed();
DROP TRIGGER IF EXISTS bw_event_deputy_deleted_notify ON public.events;
CREATE TRIGGER bw_event_deputy_deleted_notify BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_deputy_gig_changed();

-- --------------------------------------------------------------------
-- An admin cancels the request: tell the linked deputy.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_trg_deputy_request_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'available', 'maybe') THEN
    PERFORM public.bw_deputy_notify(NEW.id, 'withdrawn');
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_deputy_request_cancelled: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_deputy_request_cancelled() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_deputy_request_cancelled_notify ON public.deputy_requests;
CREATE TRIGGER bw_deputy_request_cancelled_notify AFTER UPDATE OF status ON public.deputy_requests
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_deputy_request_cancelled();

-- --------------------------------------------------------------------
-- Push: same as 084, plus the deputy types
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
    'chat_message', 'chat_mention', 'deputy_reply',
    'deputy_joined', 'deputy_request', 'deputy_gig_changed'
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
