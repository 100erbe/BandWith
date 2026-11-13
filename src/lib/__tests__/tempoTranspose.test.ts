import { describe, expect, it } from 'vitest';
import { detectBpm, keepTaps, tapBpm } from '../tempo';
import { foldSemitones, parseKey, transposeChart, transposeChord, transposeKey, transposeLyrics } from '../transpose';
import type { SongChart } from '../ireal';

describe('tap tempo', () => {
  it('reads the median gap and resets after a pause', () => {
    expect(tapBpm([0])).toBeNull();
    expect(tapBpm([0, 500, 1000, 1500])).toBe(120);
    expect(tapBpm([0, 500, 1000, 1700, 2200])).toBe(120);
    // A pause starts over: only the last two count.
    expect(tapBpm([0, 500, 5000, 5600])).toBe(100);
    expect(keepTaps([0, 500], 4000)).toEqual([4000]);
    expect(keepTaps([0, 500], 1000)).toEqual([0, 500, 1000]);
  });
});

/** A click track: short noise bursts every beat, with softer off-beats. */
const clicks = (bpm: number, seconds: number, rate = 11025) => {
  const out = new Float32Array(seconds * rate);
  const period = (60 / bpm) * rate;
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let beat = 0; beat * period < out.length; beat++) {
    const start = Math.round(beat * period);
    for (let i = 0; i < 300 && start + i < out.length; i++) out[start + i] = noise() * Math.exp(-i / 60);
    const off = Math.round(start + period / 2);
    for (let i = 0; i < 300 && off + i < out.length; i++) out[off + i] += 0.3 * noise() * Math.exp(-i / 60);
  }
  return out;
};

describe('BPM from audio', () => {
  it('finds the tempo of a click track', () => {
    for (const bpm of [92, 120, 140]) expect(Math.abs(detectBpm(clicks(bpm, 20), 11025)! - bpm)).toBeLessThanOrEqual(1);
  });

  it('gives up on silence and on short audio', () => {
    expect(detectBpm(new Float32Array(11025 * 10), 11025)).toBeNull();
    expect(detectBpm(clicks(120, 2), 11025)).toBeNull();
  });
});

describe('transpose', () => {
  it('moves chords, keeping quality and bass', () => {
    expect(transposeChord('Eb^7', 2)).toBe('F^7');
    expect(transposeChord('A-7/G', 3)).toBe('C-7/Bb');
    expect(transposeChord('F#m7b5', -1)).toBe('Fm7b5');
    expect(transposeChord('C', 1, false)).toBe('C#');
    expect(transposeChord('N.C.', 4)).toBe('N.C.');
    expect(transposeChord('%', 4)).toBe('%');
  });

  it('moves keys in their own spelling', () => {
    expect(transposeKey('F#m', -2)).toBe('Em');
    expect(transposeKey('Bb', 1)).toBe('B');
    expect(transposeKey('C maj', 2)).toBe('D maj');
    expect(transposeKey('G', 1)).toBe('Ab');
    expect(transposeKey('E', 2)).toBe('F#');
    expect(parseKey('A minor')).toMatchObject({ pc: 9, minor: true });
    expect(parseKey('Ebmaj')).toMatchObject({ pc: 3, minor: false });
  });

  it('moves inline chords in lyrics, not other brackets', () => {
    expect(transposeLyrics('# Chorus\n[G]Made-up [D/F#]words [x2]', 2)).toBe('# Chorus\n[A]Made-up [E/Ab]words [x2]');
    expect(transposeLyrics('[G]Made-up [D/F#]words', 2, false)).toBe('[A]Made-up [E/G#]words');
  });

  it('moves a chart and its key', () => {
    const chart: SongChart = { v: 1, source: 'ireal', title: 'Test', key: 'Eb', sections: [{ label: 'A', bars: [{ chords: ['Eb^7', 'C-7'] }, { chords: ['%'] }] }] };
    const up = transposeChart(chart, 2);
    expect(up.key).toBe('F');
    expect(up.sections[0].bars.map((b) => b.chords)).toEqual([['F^7', 'D-7'], ['%']]);
    expect(foldSemitones(10)).toBe(-2);
    expect(foldSemitones(-7)).toBe(5);
  });
});
