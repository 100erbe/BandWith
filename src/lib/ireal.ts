/**
 * iReal Pro chord charts (`irealb://` / `irealbook://` links, as shared on the
 * iReal Pro forums or exported from the app) → a SongChart stored in
 * `songs.chord_chart`.
 *
 * A link holds chords, sections, repeats, endings, segno/coda, style, key and
 * tempo. It never holds a melody or lyrics, and nothing here stores any.
 *
 * Format notes (community-documented):
 *   irealb://Title=Composer==Style=Key==<music>=CompStyle=BPM=Repeats===…===PlaylistName
 *   <music> starts with "1r34LbKcu7" and is scrambled in 50-character blocks.
 */

export interface ChartBar {
  /** Chord tokens in iReal spelling (C^7, A-7, Bh7, D7b9/F#), '%' = repeat the previous bar, 'N.C.' = no chord. */
  chords: string[];
  /** "{": a repeat starts here. */
  repeatStart?: boolean;
  /** "}": repeat back from the end of this bar. */
  repeatEnd?: boolean;
  /** 1st / 2nd … ending that starts on this bar. */
  ending?: number;
  /** Segno / coda signs on this bar. */
  segno?: boolean;
  coda?: boolean;
  /** Text written on the bar ("D.C. al Coda", "3x", "Fine"). */
  text?: string;
  /** Final bar line. */
  final?: boolean;
}

export interface ChartSection {
  /** "A", "B", "Intro", "Verse"… or null before the first mark. */
  label: string | null;
  bars: ChartBar[];
}

export interface SongChart {
  v: 1;
  /** Where the chart came from: an iReal Pro link, or a MusicXML file (`file` = its name). */
  source: 'ireal' | 'musicxml';
  file?: string;
  title: string;
  composer?: string;
  style?: string;
  /** iReal key: "C", "Eb", "F#-" (minor ends with "-"). */
  key?: string;
  bpm?: number;
  /** "4/4", "3/4", "12/8"… (the first one in the chart). */
  time?: string;
  sections: ChartSection[];
  /** The song's own irealb:// link, kept to re-import or open it in iReal Pro. */
  link?: string;
}

const MUSIC_PREFIX = '1r34LbKcu7';

/** Undo the 50-character block scrambling. */
const unscrambleBlock = (s: string): string => {
  const out = s.split('');
  for (let i = 0; i < 5; i++) {
    out[49 - i] = s[i];
    out[i] = s[49 - i];
  }
  for (let i = 10; i < 24; i++) {
    out[49 - i] = s[i];
    out[i] = s[49 - i];
  }
  return out.join('');
};

export const unscrambleMusic = (raw: string): string => {
  let p = raw.startsWith(MUSIC_PREFIX) ? raw.slice(MUSIC_PREFIX.length) : raw;
  let r = '';
  while (p.length > 51) {
    r += unscrambleBlock(p.slice(0, 50));
    p = p.slice(50);
  }
  r += p;
  return r.replace(/XyQ/g, '   ').replace(/LZ/g, ' |').replace(/Kcl/g, '| x');
};

/** Inverse of unscrambleMusic's block step (tests and round trips). */
export const scrambleMusic = (plain: string): string => {
  let p = plain;
  let r = '';
  while (p.length > 51) {
    r += unscrambleBlock(p.slice(0, 50));
    p = p.slice(50);
  }
  return MUSIC_PREFIX + r + p;
};

const SECTION_NAMES: Record<string, string> = { i: 'Intro', v: 'Verse', V: 'Verse' };

/** Quality, extensions and alterations after the root; "s" alone means small chords, so only "sus" is read here. */
const CHORD_RE = /^(?:[A-G][b#]?|W)(?:sus|alt|add|\^|-|h|o|\+|[#b]?\d{1,2})*(?:\/[A-G][b#]?)?/;

/** Unscrambled music → sections of bars. */
export function parseMusic(music: string): { sections: ChartSection[]; time?: string } {
  const sections: ChartSection[] = [];
  let section: ChartSection = { label: null, bars: [] };
  let bar: ChartBar = { chords: [] };
  let time: string | undefined;

  const hasContent = (b: ChartBar) =>
    b.chords.length > 0 || !!(b.ending || b.segno || b.coda || b.text || b.repeatEnd);
  const closeBar = () => {
    if (hasContent(bar)) {
      section.bars.push(bar);
      bar = { chords: [] };
    }
  };
  const closeSection = () => {
    if (section.bars.length) sections.push(section);
  };

  let i = 0;
  while (i < music.length) {
    const c = music[i];
    const rest = music.slice(i);

    if (c === '<') {
      const end = music.indexOf('>', i);
      const text = music
        .slice(i + 1, end < 0 ? undefined : end)
        .replace(/^\*\d{2}/, '')
        .trim();
      if (text) bar.text = bar.text ? `${bar.text} ${text}` : text;
      i = end < 0 ? music.length : end + 1;
      continue;
    }
    if (c === '*' && /[A-Za-z]/.test(music[i + 1] || '')) {
      const mark = music[i + 1];
      closeBar();
      const label = SECTION_NAMES[mark] ?? mark.toUpperCase();
      if (section.bars.length) {
        closeSection();
        section = { label, bars: [] };
      } else {
        section.label = label;
      }
      i += 2;
      continue;
    }
    const ts = rest.match(/^T(\d)(\d)/);
    if (ts) {
      if (!time) time = ts[1] === '1' && ts[2] === '2' ? '12/8' : `${ts[1]}/${ts[2]}`;
      i += 3;
      continue;
    }
    if (c === '{') {
      closeBar();
      bar.repeatStart = true;
      i++;
      continue;
    }
    if (c === '}') {
      bar.repeatEnd = true;
      closeBar();
      i++;
      continue;
    }
    if (c === '|' || c === '[' || c === ']') {
      closeBar();
      i++;
      continue;
    }
    if (c === 'Z') {
      if (hasContent(bar)) bar.final = true;
      else if (section.bars.length) section.bars[section.bars.length - 1].final = true;
      closeBar();
      i++;
      continue;
    }
    const ending = rest.match(/^N(\d)/);
    if (ending) {
      closeBar();
      bar.ending = Number(ending[1]) || undefined;
      i += 2;
      continue;
    }
    if (c === 'S') {
      bar.segno = true;
      i++;
      continue;
    }
    if (c === 'Q') {
      bar.coda = true;
      i++;
      continue;
    }
    if (c === 'x' || c === 'r') {
      bar.chords.push('%');
      i++;
      continue;
    }
    if (c === 'n') {
      bar.chords.push('N.C.');
      i++;
      continue;
    }
    if (c === '(') {
      // Alternate chord written small above the bar: not part of the grid.
      const end = music.indexOf(')', i);
      i = end < 0 ? music.length : end + 1;
      continue;
    }
    const chord = rest.match(CHORD_RE);
    if (chord && chord[0] !== 'W') {
      bar.chords.push(chord[0]);
      i += chord[0].length;
      continue;
    }
    // Spaces, commas, "p" (slash), "s"/"l" (size), "f" (fermata), "Y" (spacer), "U" (end), "W" alone…
    i++;
  }
  closeBar();
  closeSection();
  return { sections, time };
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Finds the first irealb:// (or irealbook://) link in pasted text. */
export const findIrealLink = (text: string): string | null => {
  const m = (text || '').match(/irealb(?:ook)?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
};

export interface IrealPlaylist {
  name: string | null;
  songs: SongChart[];
}

/** irealb:// link (one song or a whole playlist) → charts. Throws on anything else. */
export function parseIrealLink(input: string): IrealPlaylist {
  const link = findIrealLink(input);
  if (!link) throw new Error('not-ireal');
  const body = decode(link.replace(/^irealb(?:ook)?:\/\//i, ''));
  const parts = body.split('===').filter((p) => p.length > 0);
  let name: string | null = null;
  if (parts.length > 1 && !parts[parts.length - 1].includes('=')) name = parts.pop()!.trim() || null;

  const songs: SongChart[] = [];
  for (const part of parts) {
    const f = part.split('=');
    const title = (f[0] || '').trim();
    const raw = f[6] || '';
    if (!title || !raw) continue;
    const { sections, time } = parseMusic(unscrambleMusic(raw));
    if (!sections.length) continue;
    const bpm = parseInt(f[8] || '', 10);
    songs.push({
      v: 1,
      source: 'ireal',
      title,
      composer: f[1]?.trim() || undefined,
      style: f[3]?.trim() || undefined,
      key: f[4]?.trim() || undefined,
      bpm: bpm > 0 ? bpm : undefined,
      time,
      sections,
      link: `irealb://${encodeURIComponent(part)}`,
    });
  }
  if (!songs.length) throw new Error('empty');
  return { name, songs };
}

/** Keeps a stored value only if it looks like a SongChart. */
export const asSongChart = (v: unknown): SongChart | null => {
  if (!v || typeof v !== 'object') return null;
  const c = v as SongChart;
  return Array.isArray(c.sections) && typeof c.title === 'string' ? c : null;
};

// ── Display ──

const FLAT = '♭';
const SHARP = '♯';
const acc = (s: string) => s.replace(/b/g, FLAT).replace(/#/g, SHARP);

/** iReal chord token → readable label: "C^7" → "Cmaj7", "A-7" → "Am7", "Bh7" → "Bm7♭5", "Bb7/D" → "B♭7/D". */
export function chordLabel(token: string): string {
  if (token === '%' || token === 'N.C.') return token;
  const m = token.match(/^([A-G][b#]?|W)(.*?)(?:\/([A-G][b#]?))?$/);
  if (!m) return token;
  const [, root, q0, bass] = m;
  let q = q0;
  q = q.replace(/^-\^7/, 'm(maj7)').replace(/^-\^/, 'm(maj7)');
  q = q.replace(/^\^(\d+)/, 'maj$1').replace(/^\^/, 'maj7');
  q = q.replace(/^o\^7?/, 'dim(maj7)');
  q = q.replace(/^h7?/, 'm7b5').replace(/^o/, 'dim').replace(/^-/, 'm');
  const r = root === 'W' ? '' : acc(root);
  return `${r}${acc(q)}${bass ? `/${acc(bass)}` : ''}`;
}

/** iReal key → the app's key text (as in the repertoire): "Eb" → "Eb", "F#-" → "F#m". */
export const keyLabel = (key?: string): string | undefined => {
  if (!key) return undefined;
  const minor = key.endsWith('-');
  const root = minor ? key.slice(0, -1) : key;
  return /^[A-G][b#]?$/.test(root) ? `${root}${minor ? 'm' : ''}` : key;
};

export const chartBarCount = (c: SongChart) => c.sections.reduce((n, s) => n + s.bars.length, 0);
