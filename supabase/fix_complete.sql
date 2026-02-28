-- =============================================
-- FIX COMPLETO - SCHEMA E RLS
-- Esegui in Supabase SQL Editor
-- =============================================

-- STEP 1: Aggiungi colonna chat_id a messages se non esiste
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'chat_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN chat_id UUID REFERENCES chats(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
  END IF;
END $$;

-- STEP 2: Drop ALL policies on chat_participants
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can manage their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can insert their own participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can delete their own participations" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_insert" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_update" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_delete" ON chat_participants;

-- STEP 3: Drop ALL policies on chats
DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;
DROP POLICY IF EXISTS "Users can view chats they participate in" ON chats;
DROP POLICY IF EXISTS "Users can create chats" ON chats;
DROP POLICY IF EXISTS "chats_select" ON chats;
DROP POLICY IF EXISTS "chats_insert" ON chats;
DROP POLICY IF EXISTS "chats_update" ON chats;

-- STEP 4: Drop ALL policies on messages
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

-- STEP 5: Create SIMPLE policies for chat_participants
CREATE POLICY "cp_select" ON chat_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cp_insert" ON chat_participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "cp_update" ON chat_participants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "cp_delete" ON chat_participants
  FOR DELETE USING (user_id = auth.uid());

-- STEP 6: Create policies for chats
CREATE POLICY "chats_sel" ON chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp 
      WHERE cp.chat_id = chats.id AND cp.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "chats_ins" ON chats
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "chats_upd" ON chats
  FOR UPDATE USING (created_by = auth.uid());

-- STEP 7: Create policies for messages
CREATE POLICY "msg_sel" ON messages
  FOR SELECT USING (
    chat_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM chat_participants cp 
      WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "msg_ins" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "msg_upd" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "msg_del" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- STEP 8: Grant permissions
GRANT ALL ON chats TO authenticated;
GRANT ALL ON chat_participants TO authenticated;
GRANT ALL ON messages TO authenticated;

-- DONE!
SELECT 'Schema e RLS corretti con successo!' as result;
