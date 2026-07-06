-- Add RLS policies for event_members table
-- Currently the table has ENABLE ROW LEVEL SECURITY but no policies, so all operations fail

-- Allow admins/creators to insert members (when creating an event)
CREATE POLICY "event_admins_can_insert_members" ON event_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
      AND (e.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM band_members bm
        WHERE bm.band_id = e.band_id
        AND bm.user_id = auth.uid()
        AND bm.role = 'admin'
      ))
    )
  );

-- Allow users to read their own memberships
CREATE POLICY "users_can_read_own_memberships" ON event_members
  FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to read all memberships for their band's events
CREATE POLICY "admins_can_read_event_memberships" ON event_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = event_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
    )
  );

-- Allow users to update their own membership (accept/decline/drop out)
CREATE POLICY "users_can_update_own_membership" ON event_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow admins to update memberships (remove member, change fee, etc.)
CREATE POLICY "admins_can_update_memberships" ON event_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = event_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
    )
  );

-- Allow admins to delete memberships
CREATE POLICY "admins_can_delete_memberships" ON event_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = event_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
    )
  );
