-- =============================================
-- ENABLE RLS WITH PROPER POLICIES
-- Run this in Supabase SQL Editor
-- =============================================

-- First, enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Band admins can view band members" ON band_members;
DROP POLICY IF EXISTS "Users can view their own band memberships" ON band_members;
DROP POLICY IF EXISTS "Band admins can manage members" ON band_members;
DROP POLICY IF EXISTS "Members can view their bands" ON bands;
DROP POLICY IF EXISTS "Admins can update their bands" ON bands;
DROP POLICY IF EXISTS "Admins can delete their bands" ON bands;
DROP POLICY IF EXISTS "Members can view events in their bands" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;
DROP POLICY IF EXISTS "Members can view songs in their bands" ON songs;
DROP POLICY IF EXISTS "Admins can manage songs" ON songs;
DROP POLICY IF EXISTS "Members can view quotes in their bands" ON quotes;
DROP POLICY IF EXISTS "Admins can manage quotes" ON quotes;
DROP POLICY IF EXISTS "Members can view contracts" ON contracts;
DROP POLICY IF EXISTS "Admins can manage contracts" ON contracts;
DROP POLICY IF EXISTS "Members can view inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory;
DROP POLICY IF EXISTS "Members can view task templates" ON task_templates;
DROP POLICY IF EXISTS "Admins can manage task templates" ON task_templates;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can manage their chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;
DROP POLICY IF EXISTS "Users can create chats" ON chats;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can send messages in their chats" ON messages;

-- =============================================
-- PROFILES
-- =============================================
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Allow band members to view other profiles in their bands (needed for member lists)
CREATE POLICY "Band members can view profiles in their bands" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT user_id FROM band_members WHERE band_id IN (
        SELECT band_id FROM band_members WHERE user_id = auth.uid()
      )
    )
  );

-- =============================================
-- BANDS
-- =============================================
CREATE POLICY "Members can view their bands" ON bands
  FOR SELECT USING (
    id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create bands" ON bands
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update their bands" ON bands
  FOR UPDATE USING (
    id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete their bands" ON bands
  FOR DELETE USING (
    id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- BAND MEMBERS
-- =============================================
CREATE POLICY "Members can view band members" ON band_members
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert band members" ON band_members
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update band members" ON band_members
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete band members" ON band_members
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own membership" ON band_members
  FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- INVITATIONS
-- =============================================
CREATE POLICY "Admins can manage invitations" ON invitations
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can view invitation by token" ON invitations
  FOR SELECT USING (true);

-- =============================================
-- EVENTS
-- =============================================
CREATE POLICY "Members can view events" ON events
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage events" ON events
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update events" ON events
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete events" ON events
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- EVENT MEMBERS
-- =============================================
CREATE POLICY "Members can view event members" ON event_members
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Members can manage their event participation" ON event_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage event members" ON event_members
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin'))
  );

-- =============================================
-- SONGS
-- =============================================
CREATE POLICY "Members can view songs" ON songs
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can create songs" ON songs
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can update songs" ON songs
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can delete songs" ON songs
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- QUOTES
-- =============================================
CREATE POLICY "Members can view quotes" ON quotes
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can create quotes" ON quotes
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can update quotes" ON quotes
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can delete quotes" ON quotes
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- CONTRACTS
-- =============================================
CREATE POLICY "Members can view contracts" ON contracts
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage contracts" ON contracts
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- INVENTORY
-- =============================================
CREATE POLICY "Members can view inventory" ON inventory
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can manage inventory" ON inventory
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- TASK TEMPLATES
-- =============================================
CREATE POLICY "Members can view task templates" ON task_templates
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can manage task templates" ON task_templates
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- =============================================
-- CHATS & MESSAGES (no recursion)
-- =============================================
CREATE POLICY "Users can view their own participations" ON chat_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own participations" ON chat_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own participations" ON chat_participants
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can view chats they participate in" ON chats
  FOR SELECT USING (
    id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create chats" ON chats
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view messages in their chats" ON messages
  FOR SELECT USING (
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- =============================================
-- ONBOARDING PROGRESS
-- =============================================
CREATE POLICY "Users can view own onboarding" ON onboarding_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own onboarding" ON onboarding_progress
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON bands TO authenticated;
GRANT ALL ON band_members TO authenticated;
GRANT ALL ON invitations TO authenticated;
GRANT ALL ON events TO authenticated;
GRANT ALL ON event_members TO authenticated;
GRANT ALL ON songs TO authenticated;
GRANT ALL ON quotes TO authenticated;
GRANT ALL ON contracts TO authenticated;
GRANT ALL ON inventory TO authenticated;
GRANT ALL ON task_templates TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON chats TO authenticated;
GRANT ALL ON chat_participants TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON onboarding_progress TO authenticated;

SELECT '✅ RLS enabled with proper policies!' as result;
