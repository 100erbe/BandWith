-- ====================================================================
-- 039_restore_admin_event_visibility.sql
--
-- Repairs event visibility after the member-scoping migration (037).
-- Root causes addressed:
--   1. Band creators without a (correct) band_members 'admin' row were
--      being treated as members and lost access to their events.
--   2. A partially-applied 037 could leave `events` with RLS enabled but
--      no SELECT policy -> nobody sees any events.
--
-- This migration is idempotent: it backfills creators and recreates all
-- policies from scratch so the DB ends up in the correct state regardless
-- of what 037 left behind.
-- ====================================================================

-- 1) Backfill: ensure every band creator has an 'admin' band_members row.
INSERT INTO band_members (band_id, user_id, role)
SELECT id, created_by, 'admin'
FROM bands
WHERE created_by IS NOT NULL
ON CONFLICT (band_id, user_id) DO NOTHING;

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
DROP POLICY IF EXISTS "events_select_admin" ON events;
DROP POLICY IF EXISTS "events_select_member_invited" ON events;
DROP POLICY IF EXISTS "events_insert_admin" ON events;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Admins (role='admin'), band creators, or event creators can read all.
CREATE POLICY "events_select_admin" ON events
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    OR band_id IN (SELECT id FROM bands WHERE created_by = auth.uid())
    OR created_by = auth.uid()
  );

-- Members can only read events they were invited to.
CREATE POLICY "events_select_member_invited" ON events
  FOR SELECT USING (
    id IN (SELECT event_id FROM event_members WHERE user_id = auth.uid())
  );

CREATE POLICY "events_insert_admin" ON events
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    OR band_id IN (SELECT id FROM bands WHERE created_by = auth.uid())
  );

CREATE POLICY "events_update_admin" ON events
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    OR band_id IN (SELECT id FROM bands WHERE created_by = auth.uid())
  );

CREATE POLICY "events_delete_admin" ON events
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    OR band_id IN (SELECT id FROM bands WHERE created_by = auth.uid())
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
DROP POLICY IF EXISTS "event_members_select_own" ON event_members;
DROP POLICY IF EXISTS "event_members_select_admin" ON event_members;
DROP POLICY IF EXISTS "event_members_insert_admin" ON event_members;
DROP POLICY IF EXISTS "event_members_update_own" ON event_members;
DROP POLICY IF EXISTS "event_members_update_admin" ON event_members;
DROP POLICY IF EXISTS "event_members_delete_admin" ON event_members;

ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

-- A user can always read their OWN membership row (their own fee/status).
CREATE POLICY "event_members_select_own" ON event_members
  FOR SELECT USING (user_id = auth.uid());

-- Admins (role='admin') or band creators can read all membership rows.
CREATE POLICY "event_members_select_admin" ON event_members
  FOR SELECT USING (
    event_id IN (
      SELECT e.id FROM events e
      WHERE e.band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
         OR e.band_id IN (SELECT id FROM bands WHERE created_by = auth.uid())
    )
  );

CREATE POLICY "event_members_insert_admin" ON event_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND (e.band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
             OR e.band_id IN (SELECT id FROM bands WHERE created_by = auth.uid()))
    )
  );

-- A user can update their own membership (accept/decline/respond).
CREATE POLICY "event_members_update_own" ON event_members
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "event_members_update_admin" ON event_members
  FOR UPDATE USING (
    event_id IN (
      SELECT e.id FROM events e
      WHERE e.band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
         OR e.band_id IN (SELECT id FROM bands WHERE created_by = auth.uid())
    )
  );

CREATE POLICY "event_members_delete_admin" ON event_members
  FOR DELETE USING (
    event_id IN (
      SELECT e.id FROM events e
      WHERE e.band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
         OR e.band_id IN (SELECT id FROM bands WHERE created_by = auth.uid())
    )
  );

-- ====================================================================
-- NON-FINANCIAL ROSTER HELPER (recreate in case 037 failed partway)
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
      EXISTS (
        SELECT 1 FROM events e
        JOIN band_members bm ON bm.band_id = e.band_id
        WHERE e.id = p_event_id AND bm.user_id = auth.uid() AND bm.role = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = p_event_id AND e.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM event_members mine
        WHERE mine.event_id = p_event_id AND mine.user_id = auth.uid()
      )
    );
$$;

GRANT EXECUTE ON FUNCTION get_event_roster(uuid) TO authenticated;

