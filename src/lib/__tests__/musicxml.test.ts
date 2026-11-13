import { describe, expect, it } from 'vitest';
import { harmonyToken, parseMusicXml, readMusicXml, unzip } from '../musicxml';
import { chordLabel } from '../ireal';

// A made-up lead sheet (no real song): pick-up, two sections, repeat with
// endings, segno/coda, an empty bar, a melody note with a lyric.
const harmony = (step: string, kind: string, extra = '') =>
  `<harmony><root><root-step>${step.charAt(0)}</root-step>${step.includes('b') ? '<root-alter>-1</root-alter>' : ''}</root><kind>${kind}</kind>${extra}</harmony>`;

const SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Test Tune</work-title></work>
  <identification><creator type="composer">Doe Jane</creator></identification>
  <part-list><score-part id="P1"><part-name>Lead</part-name></score-part></part-list>
  <part id="P1">
    <measure number="0" implicit="yes"><note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note></measure>
    <measure number="1">
      <attributes><key><fifths>-3</fifths><mode>major</mode></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><rehearsal>A</rehearsal></direction-type><sound tempo="132"/></direction>
      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>
      ${harmony('Eb', 'major-seventh')}
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><lyric><text>secret words</text></lyric></note>
      ${harmony('C', 'minor-seventh')}
    </measure>
    <measure number="2">${harmony('F', 'dominant', '<degree><degree-value>9</degree-value><degree-alter>-1</degree-alter><degree-type>add</degree-type></degree>')}</measure>
    <measure number="3">
      <barline location="left"><ending number="1" type="start"/></barline>
      ${harmony('Bb', 'suspended-fourth', '<degree><degree-value>7</degree-value><degree-alter>0</degree-alter><degree-type>add</degree-type></degree>')}
      <barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline>
    </measure>
    <measure number="4"><barline location="left"><ending number="2" type="start"/></barline>${harmony('Eb', 'major-sixth')}</measure>
    <measure number="5"></measure>
    <measure number="6">
      <direction><direction-type><rehearsal>B</rehearsal></direction-type></direction>
      <direction><direction-type><segno/></direction-type></direction>
      <harmony><root><root-step>A</root-step></root><kind>half-diminished</kind><bass><bass-step>E</bass-step><bass-alter>-1</bass-alter></bass></harmony>
    </measure>
    <measure number="7">
      <direction><direction-type><words>D.S. al Coda</words></direction-type></direction>
      <direction><direction-type><coda/></direction-type></direction>
      <harmony><kind>none</kind></harmony>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>
</score-partwise>`;

const enc = new TextEncoder();

/** A minimal zip with stored entries (method 0), enough for the reader. */
const zip = (files: Record<string, string>) => {
  const parts: number[] = [];
  const central: number[] = [];
  const le = (n: number, len: number) => Array.from({ length: len }, (_, i) => (n >>> (8 * i)) & 0xff);
  for (const [name, content] of Object.entries(files)) {
    const nameB = Array.from(enc.encode(name));
    const data = Array.from(enc.encode(content));
    const offset = parts.length;
    parts.push(...le(0x04034b50, 4), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(0, 4));
    parts.push(...le(data.length, 4), ...le(data.length, 4), ...le(nameB.length, 2), ...le(0, 2), ...nameB, ...data);
    central.push(...le(0x02014b50, 4), ...le(20, 2), ...le(20, 2), ...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(0, 4));
    central.push(...le(data.length, 4), ...le(data.length, 4), ...le(nameB.length, 2), ...le(0, 2), ...le(0, 2));
    central.push(...le(0, 2), ...le(0, 2), ...le(0, 4), ...le(offset, 4), ...nameB);
  }
  const cdOffset = parts.length;
  const n = Object.keys(files).length;
  return new Uint8Array([
    ...parts,
    ...central,
    ...le(0x06054b50, 4), ...le(0, 2), ...le(0, 2), ...le(n, 2), ...le(n, 2), ...le(central.length, 4), ...le(cdOffset, 4), ...le(0, 2),
  ]);
};

describe('musicxml', () => {
  it('reads chords, form and details, never lyrics', () => {
    const chart = parseMusicXml(SCORE, 'test.musicxml');
    expect(chart).toMatchObject({ source: 'musicxml', file: 'test.musicxml', title: 'Test Tune', composer: 'Doe Jane', key: 'Eb', bpm: 132, time: '4/4' });
    expect(chart.sections.map((s) => s.label)).toEqual(['A', 'B']);
    const [a, b] = chart.sections;
    expect(a.bars.map((x) => x.chords)).toEqual([['Eb^7', 'C-7'], ['F7b9'], ['Bb7sus'], ['Eb6'], ['%']]);
    expect(a.bars[0].repeatStart).toBe(true);
    expect(a.bars[2]).toMatchObject({ ending: 1, repeatEnd: true });
    expect(a.bars[3].ending).toBe(2);
    expect(b.bars[0]).toMatchObject({ chords: ['Ah7/Eb'], segno: true });
    expect(b.bars[1]).toMatchObject({ chords: ['N.C.'], coda: true, final: true, text: 'D.S. al Coda' });
    expect(JSON.stringify(chart)).not.toContain('secret');
  });

  it('labels the chords like iReal ones', () => {
    const doc = new DOMParser().parseFromString(
      `<x>${harmony('Ab', 'major-minor')}${harmony('C', 'diminished-seventh')}</x>`,
      'application/xml',
    );
    const [h1, h2] = Array.from(doc.getElementsByTagName('harmony'));
    expect(chordLabel(harmonyToken(h1)!)).toBe('A♭m(maj7)');
    expect(chordLabel(harmonyToken(h2)!)).toBe('Cdim7');
  });

  it('rejects files without a score or chords', () => {
    expect(() => parseMusicXml('<html/>')).toThrow('not-musicxml');
    expect(() => parseMusicXml('<score-partwise><part id="P1"><measure/></part></score-partwise>')).toThrow('no-chords');
  });

  it('opens a compressed .mxl through its container', async () => {
    const mxl = zip({
      'META-INF/container.xml': '<container><rootfiles><rootfile full-path="score/tune.musicxml"/></rootfiles></container>',
      'score/tune.musicxml': SCORE,
    });
    expect([...(await unzip(mxl)).keys()]).toEqual(['META-INF/container.xml', 'score/tune.musicxml']);
    const chart = await readMusicXml(mxl, 'tune.mxl');
    expect(chart.title).toBe('Test Tune');
    expect(chart.file).toBe('tune.mxl');
  });

  it('reads plain bytes as XML', async () => {
    expect((await readMusicXml(enc.encode(SCORE))).sections).toHaveLength(2);
  });
});
