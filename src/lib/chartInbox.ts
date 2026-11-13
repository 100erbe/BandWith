/**
 * A MusicXML file opened with BandWith from another app (iOS "Open in…" /
 * share sheet, Android "Open with"), waiting to be attached to a song.
 *
 * The app reads it as soon as it arrives (chords and form only, like the
 * "From file" import) and keeps the chart here, in memory, until the user
 * attaches it to a song (ReceivedChartSheet) or uses it in a song form
 * (ChordImportSheet › From file › Received file).
 */
import { Capacitor } from '@capacitor/core';
import type { SongChart } from './ireal';
import { readMusicXml } from './musicxml';

let received: SongChart | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** The waiting chart's file name (or title), or null. */
export const receivedChartName = () => (received ? received.file || received.title : null);

export const peekReceivedChart = () => received;

/** Takes the waiting chart (it is no longer offered afterwards). */
export const takeReceivedChart = (): SongChart | null => {
  const c = received;
  received = null;
  emit();
  return c;
};

export const setReceivedChart = (c: SongChart | null) => {
  received = c;
  emit();
};

export const onReceivedChart = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** True for a URL the OS handed over as a file (not a link or an invite). */
export const isOpenedFileUrl = (url: string) => /^(file|content):\/\//i.test(url);

const base64ToBytes = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const fileNameOf = (url: string) => {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return /\.(musicxml|mxl|xml)$/i.test(last) ? last : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Reads a file the OS opened with the app. Resolves the chart, or null when
 * the file is not a MusicXML score with chords (it is then ignored).
 */
export async function receiveChartFile(url: string): Promise<SongChart | null> {
  if (!Capacitor.isNativePlatform() || !isOpenedFileUrl(url)) return null;
  try {
    const { Filesystem } = await import('@capacitor/filesystem');
    const { data } = await Filesystem.readFile({ path: url });
    const bytes = typeof data === 'string' ? base64ToBytes(data) : new Uint8Array(await data.arrayBuffer());
    const chart = await readMusicXml(bytes, fileNameOf(url));
    setReceivedChart(chart);
    return chart;
  } catch {
    return null;
  }
}
