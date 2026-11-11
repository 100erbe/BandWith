/**
 * Genre tags on songs. Stored in `songs.genre` (VARCHAR 100) as a
 * comma-separated list, e.g. "Pop, Funk", so imports that already write a
 * single genre keep working. Used to tag songs and to filter the library
 * while building a setlist.
 */

/** "pop,  funk ,Pop" → ["Pop", "Funk"] (trimmed, title-cased, no repeats). */
export const parseGenres = (value: string | null | undefined): string[] => {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[,;/|]/)) {
    const g = normalizeGenre(raw);
    if (!g) continue;
    const k = g.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(g);
  }
  return out;
};

export const normalizeGenre = (raw: string): string =>
  raw
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 30)
    .replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

/** Tags back to the column value; undefined when there are none. Fits 100 chars. */
export const joinGenres = (tags: string[]): string | undefined => {
  const out: string[] = [];
  let len = 0;
  for (const t of tags) {
    const add = (out.length ? 2 : 0) + t.length;
    if (len + add > 100) break;
    out.push(t);
    len += add;
  }
  return out.length ? out.join(', ') : undefined;
};

/** Every genre used by these songs, sorted. */
export const genresOf = (songs: Array<{ genre?: string | null }>): string[] => {
  const map = new Map<string, string>();
  for (const s of songs) for (const g of parseGenres(s.genre)) if (!map.has(g.toLowerCase())) map.set(g.toLowerCase(), g);
  return [...map.values()].sort((a, b) => a.localeCompare(b));
};

/** True when the song has the genre (case-insensitive); no filter → true. */
export const songHasGenre = (song: { genre?: string | null }, genre: string | null | undefined): boolean =>
  !genre || parseGenres(song.genre).some((g) => g.toLowerCase() === genre.toLowerCase());

/** Seconds → "1 h 35 min" / "45 min" / "0 min" (setlist and repertoire totals). */
export const formatHoursMinutes = (seconds: number | null | undefined): string => {
  const total = Math.max(0, Math.round((seconds || 0) / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};
