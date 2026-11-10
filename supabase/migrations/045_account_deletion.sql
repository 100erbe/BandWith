-- ====================================================================
-- 045 — Real account deletion (used by the `delete-account` edge function)
--
-- Several tables reference profiles(id) / auth.users(id) without ON DELETE,
-- so auth.admin.deleteUser() fails with a foreign-key error. These helpers
-- clean up the user's references first. Only the service role can call them.
--
-- Policy:
--   * If the user is the only active admin of a band that has other active
--     members, deletion is refused (they must hand over admin first).
--   * Bands where the user is the only active member are deleted.
--   * Every remaining reference to the user is set to NULL when the column
--     allows it, otherwise the referencing row is deleted.
-- ====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.bw_account_deletion_blockers(p_uid uuid)
RETURNS TABLE (band_id uuid, band_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name::text
  FROM bands b
  JOIN band_members me
    ON me.band_id = b.id AND me.user_id = p_uid
   AND me.role = 'admin' AND COALESCE(me.is_active, true)
  WHERE NOT EXISTS (
          SELECT 1 FROM band_members a
          WHERE a.band_id = b.id AND a.user_id <> p_uid
            AND a.role = 'admin' AND COALESCE(a.is_active, true))
    AND EXISTS (
          SELECT 1 FROM band_members o
          WHERE o.band_id = b.id AND o.user_id <> p_uid
            AND COALESCE(o.is_active, true));
$$;

CREATE OR REPLACE FUNCTION public.bw_prepare_account_deletion(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fk record;
  v_nullable boolean;
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

  -- Remaining single-column FKs to profiles(id) / auth.users(id) that would
  -- block the delete (NO ACTION / RESTRICT).
  FOR fk IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           a.attname AS column_name,
           a.attnotnull AS not_null
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND array_length(con.conkey, 1) = 1
      AND con.confdeltype IN ('a', 'r')
      AND con.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
      AND n.nspname = 'public'
  LOOP
    v_nullable := NOT fk.not_null;
    IF v_nullable THEN
      EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = $1',
                     fk.schema_name, fk.table_name, fk.column_name, fk.column_name)
      USING p_uid;
    ELSE
      EXECUTE format('DELETE FROM %I.%I WHERE %I = $1',
                     fk.schema_name, fk.table_name, fk.column_name)
      USING p_uid;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_account_deletion_blockers(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bw_prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bw_account_deletion_blockers(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bw_prepare_account_deletion(uuid) TO service_role;

COMMIT;
