import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { saveSetlistOrder } from '@/lib/services/songs';
import { useStageBle } from './useStageBle';
import {
  applyOrder,
  indexOf,
  isNewer,
  moveItem,
  parseStageState,
  reorderRows,
  sameOrder,
  stageTopic,
  type StageLiveState,
} from '@/lib/stageLive';

/** A setlist song as Stage mode gets it (setlist_songs row id, song id, set). */
export interface LiveSongRef {
  id?: string;
  songId?: string;
  setNumber?: number;
}

interface Options<T extends LiveSongRef> {
  /** Gig id; band gigs only (the channel checks band membership). */
  eventId?: string;
  setlistId?: string;
  /** Saved setlist, in saved order. */
  songs: T[];
  /** Stage mode is open: the channel only exists while it is. */
  open: boolean;
  /** Band admin: leads (their moves reach everyone) and can reorder. */
  isLeader: boolean;
}

export type StageSaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Wait after the last move before saving the order (several taps, one save). */
const SAVE_DELAY_MS = 700;

/**
 * Live Stage mode for everyone in the band ("follow the leader").
 *
 * - The admin moves to another song or reorders the setlist; their app sends
 *   the state on the gig's private channel (migration 085) and saves the new
 *   order in setlist_songs, so it also reaches apps that open later.
 * - Everyone else follows the newest state while "follow" is on. A member who
 *   steps through the songs on their own stops following until they turn it
 *   back on.
 * - Someone opening Stage mode joins the channel's presence; the leader's app
 *   then sends its state again so late arrivals catch up.
 */
export function useStageLive<T extends LiveSongRef>({ eventId, setlistId, songs, open, isLeader }: Options<T>) {
  const clientId = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const [order, setOrder] = useState<string[] | null>(null);
  const [songId, setSongId] = useState<string | null>(null);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [following, setFollowingState] = useState(true);
  const [leaderSeen, setLeaderSeen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [saveState, setSaveState] = useState<StageSaveState>('idle');

  const channelRef = useRef<RealtimeChannel | null>(null);
  /** Newest state applied or sent (Lamport clock + what it said). */
  const lastRef = useRef<StageLiveState | null>(null);
  /** Newest leader state received, kept while not following. */
  const remoteRef = useRef<StageLiveState | null>(null);
  /** This app has led (sent) at least once: only then it answers late joiners. */
  const ledRef = useRef(false);
  const followingRef = useRef(following);
  followingRef.current = following;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const live = !!eventId && open;
  const ordered = useMemo(() => applyOrder(songs, order), [songs, order]);
  const savedIds = useMemo(() => songs.map((s) => s.id).filter((id): id is string => !!id), [songs]);

  /** A leader's state from either path (Realtime or Bluetooth); the newest wins. */
  const receive = useCallback(
    (state: StageLiveState) => {
      if (state.from === clientId) return;
      // Clock moves on even for states we don't show (Lamport).
      if (!isNewer(state, lastRef.current)) return;
      lastRef.current = state;
      remoteRef.current = state;
      setLeaderSeen(true);
      // The order is the setlist's, so it applies even when not following.
      if (state.order) setOrder(state.order);
      if (followingRef.current) setSongId(state.songId);
    },
    [clientId],
  );

  // Offline on stage: the same states over Bluetooth (native apps only).
  const ble = useStageBle({ eventId, savedIds, open: live, isLeader, onState: receive });
  const blePublish = ble.publish;
  const hasIds = ordered.length > 0 && ordered.every((s) => !!s.id);
  const index = hasIds ? indexOf(ordered, songId) : Math.min(fallbackIndex, Math.max(0, ordered.length - 1));

  // The saved order caught up with the live one: drop the override.
  useEffect(() => {
    if (!order) return;
    const saved = songs.map((s) => s.id ?? '');
    if (sameOrder(saved, order)) setOrder(null);
  }, [songs, order]);

  const send = useCallback(
    (next: { songId: string | null; order: string[] | null }) => {
      const seq = (lastRef.current?.seq ?? 0) + 1;
      const state: StageLiveState = { seq, from: clientId, ...next };
      lastRef.current = state;
      ledRef.current = true;
      void channelRef.current?.send({ type: 'broadcast', event: 'state', payload: state });
      blePublish(state);
    },
    [clientId, blePublish],
  );

  const applyRemote = useCallback((state: StageLiveState) => {
    if (state.order) setOrder(state.order);
    if (state.songId !== undefined) setSongId(state.songId);
  }, []);

  // The channel lives while Stage mode is open.
  useEffect(() => {
    if (!live || !eventId) return;
    const channel = supabase.channel(stageTopic(eventId), {
      config: { private: true, broadcast: { self: false }, presence: { key: clientId } },
    });
    channelRef.current = channel;
    channel
      .on('broadcast', { event: 'state' }, (msg: { payload?: unknown }) => {
        const state = parseStageState(msg?.payload);
        if (state) receive(state);
      })
      .on('presence', { event: 'join' }, (msg: { key?: string }) => {
        if (msg?.key === clientId || !ledRef.current || !lastRef.current) return;
        if (lastRef.current.from !== clientId) return;
        void channel.send({ type: 'broadcast', event: 'state', payload: lastRef.current });
      })
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          void channel.track({ lead: isLeader }).catch(() => {});
        }
      });
    return () => {
      channelRef.current = null;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [live, eventId, clientId, isLeader, receive]);

  // Closing Stage mode forgets the live state; the saved order stands.
  useEffect(() => {
    if (open) return;
    clearTimeout(saveTimer.current);
    setOrder(null);
    setSongId(null);
    setFallbackIndex(0);
    setFollowingState(true);
    setLeaderSeen(false);
    setSaveState('idle');
    lastRef.current = null;
    remoteRef.current = null;
    ledRef.current = false;
  }, [open]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  /** Make song `i` (in the live order) the current one. */
  const select = useCallback(
    (i: number) => {
      const clamped = Math.min(Math.max(0, i), Math.max(0, ordered.length - 1));
      const id = ordered[clamped]?.id ?? null;
      setFallbackIndex(clamped);
      setSongId(id);
      if (isLeader) {
        send({ songId: id, order });
      } else if (followingRef.current) {
        // Stepping on your own: stop following until turned back on.
        setFollowingState(false);
      }
    },
    [ordered, isLeader, send, order],
  );

  const go = useCallback((delta: number) => select(index + delta), [select, index]);

  const setFollowing = useCallback(
    (on: boolean) => {
      setFollowingState(on);
      const remote = remoteRef.current;
      if (on && remote) applyRemote(remote);
    },
    [applyRemote],
  );

  /** Leader: move a song in the setlist; saved shortly after the last move. */
  const move = useCallback(
    (from: number, to: number) => {
      if (!isLeader || !setlistId) return;
      const next = moveItem(ordered, from, to);
      if (next === ordered) return;
      const ids = next.map((s) => s.id).filter((id): id is string => !!id);
      if (ids.length !== next.length) return;
      setOrder(ids);
      send({ songId: songId ?? ordered[index]?.id ?? null, order: ids });
      setSaveState('saving');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const saved = songs.filter((s) => s.id && s.songId).map((s) => ({ id: s.id!, songId: s.songId!, setNumber: s.setNumber }));
        const byId = new Map(saved.map((s) => [s.id, s]));
        const inOrder = ids.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
        if (inOrder.length !== saved.length) {
          setSaveState('error');
          return;
        }
        const { error } = await saveSetlistOrder(reorderRows(setlistId, saved, inOrder));
        if (error) {
          // Back to the saved order, for everyone.
          setSaveState('error');
          setOrder(null);
          send({ songId: lastRef.current?.songId ?? null, order: saved.map((s) => s.id) });
          return;
        }
        setSaveState('saved');
      }, SAVE_DELAY_MS);
    },
    [isLeader, setlistId, ordered, send, songId, index, songs],
  );

  return {
    /** The setlist in its live order. */
    songs: ordered,
    index,
    select,
    go,
    following,
    setFollowing,
    /** A leader's state has arrived since Stage mode opened. */
    leaderSeen,
    /** The live channel is connected. */
    connected,
    /** Bluetooth link (native apps): leading, searching, connected… */
    bluetooth: ble.status,
    isLeader,
    /** Reordering needs saved rows (a band setlist with row ids). */
    canReorder: isLeader && !!setlistId && hasIds && ordered.every((s) => !!s.songId),
    move,
    saveState,
  };
}

export type StageLive<T extends LiveSongRef = LiveSongRef> = ReturnType<typeof useStageLive<T>>;
