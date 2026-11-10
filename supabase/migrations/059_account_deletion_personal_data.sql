-- 059: account deletion failed for anyone with personal gigs or chat messages.
--
-- events.created_by is ON DELETE SET NULL, but events_personal_gig_creator_check
-- requires created_by on personal gigs (band_id IS NULL), and
-- messages.sender_id is ON DELETE SET NULL on a NOT NULL column. Either one
-- makes auth.admin.deleteUser() fail. The app promises that personal gigs and
-- messages are deleted with the account, so delete them explicitly, and also
-- delete rows for any other SET NULL foreign key on a NOT NULL column.

CREATE OR REPLACE FUNCTION public.bw_prepare_account_deletion(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fk record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.bw_account_deletion_blockers(p_uid)) THEN
    RAISE EXCEPTION 'account_has_bands' USING ERRCODE = 'P0001';
  END IF;

  -- Bands with no other active member go with the account.
  DELETE FROM bands b
  WHERE EXISTS (SELECT 1 FROM band_members me WHERE me.band_id = b.id AND me.user_id = p_uid)
    AND NOT EXISTS (
      SELECT 1 FROM band_members o
      WHERE o.band_id = b.id AND o.user_id <> p_uid AND COALESCE(o.is_active, true));

  -- Personal gigs and the user's messages are deleted with the account.
  DELETE FROM events WHERE band_id IS NULL AND created_by = p_uid;
  DELETE FROM messages WHERE sender_id = p_uid;

  -- Remaining single-column FKs to profiles(id) / auth.users(id) that would
  -- block the delete: NO ACTION / RESTRICT, or SET NULL on a NOT NULL column.
  FOR fk IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           a.attname AS column_name,
           a.attnotnull AS not_null,
           con.confdeltype AS del_type
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND array_length(con.conkey, 1) = 1
      AND (con.confdeltype IN ('a', 'r') OR (con.confdeltype = 'n' AND a.attnotnull))
      AND con.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
      AND n.nspname = 'public'
  LOOP
    IF fk.not_null THEN
      EXECUTE format('DELETE FROM %I.%I WHERE %I = $1',
                     fk.schema_name, fk.table_name, fk.column_name)
      USING p_uid;
    ELSE
      EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = $1',
                     fk.schema_name, fk.table_name, fk.column_name, fk.column_name)
      USING p_uid;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_prepare_account_deletion(uuid) TO service_role;
