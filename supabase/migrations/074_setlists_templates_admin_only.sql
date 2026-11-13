-- 074 · Setlists, setlist songs and task templates: only active admins write.
--
-- Until now any band member could create, change and delete every setlist of
-- the band (also the one attached to a gig or rehearsal) and every task
-- template: the setlist policies were "for all" to members, and on
-- task_templates a members-wide "for all" policy overrode the admin-only ones.
-- Inactive members could still write setlists too.
--
-- Decided on 2026-11-13: members only read. Writes follow bw_is_band_admin
-- (active admins), like events. Reads follow bw_is_band_member (active
-- members), like events. The app hides the write actions for members.
--
-- Replaces the policies exported in 073 for these three tables.

BEGIN;

-- ── setlists ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Band members can manage setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band members can view setlists" ON public.setlists;

CREATE POLICY setlists_select ON public.setlists
  FOR SELECT TO authenticated
  USING (public.bw_is_band_member(band_id));

CREATE POLICY setlists_insert ON public.setlists
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_is_band_admin(band_id));

CREATE POLICY setlists_update ON public.setlists
  FOR UPDATE TO authenticated
  USING (public.bw_is_band_admin(band_id))
  WITH CHECK (public.bw_is_band_admin(band_id));

CREATE POLICY setlists_delete ON public.setlists
  FOR DELETE TO authenticated
  USING (public.bw_is_band_admin(band_id));

-- ── setlist_songs (band comes from the parent setlist) ────────────────────
DROP POLICY IF EXISTS "Band members can manage setlist songs" ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can view setlist songs" ON public.setlist_songs;

CREATE POLICY setlist_songs_select ON public.setlist_songs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id AND public.bw_is_band_member(s.band_id)
  ));

CREATE POLICY setlist_songs_insert ON public.setlist_songs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id AND public.bw_is_band_admin(s.band_id)
  ));

CREATE POLICY setlist_songs_update ON public.setlist_songs
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id AND public.bw_is_band_admin(s.band_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id AND public.bw_is_band_admin(s.band_id)
  ));

CREATE POLICY setlist_songs_delete ON public.setlist_songs
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.setlists s
    WHERE s.id = setlist_songs.setlist_id AND public.bw_is_band_admin(s.band_id)
  ));

-- ── task_templates ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Band members can manage task templates" ON public.task_templates;
DROP POLICY IF EXISTS "Users can view task templates of their bands" ON public.task_templates;
DROP POLICY IF EXISTS "Admins can insert task templates" ON public.task_templates;
DROP POLICY IF EXISTS "Admins can update task templates" ON public.task_templates;
DROP POLICY IF EXISTS "Admins can delete task templates" ON public.task_templates;

CREATE POLICY task_templates_select ON public.task_templates
  FOR SELECT TO authenticated
  USING (public.bw_is_band_member(band_id));

CREATE POLICY task_templates_insert ON public.task_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_is_band_admin(band_id));

CREATE POLICY task_templates_update ON public.task_templates
  FOR UPDATE TO authenticated
  USING (public.bw_is_band_admin(band_id))
  WITH CHECK (public.bw_is_band_admin(band_id));

CREATE POLICY task_templates_delete ON public.task_templates
  FOR DELETE TO authenticated
  USING (public.bw_is_band_admin(band_id));

COMMIT;
