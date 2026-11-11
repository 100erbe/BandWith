import { describe, it, expect } from 'vitest';
import { parseGenres, joinGenres, genresOf, songHasGenre, formatHoursMinutes } from '../songGenres';

describe('songGenres', () => {
  it('parses comma lists, trims, title-cases and drops repeats', () => {
    expect(parseGenres('pop,  funk ,Pop')).toEqual(['Pop', 'Funk']);
    expect(parseGenres('')).toEqual([]);
    expect(parseGenres(null)).toEqual([]);
    expect(parseGenres('R&B; soul / hip-hop')).toEqual(['R&B', 'Soul', 'Hip-Hop']);
  });

  it('joins back within the 100-character column', () => {
    expect(joinGenres([])).toBeUndefined();
    expect(joinGenres(['Pop', 'Funk'])).toBe('Pop, Funk');
    const long = Array.from({ length: 20 }, (_, i) => `Genre${i}`);
    expect(joinGenres(long)!.length).toBeLessThanOrEqual(100);
  });

  it('collects and filters by genre', () => {
    const songs = [{ genre: 'Pop, Funk' }, { genre: 'jazz' }, { genre: null }];
    expect(genresOf(songs)).toEqual(['Funk', 'Jazz', 'Pop']);
    expect(songs.filter((s) => songHasGenre(s, 'funk'))).toHaveLength(1);
    expect(songs.filter((s) => songHasGenre(s, null))).toHaveLength(3);
  });

  it('formats durations in hours and minutes', () => {
    expect(formatHoursMinutes(0)).toBe('0 min');
    expect(formatHoursMinutes(45 * 60)).toBe('45 min');
    expect(formatHoursMinutes(95 * 60)).toBe('1 h 35 min');
    expect(formatHoursMinutes(120 * 60)).toBe('2 h');
  });
});
