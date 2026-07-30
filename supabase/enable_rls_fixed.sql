-- =============================================
-- ENABLE RLS WITH PROPER POLICIES (FIXED)
-- Run this in Supabase SQL Editor
-- =============================================

-- First, ensure created_by column exists on chats table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chats' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.chats ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on all tables
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

-- Drop all existing policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- =============================================
-- PROFILES
-- =============================================
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_select_band_members" ON profiles
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
CREATE POLICY "bands_select_member" ON bands
  FOR SELECT USING (
    id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "bands_insert_own" ON bands
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "bands_update_admin" ON bands
  FOR UPDATE USING (
    id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "bands_delete_admin" ON bands
  FOR DELETE USING (
    id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- BAND MEMBERS
-- =============================================
CREATE POLICY "bm_select_member" ON band_members
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "bm_insert_admin" ON band_members
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "bm_update_admin" ON band_members
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "bm_delete_admin" ON band_members
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "bm_update_self" ON band_members
  FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- INVITATIONS
-- =============================================
CREATE POLICY "invitations_admin_all" ON invitations
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- EVENTS
-- =============================================
CREATE POLICY "events_select_member" ON events
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "events_insert_member" ON events
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "events_update_admin" ON events
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "events_delete_admin" ON events
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- EVENT MEMBERS
-- =============================================
CREATE POLICY "em_select_member" ON event_members
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "em_insert_self" ON event_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "em_admin_all" ON event_members
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin'))
  );

-- =============================================
-- SONGS
-- =============================================
CREATE POLICY "songs_select_member" ON songs
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "songs_insert_member" ON songs
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "songs_update_member" ON songs
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "songs_delete_member" ON songs
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- QUOTES
-- =============================================
CREATE POLICY "quotes_select_member" ON quotes
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "quotes_insert_member" ON quotes
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "quotes_update_member" ON quotes
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "quotes_delete_member" ON quotes
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- CONTRACTS
-- =============================================
CREATE POLICY "contracts_select_member" ON contracts
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "contracts_admin_all" ON contracts
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- INVENTORY
-- =============================================
CREATE POLICY "inventory_select_member" ON inventory
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "inventory_manage_member" ON inventory
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- TASK TEMPLATES
-- =============================================
CREATE POLICY "tt_select_member" ON task_templates
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "tt_manage_member" ON task_templates
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE POLICY "notif_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notif_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notif_insert_system" ON notifications
  FOR INSERT WITH CHECK (true);

-- =============================================
-- CHATS & MESSAGES (no recursion)
-- =============================================
CREATE POLICY "cp_select_own" ON chat_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cp_insert_own" ON chat_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cp_delete_own" ON chat_participants
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "chats_select_participant" ON chats
  FOR SELECT USING (
    id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "chats_insert_own" ON chats
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT USING (
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- =============================================
-- ONBOARDING PROGRESS
-- =============================================
CREATE POLICY "onboarding_select_own" ON onboarding_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "onboarding_manage_own" ON onboarding_progress
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

-- =============================================
-- SETLISTS & SETLIST SONGS
-- =============================================
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "setlists_select_member" ON setlists;
DROP POLICY IF EXISTS "setlists_insert_member" ON setlists;
DROP POLICY IF EXISTS "setlists_update_member" ON setlists;
DROP POLICY IF EXISTS "setlists_delete_admin" ON setlists;
DROP POLICY IF EXISTS "setlist_songs_select_member" ON setlist_songs;
DROP POLICY IF EXISTS "setlist_songs_insert_member" ON setlist_songs;
DROP POLICY IF EXISTS "setlist_songs_update_member" ON setlist_songs;
DROP POLICY IF EXISTS "setlist_songs_delete_member" ON setlist_songs;

CREATE POLICY "setlists_select_member" ON setlists
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "setlists_insert_member" ON setlists
  FOR INSERT WITH CHECK (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "setlists_update_member" ON setlists
  FOR UPDATE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "setlists_delete_admin" ON setlists
  FOR DELETE USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "setlist_songs_select_member" ON setlist_songs
  FOR SELECT USING (
    setlist_id IN (SELECT id FROM setlists WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "setlist_songs_insert_member" ON setlist_songs
  FOR INSERT WITH CHECK (
    setlist_id IN (SELECT id FROM setlists WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "setlist_songs_update_member" ON setlist_songs
  FOR UPDATE USING (
    setlist_id IN (SELECT id FROM setlists WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "setlist_songs_delete_member" ON setlist_songs
  FOR DELETE USING (
    setlist_id IN (SELECT id FROM setlists WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
  );

GRANT ALL ON setlists TO authenticated;
GRANT ALL ON setlist_songs TO authenticated;

SELECT '✅ Complete - all RLS policies applied!' as result;
