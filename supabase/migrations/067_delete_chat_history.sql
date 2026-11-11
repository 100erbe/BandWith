-- ====================================================================
-- 067: deleting a chat erases its history from the database
--
-- Until now "Delete chat" only set chat_participants.cleared_at for the
-- user, and several app paths reset it, so the old messages came back
-- when the chat was reopened. The app no longer resets cleared_at, and
-- now also calls this function, which removes the messages for good:
--   - direct chat: every message, for both people;
--   - band / event chat: only the caller's own messages (the others
--     keep the rest of the group conversation).
-- Replies to removed messages keep working (reply_to_id ON DELETE SET NULL).
-- Safe to run more than once.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.bw_delete_chat_history(p_chat_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_type text;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chat_participants WHERE chat_id = p_chat_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not a participant of this chat' USING ERRCODE = '42501';
  END IF;

  SELECT type INTO v_type FROM chats WHERE id = p_chat_id;

  IF v_type = 'direct' THEN
    DELETE FROM messages WHERE chat_id = p_chat_id;
  ELSE
    DELETE FROM messages WHERE chat_id = p_chat_id AND sender_id = v_uid;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE chat_participants
     SET cleared_at = now()
   WHERE chat_id = p_chat_id AND user_id = v_uid;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bw_delete_chat_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_delete_chat_history(uuid) TO authenticated;
