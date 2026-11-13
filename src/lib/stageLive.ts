/**
 * Stage mode live sync ("follow the leader"), the parts without React or
 * Supabase so they can be tested.
 *
 * The band admin's app sends a StageLiveState on the gig's private Realtime
 * channel (migration 085) whenever they move to another song or reorder the
 * setlist. Every other app in Stage mode applies the newest state. "Newest"
 * is a Lamport clock (`seq`), not wall time, so two phones with different
 * clocks still agree; ties go to the larger sender id.
 */

/** Realtime topic of a gig's Stage mode channel (see migration 085). */
export const stageTopic = (eventId: string) => `stage:event:${eventId}`;

export interface StageLiveState {
  /** Lamport clock: one more than the highest seq the sender had seen. */
  seq: number;
  /** Random id of the sending app (one per Stage mode session). */
  from: string;
  /** setlist_songs row id of the current song, or null before the first song. */
  songId: string | null;
  /** Live order of setlist_songs row ids, or null when the saved order stands. */
  order: string[] | null;
}

/** True when `next` should replace `current` (it is newer). */
export const isNewer = (next: Pick<StageLiveState, 'seq' | 'from'>, current: Pick<StageLiveState, 'seq' | 'from'> | null) =>
  !current || next.seq > current.seq || (next.seq === current.seq && next.from > current.from);

/** Checks a broadcast payload; anything malformed is dropped. */
export const parseStageState = (payload: unknown): StageLiveState | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.seq !== 'number' || !Number.isFinite(p.seq) || p.seq < 0) return null;
  if (typeof p.from !== 'string' || !p.from) return null;
  if (p.songId !== null && typeof p.songId !== 'string') return null;
  if (p.order !== null && !(Array.isArray(p.order) && p.order.length <= 500 && p.order.every((x) => typeof x === 'string'))) {
    return null;
  }
  return { seq: p.seq, from: p.from, songId: (p.songId as string | null) ?? null, order: (p.order as string[] | null) ?? null };
};

/**
 * `songs` in the live `order`: songs named in the order come first, in that
 * order; songs it doesn't know (added since) keep their saved place after them.
 */
export function applyOrder<T extends { id?: string }>(songs: T[], order: string[] | null): T[] {
  if (!order || order.length === 0) return songs;
  const byId = new Map<string, T>();
  songs.forEach((s) => s.id && byId.set(s.id, s));
  const out: T[] = [];
  const used = new Set<string>();
  for (const id of order) {
    const s = byId.get(id);
    if (s && !used.has(id)) {
      out.push(s);
      used.add(id);
    }
  }
  songs.forEach((s) => {
    if (!s.id || !used.has(s.id)) out.push(s);
  });
  return out;
}

/** Same ids in the same order. */
export const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** `list` with the item at `from` moved to `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export interface SetlistRowRef {
  id: string;
  songId: string;
  setNumber?: number;
}

/**
 * setlist_songs rows to save for a new order. Positions run 1..n across the
 * whole setlist (as replaceSetlistSongs writes them) and each slot keeps its
 * set number, so sets keep their size when a song moves across them (as in
 * the setlist editor). `saved` is the setlist in its saved order.
 */
export function reorderRows(setlistId: string, saved: SetlistRowRef[], ordered: SetlistRowRef[]) {
  const slotSets = saved.map((s) => s.setNumber ?? 1);
  return ordered.map((s, i) => ({
    id: s.id,
    setlist_id: setlistId,
    song_id: s.songId,
    position: i + 1,
    set_number: slotSets[i] ?? s.setNumber ?? 1,
  }));
}

/** Index of the current song, falling back to the first song. */
export const indexOf = (songs: { id?: string }[], songId: string | null) => {
  if (!songId) return 0;
  const i = songs.findIndex((s) => s.id === songId);
  return i < 0 ? 0 : i;
};
