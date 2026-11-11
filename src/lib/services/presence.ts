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

/**
 * Back in the foreground: show ourselves online right away. If the socket died
 * in the background, reconnect now instead of waiting for the backoff timer;
 * the channel rejoins on open and the subscribe callback tracks us again.
 */
function onForeground() {
  inForeground = true;
  const userId = activeUserId;
  const channel = presenceChannel;
  if (!userId || !channel) return;

  // The demo client has no realtime socket.
  const realtime = (supabase as { realtime?: typeof supabase.realtime }).realtime;
  if (realtime && !realtime.isConnected()) {
    realtime.connect();
    return;
  }
  if (channel.state === 'joined') void track(channel, userId);
}

/** Going to the background: drop our presence now instead of on socket timeout. */
function onBackground() {
  inForeground = false;
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
  if (presenceChannel) {
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
