-- 102 · Rehearsal poll: "None of these work" is stored.
--
-- Votes are per option (rehearsal_poll_votes), so a member who answered that
-- no date works had nothing in the database: the admin saw them as not
-- answered, and reopening the poll showed no answer. This table keeps that
-- answer, one row per member and poll.
--
-- Who can do what (same rules as the votes):
--   read    band members of the poll's band (the admin sees who answered);
--   insert  only your own row, on a poll that is still polling, and only if
--           you are invited when the poll has an invite list (098);
--   delete  only your own row (voting for a date again removes it).
--
-- anon gets nothing (101); authenticated gets SELECT, INSERT, DELETE only.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rehearsal_poll_unavailable (
  poll_id uuid NOT NULL REFERENCES public.rehearsal_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

COMMENT ON TABLE public.rehearsal_poll_unavailable IS
  'Members who answered "None of these work" on a rehearsal poll.';

ALTER TABLE public.rehearsal_poll_unavailable ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rehearsal_poll_unavailable FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rehearsal_poll_unavailable TO authenticated;

DROP POLICY IF EXISTS "band_members_can_select_unavailable" ON public.rehearsal_poll_unavailable;
CREATE POLICY "band_members_can_select_unavailable" ON public.rehearsal_poll_unavailable
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rehearsal_polls rp
      JOIN public.band_members bm ON bm.band_id = rp.band_id
      WHERE rp.id = rehearsal_poll_unavailable.poll_id
        AND bm.user_id = auth.uid()
        AND COALESCE(bm.is_active, true)
    )
  );

DROP POLICY IF EXISTS "users_can_insert_own_unavailable" ON public.rehearsal_poll_unavailable;
CREATE POLICY "users_can_insert_own_unavailable" ON public.rehearsal_poll_unavailable
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.rehearsal_polls rp
      JOIN public.band_members bm ON bm.band_id = rp.band_id
      WHERE rp.id = rehearsal_poll_unavailable.poll_id
        AND bm.user_id = auth.uid()
        AND COALESCE(bm.is_active, true)
        AND rp.status = 'polling'
        AND (cardinality(rp.invited_user_ids) = 0 OR auth.uid() = ANY (rp.invited_user_ids))
    )
  );

DROP POLICY IF EXISTS "users_can_delete_own_unavailable" ON public.rehearsal_poll_unavailable;
CREATE POLICY "users_can_delete_own_unavailable" ON public.rehearsal_poll_unavailable
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Live updates for the poll card and vote sheet, like the votes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rehearsal_poll_unavailable'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rehearsal_poll_unavailable;
  END IF;
END
$$;

COMMIT;
