-- Add reply_to_id for message quoting/replying feature
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Index for efficient lookup of replies
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN messages.reply_to_id IS 'Reference to the message being replied to (for quote/reply feature)';
