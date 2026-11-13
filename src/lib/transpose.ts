/**
 * Transposing chords and keys by semitones: iReal tokens in chord charts
 * ("Eb^7", "A-7/G"), chords inline in lyrics ("[F#m7b5]") and the song's key
 * ("Bb", "F#m", "C maj"). Spelling follows the target key: flats in F, Bb,
 * Eb… (and their minors), sharps elsewhere.
 */
import type { SongChart } from './ireal';
import { isChordToken } from './lyrics';

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Pitch class of a note name ("Bb" → 10, "F#" → 6, "E♭" → 3), or null. */
export function pitchClass(note: string): number | null {
  const m = note.match(/^([A-Ga-g])([b#♭♯]*)$/);
  if (!m) return null;
  let pc = PC[m[1].toUpperCase()];
  for (const c of m[2]) pc += c === '#' || c === '♯' ? 1 : -1;
  return ((pc % 12) + 12) % 12;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Major keys written with flats (by pitch class): F, Bb, Eb, Ab, Db (F# rather than Gb). */
const FLAT_MAJORS = new Set([5, 10, 3, 8, 1]);
/** Minor keys written with flats: Dm, Gm, Cm, Fm, Bbm, Ebm. */
const FLAT_MINORS = new Set([2, 7, 0, 5, 10, 3]);

/** A key in any of the app's spellings: "Bb", "F#m", "C-", "A minor", "Eb maj". */
export function parseKey(key: string | null | undefined): { pc: number; minor: boolean; rest: string } | null {
  const m = (key || '').trim().match(/^([A-Ga-g][b#♭♯]?)(.*)$/);
  if (!m) return null;
  const pc = pitchClass(m[1]);
  if (pc == null) return null;
  const rest = m[2];
  const minor = /^\s*(-|m(?!aj)|min)/i.test(rest);
  return { pc, minor, rest };
}

/** Flats or sharps for a key moved by `semitones` (no key: flats for the common pop keys). */
export function prefersFlats(key: string | null | undefined, semitones: number): boolean {
  const k = parseKey(key);
  if (!k) return true;
  const pc = mod12(k.pc + semitones);
  return k.minor ? FLAT_MINORS.has(pc) : FLAT_MAJORS.has(pc) || pc === 0;
}

const noteName = (pc: number, flats: boolean) => (flats ? FLATS : SHARPS)[mod12(pc)];

/** One note name moved: "Bb" +2 → "C". Unknown text comes back as is. */
const moveNote = (note: string, semitones: number, flats: boolean) => {
  const pc = pitchClass(note);
  return pc == null ? note : noteName(pc + semitones, flats);
};

/**
 * One chord moved by `semitones`: root and bass note, the quality untouched.
 * Works for iReal tokens ("Eb^7", "Bh7/F", "W/C") and plain chords ("F#m7b5", "Bb/D").
 */
export function transposeChord(chord: string, semitones: number, flats = true): string {
  if (!semitones || chord === '%' || chord === 'N.C.' || chord === 'x' || chord === 'n') return chord;
  const m = chord.match(/^([A-G][b#♭♯]?|W)(.*?)(?:\/([A-G][b#♭♯]?))?$/);
  if (!m) return chord;
  const [, root, quality, bass] = m;
  const r = root === 'W' ? 'W' : moveNote(root, semitones, flats);
  return `${r}${quality}${bass ? `/${moveNote(bass, semitones, flats)}` : ''}`;
}

/** The song's key moved, keeping its own style ("F#m" -2 → "Em", "Bb" +1 → "B", "C-" → "D-"). */
export function transposeKey(key: string, semitones: number): string {
  const k = parseKey(key);
  if (!k || !semitones) return key;
  return `${noteName(k.pc + semitones, prefersFlats(key, semitones))}${k.rest}`;
}

/** Inline chords of lyrics ("[Am]words") moved; other bracketed text stays. */
export function transposeLyrics(lyrics: string, semitones: number, flats = true): string {
  if (!semitones) return lyrics;
  return lyrics.replace(/\[([^\]\s]{1,16})\]/g, (all, c: string) => (isChordToken(c) ? `[${transposeChord(c, semitones, flats)}]` : all));
}

/** A chord chart moved: every chord and the key. */
export function transposeChart(chart: SongChart, semitones: number): SongChart {
  if (!semitones) return chart;
  const flats = prefersFlats(chart.key, semitones);
  return {
    ...chart,
    ...(chart.key ? { key: transposeKey(chart.key, semitones) } : {}),
    sections: chart.sections.map((s) => ({ ...s, bars: s.bars.map((b) => ({ ...b, chords: b.chords.map((c) => transposeChord(c, semitones, flats)) })) })),
  };
}

/** −11…+11 folded to the nearest way round (−5…+6), e.g. +10 → −2. */
export const foldSemitones = (n: number) => {
  const m = mod12(n);
  return m > 6 ? m - 12 : m;
};

/** "+2", "−3", "0". */
export const semitoneLabel = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
