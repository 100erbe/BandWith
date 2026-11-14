import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '../supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Global cache of online user IDs so components can read synchronously if needed
const globalOnlineUserIds = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();

function notifyListeners() {
  const copy = new Set(globalOnlineUserIds);
  listeners.forEach((listener) => listener(copy));
}

/**
 * One private channel per band ("presence:band:<id>", migration 071): only
 * the band's active members can join it and see who is online (PR-44).
 * The online set is the union of all of the user's bands.
 */
const channels = new Map<string, RealtimeChannel>();
let activeUserId: string | null = null;
let lifecycleBound = false;
let inForeground = true;
/** Bumped on every init/cleanup so late async work from an old run stops. */
let generation = 0;

/** Rebuild the online set from every band channel's full presence state. */
function syncFromState() {
  globalOnlineUserIds.clear();
  channels.forEach((channel) => {
    Object.keys(channel.presenceState()).forEach((key) => globalOnlineUserIds.add(key));
  });
  notifyListeners();
}

function track(channel: RealtimeChannel, userId: string) {
  return channel
    .track({ user_id: userId, online_at: new Date().toISOString() })
    .catch(() => {});
}

function openChannel(bandId: string, userId: string) {
  // One channel per band: supabase.channel() would hand back the joined one.
  if (channels.has(bandId)) return;
  const channel = supabase.channel(`presence:band:${bandId}`, {
    config: { private: true, presence: { key: userId } },
  });

  channel
    // join/leave also rebuild from the full state: a user with two devices
    // stays online when only one of them leaves.
    .on('presence', { event: 'sync' }, syncFromState)
    .on('presence', { event: 'join' }, syncFromState)
    .on('presence', { event: 'leave' }, syncFromState)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && inForeground) {
        void track(channel, userId);
      }
    });

  channels.set(bandId, channel);
}

async function myBandIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('band_members')
    .select('band_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) return [];
  return [...new Set((data || []).map((r: { band_id: string }) => r.band_id).filter(Boolean))];
}

async function closeAll() {
  const old = [...channels.values()];
  channels.clear();
  await Promise.all(old.map((ch) => supabase.removeChannel(ch).catch(() => {})));
}

async function openAll(userId: string, gen: number) {
  const bandIds = await myBandIds(userId);
  if (gen !== generation || activeUserId !== userId) return;
  bandIds.forEach((id) => openChannel(id, userId));
}

let backgroundedAt = 0;

/**
 * Back in the foreground: show ourselves online right away. After a real stay
 * in the background the socket may look connected but be dead (iOS suspends
 * the app), so the channels are rebuilt from scratch: reconnect if needed,
 * join again and track on SUBSCRIBED. A short blip just re-tracks. Nothing
 * is re-sent while the state does not change (no keep-alive timer).
 */
function onForeground() {
  if (inForeground) return; // visibilitychange and appStateChange both fire
  inForeground = true;
  const userId = activeUserId;
  if (!userId) return;

  // The demo client has no realtime socket.
  const realtime = (supabase as { realtime?: typeof supabase.realtime }).realtime;
  const away = Date.now() - backgroundedAt;
  if (realtime && (away > 5_000 || !realtime.isConnected())) {
    const gen = ++generation;
    void closeAll().finally(() => {
      if (gen !== generation || activeUserId !== userId) return;
      if (!realtime.isConnected()) realtime.connect();
      void openAll(userId, gen);
    });
    return;
  }
  channels.forEach((ch) => {
    if (ch.state === 'joined') void track(ch, userId);
  });
}

/** Going to the background: drop our presence now instead of on socket timeout. */
function onBackground() {
  if (!inForeground) return;
  inForeground = false;
  backgroundedAt = Date.now();
  channels.forEach((ch) => void ch.untrack().catch(() => {}));
}

function bindLifecycle() {
  if (lifecycleBound || typeof document === 'undefined') return;
  lifecycleBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onForeground();
    else onBackground();
  });

  if (Capacitor.isNativePlatform()) {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) onForeground();
      else onBackground();
    }).catch(() => {});
  }
}

export function initPresence(userId: string) {
  if (!userId || (activeUserId === userId && channels.size > 0)) {
    return;
  }

  activeUserId = userId;
  inForeground = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const gen = ++generation;

  // Switching users: the old channels must be gone first, or
  // supabase.channel() would hand them back instead of fresh ones.
  void closeAll().finally(() => {
    if (gen !== generation || activeUserId !== userId) return;
    try {
      bindLifecycle();
      void openAll(userId, gen);
    } catch (err) {
      console.warn('[Presence] Realtime presence unavailable:', err);
    }
  });
}

/**
 * The user joined a band mid-session: open its channel so its members show
 * online (and see us) without waiting for a resume or a restart.
 */
export function refreshPresenceBands() {
  const userId = activeUserId;
  if (!userId) return;
  const gen = generation;
  void myBandIds(userId).then((bandIds) => {
    if (gen !== generation || activeUserId !== userId) return;
    bandIds.forEach((id) => openChannel(id, userId));
  });
}

export function cleanupPresence() {
  generation += 1;
  activeUserId = null;
  channels.forEach((ch) => void ch.untrack().catch(() => {}));
  void closeAll();
  globalOnlineUserIds.clear();
  notifyListeners();
}

/** True once our own presence is in the synced state, i.e. the set is trustworthy. */
export function isPresenceSynced(userId?: string | null): boolean {
  return !!userId && globalOnlineUserIds.has(userId);
}

/**
 * Hook to track online users in real-time across the app
 */
export function useOnlinePresence(userId?: string): Set<string> {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set(globalOnlineUserIds)
  );

  useEffect(() => {
    if (!userId) return;

    initPresence(userId);

    const listener = (ids: Set<string>) => {
      setOnlineUserIds(ids);
    };

    listeners.add(listener);
    // Sync current state immediately
    setOnlineUserIds(new Set(globalOnlineUserIds));

    return () => {
      listeners.delete(listener);
    };
  }, [userId]);

  return onlineUserIds;
}
