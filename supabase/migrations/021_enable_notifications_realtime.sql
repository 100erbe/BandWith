-- Enable realtime for notifications table
-- This ensures INSERT/UPDATE events are broadcast to subscribers

-- Add notifications table to realtime publication (if not already added)
DO $$
BEGIN
    -- Check if table is already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;

-- Set REPLICA IDENTITY to FULL for better realtime support
-- This ensures all column values are sent in UPDATE events
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Verify RLS policies allow reading own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
