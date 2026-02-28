-- =============================================
-- PUSH NOTIFICATION TOKENS TABLE
-- Run this in Supabase SQL Editor
-- =============================================

-- Create push_tokens table to store device tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Indexes for push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- RLS for push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;
CREATE POLICY "Users can manage their own push tokens" ON push_tokens
  FOR ALL USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON push_tokens TO authenticated;

-- Function to send push notification (to be called from server/edge function)
-- This is a placeholder - actual implementation requires FCM/APNs integration
CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  -- Log the notification request
  -- In production, this would call an Edge Function that sends to FCM/APNs
  INSERT INTO notification_logs (user_id, title, body, data, sent_at)
  VALUES (p_user_id, p_title, p_body, p_data, NOW())
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create notification_logs table for debugging
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT,
  body TEXT,
  data JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- RLS for notification_logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notification logs" ON notification_logs;
CREATE POLICY "Users can view their notification logs" ON notification_logs
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON notification_logs TO authenticated;
