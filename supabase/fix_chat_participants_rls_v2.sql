-- Fix chat_participants RLS WITHOUT recursion
-- Run this in Supabase SQL Editor

-- First, drop the problematic policy
DROP POLICY IF EXISTS "chat_participants_select_v2" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select" ON chat_participants;
DROP POLICY IF EXISTS "cp_select" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;

-- Create a security definer function to get user's chat IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_chat_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT chat_id FROM chat_participants WHERE user_id = user_uuid;
$$;

-- Now create policy using the function (no recursion!)
CREATE POLICY "chat_participants_view_all_in_my_chats" ON chat_participants
  FOR SELECT USING (
    chat_id IN (SELECT get_user_chat_ids(auth.uid()))
  );

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION get_user_chat_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_chat_ids(UUID) TO anon;
