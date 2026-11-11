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

let presenceChannel: RealtimeChannel | null = null;
let activeUserId: string | null = null;
let lifecycleBound = false;
let inForeground = true;

/** Rebuild the online set from the channel's full presence state. */
function syncFromState(channel: RealtimeChannel) {
  const state = channel.presenceState();
  globalOnlineUserIds.clear();
  Object.keys(state).forEach((key) => globalOnlineUserIds.add(key));
  notifyListeners();
}

function track(channel: RealtimeChannel, userId: string) {
  return channel
    .track({ user_id: userId, online_at: new Date().toISOString() })
    .catch(() => {});
}

function openChannel(userId: string) {
  const channel = supabase.channel('bandwith-presence', {
    config: { presence: { key: userId } },
  });

  channel
    // join/leave also rebuild from the full state: a user with two devices
    // stays online when only one of them leaves.
    .on('presence', { event: 'sync' }, () => syncFromState(channel))
    .on('presence', { event: 'join' }, () => syncFromState(channel))
    .on('presence', { event: 'leave' }, () => syncFromState(channel))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && inForeground) {
        void track(channel, userId);
      }
    });

  presenceChannel = channel;
}

let backgroundedAt = 0;
/** Re-tracks us every 30 s in the foreground: a frame that never left (e.g.
 *  sent while iOS suspended the app) can't leave us shown offline for long. */
let keepAlive: ReturnType<typeof setInterval> | null = null;

function startKeepAlive() {
  if (keepAlive) return;
  keepAlive = setInterval(() => {
    const ch = presenceChannel;
    if (inForeground && activeUserId && ch && ch.state === 'joined') void track(ch, activeUserId);
  }, 30_000);
}

function stopKeepAlive() {
  if (keepAlive) clearInterval(keepAlive);
  keepAlive = null;
}

/**
 * Back in the foreground: show ourselves online right away. After a real stay
 * in the background the socket may look connected but be dead (iOS suspends
 * the app), so the channel is rebuilt from scratch: reconnect if needed, join
 * again and track on SUBSCRIBED. A short blip just re-tracks.
 */
function onForeground() {
  if (inForeground) return; // visibilitychange and appStateChange both fire
  inForeground = true;
  const userId = activeUserId;
  const channel = presenceChannel;
  if (!userId || !channel) return;
  startKeepAlive();

  // The demo client has no realtime socket.
  const realtime = (supabase as { realtime?: typeof supabase.realtime }).realtime;
  const away = Date.now() - backgroundedAt;
  if (realtime && (away > 5_000 || !realtime.isConnected())) {
    presenceChannel = null;
    supabase
      .removeChannel(channel)
      .catch(() => {})
      .finally(() => {
        if (activeUserId !== userId || presenceChannel) return;
        if (!realtime.isConnected()) realtime.connect();
        openChannel(userId);
      });
    return;
  }
  if (channel.state === 'joined') void track(channel, userId);
}

/** Going to the background: drop our presence now instead of on socket timeout. */
function onBackground() {
  if (!inForeground) return;
  inForeground = false;
  backgroundedAt = Date.now();
  stopKeepAlive();
  if (presenceChannel) void presenceChannel.untrack().catch(() => {});
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
  if (!userId || (presenceChannel && activeUserId === userId)) {
    return;
  }

  activeUserId = userId;
  inForeground = typeof document === 'undefined' || document.visibilityState !== 'hidden';

  const open = () => {
    if (activeUserId !== userId) return;
    try {
      bindLifecycle();
      openChannel(userId);
      if (inForeground) startKeepAlive();
    } catch (err) {
      console.warn('[Presence] Realtime presence unavailable:', err);
    }
  };

  // Switching users: the topic is shared, so the old channel must be gone
  // before supabase.channel() would hand it back instead of a fresh one.
  const previous = presenceChannel;
  if (previous) {
    presenceChannel = null;
    supabase.removeChannel(previous).catch(() => {}).finally(open);
  } else {
    open();
  }
}

export function cleanupPresence() {
  stopKeepAlive();
  activeUserId = null;
  if (presenceChannel) {
    void presenceChannel.untrack().catch(() => {});
    void supabase.removeChannel(presenceChannel);
    presenceChannel = null;
    activeUserId = null;
    globalOnlineUserIds.clear();
    notifyListeners();
  }
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
