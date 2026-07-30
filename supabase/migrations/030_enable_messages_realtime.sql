-- ====================================================================
-- Enable realtime for messages table
-- Without this, subscribeToChat and subscribeToNewMessages won't fire
-- ====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER TABLE messages REPLICA IDENTITY FULL;
