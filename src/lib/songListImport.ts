/**
 * Parse a song list from a CSV / TSV / TXT file (Numbers, Excel "Save as CSV",
 * Google Sheets "Download → CSV", or a plain list typed in Notes).
 *
 * Supported shapes:
 *   - Header row with any of: title/song/name, artist/band, key, bpm/tempo,
 *     duration/length/time (m:ss or seconds), genre
 *   - No header: "Title - Artist", "Title – Artist", "Title, Artist", or just "Title"
 *   - Numbered lines ("1. Superstition - Stevie Wonder") and blank lines are fine
 */

export interface ParsedSong {
  title: string;
  artist?: string;
  key?: string;
  bpm?: number;
  duration?: number; // seconds
  genre?: string;
}

export const SONG_LIST_ACCEPT = '.csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values';
export const SONG_LIST_MAX_ROWS = 2000;

const HEADER_ALIASES: Record<keyof ParsedSong, string[]> = {
  title: ['title', 'song', 'song title', 'name', 'track', 'titolo', 'brano'],
  artist: ['artist', 'band', 'original artist', 'performer', 'artista'],
  key: ['key', 'tonality', 'tonalità', 'tonalita'],
  bpm: ['bpm', 'tempo'],
  duration: ['duration', 'length', 'time', 'durata'],
  genre: ['genre', 'style', 'genere'],
};

/** Split one delimited line, honouring double quotes ("a, b" stays one cell). */
const splitLine = (line: string, delim: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
};

const detectDelimiter = (lines: string[]): string | null => {
  const sample = lines.slice(0, 10);
  for (const d of ['\t', ';', ',']) {
    const counts = sample.map((l) => splitLine(l, d).length);
    if (counts.length && counts.every((c) => c > 1) && counts.every((c) => c === counts[0])) return d;
  }
  return null;
};

export const parseDuration = (raw?: string): number | undefined => {
  const v = (raw || '').trim();
  if (!v) return undefined;
  const mmss = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (mmss) {
    const [, a, b, c] = mmss;
    return c ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
  }
  const n = Number(v.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 20 ? Math.round(n * 60) : Math.round(n); // "4.5" minutes vs "270" seconds
};

const parseBpm = (raw?: string): number | undefined => {
  const n = parseInt((raw || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 30 && n <= 300 ? n : undefined;
};

const clean = (v?: string) => {
  const t = (v || '').replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** "1. Title - Artist" → { title, artist } */
const parseFreeLine = (line: string): ParsedSong | null => {
  const text = line.replace(/^\s*\d{1,4}[.)\-:]\s+/, '').trim();
  if (!text) return null;
  const dash = text.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) return { title: dash[0].trim(), artist: clean(dash.slice(1).join(' - ')) };
  return { title: text };
};

export const parseSongList = (input: string): ParsedSong[] => {
  const lines = input
    .replace(/^﻿/, '')
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delim = detectDelimiter(lines);
  const seen = new Set<string>();
  const out: ParsedSong[] = [];
  const push = (song: ParsedSong | null) => {
    if (!song) return;
    const title = clean(song.title);
    if (!title || title.length > 200) return;
    const id = `${title.toLowerCase()}|${(song.artist || '').toLowerCase()}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ ...song, title });
  };

  if (delim) {
    const header = splitLine(lines[0], delim).map((h) => h.toLowerCase());
    const col: Partial<Record<keyof ParsedSong, number>> = {};
    (Object.keys(HEADER_ALIASES) as (keyof ParsedSong)[]).forEach((field) => {
      const idx = header.findIndex((h) => HEADER_ALIASES[field].includes(h));
      if (idx >= 0) col[field] = idx;
    });
    const hasHeader = col.title !== undefined;
    const rows = hasHeader ? lines.slice(1) : lines;
    for (const line of rows) {
      if (out.length >= SONG_LIST_MAX_ROWS) break;
      const cells = splitLine(line, delim);
      if (hasHeader) {
        const at = (f: keyof ParsedSong) => (col[f] !== undefined ? cells[col[f]!] : undefined);
        push({
          title: at('title') || '',
          artist: clean(at('artist')),
          key: clean(at('key')),
          bpm: parseBpm(at('bpm')),
          duration: parseDuration(at('duration')),
          genre: clean(at('genre')),
        });
      } else {
        // No header: first column title, second artist.
        push({ title: cells[0] || '', artist: clean(cells[1]) });
      }
    }
    return out;
  }

  for (const line of lines) {
    if (out.length >= SONG_LIST_MAX_ROWS) break;
    push(parseFreeLine(line));
  }
  return out;
};
