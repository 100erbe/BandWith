import { describe, it, expect } from 'vitest';
import { parseSongList, parseDuration } from '@/lib/songListImport';

describe('parseSongList', () => {
  it('reads a CSV with a header, quotes and extra columns', () => {
    const csv = [
      'Title,Artist,Key,BPM,Duration,Notes',
      'Superstition,Stevie Wonder,Ebm,100,4:05,',
      '"September","Earth, Wind & Fire",A,126,3:35,opener',
    ].join('\n');
    expect(parseSongList(csv)).toEqual([
      { title: 'Superstition', artist: 'Stevie Wonder', key: 'Ebm', bpm: 100, duration: 245, genre: undefined },
      { title: 'September', artist: 'Earth, Wind & Fire', key: 'A', bpm: 126, duration: 215, genre: undefined },
    ]);
  });

  it('reads semicolon CSV from European Excel and Italian headers', () => {
    const csv = 'Titolo;Artista;Durata\nVolare;Domenico Modugno;3:20\n';
    expect(parseSongList(csv)).toEqual([
      { title: 'Volare', artist: 'Domenico Modugno', key: undefined, bpm: undefined, duration: 200, genre: undefined },
    ]);
  });

  it('reads a plain numbered list with dashes and skips duplicates', () => {
    const txt = '1. Uptown Funk - Mark Ronson\n2) Valerie – Amy Winehouse\n\nFly Me to the Moon\nUptown Funk - Mark Ronson';
    expect(parseSongList(txt)).toEqual([
      { title: 'Uptown Funk', artist: 'Mark Ronson' },
      { title: 'Valerie', artist: 'Amy Winehouse' },
      { title: 'Fly Me to the Moon' },
    ]);
  });

  it('handles a headerless two-column TSV and a BOM', () => {
    expect(parseSongList('﻿Alright\tKendrick Lamar\nHome\tMichael Bublé')).toEqual([
      { title: 'Alright', artist: 'Kendrick Lamar' },
      { title: 'Home', artist: 'Michael Bublé' },
    ]);
  });

  it('skips the header of a single-column list', () => {
    expect(parseSongList('Title\nSuperstition\nValerie')).toEqual([{ title: 'Superstition' }, { title: 'Valerie' }]);
    expect(parseSongList('Song\r\n"Hello, Goodbye"\r\nYesterday')).toEqual([{ title: 'Hello, Goodbye' }, { title: 'Yesterday' }]);
    expect(parseSongList('Titolo\nVolare')).toEqual([{ title: 'Volare' }]);
    expect(parseSongList('Title - Artist\nUptown Funk - Mark Ronson')).toEqual([{ title: 'Uptown Funk', artist: 'Mark Ronson' }]);
  });

  it('splits "Title, Artist" lines when some lines have no artist', () => {
    const txt = 'Superstition, Stevie Wonder\nFly Me to the Moon\nValerie, Amy Winehouse\nSeptember, Earth, Wind & Fire';
    expect(parseSongList(txt)).toEqual([
      { title: 'Superstition', artist: 'Stevie Wonder' },
      { title: 'Fly Me to the Moon' },
      { title: 'Valerie', artist: 'Amy Winehouse' },
      { title: 'September', artist: 'Earth, Wind & Fire' },
    ]);
  });

  it('keeps a comma inside a title in a plain list of titles', () => {
    expect(parseSongList('Hello, Goodbye\nYesterday\nLet It Be')).toEqual([
      { title: 'Hello, Goodbye' },
      { title: 'Yesterday' },
      { title: 'Let It Be' },
    ]);
  });

  it('reads a "Title,Artist" CSV where some rows have no artist', () => {
    expect(parseSongList('Title,Artist\nSuperstition,Stevie Wonder\nFly Me to the Moon')).toEqual([
      { title: 'Superstition', artist: 'Stevie Wonder', key: undefined, bpm: undefined, duration: undefined, genre: undefined },
      { title: 'Fly Me to the Moon', artist: undefined, key: undefined, bpm: undefined, duration: undefined, genre: undefined },
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(parseSongList('  \n \n')).toEqual([]);
  });
});

describe('parseDuration', () => {
  it('accepts m:ss, h:mm:ss, minutes and seconds', () => {
    expect(parseDuration('3:35')).toBe(215);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('4.5')).toBe(270);
    expect(parseDuration('245')).toBe(245);
    expect(parseDuration('abc')).toBeUndefined();
  });
});
