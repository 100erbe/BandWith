-- 100: quotes and quote_musicians closed to anon.
--
-- Both tables still had Supabase's default grants: anon could read, write,
-- delete and truncate them as far as table privileges go. RLS already hid
-- every row (all policies are for authenticated band admins), so nothing was
-- exposed; this removes the privilege layer as well, so a future policy
-- mistake can't open the quotes (clients, prices, musician fees).
--
-- Nobody signed out reads these tables: the client's quote page (/quote.html)
-- goes through the SECURITY DEFINER token RPCs of 099. Signed-in users keep
-- SELECT/INSERT/UPDATE/DELETE (RLS decides the rows); the privileges the app
-- never uses (TRUNCATE, which RLS does not filter, REFERENCES, TRIGGER,
-- MAINTAIN) go too.

REVOKE ALL ON TABLE public.quotes FROM anon;
REVOKE ALL ON TABLE public.quote_musicians FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.quotes FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.quote_musicians FROM authenticated;
