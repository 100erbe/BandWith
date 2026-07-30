-- Enable realtime for event_members table
-- This is needed so the dashboard "My Fee" counter updates in real-time
-- when an admin edits a member's fee on an accepted event.

-- Add event_members table to realtime publication (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'event_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_members;
  END IF;
END
$$;

-- Set REPLICA IDENTITY to FULL so that DELETE events include user_id column
-- (the subscription filter relies on user_id=eq.{userId} to fire)
ALTER TABLE event_members REPLICA IDENTITY FULL;
