-- ====================================================================
-- Fix RLS policies for chat_participants
-- The table may have RLS enabled but missing UPDATE and INSERT policies
-- ====================================================================

-- Re-enable RLS (in case it was disabled)
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own participant record (last_read_at, muted)
DROP POLICY IF EXISTS "Users can update own chat participation" ON chat_participants;
CREATE POLICY "Users can update own chat participation" ON chat_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to insert participants when creating a chat they're in
DROP POLICY IF EXISTS "Users can insert participants for own chats" ON chat_participants;
CREATE POLICY "Users can insert participants for own chats" ON chat_participants
    FOR INSERT WITH CHECK (
        -- User is inserting themselves
        user_id = auth.uid()
        OR
        -- Or the chat is one the user is already part of (e.g., adding more members)
        chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
    );

-- Allow users to delete their own participant record (leave chat)
DROP POLICY IF EXISTS "Users can delete own chat participation" ON chat_participants;
CREATE POLICY "Users can delete own chat participation" ON chat_participants
    FOR DELETE USING (auth.uid() = user_id);
