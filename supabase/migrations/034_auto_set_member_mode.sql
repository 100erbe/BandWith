-- ====================================================================
-- Auto-switch user_mode from 'solo' to 'member' when a user is 
-- added to a band_members table
-- 
-- Problem: Users who complete onboarding as 'solo' stay in solo mode
-- even after an admin adds them to a band. Solo mode hides the Chat 
-- tab (see AuthenticatedApp.tsx line 1406: !isSolo check).
-- 
-- This trigger fires on every INSERT to band_members and automatically
-- updates the profiles table if the user is currently in 'solo' mode.
-- ====================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1) Create the trigger function
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION on_band_member_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the user is currently in 'solo' mode, switch them to 'member'
  UPDATE profiles 
  SET user_mode = 'member' 
  WHERE id = NEW.user_id 
    AND user_mode = 'solo';
  
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2) Create the trigger (fires on INSERT to band_members)
-- ═══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_auto_set_member_mode ON band_members;
CREATE TRIGGER trg_auto_set_member_mode
AFTER INSERT ON band_members
FOR EACH ROW
EXECUTE FUNCTION on_band_member_added();

-- ═══════════════════════════════════════════════════════════════
-- 3) Verify: show existing members who are still in solo mode
-- ═══════════════════════════════════════════════════════════════

SELECT 'Users in solo mode who are already band members:' as info;
SELECT p.id, p.email, p.full_name, p.user_mode, p.sub_tier,
  COUNT(bm.id) as band_member_count
FROM profiles p
JOIN band_members bm ON bm.user_id = p.id
WHERE p.user_mode = 'solo'
GROUP BY p.id, p.email, p.full_name, p.user_mode, p.sub_tier;

SELECT '✅ Trigger created. Future band joins will auto-set user_mode to member.' as result;