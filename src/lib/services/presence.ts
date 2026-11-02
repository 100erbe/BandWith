import { useEffect, useState, useRef } from 'react';
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

export function initPresence(userId: string) {
  if (!userId || (presenceChannel && activeUserId === userId)) {
    return;
  }

  // Cleanup old channel if switching users
  if (presenceChannel) {
    presenceChannel.unsubscribe();
    presenceChannel = null;
  }

  activeUserId = userId;

  try {
    const channel = supabase.channel('bandwith-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        globalOnlineUserIds.clear();
        Object.keys(state).forEach((key) => {
          globalOnlineUserIds.add(key);
        });
        notifyListeners();
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key) {
          globalOnlineUserIds.add(key);
          notifyListeners();
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key) {
          globalOnlineUserIds.delete(key);
          notifyListeners();
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    presenceChannel = channel;
  } catch (err) {
    console.warn('[Presence] Realtime presence unavailable:', err);
  }
}

export function cleanupPresence() {
  if (presenceChannel) {
    presenceChannel.unsubscribe();
    presenceChannel = null;
    activeUserId = null;
    globalOnlineUserIds.clear();
    notifyListeners();
  }
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
