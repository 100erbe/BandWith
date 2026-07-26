-- ====================================================================
-- Fix RLS policies for chat tables AND notifications
-- 
-- Problem 1: Migration 028 added INSERT/UPDATE/DELETE to chat_participants
-- but dropped the SELECT policy — getChats() returns zero rows.
-- 
-- Problem 2: Notifications UPDATE/DELETE policies may be stale or missing
-- causing markAsRead() and deleteNotification() to silently fail.
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1) CHAT_PARTICIPANTS: Fix missing SELECT policy
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select" ON chat_participants;
DROP POLICY IF EXISTS "cp_select" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_select_v2" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_view_all_in_my_chats" ON chat_participants;

CREATE POLICY "chat_participants_select_own" ON chat_participants
    FOR SELECT USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 2) CHATS: Ensure SELECT policy exists
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;
DROP POLICY IF EXISTS "chats_select" ON chats;
DROP POLICY IF EXISTS "chats_sel" ON chats;
DROP POLICY IF EXISTS "chats_select_participant" ON chats;
DROP POLICY IF EXISTS "Users can view chats they participate in" ON chats;

CREATE POLICY "chats_select_participant" ON chats
    FOR SELECT USING (
        id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
    );

-- ═══════════════════════════════════════════════════════════════
-- 3) MESSAGES: Ensure SELECT policy exists
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "messages_view_in_my_chats" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;

CREATE POLICY "messages_view_in_my_chats" ON messages
    FOR SELECT USING (
        chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
    );

-- ═══════════════════════════════════════════════════════════════
-- 4) NOTIFICATIONS: Ensure UPDATE & DELETE policies exist
--    (migrations 004/011/021 created/dropped/recreated these —
--     we consolidate into definitive policies here)
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on notifications (may have been disabled)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- UPDATE: users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 5) GRANTS
-- ═══════════════════════════════════════════════════════════════

GRANT ALL ON public.chats TO authenticated;
GRANT ALL ON public.chat_participants TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.notifications TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6) RELOAD PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
