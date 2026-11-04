-- ====================================================================
-- Migration: 039_band_pricing_and_logistics.sql
-- Description: Move Pricing & Logistics from user profile scope to individual Band model.
-- Preserves BandMember individual payout rate overrides.
-- ====================================================================

-- 1. DROP GENERIC PRICING / LOGISTICS FIELDS FROM PROFILES (IF ANY EXIST)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS core_musician_fee,
  DROP COLUMN IF EXISTS additional_musician_fee,
  DROP COLUMN IF EXISTS standard_lineup_size,
  DROP COLUMN IF EXISTS extra_services_fee,
  DROP COLUMN IF EXISTS home_base_location,
  DROP COLUMN IF EXISTS home_base_address,
  DROP COLUMN IF EXISTS home_base_latitude,
  DROP COLUMN IF EXISTS home_base_longitude;

-- 2. ADD PRICING & LOGISTICS FIELDS DIRECTLY TO THE BANDS TABLE
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS standard_lineup_size INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS core_musician_fee NUMERIC(10, 2) DEFAULT 300.00,
  ADD COLUMN IF NOT EXISTS additional_musician_fee NUMERIC(10, 2) DEFAULT 250.00,
  ADD COLUMN IF NOT EXISTS ceremony_musician_fee NUMERIC(10, 2) DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS cocktail_musician_fee NUMERIC(10, 2) DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS dj_hourly_rate NUMERIC(10, 2) DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS production_standard_fee NUMERIC(10, 2) DEFAULT 300.00,
  ADD COLUMN IF NOT EXISTS production_pro_fee NUMERIC(10, 2) DEFAULT 600.00,
  ADD COLUMN IF NOT EXISTS production_extra_location_fee NUMERIC(10, 2) DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS travel_rate_per_km NUMERIC(10, 2) DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS home_base_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS home_base_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_base_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pricing_currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS pricing_rules JSONB DEFAULT '{
    "low_season_multiplier": 0.9,
    "mid_season_multiplier": 1.0,
    "peak_season_multiplier": 1.15,
    "margin_divisor": 0.94,
    "rounding_step": 10,
    "default_vat_rate": 21,
    "default_deposit_rate": 20
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_services JSONB DEFAULT '[
    {
      "id": "srv-song-request",
      "name": "Custom Song Arrangement",
      "category": "performance",
      "description": "Learn & arrange a special request outside the repertoire",
      "price": 120,
      "unit": "flat",
      "is_active": true
    },
    {
      "id": "srv-early-loadin",
      "name": "Early Load-In / Waiting Hour",
      "category": "logistics",
      "description": "Early setup & standby time before the event starts",
      "price": 35,
      "unit": "per_person",
      "is_active": true
    },
    {
      "id": "srv-recording",
      "name": "Live Multitrack Recording",
      "category": "production",
      "description": "Multi-channel audio capture of the live performance",
      "price": 250,
      "unit": "flat",
      "is_active": false
    }
  ]'::jsonb;

-- 3. ENSURE BAND_MEMBERS TABLE HAS DEFAULT_FEE FOR INDIVIDUAL PAYOUT OVERRIDES
ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS default_fee NUMERIC(10, 2);

-- 4. RBAC POLICIES ON PUBLIC.BANDS
-- Enable RLS if not already enabled
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;

-- Allow members of the band to view the band record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bands' AND policyname = 'Band members can view band'
  ) THEN
    CREATE POLICY "Band members can view band"
      ON public.bands
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.band_members
          WHERE band_members.band_id = public.bands.id
            AND band_members.user_id = auth.uid()
            AND band_members.is_active = true
        )
      );
  END IF;
END $$;

-- Allow band admins only to update the band record and its pricing / logistics formulas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bands' AND policyname = 'Band admins can update band details and pricing'
  ) THEN
    CREATE POLICY "Band admins can update band details and pricing"
      ON public.bands
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.band_members
          WHERE band_members.band_id = public.bands.id
            AND band_members.user_id = auth.uid()
            AND band_members.role = 'admin'
            AND band_members.is_active = true
        )
      );
  END IF;
END $$;

-- 5. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
