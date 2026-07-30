-- =============================================
-- ADD MISSING COLUMNS TO EVENTS TABLE
-- Run this in Supabase SQL Editor
-- =============================================

DO $$ 
BEGIN
  -- Add start_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'start_time') THEN
    ALTER TABLE events ADD COLUMN start_time TIME;
  END IF;

  -- Add end_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'end_time') THEN
    ALTER TABLE events ADD COLUMN end_time TIME;
  END IF;

  -- Add venue_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'venue_name') THEN
    ALTER TABLE events ADD COLUMN venue_name TEXT;
  END IF;

  -- Add venue_address column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'venue_address') THEN
    ALTER TABLE events ADD COLUMN venue_address TEXT;
  END IF;

  -- Add fee column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'fee') THEN
    ALTER TABLE events ADD COLUMN fee DECIMAL(10,2);
  END IF;

  -- Add notes column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'notes') THEN
    ALTER TABLE events ADD COLUMN notes TEXT;
  END IF;

  -- Add description column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'description') THEN
    ALTER TABLE events ADD COLUMN description TEXT;
  END IF;

  -- Add created_by column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'created_by') THEN
    ALTER TABLE events ADD COLUMN created_by UUID REFERENCES profiles(id);
  END IF;

END $$;
