-- ====================================================================
-- 070: email triggers on the new API keys (G16)
--
-- The project moves from the legacy JWT keys (anon / service_role) to the
-- new publishable (sb_publishable_…) and secret (sb_secret_…) keys. The new
-- keys are not JWTs: the platform rejects them on `Authorization: Bearer`,
-- and the functions' built-in verify_jwt check doesn't understand them.
--
-- send-email is now deployed with verify_jwt = false and authorises the
-- trigger by its dispatch secret (063), so bw_dispatch_email no longer sends
-- any key on `Authorization`. The Vault secret 'bw_anon_key' now holds the
-- PUBLISHABLE key and goes on `apikey` only. It is optional: without it the
-- emails still go out (before this migration they silently stopped).
--
-- Update the Vault secret once (SQL editor, not stored here):
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'bw_anon_key'),
--     '<sb_publishable_… key>'
--   );
--
-- Apply AFTER send-email is redeployed with --no-verify-jwt; otherwise the
-- gateway answers 401 to the trigger. Safe to run more than once.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.bw_dispatch_email(p_type text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_key text;
  v_headers jsonb;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'bw_project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'bw_email_dispatch_secret' LIMIT 1;
  IF v_url IS NULL OR v_secret IS NULL THEN RETURN; END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-bw-dispatch-secret', v_secret
  );

  -- Publishable key on `apikey` only, and only if it is a new-style key: a
  -- legacy JWT left in Vault is not sent anywhere.
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'bw_anon_key' LIMIT 1;
  IF v_key LIKE 'sb_publishable_%' THEN
    v_headers := v_headers || jsonb_build_object('apikey', v_key);
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-email',
    headers := v_headers,
    body := jsonb_build_object('type', p_type, 'data', p_data),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN others THEN
  RAISE WARNING 'bw_dispatch_email: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_dispatch_email(text, jsonb) FROM PUBLIC, anon, authenticated;
