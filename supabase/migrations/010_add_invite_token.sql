-- Add token column to band_invitations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'band_invitations' AND column_name = 'token'
  ) THEN
    ALTER TABLE band_invitations ADD COLUMN token UUID DEFAULT gen_random_uuid();
    CREATE UNIQUE INDEX IF NOT EXISTS idx_band_invitations_token ON band_invitations(token);
  END IF;
END $$;

-- Add invited_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'band_invitations' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE band_invitations ADD COLUMN invited_by UUID REFERENCES auth.users(id);
  END IF;
END $$;
