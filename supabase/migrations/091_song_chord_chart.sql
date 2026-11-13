-- ============================================================================
-- 091: chord charts on songs (iReal Pro import)
-- ----------------------------------------------------------------------------
-- songs.chord_chart (jsonb): sections of bars with chords, repeats, endings,
-- segno/coda, plus title, composer, style, key, tempo and the song's own
-- irealb:// link (src/lib/ireal.ts, SongChart). Imported by pasting an
-- iReal Pro link in the song form; shown in the song menu and in Stage mode.
--
-- Chords and form only: an iReal Pro chart has no melody and no lyrics, and
-- the app never stores either here.
--
-- Same access as the rest of the song: band members read it, members add or
-- edit songs, admins manage them (existing songs policies, table grants).
-- ~650 KB is the size of a whole 1,460-song playlist; one chart is a few KB,
-- so 256 KB is a generous cap.
-- ============================================================================

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS chord_chart jsonb;

ALTER TABLE public.songs DROP CONSTRAINT IF EXISTS songs_chord_chart_size;
ALTER TABLE public.songs
  ADD CONSTRAINT songs_chord_chart_size
  CHECK (chord_chart IS NULL OR (jsonb_typeof(chord_chart) = 'object' AND pg_column_size(chord_chart) <= 262144));

COMMENT ON COLUMN public.songs.chord_chart IS
  'Chord chart (chords, sections, repeats; no melody, no lyrics) imported from an iReal Pro link. See src/lib/ireal.ts.';
