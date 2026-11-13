-- 094 · Gear kits (Figma "Gear / Inventory – Kits", "Kit detail – status &
-- Use for a gig", "Duo Next / Gear – kits", "iPad · 08 Gear & kits").
--
-- A kit is a named set of inventory items ("Club PA", "Acoustic duo"). Using
-- a kit for a gig links it to the event: every item of the kit goes with the
-- band on that date. Item status stays on the inventory row (available /
-- in use / maintenance / lost); the app derives the kit's "ready" count.
--
-- RLS follows inventory (006 / 073): active band members read, band admins
-- manage. Each row carries band_id, which a trigger sets from the kit and
-- checks against the item or the event, so a kit never mixes bands.
--
-- New tables, so the GRANTs below list what authenticated users may do;
-- a new readable column later needs its own GRANT migration.

BEGIN;

-- ── Kits ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gear_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gear_kits_band_id ON public.gear_kits(band_id);

-- ── Items in a kit ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gear_kit_items (
  kit_id uuid NOT NULL REFERENCES public.gear_kits(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kit_id, inventory_id)
);
CREATE INDEX IF NOT EXISTS idx_gear_kit_items_band_id ON public.gear_kit_items(band_id);
CREATE INDEX IF NOT EXISTS idx_gear_kit_items_inventory_id ON public.gear_kit_items(inventory_id);

-- ── Kits used for a gig ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_gear_kits (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kit_id uuid NOT NULL REFERENCES public.gear_kits(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  assigned_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, kit_id)
);
CREATE INDEX IF NOT EXISTS idx_event_gear_kits_band_id ON public.event_gear_kits(band_id);
CREATE INDEX IF NOT EXISTS idx_event_gear_kits_kit_id ON public.event_gear_kits(kit_id);

-- ── Same band everywhere ──────────────────────────────────────────────────
-- Sets band_id from the kit and refuses an item or an event of another band.
-- SECURITY DEFINER only to read the band ids; RLS still decides who writes.
CREATE OR REPLACE FUNCTION public.bw_gear_kit_link_band()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  kit_band uuid;
  other_band uuid;
BEGIN
  SELECT k.band_id INTO kit_band FROM public.gear_kits k WHERE k.id = NEW.kit_id;
  IF kit_band IS NULL THEN
    RAISE EXCEPTION 'Unknown kit' USING ERRCODE = '23503';
  END IF;
  IF TG_TABLE_NAME = 'gear_kit_items' THEN
    SELECT i.band_id INTO other_band FROM public.inventory i WHERE i.id = NEW.inventory_id;
  ELSE
    SELECT e.band_id INTO other_band FROM public.events e WHERE e.id = NEW.event_id;
  END IF;
  IF other_band IS DISTINCT FROM kit_band THEN
    RAISE EXCEPTION 'The kit and this % belong to different bands',
      CASE WHEN TG_TABLE_NAME = 'gear_kit_items' THEN 'item' ELSE 'event' END
      USING ERRCODE = '23514';
  END IF;
  NEW.band_id := kit_band;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_gear_kit_link_band() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gear_kit_items_band ON public.gear_kit_items;
CREATE TRIGGER gear_kit_items_band
  BEFORE INSERT OR UPDATE ON public.gear_kit_items
  FOR EACH ROW EXECUTE FUNCTION public.bw_gear_kit_link_band();

DROP TRIGGER IF EXISTS event_gear_kits_band ON public.event_gear_kits;
CREATE TRIGGER event_gear_kits_band
  BEFORE INSERT OR UPDATE ON public.event_gear_kits
  FOR EACH ROW EXECUTE FUNCTION public.bw_gear_kit_link_band();

-- A kit stays in its band.
CREATE OR REPLACE FUNCTION public.bw_gear_kit_keep_band()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.band_id IS DISTINCT FROM OLD.band_id THEN
    RAISE EXCEPTION 'A kit cannot move to another band' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_gear_kit_keep_band() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gear_kits_keep_band ON public.gear_kits;
CREATE TRIGGER gear_kits_keep_band
  BEFORE UPDATE ON public.gear_kits
  FOR EACH ROW EXECUTE FUNCTION public.bw_gear_kit_keep_band();

-- ── RLS: like inventory ───────────────────────────────────────────────────
ALTER TABLE public.gear_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_gear_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view gear kits" ON public.gear_kits;
CREATE POLICY "Band members can view gear kits" ON public.gear_kits
  FOR SELECT TO authenticated USING (public.bw_is_band_member(band_id));
DROP POLICY IF EXISTS "Admins can insert gear kits" ON public.gear_kits;
CREATE POLICY "Admins can insert gear kits" ON public.gear_kits
  FOR INSERT TO authenticated WITH CHECK (public.bw_is_band_admin(band_id));
DROP POLICY IF EXISTS "Admins can update gear kits" ON public.gear_kits;
CREATE POLICY "Admins can update gear kits" ON public.gear_kits
  FOR UPDATE TO authenticated USING (public.bw_is_band_admin(band_id)) WITH CHECK (public.bw_is_band_admin(band_id));
DROP POLICY IF EXISTS "Admins can delete gear kits" ON public.gear_kits;
CREATE POLICY "Admins can delete gear kits" ON public.gear_kits
  FOR DELETE TO authenticated USING (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS "Band members can view gear kit items" ON public.gear_kit_items;
CREATE POLICY "Band members can view gear kit items" ON public.gear_kit_items
  FOR SELECT TO authenticated USING (public.bw_is_band_member(band_id));
DROP POLICY IF EXISTS "Admins can insert gear kit items" ON public.gear_kit_items;
CREATE POLICY "Admins can insert gear kit items" ON public.gear_kit_items
  FOR INSERT TO authenticated WITH CHECK (public.bw_is_band_admin(band_id));
DROP POLICY IF EXISTS "Admins can update gear kit items" ON public.gear_kit_items;
CREATE POLICY "Admins can update gear kit items" ON public.gear_kit_items
  FOR UPDATE TO authenticated USING (public.bw_is_band_admin(band_id)) WITH CHECK (public.bw_is_band_admin(band_id));
DROP POLICY IF EXISTS "Admins can delete gear kit items" ON public.gear_kit_items;
CREATE POLICY "Admins can delete gear kit items" ON public.gear_kit_items
  FOR DELETE TO authenticated USING (public.bw_is_band_admin(band_id));

DROP POLICY IF EXISTS "Band members can view gig kits" ON public.event_gear_kits;
CREATE POLICY "Band members can view gig kits" ON public.event_gear_kits
  FOR SELECT TO authenticated USING (public.bw_is_band_member(band_id));
DROP POLICY IF EXISTS "Admins can insert gig kits" ON public.event_gear_kits;
CREATE POLICY "Admins can insert gig kits" ON public.event_gear_kits
  FOR INSERT TO authenticated WITH CHECK (public.bw_is_band_admin(band_id));
DROP POLICY IF EXISTS "Admins can delete gig kits" ON public.event_gear_kits;
CREATE POLICY "Admins can delete gig kits" ON public.event_gear_kits
  FOR DELETE TO authenticated USING (public.bw_is_band_admin(band_id));

-- ── GRANTs ────────────────────────────────────────────────────────────────
REVOKE ALL ON public.gear_kits, public.gear_kit_items, public.event_gear_kits FROM anon, authenticated;
GRANT SELECT (id, band_id, name, notes, created_by, created_at, updated_at),
      INSERT (band_id, name, notes),
      UPDATE (name, notes)
  ON public.gear_kits TO authenticated;
GRANT DELETE ON public.gear_kits TO authenticated;
GRANT SELECT (kit_id, inventory_id, band_id, position, created_at),
      INSERT (kit_id, inventory_id, band_id, position),
      UPDATE (position)
  ON public.gear_kit_items TO authenticated;
GRANT DELETE ON public.gear_kit_items TO authenticated;
GRANT SELECT (event_id, kit_id, band_id, assigned_by, created_at),
      INSERT (event_id, kit_id, band_id)
  ON public.event_gear_kits TO authenticated;
GRANT DELETE ON public.event_gear_kits TO authenticated;

COMMIT;
