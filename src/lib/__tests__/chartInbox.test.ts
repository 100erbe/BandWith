import { describe, expect, it } from 'vitest';
import { fileProblem } from '../chartInbox';
import { readMusicXml } from '../musicxml';

const enc = new TextEncoder();
const score = (notes: string) =>
  enc.encode(`<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`);

const problemOf = async (bytes: Uint8Array) => {
  try {
    await readMusicXml(bytes, 'tune.musicxml');
    return null;
  } catch (e) {
    return fileProblem(bytes, 'tune.musicxml', e);
  }
};

describe('chartInbox', () => {
  it('says why a file opened with the app gives no chart', async () => {
    const lyricsOnly = score('<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><lyric><text>La la</text></lyric></note>');
    expect(await problemOf(lyricsOnly)).toBe('lyrics-only');
    expect(await problemOf(score('<note><rest/><duration>4</duration></note>'))).toBe('no-chords');
    expect(await problemOf(enc.encode('just some text'))).toBe('unreadable');
  });
});
