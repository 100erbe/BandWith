-- Enable realtime for events table
-- This ensures new/updated events appear instantly in the events list

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE events;
    END IF;
END $$;

ALTER TABLE events REPLICA IDENTITY FULL;
