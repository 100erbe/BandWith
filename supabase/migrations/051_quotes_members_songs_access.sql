-- ====================================================================
-- 051: Quotes, band membership, event lineups and songs access
--
-- Found in production:
--   - quotes: the only SELECT path was "Admins can manage quotes", which
--     matches on event_id. Quotes are saved with band_id and no event, so
--     INSERT ... RETURNING failed ("violates row-level security") and no
--     band-level quote could be read, updated or shared. quote_items and
--     quote_musicians inherited the same problem.
--   - band_members: band_members_insert_policy allowed user_id = auth.uid()
--     with any role, i.e. anyone signed in could add themselves to any band
--     as admin. "Users can join via invitation" did not pin the role.
--   - event_members: legacy policies let any band member insert, change or
--     delete anyone's lineup row (RSVPs included).
--   - songs: only admins could add songs, but the repertoire screen lets
--     every member add them; the insert failed after the file upload.
--   - events.setlist_id had no FK, deleted setlists left dangling ids.
--   - quotes had no place for the wizard's options and PDF settings, so
--     multi-option quotes came back as a single option.
--
-- Safe to run more than once.
-- ====================================================================

-- --------------------------------------------------------------------
-- quotes: band admins (and the author) only
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage quotes" ON public.quotes;
DROP POLICY IF EXISTS "Band members can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Band members can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Band admins can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_admin" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_admin" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_admin" ON public.quotes;
DROP POLICY IF EXISTS "quotes_delete_admin" ON public.quotes;

CREATE POLICY "quotes_select_admin" ON public.quotes
  FOR SELECT TO authenticated
  USING (public.bw_is_band_admin(band_id) OR created_by = auth.uid());

CREATE POLICY "quotes_insert_admin" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_is_band_admin(band_id) AND created_by = auth.uid());

CREATE POLICY "quotes_update_admin" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.bw_is_band_admin(band_id))
  WITH CHECK (public.bw_is_band_admin(band_id));

CREATE POLICY "quotes_delete_admin" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.bw_is_band_admin(band_id));

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS options jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS presentation jsonb;

-- quote_items / quote_musicians follow the quote's band.
CREATE OR REPLACE FUNCTION public.bw_is_quote_admin(p_quote_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = p_quote_id AND public.bw_is_band_admin(q.band_id)
  );
$$;
REVOKE ALL ON FUNCTION public.bw_is_quote_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_is_quote_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can manage quote items" ON public.quote_items;
DROP POLICY IF EXISTS "quote_items_admin" ON public.quote_items;
CREATE POLICY "quote_items_admin" ON public.quote_items
  FOR ALL TO authenticated
  USING (public.bw_is_quote_admin(quote_id))
  WITH CHECK (public.bw_is_quote_admin(quote_id));

DROP POLICY IF EXISTS "Band members can manage quote musicians" ON public.quote_musicians;
DROP POLICY IF EXISTS "Band admins can manage quote musicians" ON public.quote_musicians;
DROP POLICY IF EXISTS "quote_musicians_admin" ON public.quote_musicians;
CREATE POLICY "quote_musicians_admin" ON public.quote_musicians
  FOR ALL TO authenticated
  USING (public.bw_is_quote_admin(quote_id))
  WITH CHECK (public.bw_is_quote_admin(quote_id));
-- "Band members can view quote musicians" (own row) stays.

-- --------------------------------------------------------------------
-- band_members: only admins add people; invitees join as members
-- --------------------------------------------------------------------
-- New bands get their admin from the SECURITY DEFINER trigger
-- handle_new_band; invitations go through bw_accept_invitation.
DROP POLICY IF EXISTS "band_members_insert_policy" ON public.band_members;
DROP POLICY IF EXISTS "band_members_insert_admin" ON public.band_members;
CREATE POLICY "band_members_insert_admin" ON public.band_members
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS "Users can join via invitation" ON public.band_members;
CREATE POLICY "Users can join via invitation" ON public.band_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND EXISTS (
      SELECT 1 FROM band_invitations bi
      WHERE bi.band_id = band_members.band_id
        AND lower(bi.email) = lower(auth.jwt() ->> 'email')
        AND bi.status = 'pending'
        AND (bi.expires_at IS NULL OR bi.expires_at > now())
    )
  );

-- --------------------------------------------------------------------
-- event_members: members touch only their own row
-- --------------------------------------------------------------------
-- Admin and event-creator policies ("Manage event members",
-- admins_can_*, event_admins_can_insert_members) and the own-row ones
-- ("Users can respond to events", users_can_update_own_membership,
-- personal-gig policies) stay.
DROP POLICY IF EXISTS "event_members_insert" ON public.event_members;
DROP POLICY IF EXISTS "event_members_update" ON public.event_members;
DROP POLICY IF EXISTS "event_members_delete" ON public.event_members;
DROP POLICY IF EXISTS "event_members_delete_own" ON public.event_members;
CREATE POLICY "event_members_delete_own" ON public.event_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- An RSVP can't move the row to another event or person.
CREATE OR REPLACE FUNCTION public.bw_event_members_immutable_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'event_members: event_id and user_id cannot change';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bw_event_members_immutable_keys ON public.event_members;
CREATE TRIGGER bw_event_members_immutable_keys
  BEFORE UPDATE ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.bw_event_members_immutable_keys();

-- --------------------------------------------------------------------
-- songs: every active member can add and edit; admins delete
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "songs_insert_member" ON public.songs;
DROP POLICY IF EXISTS "songs_update_member" ON public.songs;
CREATE POLICY "songs_insert_member" ON public.songs
  FOR INSERT TO authenticated
  WITH CHECK (band_id::text = ANY (public.bw_my_band_ids()));
CREATE POLICY "songs_update_member" ON public.songs
  FOR UPDATE TO authenticated
  USING (band_id::text = ANY (public.bw_my_band_ids()))
  WITH CHECK (band_id::text = ANY (public.bw_my_band_ids()));
-- "Band admins can manage songs" (ALL) keeps delete admin-only.

-- --------------------------------------------------------------------
-- events.setlist_id -> setlists
-- --------------------------------------------------------------------
UPDATE public.events e SET setlist_id = NULL
WHERE setlist_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.setlists s WHERE s.id = e.setlist_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_setlist_id_fkey' AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_setlist_id_fkey
      FOREIGN KEY (setlist_id) REFERENCES public.setlists(id) ON DELETE SET NULL;
  END IF;
END $$;
