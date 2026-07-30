-- ============================================
-- FIX: Fix events table - drop NOT NULL from legacy columns + add missing columns
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe to run multiple times
-- ============================================

-- STEP 1: Fix legacy columns that may have NOT NULL constraints
-- The original table was created with "venue", "date", "time" columns
-- but the app now uses "venue_name", "event_date", "start_time"
DO $$
BEGIN
  -- Drop NOT NULL from "venue" if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'venue') THEN
    ALTER TABLE events ALTER COLUMN venue DROP NOT NULL;
    -- Copy data to venue_name where venue_name is empty
    UPDATE events SET venue_name = venue WHERE (venue_name IS NULL OR venue_name = '') AND venue IS NOT NULL AND venue != '';
  END IF;

  -- Drop NOT NULL from "date" if it exists (legacy column, now "event_date")
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'date') THEN
    ALTER TABLE events ALTER COLUMN date DROP NOT NULL;
    -- Copy data to event_date where event_date is empty
    UPDATE events SET event_date = date::DATE WHERE event_date IS NULL AND date IS NOT NULL;
  END IF;

  -- Drop NOT NULL from "time" if it exists (legacy column, now "start_time")
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'time') THEN
    ALTER TABLE events ALTER COLUMN "time" DROP NOT NULL;
    -- Copy data to start_time where start_time is empty
    UPDATE events SET start_time = "time"::TIME WHERE start_time IS NULL AND "time" IS NOT NULL;
  END IF;

  -- Drop NOT NULL from "description" if it has one
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'description') THEN
    ALTER TABLE events ALTER COLUMN description DROP NOT NULL;
  END IF;

  -- Fix event_type: change from ENUM to VARCHAR if needed, drop NOT NULL default
  -- (some setups use ENUM which rejects values like 'wedding')
  BEGIN
    ALTER TABLE events ALTER COLUMN event_type TYPE VARCHAR(50) USING event_type::TEXT;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER TABLE events ALTER COLUMN status TYPE VARCHAR(50) USING status::TEXT;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- STEP 2: Add ALL missing columns the app needs
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
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
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

-- ============================================
-- STEP 3: Fix event_members table
-- Ensure RLS policies exist (RLS may be enabled without policies = ALL operations blocked)
-- ============================================

-- Ensure event_members table exists
CREATE TABLE IF NOT EXISTS event_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'invited',
    fee DECIMAL(10, 2) DEFAULT 0,
    role VARCHAR(100),
    notes TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix status column: convert from ENUM to VARCHAR if needed
DO $$
BEGIN
  ALTER TABLE event_members ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
ALTER TABLE event_members ALTER COLUMN status SET DEFAULT 'confirmed';

-- Ensure required columns exist
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed';
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS role VARCHAR(100);

-- Enable RLS
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they exist and are correct
DROP POLICY IF EXISTS "Band members can view event members" ON event_members;
DROP POLICY IF EXISTS "Band members can manage event members" ON event_members;
DROP POLICY IF EXISTS "event_members_select" ON event_members;
DROP POLICY IF EXISTS "event_members_insert" ON event_members;
DROP POLICY IF EXISTS "event_members_update" ON event_members;
DROP POLICY IF EXISTS "event_members_delete" ON event_members;

-- SELECT: band members can see event members for their band's events
CREATE POLICY "event_members_select" ON event_members
    FOR SELECT USING (
        event_id IN (
            SELECT id FROM events WHERE band_id IN (
                SELECT band_id FROM band_members WHERE user_id = auth.uid()
            )
        )
    );

-- INSERT: band members can add event members for their band's events
CREATE POLICY "event_members_insert" ON event_members
    FOR INSERT WITH CHECK (
        event_id IN (
            SELECT id FROM events WHERE band_id IN (
                SELECT band_id FROM band_members WHERE user_id = auth.uid()
            )
        )
    );

-- UPDATE: band members can update event members for their band's events
CREATE POLICY "event_members_update" ON event_members
    FOR UPDATE USING (
        event_id IN (
            SELECT id FROM events WHERE band_id IN (
                SELECT band_id FROM band_members WHERE user_id = auth.uid()
            )
        )
    );

-- DELETE: band members can remove event members for their band's events
CREATE POLICY "event_members_delete" ON event_members
    FOR DELETE USING (
        event_id IN (
            SELECT id FROM events WHERE band_id IN (
                SELECT band_id FROM band_members WHERE user_id = auth.uid()
            )
        )
    );
