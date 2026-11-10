-- ====================================================================
-- 048: Push dispatch without the service role key
--
-- 046 had the notifications trigger call send-push with the service role
-- key stored in Vault. That key opens the whole database and had to be
-- pasted by hand. Instead the database now generates its own random
-- secret (never shown to anyone), sends it in x-bw-dispatch-secret, and
-- send-push asks the database whether it matches. A leak of this secret
-- only allows sending a push, nothing else.
--
-- Safe to run more than once.
-- ====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'bw_push_dispatch_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'bw_push_dispatch_secret',
      'Shared secret between the notifications trigger and send-push'
    );
  END IF;
END;
$$;

-- Only send-push (service role) may ask; it never learns the value.
CREATE OR REPLACE FUNCTION public.bw_verify_push_dispatch_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(length(p_secret) = 64 AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'bw_push_dispatch_secret' AND decrypted_secret = p_secret
  ), false);
$$;
REVOKE ALL ON FUNCTION public.bw_verify_push_dispatch_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_verify_push_dispatch_secret(text) TO service_role;

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
