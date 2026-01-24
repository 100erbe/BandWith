-- BandWith Onboarding Schema Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- MEMBER INVITES (for onboarding invitations)
-- ============================================

CREATE TABLE IF NOT EXISTS member_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(100),
    instruments TEXT[],
    permission VARCHAR(20) DEFAULT 'member', -- admin, member
    token VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined, expired
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    declined_at TIMESTAMP WITH TIME ZONE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ONBOARDING PROGRESS
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    path VARCHAR(20) NOT NULL, -- creator, joiner
    current_step INTEGER DEFAULT 0,
    completed_steps TEXT[] DEFAULT '{}',
    skipped_steps TEXT[] DEFAULT '{}',
    checklist_dismissed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
);

-- ============================================
-- IMPORT JOBS (for song import tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    source VARCHAR(50) NOT NULL, -- spotify, apple_music, google_drive, dropbox, csv
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB, -- source-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_member_invites_band_id ON member_invites(band_id);
CREATE INDEX IF NOT EXISTS idx_member_invites_email ON member_invites(email);
CREATE INDEX IF NOT EXISTS idx_member_invites_token ON member_invites(token);
CREATE INDEX IF NOT EXISTS idx_member_invites_status ON member_invites(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_band_id ON import_jobs(band_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Member invites: Only band admins can create/view invites for their bands
CREATE POLICY "Band admins can manage invites" ON member_invites
  FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow invited users to view their own invites by token (for accepting)
CREATE POLICY "Users can view their invites" ON member_invites
  FOR SELECT USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Onboarding progress: Users can only manage their own progress
CREATE POLICY "Users can manage own onboarding" ON onboarding_progress
  FOR ALL USING (user_id = auth.uid());

-- Import jobs: Users can manage their own import jobs
CREATE POLICY "Users can manage own imports" ON import_jobs
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Generate secure random token for invites
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Clean up expired invites (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS void AS $$
BEGIN
  UPDATE member_invites 
  SET status = 'expired' 
  WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE! 🎸
-- ============================================
