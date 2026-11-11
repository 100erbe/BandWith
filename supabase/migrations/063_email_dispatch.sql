-- ====================================================================
-- 063: Emails sent by the database
--
--   * member joined  -> every band ADMIN who gets the member_joined
--                       notification also gets the email (unless they
--                       turned email off in their notification settings)
--   * welcome        -> once per user, when the email is confirmed (or at
--                       sign-up for providers that confirm it, e.g. Google)
--
-- Same pattern as 048 (push): the database generates its own random secret
-- (never shown to anyone), sends it in x-bw-dispatch-secret, and send-email
-- asks the database whether it matches. A leak of this secret only allows
-- sending these two emails to their real recipients: the function looks up
-- every address itself from the ids.
--
-- Users who already exist do not get a welcome email (only the transition to
-- "confirmed" fires it). Safe to run more than once.
--
-- Needs the Vault secret 'bw_anon_key' (the project's public anon JWT). Not
-- stored here; create it once:
--   SELECT vault.create_secret('<anon key>', 'bw_anon_key', 'Public anon key for DB -> function calls');
-- Until it exists, the triggers do nothing.
-- ====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'bw_email_dispatch_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'bw_email_dispatch_secret',
      'Shared secret between the email triggers and send-email'
    );
  END IF;
END;
$$;

-- Only send-email (service role) may ask; it never learns the value.
CREATE OR REPLACE FUNCTION public.bw_verify_email_dispatch_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(length(p_secret) = 64 AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'bw_email_dispatch_secret' AND decrypted_secret = p_secret
  ), false);
$$;
REVOKE ALL ON FUNCTION public.bw_verify_email_dispatch_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_verify_email_dispatch_secret(text) TO service_role;

-- One-time emails already sent (server only: RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.bw_email_log (
  user_id uuid NOT NULL,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE public.bw_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bw_email_log FROM anon, authenticated;

-- Fire-and-forget call to send-email (pg_net sends it after commit).
CREATE OR REPLACE FUNCTION public.bw_dispatch_email(p_type text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_anon text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'bw_project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'bw_email_dispatch_secret' LIMIT 1;
  -- send-email keeps verify_jwt = true, so the gateway needs a JWT: the public
  -- anon key (the same one shipped in the app). The dispatch secret is what
  -- actually authorises the call.
  SELECT decrypted_secret INTO v_anon FROM vault.decrypted_secrets WHERE name = 'bw_anon_key' LIMIT 1;
  IF v_url IS NULL OR v_secret IS NULL OR v_anon IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'apikey', v_anon,
      'x-bw-dispatch-secret', v_secret
    ),
    body := jsonb_build_object('type', p_type, 'data', p_data),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_dispatch_email: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_dispatch_email(text, jsonb) FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- Member joined: piggy-back on the member_joined notifications (046),
-- one row per recipient; email only the admins among them.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_trg_email_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type <> 'member_joined' OR NEW.band_id IS NULL OR NEW.data->>'member_user_id' IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_id = NEW.band_id AND user_id = NEW.user_id AND role = 'admin' AND is_active
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.bw_dispatch_email('member_joined', jsonb_build_object(
    'bandId', NEW.band_id,
    'recipientId', NEW.user_id,
    'memberUserId', NEW.data->>'member_user_id'
  ));
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_email_member_joined: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_email_member_joined() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_email_member_joined ON public.notifications;
CREATE TRIGGER bw_email_member_joined
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_email_member_joined();

-- --------------------------------------------------------------------
-- Welcome: once, when the address becomes confirmed.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_trg_email_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email_confirmed_at IS NULL OR coalesce(NEW.is_anonymous, false) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bw_email_log (user_id, kind) VALUES (NEW.id, 'welcome')
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN NEW; END IF;

  PERFORM public.bw_dispatch_email('welcome', jsonb_build_object('userId', NEW.id));
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_trg_email_welcome: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_email_welcome() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_email_welcome ON auth.users;
CREATE TRIGGER bw_email_welcome
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_email_welcome();
