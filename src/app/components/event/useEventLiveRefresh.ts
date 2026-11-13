import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Options {
  eventId?: string;
  setlistId?: string;
  /** Personal gigs and offline drafts have nothing to listen to. */
  disabled?: boolean;
  onMembers: () => void;
  onTasks: () => void;
  onSetlist: () => void;
}

/** Changes arriving together (a save rewrites many rows) cause one reload. */
const SETTLE_MS = 300;

/**
 * Reloads the parts of an open event detail when someone changes them:
 * lineup (event_members), to-dos (rehearsal_tasks) and setlist
 * (setlist_songs, setlists). Changes to the event row itself reach the
 * detail through the events list. Realtime only sends rows this user may
 * read; deleted rows can't be filtered, so any delete in those tables causes
 * a reload.
 */
export function useEventLiveRefresh({ eventId, setlistId, disabled, onMembers, onTasks, onSetlist }: Options) {
  const handlers = useRef({ onMembers, onTasks, onSetlist });
  handlers.current = { onMembers, onTasks, onSetlist };

  useEffect(() => {
    if (!eventId || disabled) return;
    const timers: Partial<Record<keyof typeof handlers.current, ReturnType<typeof setTimeout>>> = {};
    const later = (key: keyof typeof handlers.current) => () => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => handlers.current[key](), SETTLE_MS);
    };
    const reloadMembers = later('onMembers');
    const reloadTasks = later('onTasks');
    const reloadSetlist = later('onSetlist');

    const name = `event-live-${eventId}-${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_members', filter: `event_id=eq.${eventId}` }, reloadMembers)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_members', filter: `event_id=eq.${eventId}` }, reloadMembers)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_members' }, reloadMembers)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rehearsal_tasks', filter: `event_id=eq.${eventId}` }, reloadTasks)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rehearsal_tasks', filter: `event_id=eq.${eventId}` }, reloadTasks)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rehearsal_tasks' }, reloadTasks);
    if (setlistId) {
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'setlist_songs', filter: `setlist_id=eq.${setlistId}` }, reloadSetlist)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'setlist_songs', filter: `setlist_id=eq.${setlistId}` }, reloadSetlist)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'setlist_songs' }, reloadSetlist)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'setlists', filter: `id=eq.${setlistId}` }, reloadSetlist);
    }
    channel.subscribe();

    return () => {
      Object.values(timers).forEach((id) => clearTimeout(id));
      supabase.removeChannel(channel);
    };
  }, [eventId, setlistId, disabled]);
}
