-- ====================================================================
-- COMPLETE FIX: Chat tables schema + RLS policies
-- Run ALL of this in the Supabase SQL Editor
-- ====================================================================

-- 1. Ensure all columns exist on chat_participants
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Ensure all columns exist on chats
ALTER TABLE chats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE chats ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Drop ALL existing policies on chat_participants
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select" ON chat_participants;
DROP POLICY IF EXISTS "cp_select" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select_v2" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_view_all_in_my_chats" ON chat_participants;
DROP POLICY IF EXISTS "Users can update own chat participation" ON chat_participants;
DROP POLICY IF EXISTS "Users can insert participants for own chats" ON chat_participants;
DROP POLICY IF EXISTS "Users can delete own chat participation" ON chat_participants;

-- 4. Drop the helper function if it exists
DROP FUNCTION IF EXISTS get_user_chat_ids(UUID);

-- 5. Re-enable RLS
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- 6. Create a SECURITY DEFINER helper function to avoid RLS recursion
-- This function bypasses RLS to read chat_participants
CREATE OR REPLACE FUNCTION get_user_chat_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT chat_id FROM chat_participants WHERE user_id = user_uuid;
$$;

GRANT EXECUTE ON FUNCTION get_user_chat_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_chat_ids(UUID) TO anon;

-- 7. Create new policies using the helper function (no recursion!)
-- SELECT: can see participants in any chat where you're a participant
CREATE POLICY "chat_participants_select_policy" ON chat_participants
  FOR SELECT USING (
    chat_id IN (SELECT get_user_chat_ids(auth.uid()))
  );

-- INSERT: can insert yourself or into chats you're already in
CREATE POLICY "chat_participants_insert_policy" ON chat_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR
    chat_id IN (SELECT get_user_chat_ids(auth.uid()))
  );

-- UPDATE: can update your own participant record (last_read_at, muted)
CREATE POLICY "chat_participants_update_policy" ON chat_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE: can delete your own participant record (leave chat)
CREATE POLICY "chat_participants_delete_policy" ON chat_participants
  FOR DELETE USING (auth.uid() = user_id);

-- 8. Also fix chats RLS to use the same helper (avoids the same recursion)
DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;
CREATE POLICY "Chat participants can view chats" ON chats
  FOR SELECT USING (
    id IN (SELECT get_user_chat_ids(auth.uid()))
  );

-- 9. Verify the fix - test queries
-- Run these manually to confirm:
-- SELECT * FROM chat_participants LIMIT 5;
-- SELECT * FROM chats LIMIT 5;
