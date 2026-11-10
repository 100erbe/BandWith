-- ====================================================================
-- 046: Server-side notifications + push dispatch
--
-- Before: every notification row was inserted by the acting user's app, so
--   * many operations notified nobody (event edits/cancellations, quote → gig,
--     members joining/leaving, setlist changes, payments);
--   * "member removed" always failed (the membership row was deleted first, so
--     the RLS check on the insert rejected it);
--   * push was sent from the client only for some types.
--
-- After:
--   1. Database triggers create the notifications (SECURITY DEFINER), always
--      excluding the person who did the action.
--   2. An AFTER INSERT trigger on notifications calls the `send-push` edge
--      function through pg_net, so EVERY notification row that should buzz the
--      phone does — whoever created it.
--   3. `bw_register_push_token` lets a device move to the account that is
--      signed in now (token rows are unique per device), `bw_unregister_push_token`
--      is called on sign-out.
--
-- One-time setup (Dashboard → Project Settings → Vault, "New secret"):
--   name: bw_project_url        value: https://<project-ref>.supabase.co
--   name: bw_service_role_key   value: the project's service_role key
-- Without these two secrets the notifications are still created; only the
-- push call is skipped. Nothing here ever makes an insert fail.
--
-- Safe to run more than once.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- notifications.type was an ENUM in the oldest schema and misses many types
-- the app uses (chat_message, rehearsal_poll, member_dropped_out…). Plain text
-- accepts all of them; it is a no-op if the column is already text.
ALTER TABLE public.notifications ALTER COLUMN type TYPE text USING type::text;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
  ON public.notifications (user_id, type, created_at DESC);

-- --------------------------------------------------------------------
-- Helpers
-- --------------------------------------------------------------------

-- Insert one notification per recipient (deduplicated, actor excluded).
-- `p_throttle` skips recipients who already got the same type for the same
-- reference within that interval (avoids a burst while someone edits).
CREATE OR REPLACE FUNCTION public.bw_notify(
  p_user_ids uuid[],
  p_band_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_throttle interval DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  INSERT INTO public.notifications (user_id, band_id, type, title, body, data, read, reference_id, reference_type)
  SELECT DISTINCT u, p_band_id, p_type, left(p_title, 255), p_body,
         coalesce(p_data, '{}'::jsonb) || jsonb_build_object('server', true),
         false, p_reference_id, p_reference_type
  FROM unnest(coalesce(p_user_ids, '{}'::uuid[])) AS u
  WHERE u IS NOT NULL
    AND (v_actor IS NULL OR u <> v_actor)
    AND (
      p_throttle IS NULL OR p_reference_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = u
          AND n.type = p_type
          AND n.reference_id = p_reference_id
          AND n.created_at > now() - p_throttle
      )
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_notify(uuid[], uuid, text, text, text, jsonb, uuid, text, interval) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bw_active_band_member_ids(p_band_id uuid, p_admins_only boolean DEFAULT false)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT user_id), '{}'::uuid[])
  FROM public.band_members
  WHERE band_id = p_band_id
    AND coalesce(is_active, true)
    AND (NOT p_admins_only OR role = 'admin');
$$;
REVOKE ALL ON FUNCTION public.bw_active_band_member_ids(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- People involved in an event: its lineup (not declined); if it has none, the band.
CREATE OR REPLACE FUNCTION public.bw_event_recipient_ids(p_event_id uuid, p_band_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT user_id), '{}'::uuid[]) INTO v_ids
  FROM public.event_members
  WHERE event_id = p_event_id
    AND coalesce(status, 'invited') NOT IN ('declined', 'dropped_out', 'removed');

  IF coalesce(array_length(v_ids, 1), 0) = 0 AND p_band_id IS NOT NULL THEN
    v_ids := public.bw_active_band_member_ids(p_band_id);
  END IF;
  -- Whoever created the event also cares about changes to it.
  RETURN v_ids;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_event_recipient_ids(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bw_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(nullif(trim(full_name), ''), split_part(email, '@', 1), 'A member')
  FROM public.profiles WHERE id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.bw_display_name(uuid) FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- Events: updated / cancelled / confirmed / deleted
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_trg_event_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_label text;
  v_when text;
  v_changes text[] := '{}';
  v_recipients uuid[];
  v_data jsonb;
  ev record;
BEGIN
  IF TG_OP = 'DELETE' THEN ev := OLD; ELSE ev := NEW; END IF;
  v_kind := CASE WHEN lower(coalesce(ev.event_type, 'gig')) = 'rehearsal' THEN 'rehearsal' ELSE 'gig' END;
  v_label := CASE WHEN v_kind = 'rehearsal' THEN 'Rehearsal' ELSE 'Gig' END;
  v_when := coalesce(to_char(ev.event_date, 'Dy DD Mon'), 'date TBD') ||
            CASE WHEN ev.start_time IS NOT NULL THEN ' · ' || to_char(ev.start_time, 'HH24:MI') ELSE '' END;
  ev.title := coalesce(ev.title, v_label);
  v_data := jsonb_build_object(
    'event_id', ev.id,
    'event_title', ev.title,
    'event_type', ev.event_type,
    'event_date', ev.event_date,
    'subtitle', ev.title,
    'tag', 'event-' || ev.id
  );

  IF TG_OP = 'DELETE' THEN
    -- Skip drafts nobody was told about.
    IF coalesce(OLD.status, '') IN ('draft') THEN RETURN OLD; END IF;
    v_recipients := public.bw_event_recipient_ids(OLD.id, OLD.band_id);
    PERFORM public.bw_notify(v_recipients, OLD.band_id, 'event_cancelled',
      v_label || ' cancelled', OLD.title || ' · ' || v_when || ' was removed from the calendar.',
      v_data || jsonb_build_object('deleted', true), OLD.id, 'event');
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelled' THEN
    v_recipients := public.bw_event_recipient_ids(NEW.id, NEW.band_id);
    PERFORM public.bw_notify(v_recipients, NEW.band_id, 'event_cancelled',
      v_label || ' cancelled', NEW.title || ' · ' || v_when || ' has been cancelled.',
      v_data, NEW.id, 'event');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'confirmed'
     AND coalesce(OLD.status, 'draft') IN ('draft', 'pending', 'tentative') THEN
    v_recipients := public.bw_event_recipient_ids(NEW.id, NEW.band_id);
    PERFORM public.bw_notify(v_recipients, NEW.band_id, 'event_confirmed',
      v_label || ' confirmed', NEW.title || ' · ' || v_when || ' is on. Check your lineup and times.',
      v_data || jsonb_build_object('gig_confirmed', true), NEW.id, 'event');
    RETURN NEW;
  END IF;

  IF NEW.status = 'draft' THEN RETURN NEW; END IF;

  IF NEW.event_date IS DISTINCT FROM OLD.event_date THEN v_changes := array_append(v_changes, 'date'::text); END IF;
  IF NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    v_changes := array_append(v_changes, 'time'::text);
  END IF;
  IF NEW.load_in_time IS DISTINCT FROM OLD.load_in_time OR NEW.soundcheck_time IS DISTINCT FROM OLD.soundcheck_time THEN
    v_changes := array_append(v_changes, 'load-in / soundcheck'::text);
  END IF;
  IF NEW.venue_name IS DISTINCT FROM OLD.venue_name OR NEW.venue_address IS DISTINCT FROM OLD.venue_address
     OR NEW.venue_city IS DISTINCT FROM OLD.venue_city THEN
    v_changes := array_append(v_changes, 'venue'::text);
  END IF;

  IF array_length(v_changes, 1) > 0 THEN
    v_recipients := public.bw_event_recipient_ids(NEW.id, NEW.band_id);
    PERFORM public.bw_notify(v_recipients, NEW.band_id, 'event_update',
      v_label || ' updated', NEW.title || ' · ' || v_when || ' — new ' || array_to_string(v_changes, ', ') || '.',
      v_data || jsonb_build_object('changes', to_jsonb(v_changes)), NEW.id, 'event', interval '2 minutes');
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Never block the calendar because of a notification.
  RAISE WARNING 'bw_trg_event_changed: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_event_changed_notify ON public.events;
CREATE TRIGGER bw_event_changed_notify
  AFTER UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_event_changed();

-- BEFORE DELETE: the lineup (event_members) is still there at this point.
DROP TRIGGER IF EXISTS bw_event_deleted_notify ON public.events;
CREATE TRIGGER bw_event_deleted_notify
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_event_changed();

-- --------------------------------------------------------------------
-- Band members: joined / left / removed
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_trg_band_member_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_band_name text;
  v_name text;
  v_others uuid[];
  r record;
  v_joined boolean := false;
  v_left boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_joined := coalesce(NEW.is_active, true);
  ELSIF TG_OP = 'UPDATE' THEN
    v_joined := coalesce(NEW.is_active, true) AND NOT coalesce(OLD.is_active, true);
    v_left := NOT coalesce(NEW.is_active, true) AND coalesce(OLD.is_active, true);
  ELSE
    v_left := coalesce(OLD.is_active, true);
  END IF;

  IF NOT v_joined AND NOT v_left THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;

  SELECT name INTO v_band_name FROM public.bands WHERE id = r.band_id;
  IF v_band_name IS NULL THEN  -- band itself is being deleted
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  v_name := coalesce(public.bw_display_name(r.user_id), 'A member');
  v_others := array_remove(public.bw_active_band_member_ids(r.band_id), r.user_id);

  IF v_joined THEN
    PERFORM public.bw_notify(v_others, r.band_id, 'member_joined',
      v_name || ' joined ' || v_band_name, 'Say hi and add them to your next lineup.',
      jsonb_build_object('member_user_id', r.user_id, 'member_name', v_name, 'band_name', v_band_name),
      r.band_id, 'band');
  ELSE
    IF v_actor IS NOT NULL AND v_actor <> r.user_id THEN
      -- Removed by someone else: tell the person, then the band.
      PERFORM public.bw_notify(ARRAY[r.user_id], r.band_id, 'member_left',
        'Removed from ' || v_band_name, 'An admin removed you from ' || v_band_name || '.',
        jsonb_build_object('removed', true, 'band_name', v_band_name), r.band_id, 'band');
      PERFORM public.bw_notify(v_others, r.band_id, 'member_left',
        v_name || ' left ' || v_band_name, v_name || ' is no longer in the band.',
        jsonb_build_object('member_user_id', r.user_id, 'member_name', v_name, 'band_name', v_band_name, 'removed', true),
        r.band_id, 'band');
    ELSE
      PERFORM public.bw_notify(v_others, r.band_id, 'member_left',
        v_name || ' left ' || v_band_name, v_name || ' left the band.',
        jsonb_build_object('member_user_id', r.user_id, 'member_name', v_name, 'band_name', v_band_name),
        r.band_id, 'band');
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_band_member_changed: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_band_member_changed_notify ON public.band_members;
CREATE TRIGGER bw_band_member_changed_notify
  AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.band_members
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_band_member_changed();

-- --------------------------------------------------------------------
-- Setlists: one "setlist updated" per person per setlist every 10 minutes
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_notify_setlist(p_setlist_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
BEGIN
  SELECT id, band_id, name INTO s FROM public.setlists WHERE id = p_setlist_id;
  IF s.id IS NULL OR s.band_id IS NULL THEN RETURN; END IF;
  PERFORM public.bw_notify(public.bw_active_band_member_ids(s.band_id), s.band_id, 'setlist_updated',
    'Setlist updated', s.name || ' changed. Check the running order before the next gig.',
    jsonb_build_object('setlist_id', s.id, 'setlist_name', s.name, 'tag', 'setlist-' || s.id),
    s.id, 'setlist', interval '10 minutes');
END;
$$;
REVOKE ALL ON FUNCTION public.bw_notify_setlist(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bw_trg_setlist_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'setlists' THEN
    IF NEW.name IS DISTINCT FROM OLD.name OR NEW.description IS DISTINCT FROM OLD.description THEN
      PERFORM public.bw_notify_setlist(NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  -- setlist_songs
  PERFORM public.bw_notify_setlist(CASE WHEN TG_OP = 'DELETE' THEN OLD.setlist_id ELSE NEW.setlist_id END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_setlist_changed: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_setlist_changed_notify ON public.setlists;
CREATE TRIGGER bw_setlist_changed_notify
  AFTER UPDATE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_setlist_changed();

DROP TRIGGER IF EXISTS bw_setlist_songs_changed_notify ON public.setlist_songs;
CREATE TRIGGER bw_setlist_songs_changed_notify
  AFTER INSERT OR UPDATE OR DELETE ON public.setlist_songs
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_setlist_changed();

-- --------------------------------------------------------------------
-- Payments: income recorded → admins (with amount), gig lineup (without)
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_trg_transaction_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency text;
  v_event_title text;
  v_admins uuid[];
  v_lineup uuid[];
BEGIN
  IF NEW.type <> 'income' THEN RETURN NEW; END IF;

  -- to_jsonb() so a missing optional column never breaks the trigger
  SELECT coalesce(to_jsonb(b)->'pricing_settings'->>'currency', to_jsonb(b)->>'pricing_currency', 'EUR') INTO v_currency
  FROM public.bands b WHERE b.id = NEW.band_id;
  v_admins := public.bw_active_band_member_ids(NEW.band_id, true);

  IF NEW.event_id IS NOT NULL THEN
    SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;
  END IF;

  PERFORM public.bw_notify(v_admins, NEW.band_id, 'payment_received',
    'Payment received',
    to_char(NEW.amount, 'FM999G999G990D00') || ' ' || coalesce(v_currency, 'EUR') || ' · ' ||
      coalesce(v_event_title, NEW.title),
    jsonb_build_object('transaction_id', NEW.id, 'event_id', NEW.event_id, 'amount', NEW.amount, 'currency', v_currency),
    NEW.id, 'transaction');

  IF NEW.event_id IS NOT NULL THEN
    SELECT coalesce(array_agg(DISTINCT user_id), '{}'::uuid[]) INTO v_lineup
    FROM public.event_members
    WHERE event_id = NEW.event_id AND coalesce(status, 'invited') NOT IN ('declined', 'dropped_out', 'removed')
      AND user_id <> ALL (v_admins);
    PERFORM public.bw_notify(v_lineup, NEW.band_id, 'payment_received',
      'Payment received', 'The band recorded a payment for ' || coalesce(v_event_title, 'a gig') || '.',
      jsonb_build_object('event_id', NEW.event_id), NEW.id, 'transaction');
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_transaction_income: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_transaction_income_notify ON public.transactions;
CREATE TRIGGER bw_transaction_income_notify
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_transaction_income();

-- --------------------------------------------------------------------
-- Push dispatch: every new notification of a "buzz-worthy" type
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_trg_dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_key text;
  v_push_pref text;
BEGIN
  -- Rows created by send-push itself were already pushed.
  IF coalesce(NEW.data->>'skip_push', 'false') = 'true' THEN RETURN NEW; END IF;

  IF NEW.type NOT IN (
    'invite_received', 'event_invite', 'event_update', 'event_cancelled', 'event_confirmed',
    'event_reminder', 'member_dropped_out', 'member_joined', 'member_left',
    'rehearsal_poll', 'rehearsal_proposal', 'rehearsal_poll_finalized', 'rehearsal_reminder',
    'setlist_updated', 'quote_accepted', 'payment_received', 'payment_due', 'payment_overdue',
    'chat_message', 'chat_mention'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT notification_preferences->>'push' INTO v_push_pref FROM public.profiles WHERE id = NEW.user_id;
  IF coalesce(v_push_pref, 'true') = 'false' THEN RETURN NEW; END IF;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'bw_project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'bw_service_role_key' LIMIT 1;
  IF v_url IS NULL OR v_key IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', coalesce(NEW.body, ''),
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
$$;

DROP TRIGGER IF EXISTS bw_notifications_dispatch_push ON public.notifications;
CREATE TRIGGER bw_notifications_dispatch_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_dispatch_push();

-- --------------------------------------------------------------------
-- Push tokens: one device = the account signed in now
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_register_push_token(p_token text, p_platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_token IS NULL OR length(p_token) < 10 OR length(p_token) > 4096 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF p_platform NOT IN ('ios', 'android', 'web') THEN RAISE EXCEPTION 'Invalid platform'; END IF;

  INSERT INTO public.push_tokens (user_id, token, platform, is_active, updated_at)
  VALUES (v_uid, p_token, p_platform, true, now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        is_active = true,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.bw_register_push_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_register_push_token(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bw_unregister_push_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.push_tokens SET is_active = false, updated_at = now()
  WHERE token = p_token AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.bw_unregister_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_unregister_push_token(text) TO authenticated;

-- --------------------------------------------------------------------
-- Clients may now only write notifications for themselves; everything that
-- targets other people goes through the triggers above or SECURITY DEFINER RPCs.
-- Kept as a separate, opt-in step: see the end of this file.
-- --------------------------------------------------------------------
-- Drop the legacy "anyone can insert" policies some ad-hoc scripts created.
DROP POLICY IF EXISTS "notif_insert_system" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
