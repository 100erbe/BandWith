-- ====================================================================
-- 068: push only for what needs you; your own fee changes
--
-- 1. Push vs in-app ("light") notifications. Every notification row still
--    lands in the in-app inbox (the bell); only these types also send a
--    push, because they ask you to do something or change your plans:
--      invites and RSVPs (invite_received, event_invite), votes and
--      proposals (rehearsal_poll, rehearsal_proposal), schedule changes,
--      conflicts and cancellations (event_update, event_cancelled),
--      reminders, a member dropping out (find a replacement), an accepted
--      quote, payments due/overdue, chat, and your own fee changing.
--    No longer pushed (inbox only): event_confirmed, member_joined,
--    member_left, rehearsal_poll_finalized, setlist_updated,
--    payment_received (and, as before, song_added etc.).
--
-- 2. When an admin changes a musician's fee on an event, that musician
--    (and only them) gets a `fee_changed` notification. Band extra costs
--    and other members' fees never notify anyone.
--
-- Safe to run more than once.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.bw_trg_dispatch_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    'chat_message', 'chat_mention'
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
$$;

-- --------------------------------------------------------------------
-- event_members.fee changed → tell that member only
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bw_trg_member_fee_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev record;
  v_label text;
  v_when text;
  v_cur text;
  v_fmt text := 'FM999G999G990D00';
BEGIN
  IF NEW.fee IS NOT DISTINCT FROM OLD.fee THEN RETURN NEW; END IF;
  -- Your own edit doesn't notify you (bw_notify also skips the actor).
  IF NEW.user_id IS NULL OR NEW.user_id = auth.uid() THEN RETURN NEW; END IF;
  -- Someone who declined isn't playing: no fee news.
  IF lower(coalesce(NEW.status, '')) = 'declined' THEN RETURN NEW; END IF;

  SELECT id, band_id, title, event_type, event_date, start_time, currency
    INTO ev FROM public.events WHERE id = NEW.event_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  -- Past events: settling payouts afterwards isn't news.
  IF ev.event_date IS NOT NULL AND ev.event_date < current_date THEN RETURN NEW; END IF;

  v_label := CASE WHEN lower(coalesce(ev.event_type, 'gig')) = 'rehearsal' THEN 'Rehearsal' ELSE 'Gig' END;
  v_when := coalesce(to_char(ev.event_date, 'Dy DD Mon'), 'date TBD');
  v_cur := CASE upper(coalesce(ev.currency, 'EUR'))
             WHEN 'EUR' THEN '€' WHEN 'USD' THEN '$' WHEN 'GBP' THEN '£'
             ELSE upper(ev.currency) || ' ' END;

  PERFORM public.bw_notify(
    ARRAY[NEW.user_id],
    ev.band_id,
    'fee_changed',
    'Your fee changed',
    coalesce(ev.title, v_label) || ' · ' || v_when || ': your fee is now ' ||
      v_cur || to_char(coalesce(NEW.fee, 0), v_fmt) ||
      ' (was ' || v_cur || to_char(coalesce(OLD.fee, 0), v_fmt) || ').',
    jsonb_build_object(
      'event_id', ev.id,
      'kind', 'fee_changed',
      'event_type', lower(coalesce(ev.event_type, 'gig')),
      'old_fee', OLD.fee,
      'new_fee', NEW.fee
    ),
    ev.id,
    'event',
    NULL
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_member_fee_changed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_member_fee_changed ON public.event_members;
CREATE TRIGGER bw_member_fee_changed
  AFTER UPDATE OF fee ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_member_fee_changed();
