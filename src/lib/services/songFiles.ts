/**
 * Song files (audio + charts) in Supabase Storage.
 *
 * Bucket `song-files` is PRIVATE (migration 047): objects live under
 * `<band_id>/...` and only active members of that band can read or write them.
 * Songs store a reference `sb://song-files/<path>`; the app turns it into a
 * short-lived signed URL when someone plays or opens the file.
 */
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '../supabase';
import { t } from '@/lib/i18n';
import { UserError } from '../userError';

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

const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '');

/** MIME types the `song-files` bucket accepts (migration 047, allowed_mime_types). */
export const SONG_FILE_MIME_TYPES: readonly string[] = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
  'audio/wave', 'audio/aiff', 'audio/x-aiff', 'audio/ogg', 'audio/flac', 'audio/x-flac',
  'application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/webp',
];

/** Extension → MIME type, for when the browser/OS gives no (or an odd) type. */
const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/x-m4a',
  aac: 'audio/aac',
  wav: 'audio/wav',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  webp: 'image/webp',
};

const unsupportedTypeMessage = () =>
  t('This file type is not supported. Use MP3, M4A, WAV, AIFF, AAC, OGG or FLAC audio, or a PDF, PNG, JPG, HEIC or WebP chart.');

/**
 * Content type to upload with: the file's own type when the bucket accepts
 * it, otherwise the type implied by the extension. Null when neither is
 * accepted by the bucket.
 */
export const songFileContentType = (file: Pick<File, 'name' | 'type'>): string | null => {
  const type = (file.type || '').toLowerCase();
  if (type && SONG_FILE_MIME_TYPES.includes(type)) return type;
  const byExt = MIME_BY_EXT[extOf(file.name)];
  return byExt && SONG_FILE_MIME_TYPES.includes(byExt) ? byExt : null;
};

export const classifySongFile = (file: Pick<File, 'name' | 'type'>): SongFileKind | null => {
  const ext = extOf(file.name);
  if (file.type.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio';
  if (file.type === 'application/pdf' || file.type.startsWith('image/') || CHART_EXT.includes(ext)) return 'chart';
  return null;
};

/** Human-readable problem with a picked file, or null if it can be uploaded. */
export const validateSongFile = (file: Pick<File, 'name' | 'type' | 'size'>): string | null => {
  const kind = classifySongFile(file);
  if (!kind) return t('Use an audio file (MP3, M4A, WAV…) or a chart (PDF or image).');
  if (!songFileContentType(file)) return unsupportedTypeMessage();
  const max = kind === 'audio' ? SONG_AUDIO_MAX_BYTES : SONG_CHART_MAX_BYTES;
  if (file.size > max) {
    const mb = Math.round(max / 1024 / 1024);
    return kind === 'audio' ? t('File too large: max {mb} MB for audio.', { mb }) : t('File too large: max {mb} MB for charts.', { mb });
  }
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
  if (problem) return { ref: null, kind: null, error: new UserError(problem) };
  const kind = classifySongFile(file)!;
  const contentType = songFileContentType(file);
  if (!contentType) return { ref: null, kind: null, error: new UserError(unsupportedTypeMessage()) };
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const path = `${bandId}/${kind}/${id}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(SONG_FILES_BUCKET).upload(path, file, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });
  // Storage's own text stays out of the UI (userMessage maps size / type / network).
  if (error) return { ref: null, kind: null, error: Object.assign(new Error(error.message || 'Upload failed'), { statusCode: (error as { statusCode?: unknown }).statusCode }) };
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

/**
 * Open a stored file or https link outside the app.
 *
 * Pass several candidates (e.g. recording, then Spotify, then YouTube) to open
 * the first one that resolves. Call it straight from the click handler, before
 * any other `await`: on the web a blank tab is opened synchronously (so popup
 * blockers allow it) and pointed at the signed URL once it is ready. On native
 * the URL opens in the in-app browser, which has a Done button back to the app.
 */
export const openSongResource = async (
  refs?: string | null | Array<string | null | undefined>,
): Promise<boolean> => {
  const candidates = (Array.isArray(refs) ? refs : [refs]).filter((r): r is string => !!r);
  if (candidates.length === 0) return false;

  if (Capacitor.isNativePlatform()) {
    for (const ref of candidates) {
      const url = await resolveSongFileUrl(ref);
      if (!url) continue;
      try {
        await Browser.open({ url });
        return true;
      } catch {
        /* try the next candidate */
      }
    }
    return false;
  }

  // Web: open the tab now, while we still have the user gesture.
  let win: Window | null = null;
  try {
    win = window.open('about:blank', '_blank');
    if (win) win.opener = null;
  } catch {
    win = null;
  }

  for (const ref of candidates) {
    const url = await resolveSongFileUrl(ref);
    if (!url) continue;
    if (win && !win.closed) {
      win.location.href = url;
    } else {
      window.location.assign(url);
    }
    return true;
  }

  win?.close();
  return false;
};

/* ── Files from cloud providers (Google Drive…) ─────────────────────────────
 * Picked through Android's Drive provider, a file can arrive with no
 * extension and an empty or generic type ("application/octet-stream"), so
 * the type checks rejected real MP3s. The first bytes tell what it is.
 * ───────────────────────────────────────────────────────────────────────── */

const sniffExt = (b: Uint8Array): string | null => {
  const s = (from: number, len: number) => String.fromCharCode(...b.slice(from, from + len));
  if (s(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return 'mp3';
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return 'aac';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WAVE') return 'wav';
  if (s(0, 4) === 'FORM' && (s(8, 4) === 'AIFF' || s(8, 4) === 'AIFC')) return 'aiff';
  if (s(0, 4) === 'fLaC') return 'flac';
  if (s(0, 4) === 'OggS') return 'ogg';
  if (s(4, 4) === 'ftyp') return 'm4a';
  if (s(0, 4) === '%PDF') return 'pdf';
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
  return null;
};

/**
 * The picked file as-is when its name/type are usable; otherwise a copy named
 * and typed from its content (e.g. "Track 01" from Drive → "Track 01.mp3").
 */
export const normalizeSongFile = async (file: File): Promise<File> => {
  if (classifySongFile(file) && songFileContentType(file)) return file;
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const ext = sniffExt(head);
    if (!ext) return file;
    const base = file.name.replace(/\.[^/.]+$/, '') || 'file';
    return new File([file], `${base}.${ext}`, { type: MIME_BY_EXT[ext], lastModified: file.lastModified });
  } catch {
    return file;
  }
};

/** Drive file id from a share link ("…/file/d/<id>/view", "open?id=<id>", "uc?id=<id>"). */
export const googleDriveFileId = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (!/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$|drive\.usercontent\.google\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/file\/d\/([\w-]{10,})/);
    return m?.[1] || u.searchParams.get('id');
  } catch {
    return null;
  }
};

/**
 * URL an <audio> element can stream: Drive share links (an HTML viewer page)
 * become the direct file download. Works for files shared as "Anyone with
 * the link"; a private Drive file can't be streamed by any app.
 */
export const playableAudioUrl = (url: string): string => {
  const id = googleDriveFileId(url);
  return id ? `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download` : url;
};
