-- ====================================================================
-- Fix missing UPDATE and DELETE policies for notifications
-- 
-- Current state (from diagnostics):
--   notifications:   ONLY has SELECT — markAsRead/deleteNotification silently fail
--   chat_participants: Has SELECT policies (working ✓)
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1) NOTIFICATIONS: Add missing UPDATE and DELETE policies
-- ═══════════════════════════════════════════════════════════════

-- UPDATE: users can mark their own notifications as read
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 2) Load Schema
-- ═══════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';