-- ====================================================================
-- Fix relationship between band_members and profiles
-- 
-- The band_members table has user_id referencing auth.users(id),
-- while profiles(id) also references auth.users(id). PostgREST
-- cannot automatically infer a join path between band_members and
-- profiles because there's no foreign key directly linking them.
-- 
-- Adding a FK from band_members(user_id) to profiles(id) allows
-- PostgREST to resolve the `profile:profiles(*)` join in queries.
-- ====================================================================

-- Drop existing FK if any (band_members.user_id -> auth.users)
ALTER TABLE public.band_members
  DROP CONSTRAINT IF EXISTS band_members_user_id_fkey,
  ADD CONSTRAINT band_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Also fix event_members similarly for consistency
ALTER TABLE public.event_members
  DROP CONSTRAINT IF EXISTS event_members_user_id_fkey,
  ADD CONSTRAINT event_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix band_members.band_id FK to ensure it's explicit
ALTER TABLE public.band_members
  DROP CONSTRAINT IF EXISTS band_members_band_id_fkey,
  ADD CONSTRAINT band_members_band_id_fkey 
    FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;

-- Fix invitations.band_id FK
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_band_id_fkey,
  ADD CONSTRAINT invitations_band_id_fkey 
    FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
