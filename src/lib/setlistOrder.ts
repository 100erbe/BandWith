/**
 * Play order of a gig setlist while the admin reorders it (gig wizard and
 * Edit event). Songs move inside their own set; the play number (01, 02, …)
 * runs across all sets, the same numbering the gig detail and Stage mode
 * show. The order is saved with the gig (persistSetlist writes each song's
 * `position` from this array order), so no extra column is involved.
 */

/** Same list with the item at `from` moved to `to` (indices clamped). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** Moves the song with `activeUid` to where `overUid` is (drag and drop). */
export function moveSongTo<T extends { uid: string }>(songs: T[], activeUid: string, overUid: string): T[] {
  const from = songs.findIndex((s) => s.uid === activeUid);
  const to = songs.findIndex((s) => s.uid === overUid);
  if (from < 0 || to < 0) return songs;
  return moveItem(songs, from, to);
}

/** Moves a song one step up (-1) or down (+1); unchanged at either end. */
export function moveSongBy<T extends { uid: string }>(songs: T[], uid: string, delta: number): T[] {
  const from = songs.findIndex((s) => s.uid === uid);
  if (from < 0) return songs;
  const to = from + delta;
  if (to < 0 || to >= songs.length) return songs;
  return moveItem(songs, from, to);
}

/** Replaces one set's songs, leaving the other sets as they are. */
export function withSetSongs<S extends { uid: string; songs?: unknown[] }>(sets: S[], setUid: string, songs: S['songs']): S[] {
  return sets.map((s) => (s.uid === setUid ? { ...s, songs } : s));
}

/** First play number of each set: songs are numbered across sets (1-based). */
export function setStartNumbers(sets: { songs?: unknown[] }[]): number[] {
  const starts: number[] = [];
  let n = 1;
  for (const s of sets) {
    starts.push(n);
    n += s.songs?.length ?? 0;
  }
  return starts;
}

/** "01", "02", … "10", "100": two digits at least. */
export const playNumber = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

/**
 * Order to show while a song is being dragged: the song already sits where
 * it would land, so the numbers read as they will after the drop.
 */
export function projectedOrder(uids: string[], activeUid: string | null, overUid: string | null): string[] {
  if (!activeUid || !overUid || activeUid === overUid) return uids;
  const from = uids.indexOf(activeUid);
  const to = uids.indexOf(overUid);
  if (from < 0 || to < 0) return uids;
  return moveItem(uids, from, to);
}
