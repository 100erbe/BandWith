-- 092 · Rider & stage for a gig (Figma "iPad · 03", "Phone · Next", "Duo · Next").
--
-- One row per band event: the stage plot (one or more layouts, e.g. "Full
-- band" and "Trio"), the input list, what the band brings and what the venue
-- provides. It is logistics, not money: every active member of the band reads
-- it (like the event itself); only whoever manages the event writes it (an
-- active band admin, bw_can_manage_event).
--
-- Shapes (checked by the app, src/lib/stagePlot.ts, which also sanitises
-- what it reads):
--   plots          [{id, name, width_m, depth_m, items: [{id, kind, code,
--                    label, x, y, lead}]}]  x / y from 0 to 1, audience below
--   inputs         [{id, source, mic, kind: 'mic' | 'di', who}]  channel =
--                    position + 1
--   band_brings    ["PA 2× 12\" + sub", …]
--   venue_provides ["Power 2× 16A", …]
--
-- Personal gigs (no band) have no rider & stage.

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_stage (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  plots jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(plots) = 'array' AND jsonb_array_length(plots) <= 6),
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(inputs) = 'array' AND jsonb_array_length(inputs) <= 96),
  mixer text CHECK (mixer IS NULL OR length(mixer) <= 60),
  band_brings jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(band_brings) = 'array' AND jsonb_array_length(band_brings) <= 40),
  venue_provides jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(venue_provides) = 'array' AND jsonb_array_length(venue_provides) <= 40),
  venue_agreed boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Keeps a single row small (the whole thing is a few KB in practice).
  CHECK (pg_column_size(plots) + pg_column_size(inputs) + pg_column_size(band_brings) + pg_column_size(venue_provides) < 200000)
);

CREATE INDEX IF NOT EXISTS idx_event_stage_band_id ON public.event_stage(band_id);

-- Who changed it last, and when (never trusted from the client).
CREATE OR REPLACE FUNCTION public.bw_trg_event_stage_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
    -- The row stays on its event and band.
    NEW.event_id := OLD.event_id;
    NEW.band_id := OLD.band_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_stage_touch ON public.event_stage;
CREATE TRIGGER event_stage_touch
  BEFORE INSERT OR UPDATE ON public.event_stage
  FOR EACH ROW EXECUTE FUNCTION public.bw_trg_event_stage_touch();

ALTER TABLE public.event_stage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_stage_select ON public.event_stage;
DROP POLICY IF EXISTS event_stage_insert ON public.event_stage;
DROP POLICY IF EXISTS event_stage_update ON public.event_stage;
DROP POLICY IF EXISTS event_stage_delete ON public.event_stage;

-- Every active member of the band (members see the logistics).
CREATE POLICY event_stage_select ON public.event_stage
  FOR SELECT TO authenticated
  USING (public.bw_is_band_member(band_id));

-- Whoever manages the event, and only for the event's own band.
CREATE POLICY event_stage_insert ON public.event_stage
  FOR INSERT TO authenticated
  WITH CHECK (
    public.bw_can_manage_event(event_id)
    AND band_id = public.bw_event_band_id(event_id)
  );

CREATE POLICY event_stage_update ON public.event_stage
  FOR UPDATE TO authenticated
  USING (public.bw_can_manage_event(event_id))
  WITH CHECK (
    public.bw_can_manage_event(event_id)
    AND band_id = public.bw_event_band_id(event_id)
  );

CREATE POLICY event_stage_delete ON public.event_stage
  FOR DELETE TO authenticated
  USING (public.bw_can_manage_event(event_id));

REVOKE ALL ON public.event_stage FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_stage TO authenticated;

REVOKE ALL ON FUNCTION public.bw_trg_event_stage_touch() FROM PUBLIC, anon, authenticated;

COMMIT;
