-- ====================================================================
-- 065: Product update emails ("What's new in BandWith")
--
-- Who gets them: every confirmed account, unless they turned it off
-- (opt-out). notification_preferences.product_updates = false, or
-- notification_preferences.email = false, means no.
--
-- How an issue goes out:
--   1. INSERT a row into bw_product_updates (the content).
--   2. SELECT bw_send_product_update(<id>, ARRAY[<user ids>]) to test on a
--      few people (not logged, so they still get the real send).
--   3. SELECT bw_send_product_update(<id>) to send it to everyone. Each
--      person gets it once (bw_email_log 'product_update:<id>').
-- Both run only as the service role (SQL editor / CLI), never from the app.
--
-- Unsubscribe: every email carries a personal link to /unsubscribe.html
-- with an HMAC of the user id (Vault 'bw_unsubscribe_secret'). The page asks
-- for a click, then calls bw_email_unsubscribe, which checks the HMAC.
-- Safe to run more than once.
-- ====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'bw_unsubscribe_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'bw_unsubscribe_secret',
      'Signs the personal unsubscribe links in product update emails'
    );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.bw_product_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_label text NOT NULL,          -- "November 2026"
  preheader text NOT NULL,
  headline text NOT NULL,             -- line breaks become <br>
  intro text NOT NULL,
  cta_label text NOT NULL DEFAULT 'See what''s new',
  cta_url text,                       -- app host only; null = the app
  items jsonb NOT NULL DEFAULT '[]',  -- 3 x {title, text, url?}: New, Improved, Fixed
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
ALTER TABLE public.bw_product_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bw_product_updates FROM anon, authenticated;

-- Signature for a user's unsubscribe link (send-email only).
CREATE OR REPLACE FUNCTION public.bw_unsubscribe_sig(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.hmac(p_user::text || ':product_updates', decrypted_secret, 'sha256'), 'hex')
  FROM vault.decrypted_secrets WHERE name = 'bw_unsubscribe_secret' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.bw_unsubscribe_sig(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_unsubscribe_sig(uuid) TO service_role;

-- Called by /unsubscribe.html (anyone holding the link). True when done.
CREATE OR REPLACE FUNCTION public.bw_email_unsubscribe(p_user uuid, p_sig text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_user IS NULL OR p_sig IS NULL OR length(p_sig) <> 64
     OR p_sig IS DISTINCT FROM public.bw_unsubscribe_sig(p_user) THEN
    RETURN false;
  END IF;
  UPDATE public.profiles
  SET notification_preferences = coalesce(notification_preferences, '{}'::jsonb) || '{"product_updates": false}'::jsonb
  WHERE id = p_user;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_email_unsubscribe(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bw_email_unsubscribe(uuid, text) TO anon, authenticated;

-- Sends an issue in batches of 20 (one send-email call per batch; send-email
-- uses Resend's batch API). Returns how many people it was sent to.
CREATE OR REPLACE FUNCTION public.bw_send_product_update(p_issue uuid, p_only uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_total integer := 0;
  v_batch uuid[];
  i integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bw_product_updates WHERE id = p_issue) THEN
    RAISE EXCEPTION 'Unknown product update %', p_issue;
  END IF;

  SELECT coalesce(array_agg(u.id ORDER BY u.created_at), '{}') INTO v_ids
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND NOT coalesce(u.is_anonymous, false)
    AND coalesce(p.notification_preferences->>'email', 'true') <> 'false'
    AND coalesce(p.notification_preferences->>'product_updates', 'true') <> 'false'
    AND (p_only IS NULL OR u.id = ANY (p_only));

  IF p_only IS NULL THEN
    -- Real send: once per person per issue.
    WITH fresh AS (
      INSERT INTO public.bw_email_log (user_id, kind)
      SELECT unnest(v_ids), 'product_update:' || p_issue
      ON CONFLICT DO NOTHING
      RETURNING user_id
    )
    SELECT coalesce(array_agg(user_id), '{}') INTO v_ids FROM fresh;
    UPDATE public.bw_product_updates SET sent_at = coalesce(sent_at, now()) WHERE id = p_issue;
  END IF;

  i := 1;
  WHILE i <= coalesce(array_length(v_ids, 1), 0) LOOP
    v_batch := v_ids[i : i + 19];
    PERFORM public.bw_dispatch_email('product_update', jsonb_build_object('issueId', p_issue, 'userIds', to_jsonb(v_batch)));
    v_total := v_total + array_length(v_batch, 1);
    i := i + 20;
  END LOOP;
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_send_product_update(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
