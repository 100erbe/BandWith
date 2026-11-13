/**
 * MusicXML (.musicxml / .xml) and compressed MusicXML (.mxl) → the SongChart
 * stored in `songs.chord_chart`, the same shape as an iReal Pro link.
 *
 * iReal Pro exports a chart with Share › Export › MusicXML; other notation
 * apps export the same format. Only the chord symbols (<harmony>) and the
 * form are read: measures, rehearsal marks, repeats, endings, segno/coda,
 * time and key. Notes and melody are skipped. Lyrics (<lyric>) are read
 * only by parseMusicXmlSong, for the song's own lyrics field, when the
 * musician imports a score that has them (e.g. a MuseScore export).
 */
import { chordLabel, type ChartBar, type ChartSection, type SongChart } from './ireal';

export type MusicXmlError = 'not-musicxml' | 'no-chords' | 'too-large';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_BARS = 1500;
const MAX_TEXT = 40;

// ── .mxl (zip) ──

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

const inflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Response(data as BlobPart).body!.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** The files of a zip archive, by name (stored or deflated entries). */
export async function unzip(buf: Uint8Array): Promise<Map<string, Uint8Array>> {
  // End of central directory: the last 22 bytes, or up to 64 KB earlier with a comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not-musicxml');
  const count = u16(buf, eocd + 10);
  let p = u32(buf, eocd + 16);
  const out = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (u32(buf, p) !== 0x02014b50) throw new Error('not-musicxml');
    const method = u16(buf, p + 10);
    const size = u32(buf, p + 20);
    const nameLen = u16(buf, p + 28);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    const local = u32(buf, p + 42);
    p += 46 + nameLen + u16(buf, p + 30) + u16(buf, p + 32);
    if (name.endsWith('/')) continue;
    const start = local + 30 + u16(buf, local + 26) + u16(buf, local + 28);
    const data = buf.subarray(start, start + size);
    const file = method === 0 ? data : method === 8 ? await inflateRaw(data) : null;
    if (!file) continue;
    total += file.length;
    if (total > MAX_BYTES) throw new Error('too-large');
    out.set(name, file);
  }
  return out;
}

/** The score inside an .mxl: META-INF/container.xml names it, else the first .xml/.musicxml. */
async function mxlScore(buf: Uint8Array): Promise<string> {
  const files = await unzip(buf);
  const dec = new TextDecoder();
  const container = files.get('META-INF/container.xml');
  let path: string | null = null;
  if (container) {
    const doc = new DOMParser().parseFromString(dec.decode(container), 'application/xml');
    path = doc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path') ?? null;
  }
  const score =
    (path && files.get(path)) ||
    [...files.entries()].find(([name]) => !name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(name))?.[1];
  if (!score) throw new Error('not-musicxml');
  return dec.decode(score);
}

// ── Chords ──

const KIND: Record<string, string> = {
  major: '',
  minor: '-',
  augmented: '+',
  diminished: 'o',
  dominant: '7',
  'major-seventh': '^7',
  'minor-seventh': '-7',
  'diminished-seventh': 'o7',
  'augmented-seventh': '+7',
  'half-diminished': 'h7',
  'major-minor': '-^7',
  'major-sixth': '6',
  'minor-sixth': '-6',
  'dominant-ninth': '9',
  'major-ninth': '^9',
  'minor-ninth': '-9',
  'dominant-11th': '11',
  'major-11th': '^11',
  'minor-11th': '-11',
  'dominant-13th': '13',
  'major-13th': '^13',
  'minor-13th': '-13',
  'suspended-second': 'sus2',
  'suspended-fourth': 'sus',
  power: '5',
  pedal: '',
};

const text = (el: Element | null | undefined, tag: string) => el?.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';

const alterSign = (alter: string) => {
  const n = Math.round(Number(alter) || 0);
  return n < 0 ? 'b'.repeat(-n) : '#'.repeat(n);
};

const note = (step: string, alter: string) => (/^[A-G]$/i.test(step) ? step.toUpperCase() + alterSign(alter) : null);

/** A <harmony> → an iReal-style chord token ("C^7", "A-7", "Bb7b9/D"), "N.C." or null. */
export function harmonyToken(h: Element): string | null {
  const kindEl = h.getElementsByTagName('kind')[0];
  const kind = kindEl?.textContent?.trim() ?? '';
  if (kind === 'none') return 'N.C.';
  const root = note(text(h, 'root-step'), text(h, 'root-alter'));
  if (!root) return null;
  let q = KIND[kind] ?? '';
  for (const d of Array.from(h.getElementsByTagName('degree'))) {
    const value = text(d, 'degree-value');
    const type = text(d, 'degree-type');
    const sign = alterSign(text(d, 'degree-alter'));
    if (!/^\d{1,2}$/.test(value) || type === 'subtract') continue;
    if (type === 'add' && !sign) {
      if (value === '7' && q.startsWith('sus')) q = `7${q}`;
      else q += `add${value}`;
    } else q += `${sign}${value}`;
  }
  const bass = note(text(h, 'bass-step'), text(h, 'bass-alter'));
  return `${root}${q}${bass && bass !== root ? `/${bass}` : ''}`;
}

const MAJOR_KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_KEYS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

/** <key> → iReal key text ("Eb", "C-"). */
const keyName = (k: Element): string | undefined => {
  const fifths = Number(text(k, 'fifths'));
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) return undefined;
  return text(k, 'mode') === 'minor' ? `${MINOR_KEYS[fifths + 7]}-` : MAJOR_KEYS[fifths + 7];
};

// ── Score ──

const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s);

/** A MusicXML score (partwise) → a chord chart. Throws 'not-musicxml' or 'no-chords'. */
export function parseMusicXml(xml: string, fileName?: string): SongChart {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const score = doc.documentElement;
  if (!score || score.nodeName !== 'score-partwise' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('not-musicxml');
  }
  const parts = Array.from(score.getElementsByTagName('part'));
  const part = parts.find((p) => p.getElementsByTagName('harmony').length > 0);
  if (!part) throw new Error('no-chords');

  let time: string | undefined;
  let key: string | undefined;
  let bpm: number | undefined;
  const sections: ChartSection[] = [];
  let current: ChartSection = { label: null, bars: [] };
  let prevChords: string[] = [];

  for (const m of Array.from(part.children).filter((c) => c.nodeName === 'measure')) {
    const bar: ChartBar = { chords: [] };
    const words: string[] = [];
    let mark: string | null = null;
    for (const el of Array.from(m.getElementsByTagName('*'))) {
      switch (el.nodeName) {
        case 'harmony': {
          const tok = harmonyToken(el);
          if (tok) bar.chords.push(tok);
          break;
        }
        case 'time':
          if (!time) {
            const beats = text(el, 'beats');
            const type = text(el, 'beat-type');
            if (beats && type) time = `${beats}/${type}`;
          }
          break;
        case 'key':
          if (!key) key = keyName(el);
          break;
        case 'sound': {
          const tempo = Number(el.getAttribute('tempo'));
          if (!bpm && tempo > 0) bpm = Math.round(tempo);
          break;
        }
        case 'per-minute': {
          const tempo = Number(el.textContent);
          if (!bpm && tempo > 0) bpm = Math.round(tempo);
          break;
        }
        case 'rehearsal':
          mark = el.textContent?.trim() || mark;
          break;
        case 'words': {
          const w = el.textContent?.trim();
          if (w) words.push(w);
          break;
        }
        case 'segno':
          bar.segno = true;
          break;
        case 'coda':
          bar.coda = true;
          break;
        case 'repeat':
          if (el.getAttribute('direction') === 'forward') bar.repeatStart = true;
          if (el.getAttribute('direction') === 'backward') bar.repeatEnd = true;
          break;
        case 'ending': {
          const n = parseInt(el.getAttribute('number') || '', 10);
          if (el.getAttribute('type') === 'start' && n > 0) bar.ending = n;
          break;
        }
        case 'bar-style':
          if (el.textContent?.trim() === 'light-heavy' && el.parentElement?.getAttribute('location') !== 'left') bar.final = true;
          break;
        // <note>, <lyric> and the rest are melody: skipped.
      }
    }
    if (words.length) bar.text = clip(words.join(' '));
    // A pick-up measure with no chord is not a bar of the form.
    if (!bar.chords.length && m.getAttribute('implicit') === 'yes' && !mark) continue;
    // A bar without a chord symbol keeps the previous chord.
    if (!bar.chords.length && prevChords.length) bar.chords = ['%'];
    else if (bar.chords.length) prevChords = bar.chords;
    if (mark) {
      if (current.bars.length) sections.push(current);
      current = { label: clip(mark), bars: [] };
    }
    current.bars.push(bar);
    if (sections.reduce((n, s) => n + s.bars.length, current.bars.length) >= MAX_BARS) break;
  }
  if (current.bars.length) sections.push(current);
  if (!sections.some((s) => s.bars.some((b) => b.chords.some((c) => c !== '%')))) throw new Error('no-chords');

  const creator = Array.from(doc.getElementsByTagName('creator')).find((c) => c.getAttribute('type') === 'composer');
  const title =
    text(doc.documentElement, 'work-title') ||
    text(doc.documentElement, 'movement-title') ||
    (fileName ? fileName.replace(/\.(musicxml|mxl|xml)$/i, '') : '');
  return {
    v: 1,
    source: 'musicxml',
    ...(fileName ? { file: fileName } : {}),
    title: clip(title) || 'Untitled',
    ...(creator?.textContent?.trim() ? { composer: creator.textContent.trim() } : {}),
    ...(key ? { key } : {}),
    ...(bpm ? { bpm } : {}),
    ...(time ? { time } : {}),
    sections,
  };
}

/** A picked or shared file (.musicxml, .xml or .mxl) → a chord chart. */
export async function readMusicXml(bytes: Uint8Array, fileName?: string): Promise<SongChart> {
  if (bytes.length > MAX_BYTES) throw new Error('too-large');
  const xml = isZip(bytes) ? await mxlScore(bytes) : new TextDecoder().decode(bytes);
  return parseMusicXml(xml, fileName);
}

/** Files the "From file" import accepts, by name. */
export const isMusicXmlName = (name: string) => /\.(musicxml|mxl|xml)$/i.test(name);

// ── Lyrics ──

/** iReal chord token → the plain spelling used inside lyrics ("C^7" → "Cmaj7", "A-7" → "Am7"). */
const plainChord = (token: string) => chordLabel(token).replace(/♭/g, 'b').replace(/♯/g, '#');

/** Section names used when a score names none, in the user's language. */
export interface LyricSectionNames {
  verse: string;
}

/**
 * The lyrics of a score, with its chord symbols inline ("[Am]Hel-lo" → "[Am]Hello"):
 * verse 1 carries the chords and the rehearsal marks as sections; further
 * verses follow as their own blocks. Lines break where the score starts a
 * new system, or every 4 measures. Returns '' when the score has no lyrics.
 */
export function musicXmlLyrics(doc: Document, names: LyricSectionNames): string {
  const parts = Array.from(doc.getElementsByTagName('part'));
  const part = parts.find((p) => p.getElementsByTagName('lyric').length > 0);
  if (!part) return '';
  const measures = Array.from(part.children).filter((c) => c.nodeName === 'measure');
  const hasSystems = measures.some((m) => Array.from(m.getElementsByTagName('print')).some((p) => p.getAttribute('new-system') === 'yes' || p.getAttribute('new-page') === 'yes'));

  // verse number → lines; verse 1 also gets chords and sections.
  const verses = new Map<string, string[]>();
  const current = new Map<string, { text: string; words: boolean; chords: string[] }>();
  const lineOf = (v: string) => {
    if (!current.has(v)) current.set(v, { text: '', words: false, chords: [] });
    return current.get(v)!;
  };
  const linesOf = (v: string) => {
    if (!verses.has(v)) verses.set(v, []);
    return verses.get(v)!;
  };
  const flush = (v: string) => {
    const l = current.get(v);
    if (!l) return;
    const t = l.text.replace(/\s+/g, ' ').trim();
    if (l.words && t) linesOf(v).push(t);
    else if (l.chords.length) linesOf(v).push(`♪ ${l.chords.map((c) => `[${c}]`).join(' ')}`);
    current.delete(v);
  };
  const flushAll = () => {
    for (const v of [...current.keys()]) flush(v);
  };
  let pendingChord: string | null = null;
  let measuresInLine = 0;
  /** The waiting chord goes into verse 1 here, before the next syllable or alone. */
  const placeChord = () => {
    if (!pendingChord) return;
    const l = lineOf('1');
    l.chords.push(pendingChord);
    l.text += `[${pendingChord}]`;
    pendingChord = null;
  };

  for (const m of measures) {
    const newSystem = Array.from(m.getElementsByTagName('print')).some((p) => p.getAttribute('new-system') === 'yes' || p.getAttribute('new-page') === 'yes');
    if ((hasSystems && newSystem) || (!hasSystems && measuresInLine >= 4)) {
      placeChord();
      flushAll();
      measuresInLine = 0;
    }
    measuresInLine++;
    for (const el of Array.from(m.getElementsByTagName('*'))) {
      if (el.nodeName === 'rehearsal') {
        const mark = el.textContent?.trim();
        if (!mark) continue;
        flushAll();
        measuresInLine = 1;
        const lines = linesOf('1');
        if (lines.length) lines.push('');
        lines.push(`# ${mark.slice(0, MAX_TEXT)}`);
      } else if (el.nodeName === 'harmony') {
        const tok = harmonyToken(el);
        if (!tok) continue;
        // Two chords before a syllable: the first stands alone.
        placeChord();
        pendingChord = plainChord(tok);
      } else if (el.nodeName === 'lyric') {
        const v = el.getAttribute('number') || '1';
        const texts = Array.from(el.getElementsByTagName('text')).map((x) => x.textContent ?? '');
        if (!texts.join('').trim()) continue;
        const syllabic = el.getElementsByTagName('syllabic')[0]?.textContent?.trim() || 'single';
        if (v === '1') placeChord();
        const l = lineOf(v);
        l.text += texts.join(' ') + (syllabic === 'begin' || syllabic === 'middle' ? '' : ' ');
        l.words = true;
        if (el.getElementsByTagName('end-line').length || el.getElementsByTagName('end-paragraph').length) {
          flush(v);
          if (el.getElementsByTagName('end-paragraph').length) linesOf(v).push('');
        }
      } else if (el.nodeName === 'note' && pendingChord && !el.getElementsByTagName('lyric').length && !el.getElementsByTagName('rest').length) {
        // A chord on a note without words (a held note, an instrumental bar).
        placeChord();
      }
    }
  }
  placeChord();
  flushAll();

  const blocks: string[] = [];
  const order = [...verses.keys()].sort((a, b) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99));
  for (const v of order) {
    const lines = verses.get(v)!;
    if (!lines.some((x) => x && !x.startsWith('♪') && !x.startsWith('#'))) continue;
    if (order.length > 1 && v !== '1') blocks.push(`# ${names.verse} ${v}`);
    blocks.push(lines.join('\n').trim(), '');
  }
  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** A picked file → its chord chart and/or its lyrics. Throws 'not-musicxml', 'no-chords' (neither) or 'too-large'. */
export async function parseMusicXmlSong(
  bytes: Uint8Array,
  fileName: string,
  names: LyricSectionNames,
): Promise<{ chart?: SongChart; lyrics?: string; title?: string; composer?: string }> {
  if (bytes.length > MAX_BYTES) throw new Error('too-large');
  const xml = isZip(bytes) ? await mxlScore(bytes) : new TextDecoder().decode(bytes);
  let chart: SongChart | undefined;
  try {
    chart = parseMusicXml(xml, fileName);
  } catch (e) {
    if ((e as Error).message !== 'no-chords') throw e;
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const lyrics = musicXmlLyrics(doc, names);
  if (!chart && !lyrics) throw new Error('no-chords');
  const creator = Array.from(doc.getElementsByTagName('creator')).find((c) => c.getAttribute('type') === 'composer');
  const title = text(doc.documentElement, 'work-title') || text(doc.documentElement, 'movement-title') || fileName.replace(/\.(musicxml|mxl|xml)$/i, '');
  return {
    ...(chart ? { chart } : {}),
    ...(lyrics ? { lyrics } : {}),
    ...(title ? { title: clip(title) } : {}),
    ...(creator?.textContent?.trim() ? { composer: creator.textContent.trim() } : {}),
  };
}
