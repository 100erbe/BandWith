-- ====================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Fixes: notifications can't be cleared + checks chat issue
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════
-- FIX 1: Add UPDATE and DELETE policies for notifications
-- ═══════════════════════════════════════════════════════════════

-- UPDATE: users can mark their own notifications as read
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (user_id = auth.uid());
    
-- DELETE: users can delete their own notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
    FOR DELETE USING (user_id = auth.uid());

SELECT '✅ Notifications: UPDATE and DELETE policies created' as result;

-- ═══════════════════════════════════════════════════════════════
-- CHECK: RLS state (is it ON or OFF?)
-- ═══════════════════════════════════════════════════════════════
SELECT tablename, 
  CASE WHEN rowsecurity THEN 'RLS ON' ELSE 'RLS OFF' END as rls_state
FROM pg_tables 
WHERE tablename IN ('chats', 'chat_participants', 'messages', 'notifications');

-- ═══════════════════════════════════════════════════════════════
-- CHECK: Show all policies after fix
-- ═══════════════════════════════════════════════════════════════
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE tablename IN ('chats', 'chat_participants', 'messages', 'notifications')
ORDER BY tablename, cmd;

-- ═══════════════════════════════════════════════════════════════
-- CHECK: List users and their user_mode (to detect solo vs member)
-- ═══════════════════════════════════════════════════════════════
SELECT id, email, full_name, user_mode, sub_tier 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- ═══════════════════════════════════════════════════════════════
-- CHECK: Do member users have any chat_participations?
-- ═══════════════════════════════════════════════════════════════
SELECT u.id as user_id, u.email, u.full_name, u.user_mode,
  (SELECT COUNT(*) FROM chat_participants cp WHERE cp.user_id = u.id) as chat_count
FROM profiles u
WHERE u.user_mode = 'member'
LIMIT 10;