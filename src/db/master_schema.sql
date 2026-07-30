-- ====================================================================
-- 1. CLEAN UP EXISTING TABLES (Drops dependent structures safely)
-- ====================================================================
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.event_members CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chat_participants CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.task_templates CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TABLE IF EXISTS public.quotes CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.songs CASCADE;
DROP TABLE IF EXISTS public.band_members CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.bands CASCADE;
DROP TABLE IF EXISTS public.onboarding_progress CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ====================================================================
-- 2. CORE SYSTEM TABLES
-- ====================================================================

-- Profiles: Connected directly to Supabase Auth Users
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'member',
    instrument TEXT,
    phone TEXT,
    bio TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bands Table
CREATE TABLE public.bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo_url TEXT,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Band Members Cross-Reference
-- Note: user_id references profiles(id), which itself references auth.users(id).
-- This gives PostgREST a direct relationship path to resolve joins like:
--   band_members.profile:profiles(*)
CREATE TABLE public.band_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    instrument TEXT,
    stage_name TEXT,
    default_fee DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    UNIQUE(band_id, user_id)
);

-- Invitations: The "Waiting Room" for invited users without accounts yet
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
    token UUID DEFAULT gen_random_uuid(), 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 3. GIGS & EVENTS ENGINE
-- ====================================================================
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_type TEXT DEFAULT 'gig', -- 'gig', 'rehearsal', etc.
    status TEXT DEFAULT 'confirmed', -- 'draft', 'confirmed', 'cancelled'
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    load_in_time TIME,
    soundcheck_time TIME,
    venue TEXT,
    venue_name TEXT,
    venue_address TEXT,
    venue_city TEXT,
    client_name TEXT,
    fee DECIMAL(10, 2) DEFAULT 0,
    price DECIMAL(10, 2) DEFAULT 0,
    description TEXT,
    notes TEXT,
    indoor_outdoor TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule JSONB,
    setlist_id UUID,
    capacity INTEGER,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Rosters / Members tracking
CREATE TABLE public.event_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT,
    fee DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending', -- 'confirmed', 'declined', 'pending'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- ====================================================================
-- 4. DASHBOARD FEATURE MODULES
-- ====================================================================

CREATE TABLE public.songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT,
    duration_seconds INTEGER,
    bpm INTEGER,
    key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    client_name TEXT,
    total DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    title TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    name TEXT,
    status TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 5. COMMUNICATIONS
-- ====================================================================

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT,
    type TEXT DEFAULT 'band',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ,
    muted BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_band_id ON messages(band_id) WHERE band_id IS NOT NULL;

CREATE TABLE public.onboarding_progress (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    path TEXT,
    current_step INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlists
CREATE TABLE public.setlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    total_duration_seconds INTEGER,
    song_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlist Songs
CREATE TABLE public.setlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setlist_id UUID REFERENCES public.setlists(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL,
    set_number INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- 6. AUTOMATED SYSTEM TRIGGERS
-- ====================================================================

-- Auth Signup Trigger -> Creates Profile Entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Band Creator Trigger -> Automatically assigns Admin Member Status
CREATE OR REPLACE FUNCTION public.handle_new_band()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$BEGIN
  INSERT INTO public.band_members (band_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT (band_id, user_id) DO NOTHING;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS on_band_created ON public.bands;
CREATE TRIGGER on_band_created
  AFTER INSERT ON public.bands
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_band();

-- ====================================================================
-- 7. DEVELOPMENT DEV-PASS (Disables RLS Restrictions for Testing)
-- ====================================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 8. RELOAD POSTGREST CACHE
-- ====================================================================
NOTIFY pgrst, 'reload schema';