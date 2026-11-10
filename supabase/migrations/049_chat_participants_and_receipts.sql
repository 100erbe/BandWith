-- ====================================================================
-- 049: Chat participants visible to their chat + WhatsApp-style receipts
--
-- 1. chat_participants was readable only for your own row, so a direct
--    chat could not show the other person's name ("Direct Chat") and
--    senders could never see when a message was read. Participants are
--    now visible to everyone in the same chat (and nobody else).
-- 2. last_delivered_at: when the recipient's app last received the chat.
--    Status of a message = sent (on the server) → delivered (all other
--    participants' apps got it) → read (all of them opened the chat).
-- 3. Both marks use server time (same clock as messages.created_at) and
--    only write when there is something new, so realtime updates never
--    loop between devices.
--
-- Safe to run more than once.
-- ====================================================================

ALTER TABLE public.chat_participants ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz;

CREATE OR REPLACE FUNCTION public.bw_my_chat_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(chat_id), '{}') FROM chat_participants WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.bw_my_chat_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_my_chat_ids() TO authenticated;

DROP POLICY IF EXISTS "chat_participants_select_same_chat" ON public.chat_participants;
CREATE POLICY "chat_participants_select_same_chat" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (chat_id = ANY (public.bw_my_chat_ids()));

-- Mark every chat with messages newer than my last delivery as delivered.
CREATE OR REPLACE FUNCTION public.bw_mark_chats_delivered()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  UPDATE chat_participants cp
     SET last_delivered_at = now()
   WHERE cp.user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM messages m
        WHERE m.chat_id = cp.chat_id
          AND m.sender_id <> auth.uid()
          AND m.created_at > coalesce(cp.last_delivered_at, '-infinity'::timestamptz)
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_mark_chats_delivered() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_mark_chats_delivered() TO authenticated;

-- Opening a chat: read (and therefore delivered) up to now.
CREATE OR REPLACE FUNCTION public.bw_mark_chat_read(p_chat_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  UPDATE chat_participants cp
     SET last_read_at = now(),
         last_delivered_at = now()
   WHERE cp.chat_id = p_chat_id
     AND cp.user_id = auth.uid()
     AND (
       cp.last_read_at IS NULL
       OR EXISTS (
         SELECT 1 FROM messages m
          WHERE m.chat_id = cp.chat_id
            AND m.sender_id <> auth.uid()
            AND m.created_at > cp.last_read_at
       )
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_mark_chat_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_mark_chat_read(uuid) TO authenticated;

-- Senders get receipt changes live (RLS above limits rows to their chats).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
END;
$$;
