-- ====================================================================
-- 037_member_scoped_events_rls.sql
--
-- Enforce least-privilege access for freemium/member users:
--   1. Members can only SEE the gigs they have been invited to
--      (i.e. they have an event_members row), never the whole band.
--   2. Members can only read their OWN event_members row -> their OWN fee.
--      They can never read the band total fee or other members' fees.
--   3. Members cannot create/update/delete band events or memberships
--      (closes the previous "Band members can update events" and
--       "Band members can manage event members FOR ALL" holes).
--
-- NOTE: Postgres ORs together all permissive SELECT policies, so we MUST
-- drop every legacy/broad policy before recreating scoped ones.
-- ====================================================================

-- ====================================================================
-- EVENTS
-- ====================================================================
DROP POLICY IF EXISTS "Band members can view events" ON events;
DROP POLICY IF EXISTS "Band members can create events" ON events;
DROP POLICY IF EXISTS "Band members can update events" ON events;
DROP POLICY IF EXISTS "Band admins can update events" ON events;
DROP POLICY IF EXISTS "Band admins can delete events" ON events;
DROP POLICY IF EXISTS "Members can view events" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;
DROP POLICY IF EXISTS "Admins can update events" ON events;
DROP POLICY IF EXISTS "Admins can delete events" ON events;
DROP POLICY IF EXISTS "events_select_member" ON events;
DROP POLICY IF EXISTS "events_insert_member" ON events;
DROP POLICY IF EXISTS "events_update_admin" ON events;
DROP POLICY IF EXISTS "events_delete_admin" ON events;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Admins (or the event creator) can read all of their band's events.
CREATE POLICY "events_select_admin" ON events
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    OR created_by = auth.uid()
  );

-- Members can only read events they were invited to.
CREATE POLICY "events_select_member_invited" ON events
  FOR SELECT USING (
    id IN (SELECT event_id FROM event_members WHERE user_id = auth.uid())
  );

-- Writes are admin-only.
CREATE POLICY "events_insert_admin" ON events
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "events_update_admin" ON events
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "events_delete_admin" ON events
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ====================================================================
-- EVENT MEMBERS
-- ====================================================================
DROP POLICY IF EXISTS "Members can view event members" ON event_members;
DROP POLICY IF EXISTS "Admins can manage event members" ON event_members;
DROP POLICY IF EXISTS "Band members can view event members" ON event_members;
DROP POLICY IF EXISTS "Band members can manage event members" ON event_members;
DROP POLICY IF EXISTS "Members can manage their event participation" ON event_members;
DROP POLICY IF EXISTS "em_select_member" ON event_members;
DROP POLICY IF EXISTS "em_insert_self" ON event_members;
DROP POLICY IF EXISTS "em_admin_all" ON event_members;
DROP POLICY IF EXISTS "event_admins_can_insert_members" ON event_members;
DROP POLICY IF EXISTS "users_can_read_own_memberships" ON event_members;
DROP POLICY IF EXISTS "admins_can_read_event_memberships" ON event_members;
DROP POLICY IF EXISTS "users_can_update_own_membership" ON event_members;
DROP POLICY IF EXISTS "admins_can_update_memberships" ON event_members;
DROP POLICY IF EXISTS "admins_can_delete_memberships" ON event_members;

ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

-- A user can always read their OWN membership row (their own fee/status).
CREATE POLICY "event_members_select_own" ON event_members
  FOR SELECT USING (user_id = auth.uid());

-- Admins can read all membership rows for their band's events.
CREATE POLICY "event_members_select_admin" ON event_members
  FOR SELECT USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE bm.user_id = auth.uid() AND bm.role = 'admin'
    )
  );

-- Only admins can add people to events (no self-enrollment).
CREATE POLICY "event_members_insert_admin" ON event_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = event_id AND bm.user_id = auth.uid() AND bm.role = 'admin'
    )
  );

-- A user can update their own membership (accept/decline/respond).
CREATE POLICY "event_members_update_own" ON event_members
  FOR UPDATE USING (user_id = auth.uid());

-- Admins can update any membership row (change fee, status, role...).
CREATE POLICY "event_members_update_admin" ON event_members
  FOR UPDATE USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE bm.user_id = auth.uid() AND bm.role = 'admin'
    )
  );

-- Only admins can remove people from events.
CREATE POLICY "event_members_delete_admin" ON event_members
  FOR DELETE USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE bm.user_id = auth.uid() AND bm.role = 'admin'
    )
  );

-- ====================================================================
-- NON-FINANCIAL ROSTER HELPER (standard practice)
--
-- Lets the UI show WHO is on a gig (names + status) without ever
-- exposing any member's fee. The function checks that the caller is a
-- member of the event's band, so it cannot be abused to enumerate
-- rosters for unrelated bands.
-- ====================================================================
CREATE OR REPLACE FUNCTION get_event_roster(p_event_id uuid)
RETURNS TABLE (user_id uuid, full_name text, status text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT em.user_id, p.full_name, em.status
  FROM event_members em
  JOIN profiles p ON p.id = em.user_id
  WHERE em.event_id = p_event_id
    AND (
      -- admins can see the roster of any event in their band
      EXISTS (
        SELECT 1
        FROM events e
        JOIN band_members bm ON bm.band_id = e.band_id
        WHERE e.id = p_event_id AND bm.user_id = auth.uid() AND bm.role = 'admin'
      )
      -- members can only see the roster of events they were invited to
      OR EXISTS (
        SELECT 1
        FROM event_members mine
        WHERE mine.event_id = p_event_id AND mine.user_id = auth.uid()
      )
    );
$$;

GRANT EXECUTE ON FUNCTION get_event_roster(uuid) TO authenticated;
