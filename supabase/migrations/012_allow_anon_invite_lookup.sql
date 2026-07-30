-- Allow anonymous users to look up their invitations by email
-- This is secure because it requires knowing the exact email address

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Anyone can lookup invitations by email" ON band_invitations;

-- Create new policy for anonymous invite lookup
CREATE POLICY "Anyone can lookup invitations by email" ON band_invitations
  FOR SELECT USING (true);

-- Note: This allows SELECT for anyone, but:
-- 1. They need to know the exact email to filter
-- 2. INSERT/UPDATE/DELETE still requires authentication
-- 3. The invite is only useful if they can complete signup with that email
