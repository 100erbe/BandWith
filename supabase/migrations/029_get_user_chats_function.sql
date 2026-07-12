-- ====================================================================
-- Create a helper function to fetch chats with participants
-- Uses raw SQL to avoid PostgREST join/cache issues
-- ====================================================================

-- Function to get all chats for a user with participants
CREATE OR REPLACE FUNCTION get_user_chats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', c.id,
      'band_id', c.band_id,
      'event_id', c.event_id,
      'type', c.type,
      'name', c.name,
      'created_by', c.created_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'participants', (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', cp.id,
            'chat_id', cp.chat_id,
            'user_id', cp.user_id,
            'last_read_at', cp.last_read_at,
            'muted', cp.muted,
            'joined_at', cp.joined_at
          )
        )
        FROM chat_participants cp
        WHERE cp.chat_id = c.id
      )
    )
    ORDER BY c.updated_at DESC NULLS LAST
  ) INTO result
  FROM chats c
  WHERE c.id IN (
    SELECT cp.chat_id FROM chat_participants cp WHERE cp.user_id = p_user_id
  );

  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;
