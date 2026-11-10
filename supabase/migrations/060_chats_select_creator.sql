-- 060: creators can read the chats they create.
--
-- createChat() inserts the chat with RETURNING (supabase .insert().select())
-- and only then adds the participants. The only SELECT policy on chats
-- required a chat_participants row, so the RETURNING row was invisible to its
-- creator and Postgres rejected the insert with
--   "new row violates row-level security policy for table chats".
-- Every new direct, band or event chat failed this way.

DROP POLICY IF EXISTS chats_select_creator ON public.chats;
CREATE POLICY chats_select_creator ON public.chats
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());
