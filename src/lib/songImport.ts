/**
 * Lyrics (and chords) the musician brings in for the band's private use:
 * pasted text, ChordPro files (.cho / .chordpro / .pro / .crd), plain text
 * (.txt) and MusicXML scores with lyrics (see musicxml.ts).
 *
 * Everything becomes the text stored in `songs.lyrics` (src/lib/lyrics.ts):
 * `# Section` headers, blank lines between stanzas and ChordPro-style inline
 * chords (`[Am]words`). Nothing is ever looked up on a site or an API.
 */
import { keyLabel, type SongChart } from './ireal';
import { isChordToken } from './lyrics';
import { parseMusicXmlSong } from './musicxml';

export interface ImportedSong {
  /** Lyrics in the app's format, or undefined when the source has none. */
  lyrics?: string;
  /** Bar-by-bar chord chart (MusicXML only). */
  chart?: SongChart;
  title?: string;
  artist?: string;
  key?: string;
  bpm?: number;
}

export type SongFileError = 'unsupported' | 'empty' | 'not-musicxml' | 'no-chords' | 'too-large';

const MAX_LYRICS = 20000;

/** Section names used when a format names none ("Verse", "Chorus"…), in the user's language. */
export interface SectionNames {
  verse: string;
  chorus: string;
  bridge: string;
}

const clean = (s: string) => s.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');

/** Tidy the result: no runs of blank lines, nothing past the size limit. */
const finish = (lines: string[]) =>
  lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_LYRICS);

// ── Chords over lyrics (plain text, as pasted from songbooks) ──

const words = (line: string) => line.trim().split(/\s+/).filter(Boolean);

/** "Am   G/B  C" or "| Am | G |": a line of chords only. */
const isChordLine = (line: string) => {
  const w = words(line.replace(/[|]/g, ' '));
  return w.length > 0 && w.every((x) => isChordToken(x));
};

/** "♪ [Am] [G]": a line of chords with no words under it (a lone "[Am]" would read as a section). */
const chordOnly = (line: string) => `♪ ${words(line.replace(/[|]/g, ' ')).map((c) => `[${c}]`).join(' ')}`;

/** Put the chords of `chordLine` into `lyric` at their columns: "[Am]Hello [G]world". */
const mergeChords = (chordLine: string, lyric: string) => {
  const marks: { col: number; chord: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordLine))) if (m[0] !== '|') marks.push({ col: m.index, chord: m[0] });
  let out = '';
  let pos = 0;
  const padded = lyric.padEnd(Math.max(...marks.map((x) => x.col)), ' ');
  for (const { col, chord } of marks) {
    out += padded.slice(pos, col) + `[${chord}]`;
    pos = col;
  }
  return (out + padded.slice(pos)).replace(/\s+$/, '');
};

const HEADER_RE = /^\s*\[?\s*((?:intro|verse|chorus|pre-?chorus|bridge|outro|solo|interlude|refrain|strofa|ritornello|coro|estribillo|couplet|refrain|strophe|vers|ponte)\b[^\]:]{0,24})\s*\]?\s*:?\s*$/i;

/** Plain text → the app's lyrics: chords-above-words lines become inline chords, "Chorus:" becomes a section. */
export function textToLyrics(text: string): string {
  const lines = clean(text).split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');
    const header = line.match(HEADER_RE);
    if (header && !isChordLine(line)) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(`# ${header[1].trim()}`);
      continue;
    }
    if (line && isChordLine(line)) {
      const next = (lines[i + 1] ?? '').replace(/\s+$/, '');
      if (next.trim() && !isChordLine(next) && !HEADER_RE.test(next)) {
        out.push(mergeChords(line, next));
        i++;
      } else out.push(chordOnly(line));
      continue;
    }
    out.push(line);
  }
  return finish(out);
}

// ── ChordPro ──

const DIRECTIVE_RE = /^\s*\{\s*([a-z_]+)\s*(?::\s*([\s\S]*?))?\s*\}\s*$/i;

/** A ChordPro file → lyrics with inline chords, plus title, artist and key. */
export function parseChordPro(text: string, names: SectionNames): ImportedSong {
  const out: string[] = [];
  const song: ImportedSong = {};
  let verses = 0;
  let inTab = false;
  const section = (name: string) => {
    if (out.length && out[out.length - 1] !== '') out.push('');
    out.push(`# ${name}`);
  };
  for (const raw of clean(text).split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const d = line.match(DIRECTIVE_RE);
    if (d) {
      const name = d[1].toLowerCase();
      const arg = (d[2] || '').trim();
      switch (name) {
        case 'title':
        case 't':
          song.title = song.title || arg || undefined;
          break;
        case 'artist':
        case 'subtitle':
        case 'st':
        case 'composer':
          song.artist = song.artist || arg || undefined;
          break;
        case 'key':
          song.key = song.key || arg || undefined;
          break;
        case 'tempo': {
          const n = parseInt(arg, 10);
          if (n > 0) song.bpm = song.bpm || n;
          break;
        }
        case 'start_of_chorus':
        case 'soc':
          section(arg || names.chorus);
          break;
        case 'start_of_verse':
        case 'sov':
          verses++;
          section(arg || `${names.verse} ${verses}`);
          break;
        case 'start_of_bridge':
        case 'sob':
          section(arg || names.bridge);
          break;
        case 'start_of_tab':
        case 'sot':
          inTab = true;
          break;
        case 'end_of_tab':
        case 'eot':
          inTab = false;
          break;
        case 'chorus':
          // "Repeat the chorus".
          section(arg || names.chorus);
          out.push(`*(${names.chorus})*`);
          break;
        case 'comment':
        case 'c':
        case 'comment_italic':
        case 'ci':
        case 'highlight':
          if (arg) out.push(`*${arg}*`);
          break;
        case 'end_of_chorus':
        case 'eoc':
        case 'end_of_verse':
        case 'eov':
        case 'end_of_bridge':
        case 'eob':
          if (out.length && out[out.length - 1] !== '') out.push('');
          break;
        // Other directives (capo, columns, fonts, images…) are layout only.
      }
      continue;
    }
    if (inTab) continue;
    // ChordPro comment lines; a "#" line would otherwise read as a section.
    if (/^\s*#/.test(line)) continue;
    const trimmed = line.trim();
    // A line of chords only, e.g. an intro: "[Am] [G]".
    if (trimmed && /^(\[[^\]]+\]\s*)+$/.test(trimmed)) {
      const chords = [...trimmed.matchAll(/\[([^\]]+)\]/g)].map((x) => x[1].trim());
      if (chords.every(isChordToken)) {
        out.push(`♪ ${chords.map((c) => `[${c}]`).join(' ')}`);
        continue;
      }
    }
    out.push(line);
  }
  const lyrics = finish(out);
  return { ...song, ...(lyrics ? { lyrics } : {}) };
}

const looksLikeChordPro = (text: string) => /^\s*\{\s*(title|t|soc|start_of_chorus|sov|start_of_verse|artist|key)\b/im.test(text);

// ── Files ──

export const SONG_FILE_ACCEPT = '.musicxml,.mxl,.xml,.cho,.chordpro,.chopro,.pro,.crd,.txt,text/plain,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml';

const ext = (name: string) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();

/** A picked file → lyrics and/or a chord chart. Throws a SongFileError code. */
export async function readSongFile(bytes: Uint8Array, fileName: string, names: SectionNames): Promise<ImportedSong> {
  const e = ext(fileName);
  if (['musicxml', 'mxl', 'xml'].includes(e)) {
    const { chart, lyrics, title, composer } = await parseMusicXmlSong(bytes, fileName, names);
    return {
      ...(chart ? { chart, key: keyLabel(chart.key), bpm: chart.bpm } : {}),
      ...(lyrics ? { lyrics: lyrics.slice(0, MAX_LYRICS) } : {}),
      ...(title ? { title } : {}),
      ...(composer ? { artist: composer } : {}),
    };
  }
  if (!['cho', 'chordpro', 'chopro', 'pro', 'crd', 'txt', 'text', ''].includes(e)) throw new Error('unsupported');
  if (bytes.length > 1024 * 1024) throw new Error('too-large');
  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) throw new Error('empty');
  const song = e === 'txt' || e === 'text' ? (looksLikeChordPro(text) ? parseChordPro(text, names) : { lyrics: textToLyrics(text) }) : parseChordPro(text, names);
  if (!song.lyrics) throw new Error('empty');
  return song;
}

/** Pasted text: ChordPro when it looks like it, otherwise plain lyrics (chords above words become inline). */
export function pastedLyrics(text: string, names: SectionNames): ImportedSong {
  if (looksLikeChordPro(text)) return parseChordPro(text, names);
  const lyrics = textToLyrics(text);
  return lyrics ? { lyrics } : {};
}
