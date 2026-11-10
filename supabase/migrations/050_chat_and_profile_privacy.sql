-- ====================================================================
-- 050: Chat and profile privacy
--
-- Old permissive policies (all ORed together, several granted to PUBLIC
-- i.e. also to signed-out callers holding the app's anon key) let:
--   - anyone read every profile, including email and phone;
--   - any band member read every message tagged with the band, including
--     other members' direct chats; messages with no chat were public;
--   - anyone insert a chat_participants row for any chat (cp_insert WITH
--     CHECK true) or move their own row to another chat via UPDATE, i.e.
--     join and read any conversation;
--   - anyone insert a message into any chat (msg_ins only checked sender);
--   - anyone create chats bypassing the band/event check (chats_ins).
-- After this migration:
--   - messages: read/write only in chats you participate in;
--   - chat_participants: rows can't be moved between chats/users;
--   - profiles: visible to yourself and to people you share a band, a
--     chat or an event with; member search goes through an admin-only
--     function that masks emails unless you type the exact address.
-- Checked before writing: no message has chat_id NULL, every sender is a
-- participant, every active band member is in their band chat.
--
-- Safe to run more than once.
-- ====================================================================

-- --------------------------------------------------------------------
-- messages
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Band members can read messages" ON public.messages;
DROP POLICY IF EXISTS "Band members can view messages" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_view_in_my_chats" ON public.messages;
DROP POLICY IF EXISTS "msg_sel" ON public.messages;
DROP POLICY IF EXISTS "Band members can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Band members can send messages" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "msg_ins" ON public.messages;
DROP POLICY IF EXISTS "msg_upd" ON public.messages;
DROP POLICY IF EXISTS "msg_del" ON public.messages;
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;

CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (chat_id = ANY (public.bw_my_chat_ids()));

CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND chat_id = ANY (public.bw_my_chat_ids()));

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND chat_id = ANY (public.bw_my_chat_ids()));

CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- A message can be edited, never moved or re-attributed.
CREATE OR REPLACE FUNCTION public.bw_messages_immutable_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_id IS DISTINCT FROM OLD.chat_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'messages: chat_id, sender_id and created_at cannot change';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bw_messages_immutable_keys ON public.messages;
CREATE TRIGGER bw_messages_immutable_keys
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bw_messages_immutable_keys();

-- --------------------------------------------------------------------
-- chat_participants
-- --------------------------------------------------------------------
-- cp_insert allowed anything; chat_participants_insert (042) stays and
-- uses bw_can_add_chat_participant.
DROP POLICY IF EXISTS "cp_insert" ON public.chat_participants;

-- The app upserts its own row (same chat_id/user_id), so block only changes.
CREATE OR REPLACE FUNCTION public.bw_chat_participants_immutable_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_id IS DISTINCT FROM OLD.chat_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'chat_participants: chat_id and user_id cannot change';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bw_chat_participants_immutable_keys ON public.chat_participants;
CREATE TRIGGER bw_chat_participants_immutable_keys
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW EXECUTE FUNCTION public.bw_chat_participants_immutable_keys();

-- --------------------------------------------------------------------
-- chats
-- --------------------------------------------------------------------
-- chats_ins skipped the band/event check of chats_insert (042).
DROP POLICY IF EXISTS "chats_ins" ON public.chats;
DROP POLICY IF EXISTS "chats_upd" ON public.chats;
CREATE POLICY "chats_upd" ON public.chats
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- --------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------
-- Someone in an event with me: both in the lineup, or one in the lineup
-- of an event of a band the other belongs to.
CREATE OR REPLACE FUNCTION public.bw_shares_event(p_other uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_members a
    JOIN event_members b ON b.event_id = a.event_id
    WHERE a.user_id = p_user_id AND b.user_id = p_other
  ) OR EXISTS (
    SELECT 1
    FROM event_members em
    JOIN events e ON e.id = em.event_id
    JOIN band_members bm ON bm.band_id = e.band_id AND coalesce(bm.is_active, true)
    WHERE (em.user_id = p_other AND bm.user_id = p_user_id)
       OR (em.user_id = p_user_id AND bm.user_id = p_other)
  );
$$;
REVOKE ALL ON FUNCTION public.bw_shares_event(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_shares_event(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_related" ON public.profiles;
CREATE POLICY "profiles_select_related" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.bw_shares_band(id)
    OR public.bw_shares_chat(id)
    OR public.bw_shares_event(id)
  );

-- Member search for the invite screen: band admins only, 3+ characters,
-- 8 results, email masked unless the exact address was typed.
CREATE OR REPLACE FUNCTION public.bw_search_invitable_users(p_band_id uuid, p_query text)
RETURNS TABLE (id uuid, full_name text, avatar_url text, email_hint text, email_exact boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT lower(btrim(coalesce(p_query, ''))) AS v)
  SELECT p.id,
         p.full_name::text,
         p.avatar_url::text,
         CASE WHEN lower(p.email) = q.v THEN p.email::text
              ELSE left(split_part(p.email, '@', 1), 2) || '•••@' || split_part(p.email, '@', 2)
         END,
         lower(p.email) = q.v
  FROM profiles p, q
  WHERE auth.uid() IS NOT NULL
    AND public.bw_is_band_admin(p_band_id)
    AND length(q.v) >= 3
    AND p.id <> auth.uid()
    AND (
      lower(p.email) = q.v
      OR (position('@' in q.v) = 0
          AND p.full_name ILIKE '%' || replace(replace(replace(q.v, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    )
    AND NOT EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = p_band_id AND bm.user_id = p.id AND coalesce(bm.is_active, true)
    )
  ORDER BY (lower(p.email) = q.v) DESC, p.full_name
  LIMIT 8;
$$;
REVOKE ALL ON FUNCTION public.bw_search_invitable_users(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_search_invitable_users(uuid, text) TO authenticated;
