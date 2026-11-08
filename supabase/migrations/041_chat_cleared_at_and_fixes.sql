-- ====================================================================
-- Migration 041: Chat cleared_at, soft-delete restoration, and band name sync
-- ====================================================================

-- 1. Add cleared_at column to chat_participants if not present
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Function & trigger to automatically keep chats.name in sync when a band is renamed
CREATE OR REPLACE FUNCTION handle_band_name_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
        UPDATE chats
        SET name = NEW.name, updated_at = NOW()
        WHERE band_id = NEW.id AND type = 'band';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_band_name_updated ON bands;
CREATE TRIGGER on_band_name_updated
    AFTER UPDATE OF name ON bands
    FOR EACH ROW EXECUTE FUNCTION handle_band_name_update();

-- 3. Sync existing band chats with their current band name
UPDATE chats c
SET name = b.name, updated_at = NOW()
FROM bands b
WHERE c.band_id = b.id AND c.type = 'band' AND (c.name IS DISTINCT FROM b.name OR c.name IS NULL);

-- 4. Ensure active band members are present in band chat participants
INSERT INTO chat_participants (chat_id, user_id)
SELECT c.id, bm.user_id
FROM chats c
JOIN band_members bm ON bm.band_id = c.band_id AND bm.is_active = true
WHERE c.type = 'band'
ON CONFLICT (chat_id, user_id) DO NOTHING;
