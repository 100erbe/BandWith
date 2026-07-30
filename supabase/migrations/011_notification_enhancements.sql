-- Notification system enhancements for production

-- Add archived column if not exists
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add priority column if not exists
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';

-- Add reference columns for linking to entities
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS reference_id UUID;

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);

-- Add primary and secondary action columns
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS primary_action VARCHAR(20);

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS secondary_action VARCHAR(20);

-- Add expires_at for time-sensitive notifications
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for archived notifications
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(archived);

-- Create index for priority
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- Create index for reference lookups
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);

-- Update RLS policy to include archived filtering
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- Add insert policy if not exists
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
CREATE POLICY "Users can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Keep update policy
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Add delete policy
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (user_id = auth.uid());
