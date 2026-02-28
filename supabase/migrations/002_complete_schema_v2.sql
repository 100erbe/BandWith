-- ============================================
-- BandWith Complete Database Schema
-- Version 2.1 - Handles existing types
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP EXISTING TYPES (if any) and RECREATE
-- ============================================

DO $$ BEGIN
    DROP TYPE IF EXISTS event_type CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP TYPE IF EXISTS event_status CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP TYPE IF EXISTS quote_status CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP TYPE IF EXISTS notification_type CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP TYPE IF EXISTS chat_type CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- PROFILES (User Profiles)
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(50),
    instrument VARCHAR(100),
    bio TEXT,
    location VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Europe/Rome',
    preferred_language VARCHAR(10) DEFAULT 'it',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BANDS (Musical Groups)
-- ============================================

CREATE TABLE IF NOT EXISTS bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    logo_url TEXT,
    cover_url TEXT,
    description TEXT,
    genre VARCHAR(100),
    formed_date DATE,
    location VARCHAR(255),
    website VARCHAR(255),
    social_links JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    plan VARCHAR(20) DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BAND_MEMBERS (Junction: Users in Bands)
-- ============================================

CREATE TABLE IF NOT EXISTS band_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    instrument VARCHAR(100),
    stage_name VARCHAR(255),
    default_fee DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(band_id, user_id)
);

-- ============================================
-- CREATE ENUM TYPES
-- ============================================

CREATE TYPE event_type AS ENUM ('gig', 'rehearsal', 'wedding', 'corporate', 'private', 'festival', 'other');
CREATE TYPE event_status AS ENUM ('draft', 'tentative', 'confirmed', 'cancelled', 'completed');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'negotiating', 'archived');
CREATE TYPE notification_type AS ENUM (
    'event_invite', 'event_reminder', 'event_update', 'event_cancelled',
    'quote_received', 'quote_accepted', 'quote_declined',
    'payment_received', 'payment_due',
    'member_joined', 'member_left',
    'song_added', 'setlist_updated',
    'rehearsal_reminder', 'task_assigned',
    'system', 'custom'
);
CREATE TYPE chat_type AS ENUM ('direct', 'group', 'band', 'event');

-- ============================================
-- EVENTS (Gigs, Rehearsals, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    event_type event_type NOT NULL,
    status event_status DEFAULT 'draft',
    description TEXT,
    
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    load_in_time TIME,
    soundcheck_time TIME,
    
    venue_name VARCHAR(255),
    venue_address TEXT,
    venue_city VARCHAR(100),
    venue_country VARCHAR(100) DEFAULT 'IT',
    venue_coordinates JSONB,
    indoor_outdoor VARCHAR(20),
    
    fee DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EUR',
    deposit_amount DECIMAL(10, 2),
    deposit_paid BOOLEAN DEFAULT FALSE,
    payment_status VARCHAR(20) DEFAULT 'pending',
    
    dress_code VARCHAR(100),
    setlist_id UUID,
    notes TEXT,
    internal_notes TEXT,
    
    client_name VARCHAR(255),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_company VARCHAR(255),
    
    contract_url TEXT,
    contract_signed BOOLEAN DEFAULT FALSE,
    attachments JSONB DEFAULT '[]'::jsonb,
    
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule JSONB,
    parent_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    
    quote_id UUID,
    
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EVENT_MEMBERS (Who's playing at event)
-- ============================================

CREATE TABLE IF NOT EXISTS event_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) DEFAULT 'invited',
    fee DECIMAL(10, 2) DEFAULT 0,
    role VARCHAR(100),
    notes TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- ============================================
-- SONGS (Repertoire)
-- ============================================

CREATE TABLE IF NOT EXISTS songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    duration_seconds INTEGER,
    bpm INTEGER,
    key VARCHAR(10),
    genre VARCHAR(100),
    category VARCHAR(100),
    
    status VARCHAR(20) DEFAULT 'learning',
    priority VARCHAR(20) DEFAULT 'medium',
    
    audio_url TEXT,
    chart_url TEXT,
    lyrics TEXT,
    notes TEXT,
    
    spotify_id VARCHAR(255),
    apple_music_id VARCHAR(255),
    youtube_url TEXT,
    
    times_played INTEGER DEFAULT 0,
    last_played_at TIMESTAMP WITH TIME ZONE,
    
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SETLISTS
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

-- ============================================
-- SETLIST_SONGS (Songs in Setlist)
-- ============================================

CREATE TABLE IF NOT EXISTS setlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    
    position INTEGER NOT NULL,
    set_number INTEGER DEFAULT 1,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(setlist_id, position)
);

-- ============================================
-- QUOTES (Preventivi)
-- ============================================

CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE NOT NULL,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    status quote_status DEFAULT 'draft',
    
    client_name VARCHAR(255) NOT NULL,
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_company VARCHAR(255),
    
    event_name VARCHAR(255),
    event_type VARCHAR(50),
    event_date DATE,
    event_time_start TIME,
    event_time_end TIME,
    guest_count INTEGER,
    
    venue_name VARCHAR(255),
    venue_address TEXT,
    venue_city VARCHAR(100),
    venue_country VARCHAR(100) DEFAULT 'IT',
    indoor_outdoor VARCHAR(20),
    
    performance_type VARCHAR(50),
    set_duration_minutes INTEGER,
    number_of_sets INTEGER DEFAULT 2,
    break_duration_minutes INTEGER,
    genres TEXT[],
    special_requests TEXT,
    
    billing_country VARCHAR(100),
    billing_address TEXT,
    vat_number VARCHAR(50),
    fiscal_code VARCHAR(50),
    vat_rate DECIMAL(5, 2) DEFAULT 22,
    vat_exempt BOOLEAN DEFAULT FALSE,
    reverse_charge BOOLEAN DEFAULT FALSE,
    
    currency VARCHAR(3) DEFAULT 'EUR',
    base_fee DECIMAL(10, 2) DEFAULT 0,
    travel_included BOOLEAN DEFAULT TRUE,
    travel_fee DECIMAL(10, 2) DEFAULT 0,
    travel_distance_km INTEGER,
    accommodation_needed BOOLEAN DEFAULT FALSE,
    accommodation_fee DECIMAL(10, 2) DEFAULT 0,
    meals_included BOOLEAN DEFAULT TRUE,
    meals_fee DECIMAL(10, 2) DEFAULT 0,
    sound_included BOOLEAN DEFAULT TRUE,
    sound_fee DECIMAL(10, 2) DEFAULT 0,
    lights_included BOOLEAN DEFAULT TRUE,
    lights_fee DECIMAL(10, 2) DEFAULT 0,
    backline_included BOOLEAN DEFAULT TRUE,
    backline_fee DECIMAL(10, 2) DEFAULT 0,
    custom_items JSONB DEFAULT '[]'::jsonb,
    
    discount_type VARCHAR(20) DEFAULT 'none',
    discount_value DECIMAL(10, 2) DEFAULT 0,
    discount_reason TEXT,
    
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(10, 2) DEFAULT 0,
    vat_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) DEFAULT 0,
    
    valid_until DATE,
    deposit_required BOOLEAN DEFAULT TRUE,
    deposit_percentage INTEGER DEFAULT 30,
    deposit_due_date VARCHAR(50),
    balance_due_date VARCHAR(50),
    payment_methods TEXT[],
    cancellation_policy VARCHAR(20) DEFAULT 'moderate',
    cancellation_terms TEXT,
    
    internal_notes TEXT,
    client_notes TEXT,
    special_terms TEXT,
    
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    response_type VARCHAR(20),
    rejection_reason TEXT,
    converted_to_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- QUOTE_MUSICIANS (Musicians in Quote)
-- ============================================

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

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
    
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    action_url TEXT,
    action_label VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CHATS (Conversations)
-- ============================================

CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    
    type chat_type NOT NULL,
    name VARCHAR(255),
    
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CHAT_PARTICIPANTS
-- ============================================

CREATE TABLE IF NOT EXISTS chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    last_read_at TIMESTAMP WITH TIME ZONE,
    muted BOOLEAN DEFAULT FALSE,
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

-- ============================================
-- MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
    
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- REHEARSAL TASKS
-- ============================================

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

-- ============================================
-- SONG PROPOSALS (for rehearsals)
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_bands_slug ON bands(slug);
CREATE INDEX IF NOT EXISTS idx_bands_created_by ON bands(created_by);
CREATE INDEX IF NOT EXISTS idx_band_members_band_id ON band_members(band_id);
CREATE INDEX IF NOT EXISTS idx_band_members_user_id ON band_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_band_id ON events(band_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_members_event_id ON event_members(event_id);
CREATE INDEX IF NOT EXISTS idx_event_members_user_id ON event_members(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_band_id ON songs(band_id);
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_setlists_band_id ON setlists(band_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);
CREATE INDEX IF NOT EXISTS idx_quotes_band_id ON quotes(band_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_chats_band_id ON chats(band_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_musicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_proposals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (Drop existing first)
-- ============================================

-- Profiles
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Bands
DROP POLICY IF EXISTS "Band members can view bands" ON bands;
DROP POLICY IF EXISTS "Users can create bands" ON bands;
DROP POLICY IF EXISTS "Band admins can update bands" ON bands;

CREATE POLICY "Band members can view bands" ON bands
    FOR SELECT USING (
        id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
        OR created_by = auth.uid()
    );

CREATE POLICY "Users can create bands" ON bands
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Band admins can update bands" ON bands
    FOR UPDATE USING (
        id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Band Members
DROP POLICY IF EXISTS "Band members can view members" ON band_members;
DROP POLICY IF EXISTS "Band admins can manage members" ON band_members;

CREATE POLICY "Band members can view members" ON band_members
    FOR SELECT USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Band admins can manage members" ON band_members
    FOR ALL USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Events
DROP POLICY IF EXISTS "Band members can view events" ON events;
DROP POLICY IF EXISTS "Band members can create events" ON events;
DROP POLICY IF EXISTS "Band admins can update events" ON events;

CREATE POLICY "Band members can view events" ON events
    FOR SELECT USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Band members can create events" ON events
    FOR INSERT WITH CHECK (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Band admins can update events" ON events
    FOR UPDATE USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Songs
DROP POLICY IF EXISTS "Band members can view songs" ON songs;
DROP POLICY IF EXISTS "Band members can manage songs" ON songs;

CREATE POLICY "Band members can view songs" ON songs
    FOR SELECT USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Band members can manage songs" ON songs
    FOR ALL USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    );

-- Quotes
DROP POLICY IF EXISTS "Band members can view quotes" ON quotes;
DROP POLICY IF EXISTS "Band admins can manage quotes" ON quotes;

CREATE POLICY "Band members can view quotes" ON quotes
    FOR SELECT USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Band admins can manage quotes" ON quotes
    FOR ALL USING (
        band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Chats
DROP POLICY IF EXISTS "Chat participants can view chats" ON chats;

CREATE POLICY "Chat participants can view chats" ON chats
    FOR SELECT USING (
        id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
    );

-- Messages
DROP POLICY IF EXISTS "Chat participants can view messages" ON messages;
DROP POLICY IF EXISTS "Chat participants can send messages" ON messages;

CREATE POLICY "Chat participants can view messages" ON messages
    FOR SELECT USING (
        chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
    );

CREATE POLICY "Chat participants can send messages" ON messages
    FOR INSERT WITH CHECK (
        chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
        AND sender_id = auth.uid()
    );

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_bands_updated_at ON bands;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_songs_updated_at ON songs;
DROP TRIGGER IF EXISTS update_setlists_updated_at ON setlists;
DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bands_updated_at BEFORE UPDATE ON bands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_setlists_updated_at BEFORE UPDATE ON setlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-add creator as admin when band is created
CREATE OR REPLACE FUNCTION handle_new_band()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO band_members (band_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (band_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_band_created ON bands;
CREATE TRIGGER on_band_created
    AFTER INSERT ON bands
    FOR EACH ROW EXECUTE FUNCTION handle_new_band();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Generate quote number
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

-- Get user's bands
CREATE OR REPLACE FUNCTION get_user_bands(p_user_id UUID)
RETURNS TABLE (
    band_id UUID,
    band_name TEXT,
    user_role TEXT,
    member_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name::TEXT,
        bm.role::TEXT,
        (SELECT COUNT(*) FROM band_members WHERE band_id = b.id AND is_active = TRUE)
    FROM bands b
    JOIN band_members bm ON b.id = bm.band_id
    WHERE bm.user_id = p_user_id AND bm.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get upcoming events for user
CREATE OR REPLACE FUNCTION get_upcoming_events(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    event_date DATE,
    event_type event_type,
    event_status event_status,
    band_name TEXT,
    venue_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title::TEXT,
        e.event_date,
        e.event_type,
        e.status,
        b.name::TEXT,
        e.venue_name::TEXT
    FROM events e
    JOIN bands b ON e.band_id = b.id
    JOIN band_members bm ON b.id = bm.band_id
    WHERE bm.user_id = p_user_id 
        AND bm.is_active = TRUE
        AND e.event_date >= CURRENT_DATE
        AND e.status != 'cancelled'
    ORDER BY e.event_date ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! 🎸
-- ============================================
