-- =============================================
-- ADD MISSING COLUMNS
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add is_active and left_at columns to band_members if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'band_members' AND column_name = 'is_active') THEN
    ALTER TABLE band_members ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'band_members' AND column_name = 'left_at') THEN
    ALTER TABLE band_members ADD COLUMN left_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'band_members' AND column_name = 'instrument') THEN
    ALTER TABLE band_members ADD COLUMN instrument TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'band_members' AND column_name = 'stage_name') THEN
    ALTER TABLE band_members ADD COLUMN stage_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'band_members' AND column_name = 'default_fee') THEN
    ALTER TABLE band_members ADD COLUMN default_fee DECIMAL(10,2);
  END IF;
END $$;

-- 2. Create band_invitations table for pending invites
CREATE TABLE IF NOT EXISTS band_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  invited_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for band_invitations
CREATE INDEX IF NOT EXISTS idx_band_invitations_band_id ON band_invitations(band_id);
CREATE INDEX IF NOT EXISTS idx_band_invitations_email ON band_invitations(email);
CREATE INDEX IF NOT EXISTS idx_band_invitations_status ON band_invitations(status);

-- RLS for band_invitations
ALTER TABLE band_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band admins can manage invitations" ON band_invitations;
CREATE POLICY "Band admins can manage invitations" ON band_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = band_invitations.band_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can see their invitations" ON band_invitations;
CREATE POLICY "Users can see their invitations" ON band_invitations
  FOR SELECT USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- 3. Create song_folders table for organizing songs
CREATE TABLE IF NOT EXISTS song_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for song_folders
CREATE INDEX IF NOT EXISTS idx_song_folders_band_id ON song_folders(band_id);

-- RLS for song_folders
ALTER TABLE song_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage song folders" ON song_folders;
CREATE POLICY "Band members can manage song folders" ON song_folders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = song_folders.band_id
      AND bm.user_id = auth.uid()
    )
  );

-- 4. Update existing band_members to have is_active = true
UPDATE band_members SET is_active = true WHERE is_active IS NULL;

-- 5. Add phone and instrument to profiles if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'instrument') THEN
    ALTER TABLE profiles ADD COLUMN instrument TEXT;
  END IF;
END $$;

-- 6. Grant permissions
GRANT ALL ON band_invitations TO authenticated;
GRANT ALL ON song_folders TO authenticated;
