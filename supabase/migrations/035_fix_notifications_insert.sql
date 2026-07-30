-- ====================================================================
-- Fix: Missing columns and INSERT policy for notifications
--
-- Two errors when creating events:
--   1. "Could not find the 'primary_action' column" → missing columns
--   2. "new row violates RLS policy" → missing INSERT policy
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1) Add missing columns (safely, IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS primary_action VARCHAR(20),
  ADD COLUMN IF NOT EXISTS secondary_action VARCHAR(20);

-- ═══════════════════════════════════════════════════════════════
-- 2) Add INSERT policy for notifications
-- ═══════════════════════════════════════════════════════════════
-- Allows authenticated users to insert notifications.
-- The server-side function (insert_notification) or direct inserts
-- will work if the user is authenticated.

DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;

CREATE POLICY "notifications_insert" ON notifications
    FOR INSERT
    WITH CHECK (
      -- Authenticated users can insert notifications
      auth.role() = 'authenticated'
    );

-- ═══════════════════════════════════════════════════════════════
-- 3) Reload schema cache
-- ═══════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';