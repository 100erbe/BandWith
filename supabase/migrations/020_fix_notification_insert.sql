-- Fix: Allow any authenticated user to create notifications for any user
-- This is needed because when user A sends a message to user B,
-- user A needs to create a notification for user B

-- Drop existing insert policies
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- Create new policy that allows any authenticated user to insert notifications
CREATE POLICY "Authenticated users can create notifications" ON notifications
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- Ensure realtime is enabled for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
