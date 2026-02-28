-- Fix chat_participants RLS to allow seeing all participants in your chats
-- Run this in Supabase SQL Editor

-- Drop old restrictive policies
DROP POLICY IF EXISTS "chat_participants_select" ON chat_participants;
DROP POLICY IF EXISTS "cp_select" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;

-- Create new policy: see all participants in chats where you are a member
-- Using EXISTS to avoid recursion issues
CREATE POLICY "chat_participants_select_v2" ON chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp2 
      WHERE cp2.chat_id = chat_participants.chat_id 
      AND cp2.user_id = auth.uid()
    )
  );

-- Verify with a test (optional)
-- SELECT * FROM chat_participants WHERE chat_id = 'f1a21841-de35-476e-ab79-be3e99c7cbdc';
