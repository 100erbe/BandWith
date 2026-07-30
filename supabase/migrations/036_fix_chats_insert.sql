-- ====================================================================
-- Fix: Missing INSERT policies for chats and chat_participants
--
-- Error: "new row violates row-level security policy for table 'chats'"
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1) chats: INSERT policy
-- ═══════════════════════════════════════════════════════════════
-- Allows authenticated users to create new chats

DROP POLICY IF EXISTS "chats_insert" ON chats;
CREATE POLICY "chats_insert" ON chats
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
-- 2) chat_participants: INSERT policy
-- ═══════════════════════════════════════════════════════════════
-- Allows authenticated users to add participants to chats

DROP POLICY IF EXISTS "chat_participants_insert" ON chat_participants;
CREATE POLICY "chat_participants_insert" ON chat_participants
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
-- 3) Reload schema cache
-- ═══════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';