-- Fix messages RLS to use the security definer function
-- Run this in Supabase SQL Editor

-- Drop existing message policies
DROP POLICY IF EXISTS "Chat participants can view messages" ON messages;
DROP POLICY IF EXISTS "Chat participants can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;
DROP POLICY IF EXISTS "msg_sel" ON messages;
DROP POLICY IF EXISTS "msg_ins" ON messages;
DROP POLICY IF EXISTS "msg_upd" ON messages;
DROP POLICY IF EXISTS "msg_del" ON messages;

-- Create policies using the security definer function (no recursion!)
CREATE POLICY "messages_view_in_my_chats" ON messages
  FOR SELECT USING (
    chat_id IN (SELECT get_user_chat_ids(auth.uid()))
  );

CREATE POLICY "messages_send_in_my_chats" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    chat_id IN (SELECT get_user_chat_ids(auth.uid()))
  );

CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- Enable realtime for messages table (if not already)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
