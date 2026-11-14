/**
 * Stage mode over Bluetooth: native plumbing.
 * - StageBle: the app's own plugin, leader side (ios/App/App/StageBlePlugin.swift,
 *   android/app/src/main/java/com/bandwith/app/StageBlePlugin.java).
 * - Members use @capacitor-community/bluetooth-le (central), see useStageBle.
 * - The gig's key (migration 087) and the setlist are fetched while online and
 *   kept on the device, so Bluetooth still works when the venue has no internet.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { supabase, isDemoMode } from './supabase';
import type { SongChart } from './ireal';

export type StageBleState = 'on' | 'off' | 'unauthorized' | 'unsupported' | 'unknown';

interface StageBlePlugin {
  start(options: { serviceUuid: string; characteristicUuid: string; value: string; notify: string }): Promise<{ state: StageBleState }>;
  update(options: { value: string; notify: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: 'stateChange',
    cb: (data: { state: StageBleState; subscribers: number }) => void,
  ): Promise<PluginListenerHandle>;
}

export const StageBle = registerPlugin<StageBlePlugin>('StageBle');

/** Bluetooth sync runs only in the native apps (no demo, no web). */
export const stageBleAvailable = () => Capacitor.isNativePlatform() && !isDemoMode;

const KEY_PREFIX = 'bw-stage-key:';

const cachedKey = (eventId: string): string | null => {
  try {
    return localStorage.getItem(KEY_PREFIX + eventId);
  } catch {
    return null;
  }
};

/**
 * The gig's Bluetooth key: from the device, or fetched (and kept) when
 * online. Null for people outside the band, or offline before the first fetch.
 */
export async function stageKey(eventId: string): Promise<string | null> {
  const cached = cachedKey(eventId);
  if (cached) return cached;
  try {
    const { data, error } = await supabase.rpc('bw_stage_key', { p_event_id: eventId });
    if (error || typeof data !== 'string' || !data) return null;
    try {
      localStorage.setItem(KEY_PREFIX + eventId, data);
    } catch {
      /* kept for this session only */
    }
    return data;
  } catch {
    return null;
  }
}

/** Fetch the key ahead of the gig (event detail open), so it's there offline. */
export function prefetchStageKey(eventId?: string) {
  if (!eventId || !stageBleAvailable() || cachedKey(eventId)) return;
  void stageKey(eventId);
}

const SETLIST_PREFIX = 'bw-setlist-songs:';

/** Setlist songs as Stage mode shows them, kept on the phone (native apps only). */
export interface CachedSetlistSong {
  id?: string;
  songId?: string;
  setNumber?: number;
  title: string;
  artist?: string;
  duration?: string;
  key?: string;
  lyrics?: string;
  /** songs.chord_chart (iReal Pro import). */
  chart?: SongChart;
}

export function readCachedSetlist(setlistId: string): CachedSetlistSong[] | null {
  if (!stageBleAvailable()) return null;
  try {
    const raw = localStorage.getItem(SETLIST_PREFIX + setlistId);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedSetlist(setlistId: string, songs: CachedSetlistSong[]) {
  if (!stageBleAvailable()) return;
  try {
    if (songs.length === 0) localStorage.removeItem(SETLIST_PREFIX + setlistId);
    else localStorage.setItem(SETLIST_PREFIX + setlistId, JSON.stringify(songs));
  } catch {
    // Storage full: keep at least the songs and lyrics, without chord charts.
    try {
      localStorage.setItem(SETLIST_PREFIX + setlistId, JSON.stringify(songs.map(({ chart: _chart, ...rest }) => rest)));
    } catch {
      /* Stage mode just needs internet */
    }
  }
}

/**
 * Sign-out: the band's setlists (with lyrics and charts) and the gigs'
 * Bluetooth keys kept on this phone go too.
 */
export function clearStageCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(SETLIST_PREFIX) || k.startsWith(KEY_PREFIX))) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage not available */
  }
}
