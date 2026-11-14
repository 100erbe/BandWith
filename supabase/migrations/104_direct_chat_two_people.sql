-- ============================================================================
-- 104: a direct chat stays between its two people
-- ----------------------------------------------------------------------------
-- A direct chat whose other participant row was gone (old hard deletes, or a
-- user removing their own row) could be reused by the app for a DM with
-- someone else: that person was added to it and read the whole history.
-- The app now only reuses a chat that was only ever between the same two
-- people (src/lib/directChat.ts). This is the server-side guard: nobody can
-- be added to a direct chat if it would then involve more than two people,
-- counting the creator, the current participants and everyone who wrote in it.
--
-- Only the direct-chat branch of bw_can_add_chat_participant changes; band
-- and event chats and every other rule are as in 073.
-- Not applied automatically: apply by hand like the other migrations.
-- ============================================================================

begin;

CREATE OR REPLACE FUNCTION public.bw_can_add_chat_participant(p_chat_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c record;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, type, band_id, event_id, created_by INTO c FROM chats WHERE id = p_chat_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF c.type = 'band' AND c.band_id IS NOT NULL THEN
    RETURN public.bw_is_band_member(c.band_id, actor)
       AND public.bw_is_band_member(c.band_id, p_user_id);
  END IF;

  IF c.type = 'event' AND c.event_id IS NOT NULL THEN
    RETURN public.bw_is_event_participant(c.event_id, actor)
       AND public.bw_is_event_participant(c.event_id, p_user_id);
  END IF;

  -- Direct / other chats: the actor must own or already be in the chat.
  IF NOT (
    c.created_by = actor
    OR EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = p_chat_id AND user_id = actor)
  ) THEN
    RETURN false;
  END IF;

  IF p_user_id = actor
     OR EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id) THEN
    RETURN true;
  END IF;

  -- Direct messages: members write only to admins of a band they share.
  IF c.type = 'direct' THEN
    -- Never a third person: they would read the whole history.
    IF (
      SELECT count(*) FROM (
        SELECT c.created_by AS u
        UNION SELECT cp.user_id FROM chat_participants cp WHERE cp.chat_id = p_chat_id
        UNION SELECT m.sender_id FROM messages m WHERE m.chat_id = p_chat_id
        UNION SELECT p_user_id
      ) people
      WHERE u IS NOT NULL
    ) > 2 THEN
      RETURN false;
    END IF;
    RETURN public.bw_shares_band_with_admin(p_user_id, actor);
  END IF;

  RETURN p_user_id = c.created_by OR public.bw_shares_band(p_user_id, actor);
END;
$function$;

commit;
