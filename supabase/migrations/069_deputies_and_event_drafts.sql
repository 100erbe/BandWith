-- ====================================================================
-- 069: deputies (session musicians) and "New gig" drafts in the cloud
--
-- 1. band_deputies: the band's list of deputies (dep / session players).
--    When a member can't make a gig, an admin picks a deputy for that
--    instrument and sends them a request (WhatsApp, SMS or email from the
--    app). Deputies don't need a BandWith account. Only band admins can
--    see and edit the list (it holds outside people's phone numbers).
--
-- 2. event_drafts: unfinished "New gig" wizards, so a draft saved on one
--    device shows up on the others. Each draft belongs to its author only.
--
-- Safe to run more than once.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.band_deputies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  instrument text CHECK (instrument IS NULL OR length(instrument) <= 60),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  email text CHECK (email IS NULL OR length(email) <= 200),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  default_fee numeric CHECK (default_fee IS NULL OR default_fee >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS band_deputies_band_idx ON public.band_deputies (band_id, instrument);

ALTER TABLE public.band_deputies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS band_deputies_admin_select ON public.band_deputies;
CREATE POLICY band_deputies_admin_select ON public.band_deputies
  FOR SELECT TO authenticated USING (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS band_deputies_admin_insert ON public.band_deputies;
CREATE POLICY band_deputies_admin_insert ON public.band_deputies
  FOR INSERT TO authenticated WITH CHECK (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS band_deputies_admin_update ON public.band_deputies;
CREATE POLICY band_deputies_admin_update ON public.band_deputies
  FOR UPDATE TO authenticated
  USING (public.bw_is_band_admin(band_id))
  WITH CHECK (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS band_deputies_admin_delete ON public.band_deputies;
CREATE POLICY band_deputies_admin_delete ON public.band_deputies
  FOR DELETE TO authenticated USING (public.bw_is_band_admin(band_id));

REVOKE ALL ON public.band_deputies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.band_deputies TO authenticated;

-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_drafts (
  id text PRIMARY KEY CHECK (length(id) <= 64),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  event_date date,
  venue text CHECK (venue IS NULL OR length(venue) <= 200),
  event_type text CHECK (event_type IS NULL OR length(event_type) <= 40),
  state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(state) <= 200000),
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_drafts_user_idx ON public.event_drafts (user_id, band_id, saved_at DESC);

ALTER TABLE public.event_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_drafts_own ON public.event_drafts;
CREATE POLICY event_drafts_own ON public.event_drafts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND (band_id IS NULL OR public.bw_is_band_admin(band_id)));

REVOKE ALL ON public.event_drafts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_drafts TO authenticated;
