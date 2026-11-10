-- ====================================================================
-- 047: Storage buckets — song files, band branding, size/type limits
--
--   song-files     PRIVATE. <band_id>/<audio|chart>/<file>. Active members of
--                  the band read/write/delete; the app uses signed URLs.
--                  50 MB, audio + PDF + images.
--   band-branding  PUBLIC read (logos/signatures are drawn into quote PDFs),
--                  writes only by admins of the band in <band_id>/. 3 MB images.
--   quotes         (exists, 040/042) 10 MB, PDF only.
--   avatars        (exists, 037/042) 5 MB images.
--
-- Also adds bands.pricing_settings (jsonb): the app saves quote pricing,
-- country and currency there, but the column never existed, so the
-- settings stayed on one device only.
--
-- Safe to run more than once.
-- ====================================================================

ALTER TABLE public.bands ADD COLUMN IF NOT EXISTS pricing_settings jsonb;

CREATE OR REPLACE FUNCTION public.bw_my_band_ids()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(band_id::text), '{}')
  FROM band_members
  WHERE user_id = auth.uid() AND COALESCE(is_active, true);
$$;
REVOKE ALL ON FUNCTION public.bw_my_band_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_my_band_ids() TO authenticated;

-- --------------------------------------------------------------------
-- Buckets + limits
-- --------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'song-files', 'song-files', false, 52428800,
  ARRAY[
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
    'audio/wave', 'audio/aiff', 'audio/x-aiff', 'audio/ogg', 'audio/flac', 'audio/x-flac',
    'application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('band-branding', 'band-branding', true, 3145728, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
   SET file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf']
 WHERE id = 'quotes';

UPDATE storage.buckets
   SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/heic']
 WHERE id = 'avatars';

-- --------------------------------------------------------------------
-- song-files policies (band members only)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "bw_song_files_member_select" ON storage.objects;
DROP POLICY IF EXISTS "bw_song_files_member_insert" ON storage.objects;
DROP POLICY IF EXISTS "bw_song_files_member_update" ON storage.objects;
DROP POLICY IF EXISTS "bw_song_files_member_delete" ON storage.objects;

CREATE POLICY "bw_song_files_member_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'song-files' AND (storage.foldername(name))[1] = ANY (public.bw_my_band_ids()));
CREATE POLICY "bw_song_files_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'song-files' AND (storage.foldername(name))[1] = ANY (public.bw_my_band_ids()));
CREATE POLICY "bw_song_files_member_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'song-files' AND (storage.foldername(name))[1] = ANY (public.bw_my_band_ids()));
CREATE POLICY "bw_song_files_member_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'song-files' AND (storage.foldername(name))[1] = ANY (public.bw_my_band_ids()));

-- --------------------------------------------------------------------
-- band-branding policies (public read via URL; admins of the band write)
-- --------------------------------------------------------------------
-- Remove any permissive policy an earlier manual setup may have created.
DROP POLICY IF EXISTS "Public read access for band-branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload band-branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update band-branding" ON storage.objects;
DROP POLICY IF EXISTS "bw_branding_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "bw_branding_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "bw_branding_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "bw_branding_admin_delete" ON storage.objects;

-- SELECT is only needed for upsert/list by the admins; public URLs work without it.
CREATE POLICY "bw_branding_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'band-branding' AND (storage.foldername(name))[1] = ANY (public.bw_my_admin_band_ids()));
CREATE POLICY "bw_branding_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'band-branding' AND (storage.foldername(name))[1] = ANY (public.bw_my_admin_band_ids()));
CREATE POLICY "bw_branding_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'band-branding' AND (storage.foldername(name))[1] = ANY (public.bw_my_admin_band_ids()));
CREATE POLICY "bw_branding_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'band-branding' AND (storage.foldername(name))[1] = ANY (public.bw_my_admin_band_ids()));
