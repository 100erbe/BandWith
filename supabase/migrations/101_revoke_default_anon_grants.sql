-- 101: remove the default table privileges anon still has on public tables.
--
-- Supabase's default privileges gave anon (the role for requests without a
-- signed-in user) full rights on every new table. RLS has kept the rows
-- hidden, but nothing in the product reads or writes these tables without a
-- session: the public pages (quote, deputy, rider, unsubscribe), the invite
-- preview and the deputy calendar feed all go through SECURITY DEFINER RPCs.
-- Migration 100 did this for quotes and quote_musicians; this one does the
-- rest, so a missing or wrong policy can no longer expose a table to anon.
--
-- Kept on purpose: beta_requests, where anon has INSERT on a few columns for
-- the landing page's beta form (REVOKE ALL on a table also drops its column
-- grants, so it is skipped).
--
-- authenticated also loses TRUNCATE (which RLS does not filter), REFERENCES,
-- TRIGGER and MAINTAIN, which the app never uses.
--
-- Default privileges for tables created later by postgres change the same way,
-- so a table that anon really needs must be granted to it explicitly.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND c.relname <> 'beta_requests'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %s FROM anon', t.rel);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE %s FROM authenticated', t.rel);
  END LOOP;
END
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated;
