-- 082: setlists and their songs in the realtime publication.
--
-- An open gig detail reloads its setlist as soon as someone saves it
-- (useEventLiveRefresh). Realtime only sends rows the subscriber may read
-- (RLS on setlists / setlist_songs applies), so nothing new becomes visible.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'setlist_songs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.setlist_songs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'setlists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.setlists;
  END IF;
END;
$$;
