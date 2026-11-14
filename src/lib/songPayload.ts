/**
 * The song form (AddSongModal) → the row written to `songs`.
 *
 * Creating: only what was filled in. Editing: only the fields that changed
 * since the song was opened, with emptied fields sent as null so they are
 * really cleared (a missing key leaves the column as it was). Sending only
 * the changes also keeps a bandmate's edit to another field of the same song
 * (one fixes the lyrics, the other the BPM) instead of overwriting it.
 */
import type { SongChanges } from './services/songs';
import type { SongChart } from './ireal';
import { joinGenres } from './songGenres';

export type { SongChanges };

export interface SongFormValues {
  title: string;
  artist: string;
  genres: string[];
  /** Stored recording / chart (song-files ref or https link); null = none. */
  audioUrl: string | null;
  chartUrl: string | null;
  youtubeUrl: string | null;
  /** Notes as they will be saved (chords link included). */
  notes: string;
  lyrics: string;
  bpm: string;
  key: string;
  durationSeconds: number;
  /** Only when the chart was changed in this form. */
  chordChart?: { value: SongChart | null };
}

/** Every field as the form saves it (null = empty). */
export function songFields(f: SongFormValues): SongChanges {
  const lyrics = f.lyrics.trim() ? f.lyrics.replace(/\s+$/, '').slice(0, 20000) : null;
  const bpm = parseInt(f.bpm, 10);
  return {
    title: f.title.trim(),
    artist: f.artist.trim() || null,
    genre: joinGenres(f.genres) ?? null,
    audio_url: f.audioUrl || null,
    chart_url: f.chartUrl || null,
    youtube_url: f.youtubeUrl || null,
    notes: f.notes.trim() || null,
    lyrics,
    bpm: bpm > 0 ? bpm : null,
    key: f.key.trim() || null,
    duration_seconds: f.durationSeconds > 0 ? f.durationSeconds : null,
    ...(f.chordChart ? { chord_chart: f.chordChart.value } : {}),
  };
}

/** New song: the filled-in fields only. */
export function songCreatePayload(f: SongFormValues): SongChanges {
  const all = songFields(f);
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== null && v !== undefined)) as SongChanges;
}

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null) || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Edited song: the fields that differ from `opened` (the form as it was
 * filled from the song), emptied ones as null. `{}` when nothing changed.
 */
export function songUpdatePayload(opened: SongFormValues, current: SongFormValues): SongChanges {
  const before = songFields(opened);
  const after = songFields(current);
  const out: SongChanges = {};
  for (const k of Object.keys(after) as (keyof SongChanges)[]) {
    if (k === 'chord_chart') {
      if (current.chordChart) (out as Record<string, unknown>)[k] = after[k] ?? null;
      continue;
    }
    if (!same(before[k], after[k])) (out as Record<string, unknown>)[k] = after[k] ?? null;
  }
  return out;
}

/** Stored files the saved song no longer uses (removed from storage after the save). */
export const replacedFiles = (opened: Pick<SongFormValues, 'audioUrl' | 'chartUrl'>, saved: SongChanges): string[] =>
  [
    'audio_url' in saved && opened.audioUrl && saved.audio_url !== opened.audioUrl ? opened.audioUrl : null,
    'chart_url' in saved && opened.chartUrl && saved.chart_url !== opened.chartUrl ? opened.chartUrl : null,
  ].filter((r): r is string => !!r);

/** "Superstition" / "Stevie Wonder" → a key to spot the same song already in the library. */
export const songIdentity = (title: string, artist?: string | null) =>
  `${title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()}|${(artist || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()}`;
