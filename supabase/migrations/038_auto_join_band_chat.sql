-- ====================================================================
-- 038_auto_join_band_chat.sql
--
-- When a user is added to a band (via invite, onboarding, or admin-add),
-- automatically add them to that band's chat so band messaging reaches
-- every member. Creates the band chat if it doesn't exist yet.
--
-- This closes the gap flagged in diagnose.mjs: "Freemium members joining
-- via invite need to be added to the band chat automatically."
-- ====================================================================

CREATE OR REPLACE FUNCTION on_band_member_join_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chat_id uuid;
  v_band_name text;
BEGIN
  -- Find the existing band chat (oldest, in case of duplicates).
  SELECT id INTO v_chat_id
  FROM chats
  WHERE type = 'band' AND band_id = NEW.band_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Create the band chat if it doesn't exist.
  IF v_chat_id IS NULL THEN
    SELECT name INTO v_band_name FROM bands WHERE id = NEW.band_id;

    INSERT INTO chats (type, name, band_id, created_by)
    VALUES ('band', COALESCE(v_band_name, 'Band Chat'), NEW.band_id, NEW.user_id)
    RETURNING id INTO v_chat_id;
  END IF;

  -- Add the new member as a participant (idempotent).
  INSERT INTO chat_participants (chat_id, user_id)
  VALUES (v_chat_id, NEW.user_id)
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_band_member_join_chat ON band_members;
CREATE TRIGGER trg_band_member_join_chat
AFTER INSERT ON band_members
FOR EACH ROW
EXECUTE FUNCTION on_band_member_join_chat();
