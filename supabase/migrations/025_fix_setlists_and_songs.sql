-- ============================================
-- Migration 025: Fix Songs columns and Create Setlists
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ADD MISSING COLUMNS TO SONGS TABLE
-- ============================================
ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS bpm INTEGER;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS key VARCHAR(10);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre VARCHAR(100);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'learning';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS chart_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS spotify_id VARCHAR(255);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS apple_music_id VARCHAR(255);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS times_played INTEGER DEFAULT 0;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- 2. CREATE SETLISTS TABLE (if not exists)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setlists_band_id ON setlists(band_id);

-- ============================================
-- 3. CREATE SETLIST_SONGS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS setlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL,
    set_number INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);

-- ============================================
-- 4. DISABLE RLS FOR ALL TABLES (dev mode)
-- ============================================
ALTER TABLE songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE setlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RELOAD POSTGREST CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
