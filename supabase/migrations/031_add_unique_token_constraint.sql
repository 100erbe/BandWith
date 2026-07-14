-- ====================================================================
-- Add unique constraint on push_tokens.token for upsert support
-- ====================================================================

-- Drop the composite unique constraint first (it includes user_id too)
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;

-- Add unique constraint on token alone (for upsert with onConflict: 'token')
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_token_key UNIQUE (token);

-- Re-add composite index for querying by user_id (replaces the dropped constraint)
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id_token ON push_tokens(user_id, token);
