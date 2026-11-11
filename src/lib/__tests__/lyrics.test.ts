import { describe, it, expect } from 'vitest';
import { parseLyrics, parseInline } from '../lyrics';

describe('lyrics', () => {
  it('reads Markdown sections and stanzas', () => {
    const s = parseLyrics('# Verse 1\nLine one\nLine two\n\n[Chorus]\nSing **loud**\n');
    expect(s.map((x) => x.name)).toEqual(['Verse 1', 'Chorus']);
    expect(s[0].lines).toEqual(['Line one', 'Line two']);
    expect(s[1].lines).toEqual(['Sing **loud**']);
  });

  it('reads plain text with no sections', () => {
    expect(parseLyrics('a\nb')).toEqual([{ name: null, lines: ['a', 'b'] }]);
    expect(parseLyrics('')).toEqual([]);
  });

  it('reads JSON shapes', () => {
    expect(parseLyrics('["a","b"]')).toEqual([{ name: null, lines: ['a', 'b'] }]);
    expect(parseLyrics('{"sections":[{"name":"Verse","lines":["x"]},{"name":"Chorus","text":"y\\nz"}]}')).toEqual([
      { name: 'Verse', lines: ['x'] },
      { name: 'Chorus', lines: ['y', 'z'] },
    ]);
    expect(parseLyrics('{"lyrics":"# Intro\\nhey"}')).toEqual([{ name: 'Intro', lines: ['hey'] }]);
    // Not JSON: a lone "[Bridge]" header is Markdown.
    expect(parseLyrics('[Bridge]\nla')).toEqual([{ name: 'Bridge', lines: ['la'] }]);
  });

  it('splits bold and italic without HTML', () => {
    expect(parseInline('a **b** *c* <i>d</i>')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' <i>d</i>' },
    ]);
  });
});
