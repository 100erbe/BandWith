-- =============================================
-- FIX RLS POLICIES V2 - RICORSIONE INFINITA
-- Esegui in Supabase SQL Editor
-- =============================================

-- STEP 1: Drop ALL problematic policies on chat_participants
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can manage their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can insert their own participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can delete their own participations" ON chat_participants;

-- STEP 2: Drop ALL problematic policies on chats
DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;
DROP POLICY IF EXISTS "Users can view chats they participate in" ON chats;
DROP POLICY IF EXISTS "Users can create chats" ON chats;

-- STEP 3: Drop ALL problematic policies on messages
DROP POLICY IF EXISTS "Chat participants can view messages" ON messages;
DROP POLICY IF EXISTS "Chat participants can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- STEP 4: Create SIMPLE policies for chat_participants
-- Users can only see/manage their OWN participations (no recursion!)
CREATE POLICY "chat_participants_select" ON chat_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "chat_participants_insert" ON chat_participants
  FOR INSERT WITH CHECK (true); -- Allow insert, app controls logic

CREATE POLICY "chat_participants_update" ON chat_participants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "chat_participants_delete" ON chat_participants
  FOR DELETE USING (user_id = auth.uid());

-- STEP 5: Create policies for chats using a CTE approach
CREATE POLICY "chats_select" ON chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp 
      WHERE cp.chat_id = chats.id AND cp.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "chats_insert" ON chats
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "chats_update" ON chats
  FOR UPDATE USING (created_by = auth.uid());

-- STEP 6: Create policies for messages
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp 
      WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_participants cp 
      WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- DONE!
SELECT 'RLS policies fixed successfully!' as result;
