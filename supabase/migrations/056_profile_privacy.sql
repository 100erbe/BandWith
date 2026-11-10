-- ====================================================================
-- 056: Profile privacy preferences
--
-- Adds profiles.privacy (jsonb) for per-user privacy switches set in
-- Settings → Privacy & account (src/lib/services/privacyPrefs.ts):
--   { "hidePersonalGigDetails": boolean }
--     true  → bands should see the user as busy on a personal gig's date,
--             without its title or venue.
--
-- No policy changes: users already update their own profiles row (the
-- same path notification_preferences uses), and 050's
-- profiles_select_related lets band mates read it.
-- Personal gigs (events.band_id IS NULL) are only readable by their
-- creator (029), so nothing exposes their details to bands today; any
-- future band-facing availability view must honour this flag server-side.
--
-- Safe to run more than once.
-- ====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.privacy IS
  'Per-user privacy switches, e.g. {"hidePersonalGigDetails": true}. Written by the user from Settings.';
