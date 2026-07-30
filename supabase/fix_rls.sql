-- =============================================
-- FIX RLS POLICIES - RICORSIONE INFINITA
-- Esegui in Supabase SQL Editor
-- =============================================

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can manage their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their chats" ON messages;

-- Fix chat_participants policies (avoid recursion)
CREATE POLICY "Users can view their own participations" ON chat_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own participations" ON chat_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own participations" ON chat_participants
  FOR DELETE USING (user_id = auth.uid());

-- Fix chats policies (use direct check, not subquery that causes recursion)
DROP POLICY IF EXISTS "Users can view chats they participate in" ON chats;
CREATE POLICY "Users can view chats they participate in" ON chats
  FOR SELECT USING (
    id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create chats" ON chats
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Fix messages policies
CREATE POLICY "Users can view messages in their chats" ON messages
  FOR SELECT USING (
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

-- Grant permissions
GRANT ALL ON chats TO authenticated;
GRANT ALL ON chat_participants TO authenticated;
GRANT ALL ON messages TO authenticated;

SELECT 'RLS policies fixed!' as result;
