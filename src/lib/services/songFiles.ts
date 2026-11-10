/**
 * Song files (audio + charts) in Supabase Storage.
 *
 * Bucket `song-files` is PRIVATE (migration 047): objects live under
 * `<band_id>/...` and only active members of that band can read or write them.
 * Songs store a reference `sb://song-files/<path>`; the app turns it into a
 * short-lived signed URL when someone plays or opens the file.
 */
import { supabase } from '../supabase';

export const SONG_FILES_BUCKET = 'song-files';
const REF_PREFIX = `sb://${SONG_FILES_BUCKET}/`;

export const SONG_AUDIO_MAX_BYTES = 50 * 1024 * 1024;
export const SONG_CHART_MAX_BYTES = 20 * 1024 * 1024;

const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'aif', 'aiff', 'ogg', 'flac'];
const CHART_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'heic', 'webp'];

/** Accept attribute for <input type="file"> (iOS Files shows iCloud, Drive, Dropbox…). */
export const SONG_FILE_ACCEPT = [
  ...AUDIO_EXT.map((e) => `.${e}`),
  ...CHART_EXT.map((e) => `.${e}`),
  'audio/*',
  'application/pdf',
].join(',');

export type SongFileKind = 'audio' | 'chart';

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() || '';

export const classifySongFile = (file: Pick<File, 'name' | 'type'>): SongFileKind | null => {
  const ext = extOf(file.name);
  if (file.type.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio';
  if (file.type === 'application/pdf' || file.type.startsWith('image/') || CHART_EXT.includes(ext)) return 'chart';
  return null;
};

/** Human-readable problem with a picked file, or null if it can be uploaded. */
export const validateSongFile = (file: Pick<File, 'name' | 'type' | 'size'>): string | null => {
  const kind = classifySongFile(file);
  if (!kind) return 'Use an audio file (MP3, M4A, WAV…) or a chart (PDF or image).';
  const max = kind === 'audio' ? SONG_AUDIO_MAX_BYTES : SONG_CHART_MAX_BYTES;
  if (file.size > max) return `File too large: max ${Math.round(max / 1024 / 1024)} MB for ${kind === 'audio' ? 'audio' : 'charts'}.`;
  return null;
};

export const isStoredSongFile = (ref?: string | null): ref is string => !!ref && ref.startsWith(REF_PREFIX);

/** Only https links may be stored or opened (no javascript:, data:, file:…). */
export const safeHttpsUrl = (input?: string | null): string | undefined => {
  const value = (input || '').trim();
  if (!value) return undefined;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const safeName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80) || 'file';

/** Upload a picked file for a band; returns the reference to store on the song. */
export const uploadSongFile = async (
  bandId: string,
  file: File,
): Promise<{ ref: string; kind: SongFileKind; error: null } | { ref: null; kind: null; error: Error }> => {
  const problem = validateSongFile(file);
  if (problem) return { ref: null, kind: null, error: new Error(problem) };
  const kind = classifySongFile(file)!;
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const path = `${bandId}/${kind}/${id}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(SONG_FILES_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) return { ref: null, kind: null, error: new Error(error.message || 'Upload failed') };
  return { ref: `${REF_PREFIX}${path}`, kind, error: null };
};

/** Playable/openable URL for a stored file or an https link; null otherwise. */
export const resolveSongFileUrl = async (ref?: string | null): Promise<string | null> => {
  if (!ref) return null;
  if (isStoredSongFile(ref)) {
    const { data, error } = await supabase.storage
      .from(SONG_FILES_BUCKET)
      .createSignedUrl(ref.slice(REF_PREFIX.length), 60 * 60);
    return error ? null : data?.signedUrl ?? null;
  }
  return safeHttpsUrl(ref) ?? null;
};

/** Delete stored files (ignores links). Best effort. */
export const removeSongFiles = async (refs: Array<string | null | undefined>): Promise<void> => {
  const paths = refs.filter(isStoredSongFile).map((r) => r.slice(REF_PREFIX.length));
  if (paths.length === 0) return;
  await supabase.storage.from(SONG_FILES_BUCKET).remove(paths).catch(() => undefined);
};

/** Open a stored file or https link outside the app (Safari/Files/Maps…). */
export const openSongResource = async (ref?: string | null): Promise<boolean> => {
  // Open the window synchronously-ish to keep the user gesture on web; on
  // native, Capacitor hands the URL to the system.
  const url = await resolveSongFileUrl(ref);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};
