-- ===============================================================
-- DIAGNOSTIC QUERIES - Run in Supabase SQL Editor
-- ===============================================================

-- 1. Check RLS state (is it ON or OFF?)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('chats', 'chat_participants', 'messages', 'notifications');

-- 2. Check all policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename IN ('chats', 'chat_participants', 'messages', 'notifications')
ORDER BY tablename, cmd;

-- 3. Pick a member user and check their chat participations
-- Replace 'MEMBER_USER_ID_HERE' with the UUID of a freemium/member user
-- SELECT cp.chat_id, c.name, c.type 
-- FROM chat_participants cp 
-- JOIN chats c ON c.id = cp.chat_id
-- WHERE cp.user_id = 'MEMBER_USER_ID_HERE';

-- 4. Check all notifications for that user
-- SELECT id, type, title, read, created_at 
-- FROM notifications 
-- WHERE user_id = 'MEMBER_USER_ID_HERE'
-- ORDER BY created_at DESC 
-- LIMIT 20;

-- 5. Test notification UPDATE (dry run with ROLLBACK)
BEGIN;
UPDATE notifications 
SET read = true, read_at = NOW() 
WHERE user_id = (SELECT id FROM profiles LIMIT 1) 
AND read = false;
-- If this works, you'll see "UPDATE 1" or similar
ROLLBACK; -- Undo the change

-- 6. Quick check: does this user see any rows?
SELECT 'chat_participants see:' as check, count(*) as cnt FROM chat_participants WHERE user_id IN (SELECT id FROM profiles LIMIT 1);