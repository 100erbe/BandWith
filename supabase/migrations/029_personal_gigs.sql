-- Migration: 029_personal_gigs.sql
-- Description: Allow Personal Gigs for Freemium / Solo / Member users
-- 1. Make band_id NULLABLE in public.events
-- 2. Add data integrity check: if band_id IS NULL, created_by MUST NOT BE NULL
-- 3. Add RLS policies on public.events for personal gigs (band_id IS NULL AND created_by = auth.uid())
-- 4. Add RLS policies on public.event_members for personal gigs

-- 1. Make band_id NULLABLE in public.events
ALTER TABLE public.events ALTER COLUMN band_id DROP NOT NULL;

-- 2. Data integrity constraint: if band_id IS NULL, created_by MUST NOT BE NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_personal_gig_creator_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_personal_gig_creator_check
      CHECK (band_id IS NOT NULL OR created_by IS NOT NULL);
  END IF;
END $$;

-- 3. RLS Policies on public.events for Personal Gigs
DROP POLICY IF EXISTS "Users can view own personal events" ON public.events;
CREATE POLICY "Users can view own personal events" ON public.events
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND band_id IS NULL AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert own personal events" ON public.events;
CREATE POLICY "Users can insert own personal events" ON public.events
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND band_id IS NULL AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update own personal events" ON public.events;
CREATE POLICY "Users can update own personal events" ON public.events
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND band_id IS NULL AND created_by = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND band_id IS NULL AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete own personal events" ON public.events;
CREATE POLICY "Users can delete own personal events" ON public.events
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND band_id IS NULL AND created_by = auth.uid()
  );

-- 4. RLS Policies on public.event_members for Personal Gigs
DROP POLICY IF EXISTS "Users can select own personal event members" ON public.event_members;
CREATE POLICY "Users can select own personal event members" ON public.event_members
  FOR SELECT
  USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_members.event_id
      AND e.band_id IS NULL
      AND e.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own personal event members" ON public.event_members;
CREATE POLICY "Users can insert own personal event members" ON public.event_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_members.event_id
      AND e.band_id IS NULL
      AND e.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own personal event members" ON public.event_members;
CREATE POLICY "Users can update own personal event members" ON public.event_members
  FOR UPDATE
  USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_members.event_id
      AND e.band_id IS NULL
      AND e.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own personal event members" ON public.event_members;
CREATE POLICY "Users can delete own personal event members" ON public.event_members
  FOR DELETE
  USING (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_members.event_id
      AND e.band_id IS NULL
      AND e.created_by = auth.uid()
    )
  );
