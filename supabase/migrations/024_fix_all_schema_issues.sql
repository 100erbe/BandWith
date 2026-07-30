-- ====================================================================
-- Fix all remaining schema issues
-- Run this in Supabase SQL Editor
-- ====================================================================

-- ============================================
-- 1. FIX MESSAGES TABLE - Add missing columns
-- ============================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS band_id UUID REFERENCES bands(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- reply_to_id was already added in migration 022, but ensure it exists
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Index for efficient lookup of replies
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_band_id ON messages(band_id) WHERE band_id IS NOT NULL;

-- ============================================
-- 2. FIX CHATS TABLE - Add missing columns
-- ============================================
ALTER TABLE chats ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 3. FIX CHAT_PARTICIPANTS - Add missing columns
-- ============================================
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 4. FIX CHAT_PARTICIPANTS FK - Point to profiles instead of auth.users
-- ============================================
-- Drop existing FK if pointing to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'chat_participants' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.column_name = 'user_id'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth'
  ) THEN
    ALTER TABLE chat_participants DROP CONSTRAINT chat_participants_user_id_fkey;
  END IF;
END $$;

-- Add constraint pointing to profiles
ALTER TABLE chat_participants
  ADD CONSTRAINT chat_participants_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================
-- 5. FIX MESSAGES FK - Point sender_id to profiles instead of auth.users
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'messages' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.column_name = 'sender_id'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sender_id_fkey;
  END IF;
END $$;

ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- 6. FIX EVENTS - Add missing columns for setlists
-- ============================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS setlist_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- ============================================
-- 7. CREATE SETLISTS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS setlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    total_duration_seconds INTEGER,
    song_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setlists_band_id ON setlists(band_id);

-- ============================================
-- 8. CREATE SETLIST_SONGS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS setlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL,
    set_number INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);

-- ============================================
-- 9. DISABLE RLS for all tables (dev mode)
-- ============================================
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE setlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. RELOAD POSTGREST CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
