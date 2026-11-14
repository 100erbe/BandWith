import { describe, expect, it } from 'vitest';
import {
  asSongChart,
  chartBarCount,
  chordLabel,
  findIrealLink,
  keyLabel,
  parseIrealLink,
  parseMusic,
  scrambleMusic,
  unscrambleMusic,
} from '../ireal';

// A made-up chart (no real song): 2 sections, repeat with endings, segno/coda, text.
const PLAIN =
  '{*AT44C^7 A-7 |D-7 G7 |N1E-7 A7 }|N2D-7 G7 |C6 |x Z' +
  '*B[Fh7 Bb7b9 |Ebo7 |S<D.C. al Coda>Ab-^7/G |Q n Z';

const songField = (title: string, plain: string, key = 'C', bpm = '120') =>
  [title, 'Doe Jane', '', 'Medium Swing', key, '', scrambleMusic(plain), 'Jazz-Medium Swing', bpm, '1'].join('=');

const link = (...songs: string[]) => `irealb://${encodeURIComponent(songs.join('==='))}`;

describe('ireal', () => {
  it('scrambles and unscrambles 50-character blocks', () => {
    expect(PLAIN.length).toBeGreaterThan(51);
    expect(scrambleMusic(PLAIN)).not.toContain(PLAIN.slice(0, 20));
    expect(unscrambleMusic(scrambleMusic(PLAIN))).toBe(PLAIN);
  });

  it('expands the iReal shorthand', () => {
    expect(unscrambleMusic('1r34LbKcu7C^7XyQLZKcl')).toBe('C^7    || x');
  });

  it('reads sections, repeats, endings and signs', () => {
    const { sections, time } = parseMusic(PLAIN);
    expect(time).toBe('4/4');
    expect(sections.map((s) => s.label)).toEqual(['A', 'B']);
    const [a, b] = sections;
    expect(a.bars.map((x) => x.chords)).toEqual([['C^7', 'A-7'], ['D-7', 'G7'], ['E-7', 'A7'], ['D-7', 'G7'], ['C6'], ['%']]);
    expect(a.bars[0].repeatStart).toBe(true);
    expect(a.bars[2]).toMatchObject({ ending: 1, repeatEnd: true });
    expect(a.bars[3].ending).toBe(2);
    expect(a.bars[5].final).toBe(true);
    expect(b.bars.map((x) => x.chords)).toEqual([['Fh7', 'Bb7b9'], ['Ebo7'], ['Ab-^7/G'], ['N.C.']]);
    expect(b.bars[2]).toMatchObject({ segno: true, text: 'D.C. al Coda' });
    expect(b.bars[3]).toMatchObject({ coda: true, final: true });
  });

  it('parses a one-song link with its fields', () => {
    const { name, songs } = parseIrealLink(link(songField('My Tune', PLAIN, 'F#-', '96')));
    expect(name).toBeNull();
    expect(songs).toHaveLength(1);
    expect(songs[0]).toMatchObject({ title: 'My Tune', composer: 'Doe Jane', style: 'Medium Swing', key: 'F#-', bpm: 96, time: '4/4' });
    expect(chartBarCount(songs[0])).toBe(10);
    // The kept link re-imports to the same chart.
    expect(parseIrealLink(songs[0].link!).songs[0].sections).toEqual(songs[0].sections);
  });

  it('parses a playlist and its name, skipping broken songs', () => {
    const pl = parseIrealLink(
      `Look: ${link(songField('One', PLAIN), songField('Two', '*AT34D-7 |G7 Z'), 'Broken=x', 'My list')} thanks`,
    );
    expect(pl.name).toBe('My list');
    expect(pl.songs.map((s) => [s.title, s.time])).toEqual([['One', '4/4'], ['Two', '3/4']]);
  });

  it('reads older irealbook:// links (six fields, music not scrambled)', () => {
    const one = ['Made Up Tune', 'Doe Jane', 'Bossa Nova', 'F', 'n', PLAIN].join('=');
    const two = ['Second Tune', 'Roe Rick', 'Ballad', 'Bb-', 'n', '[T34C^7 |G7 Z'].join('=');
    const pl = parseIrealLink(`irealbook://${encodeURIComponent(`${one}=${two}`)}`);
    expect(pl.songs.map((c) => c.title)).toEqual(['Made Up Tune', 'Second Tune']);
    expect(pl.songs[0]).toMatchObject({ composer: 'Doe Jane', style: 'Bossa Nova', key: 'F', time: '4/4' });
    expect(pl.songs[0].sections.length).toBe(2);
    expect(pl.songs[1]).toMatchObject({ key: 'Bb-', time: '3/4' });
    expect(pl.songs[0].link?.startsWith('irealbook://')).toBe(true);
    // Same song pasted as irealb:// still goes through the scrambled layout.
    expect(parseIrealLink(link(songField('Made Up Tune', PLAIN))).songs[0].title).toBe('Made Up Tune');
  });

  it('rejects text without a chart', () => {
    expect(findIrealLink('https://example.com')).toBeNull();
    expect(() => parseIrealLink('hello')).toThrow('not-ireal');
    expect(() => parseIrealLink('irealb://nothing')).toThrow('empty');
  });

  it('labels chords and keys', () => {
    expect(chordLabel('C^7')).toBe('Cmaj7');
    expect(chordLabel('C^')).toBe('Cmaj7');
    expect(chordLabel('A-7')).toBe('Am7');
    expect(chordLabel('Bh7')).toBe('Bm7♭5');
    expect(chordLabel('Ebo7')).toBe('E♭dim7');
    expect(chordLabel('Co^7')).toBe('Cdim(maj7)');
    expect(chordLabel('Ab-^7/G')).toBe('A♭m(maj7)/G');
    expect(chordLabel('F#7#9/C#')).toBe('F♯7♯9/C♯');
    expect(chordLabel('%')).toBe('%');
    expect(keyLabel('Eb')).toBe('Eb');
    expect(keyLabel('F#-')).toBe('F#m');
    expect(keyLabel(undefined)).toBeUndefined();
  });

  it('accepts only stored charts', () => {
    expect(asSongChart(null)).toBeNull();
    expect(asSongChart({ title: 'x' })).toBeNull();
    expect(asSongChart({ title: 'x', sections: [] })).not.toBeNull();
  });
});
