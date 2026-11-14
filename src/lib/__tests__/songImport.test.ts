import { describe, expect, it } from 'vitest';
import { parseChordPro, pastedLyrics, readSongFile, songFileTooLarge, textToLyrics } from '../songImport';
import { isChordToken, parseLyrics, splitChords } from '../lyrics';

// Made-up words only: no real song.
const NAMES = { verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge' };
const enc = new TextEncoder();

const CHORDPRO = `{title: Paper Boats}
{artist: The Test Band}
{key: G}
{tempo: 96}
# a comment line
{start_of_verse}
[G]Paper boats on a [C]rainy street
[Em]Sailing slow on [D]tired feet
{end_of_verse}

{soc}
[C]Float a[G]way, [D]float away
{eoc}
{c: Slower}
[G] [C] [D]
{start_of_tab}
e|---0---|
{end_of_tab}
{chorus}`;

describe('ChordPro', () => {
  it('reads title, artist, key, tempo, sections and inline chords', () => {
    const song = parseChordPro(CHORDPRO, NAMES);
    expect(song).toMatchObject({ title: 'Paper Boats', artist: 'The Test Band', key: 'G', bpm: 96 });
    expect(song.lyrics).toBe(
      [
        '# Verse 1',
        '[G]Paper boats on a [C]rainy street',
        '[Em]Sailing slow on [D]tired feet',
        '',
        '# Chorus',
        '[C]Float a[G]way, [D]float away',
        '',
        '*Slower*',
        '♪ [G] [C] [D]',
        '',
        '# Chorus',
        '*(Chorus)*',
      ].join('\n'),
    );
  });

  it('keeps the lyrics readable by the lyrics parser', () => {
    const blocks = parseLyrics(parseChordPro(CHORDPRO, NAMES).lyrics!);
    expect(blocks.map((b) => b.name)).toEqual(['Verse 1', 'Chorus', 'Chorus']);
  });
});

describe('chords over lyrics', () => {
  it('puts chords above the words into the words', () => {
    const text = ['Chorus:', 'G         C', 'Paper boats on a rainy street', '', 'Am  D', '', 'Just words here'].join('\n');
    expect(textToLyrics(text)).toBe(['# Chorus', '[G]Paper boat[C]s on a rainy street', '', '♪ [Am] [D]', '', 'Just words here'].join('\n'));
  });

  it('pads short lines so late chords still land', () => {
    expect(textToLyrics('G      D\nHey')).toBe('[G]Hey    [D]');
  });

  it('treats a pasted ChordPro text as ChordPro', () => {
    expect(pastedLyrics('{title: X}\n[G]La la', NAMES)).toMatchObject({ title: 'X', lyrics: '[G]La la' });
    expect(pastedLyrics('   ', NAMES)).toEqual({});
  });
});

describe('song files', () => {
  it('reads .cho and .txt, refuses others', async () => {
    const cho = await readSongFile(enc.encode(CHORDPRO), 'boats.cho', NAMES);
    expect(cho.title).toBe('Paper Boats');
    const txt = await readSongFile(enc.encode('Verse 1\nSome made-up line'), 'song.txt', NAMES);
    expect(txt.lyrics).toBe('# Verse 1\nSome made-up line');
    await expect(readSongFile(enc.encode('x'), 'song.pdf', NAMES)).rejects.toThrow('unsupported');
    await expect(readSongFile(enc.encode('  \n'), 'song.txt', NAMES)).rejects.toThrow('empty');
  });

  it('reads MusicXML lyrics with inline chords, and lyrics-only scores', async () => {
    const lyric = (t: string, syl = 'single', n = '1') => `<lyric number="${n}"><syllabic>${syl}</syllabic><text>${t}</text></lyric>`;
    const note = (...lyrics: string[]) => `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>${lyrics.join('')}</note>`;
    const harm = (step: string, kind: string) => `<harmony><root><root-step>${step}</root-step></root><kind>${kind}</kind></harmony>`;
    const score = (withChords: boolean) => `<?xml version="1.0"?>
<score-partwise version="4.0"><work><work-title>Moon Kite</work-title></work>
<part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
<part id="P1">
  <measure number="1"><direction><direction-type><rehearsal>Verse</rehearsal></direction-type></direction>
    ${withChords ? harm('A', 'minor') : ''}${note(lyric('Fly', 'single'), lyric('Run', 'single', '2'))}${note(lyric('my', 'single'), lyric('a', 'single', '2'))}
    ${withChords ? harm('F', 'major-seventh') : ''}${note(lyric('pa', 'begin'), lyric('long', 'single', '2'))}${note(lyric('per', 'end'))}</measure>
  <measure number="2"><print new-system="yes"/>${withChords ? harm('G', 'dominant') : ''}${note()}</measure>
  <measure number="3">${note(lyric('kite', 'single'))}</measure>
</part></score-partwise>`;
    const both = await readSongFile(enc.encode(score(true)), 'kite.musicxml', NAMES);
    expect(both.chart?.title).toBe('Moon Kite');
    expect(both.lyrics).toBe(['# Verse', '[Am]Fly my [Fmaj7]paper', '[G7]kite', '', '# Verse 2', 'Run a long'].join('\n'));
    const words = await readSongFile(enc.encode(score(false)), 'kite.musicxml', NAMES);
    expect(words.chart).toBeUndefined();
    expect(words).toMatchObject({ title: 'Moon Kite' });
    expect(words.lyrics?.split('\n').slice(0, 3)).toEqual(['# Verse', 'Fly my paper', 'kite']);
  });
});

describe('inline chords', () => {
  it('knows chord tokens', () => {
    for (const c of ['G', 'Am', 'F#m7b5', 'Bbmaj7', 'C/E', 'Dsus4', 'E7(#9)', 'N.C.', 'C^7', 'A-7']) expect(isChordToken(c)).toBe(true);
    for (const w of ['Chorus', 'x', 'Hello', 'Am I', '']) expect(isChordToken(w)).toBe(false);
  });

  it('splits a line into chord + text segments', () => {
    expect(splitChords('[Am]Hello [G]world')).toEqual([
      { chord: 'Am', text: 'Hello ' },
      { chord: 'G', text: 'world' },
    ]);
    expect(splitChords('Intro [x] words')).toBeNull();
    expect(splitChords('no chords')).toBeNull();
    expect(splitChords('la [C]')).toEqual([
      { chord: null, text: 'la ' },
      { chord: 'C', text: '' },
    ]);
  });
  it('says a file is too large before it is read', () => {
    expect(songFileTooLarge('score.mxl', 19 * 1024 * 1024)).toBe(false);
    expect(songFileTooLarge('score.mxl', 21 * 1024 * 1024)).toBe(true);
    expect(songFileTooLarge('song.cho', 900 * 1024)).toBe(false);
    expect(songFileTooLarge('song.txt', 2 * 1024 * 1024)).toBe(true);
    expect(songFileTooLarge('movie.mp4', 500 * 1024 * 1024)).toBe(true);
  });
});
