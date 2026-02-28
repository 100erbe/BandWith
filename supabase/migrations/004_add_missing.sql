-- ============================================
-- BandWith - Add Missing Tables & Columns
-- Version 4.0 - Based on existing schema
-- ============================================

-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- PROFILES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instrument VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Rome';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'it';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- BANDS
ALTER TABLE bands ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE bands ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS formed_date DATE;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE bands ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE bands ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';
ALTER TABLE bands ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE bands ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- BAND_MEMBERS
ALTER TABLE band_members ADD COLUMN IF NOT EXISTS stage_name VARCHAR(255);
ALTER TABLE band_members ADD COLUMN IF NOT EXISTS default_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE band_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE band_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;

-- EVENTS
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS load_in_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS soundcheck_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_address TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_city VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_country VARCHAR(100) DEFAULT 'IT';
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_coordinates JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS indoor_outdoor VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';
ALTER TABLE events ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE events ADD COLUMN IF NOT EXISTS dress_code VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS setlist_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50);
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_company VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS contract_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS quote_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- EVENT_MEMBERS
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'invited';
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS role VARCHAR(100);
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

-- SONGS
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
ALTER TABLE songs ADD COLUMN IF NOT EXISTS added_by UUID;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- QUOTES (add missing columns)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_number VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_company VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS event_name VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS event_type VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS event_time_start TIME;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS event_time_end TIME;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS guest_count INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS venue_name VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS venue_address TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS venue_city VARCHAR(100);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS venue_country VARCHAR(100) DEFAULT 'IT';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS indoor_outdoor VARCHAR(20);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS performance_type VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS set_duration_minutes INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS number_of_sets INTEGER DEFAULT 2;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS genres TEXT[];
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS special_requests TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fiscal_code VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 22;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_exempt BOOLEAN DEFAULT FALSE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT FALSE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS base_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS travel_included BOOLEAN DEFAULT TRUE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS travel_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS travel_distance_km INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accommodation_needed BOOLEAN DEFAULT FALSE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accommodation_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS meals_included BOOLEAN DEFAULT TRUE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS meals_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sound_included BOOLEAN DEFAULT TRUE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sound_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lights_included BOOLEAN DEFAULT TRUE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lights_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS backline_included BOOLEAN DEFAULT TRUE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS backline_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'none';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT TRUE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 30;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_due_date VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS balance_due_date VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_methods TEXT[];
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cancellation_policy VARCHAR(20) DEFAULT 'moderate';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cancellation_terms TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_notes TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS special_terms TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS response_type VARCHAR(20);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_to_event_id UUID;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- CREATE MISSING TABLES
-- ============================================

-- SETLISTS
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

-- SETLIST_SONGS
CREATE TABLE IF NOT EXISTS setlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL,
    set_number INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QUOTE_MUSICIANS
CREATE TABLE IF NOT EXISTS quote_musicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    instrument VARCHAR(100),
    fee DECIMAL(10, 2) DEFAULT 0,
    is_external BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    action_label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CHATS
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CHAT_PARTICIPANTS
CREATE TABLE IF NOT EXISTS chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    last_read_at TIMESTAMP WITH TIME ZONE,
    muted BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

-- REHEARSAL_TASKS (rename from tasks if different structure needed)
CREATE TABLE IF NOT EXISTS rehearsal_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) DEFAULT 'todo',
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SONG_PROPOSALS
CREATE TABLE IF NOT EXISTS song_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    proposed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    votes_yes INTEGER DEFAULT 0,
    votes_no INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_setlists_band_id ON setlists(band_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);
CREATE INDEX IF NOT EXISTS idx_quote_musicians_quote_id ON quote_musicians(quote_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_chats_band_id ON chats(band_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_tasks_event_id ON rehearsal_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_song_proposals_band_id ON song_proposals(band_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_musicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_proposals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Setlists
DROP POLICY IF EXISTS "Band members can view setlists" ON setlists;
DROP POLICY IF EXISTS "Band members can manage setlists" ON setlists;
CREATE POLICY "Band members can view setlists" ON setlists FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);
CREATE POLICY "Band members can manage setlists" ON setlists FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

-- Setlist Songs
DROP POLICY IF EXISTS "Band members can view setlist songs" ON setlist_songs;
DROP POLICY IF EXISTS "Band members can manage setlist songs" ON setlist_songs;
CREATE POLICY "Band members can view setlist songs" ON setlist_songs FOR SELECT USING (
    setlist_id IN (SELECT id FROM setlists WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Band members can manage setlist songs" ON setlist_songs FOR ALL USING (
    setlist_id IN (SELECT id FROM setlists WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
);

-- Quote Musicians
DROP POLICY IF EXISTS "Band members can view quote musicians" ON quote_musicians;
DROP POLICY IF EXISTS "Band admins can manage quote musicians" ON quote_musicians;
CREATE POLICY "Band members can view quote musicians" ON quote_musicians FOR SELECT USING (
    quote_id IN (SELECT id FROM quotes WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Band admins can manage quote musicians" ON quote_musicians FOR ALL USING (
    quote_id IN (SELECT id FROM quotes WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin'))
);

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Chats
DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;
CREATE POLICY "Chat participants can view chats" ON chats FOR SELECT USING (
    id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
);

-- Chat Participants
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;
CREATE POLICY "Users can view chat participants" ON chat_participants FOR SELECT USING (
    chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
);

-- Rehearsal Tasks
DROP POLICY IF EXISTS "Band members can view tasks" ON rehearsal_tasks;
DROP POLICY IF EXISTS "Band members can manage tasks" ON rehearsal_tasks;
CREATE POLICY "Band members can view tasks" ON rehearsal_tasks FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Band members can manage tasks" ON rehearsal_tasks FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()))
);

-- Song Proposals
DROP POLICY IF EXISTS "Band members can view proposals" ON song_proposals;
DROP POLICY IF EXISTS "Band members can manage proposals" ON song_proposals;
CREATE POLICY "Band members can view proposals" ON song_proposals FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);
CREATE POLICY "Band members can manage proposals" ON song_proposals FOR ALL USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_setlists_updated_at ON setlists;
CREATE TRIGGER update_setlists_updated_at BEFORE UPDATE ON setlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION generate_quote_number(band_prefix TEXT DEFAULT 'BW')
RETURNS TEXT AS $$
DECLARE
    year_str TEXT;
    seq_num INTEGER;
BEGIN
    year_str := EXTRACT(YEAR FROM NOW())::TEXT;
    SELECT COALESCE(MAX(
        NULLIF(REGEXP_REPLACE(quote_number, '^[A-Z]+-[0-9]+-', ''), '')::INTEGER
    ), 0) + 1
    INTO seq_num
    FROM quotes
    WHERE quote_number LIKE band_prefix || '-' || year_str || '-%';
    RETURN band_prefix || '-' || year_str || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE! 🎸
-- ============================================
