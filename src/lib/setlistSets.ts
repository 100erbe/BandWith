/**
 * A saved setlist (setlist_songs rows) as the gig wizard edits it: one entry
 * per set, songs in their saved order.
 */

export interface WizardSetSong {
  uid: string;
  title: string;
  artist: string;
  songId: string;
}

export interface WizardSet {
  uid: string;
  title: string;
  songs: WizardSetSong[];
}

export interface SavedSetlistSong {
  song_id: string;
  set_number?: number | null;
  position?: number | null;
  song?: { title?: string | null; artist?: string | null } | null;
}

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${(seq += 1)}-${Math.random().toString(36).slice(2, 7)}`;

/** Groups the rows by set (1, 2, …) and keeps each set's saved order. */
export function setsFromSetlistSongs(rows: SavedSetlistSong[], setTitle: (n: number) => string): WizardSet[] {
  const bySet = new Map<number, SavedSetlistSong[]>();
  for (const row of rows) {
    if (!row?.song_id) continue;
    const n = row.set_number && row.set_number >= 1 ? Math.floor(row.set_number) : 1;
    if (!bySet.has(n)) bySet.set(n, []);
    bySet.get(n)!.push(row);
  }
  return [...bySet.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, songs]) => ({
      uid: uid(`set-${n}`),
      title: setTitle(n),
      songs: [...songs]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((s) => ({
          uid: uid('song'),
          title: s.song?.title || 'Untitled',
          artist: s.song?.artist || '',
          songId: s.song_id,
        })),
    }));
}

/** Songs across all sets. */
export function setSongCount(sets: { songs?: unknown[] }[]): number {
  return sets.reduce((n, s) => n + (s.songs?.length ?? 0), 0);
}

/** Takes the given songs out of every set (sets themselves stay). */
export function removeSongsFromSets<T extends { songs?: { songId?: string }[] }>(sets: T[], songIds: string[]): T[] {
  if (songIds.length === 0) return sets;
  const drop = new Set(songIds);
  return sets.map((s) => ({ ...s, songs: (s.songs || []).filter((sg) => !sg.songId || !drop.has(sg.songId)) }));
}
