import { describe, it, expect } from 'vitest';
import { removeSongsFromSets, setsFromSetlistSongs, setSongCount } from '../setlistSets';

const title = (n: number) => `Set ${n}`;
const row = (song_id: string, set_number: number | null, position: number, name = song_id) => ({
  song_id,
  set_number,
  position,
  song: { title: name, artist: `${name} artist` },
});

describe('setsFromSetlistSongs', () => {
  it('returns no sets for an empty setlist', () => {
    expect(setsFromSetlistSongs([], title)).toEqual([]);
  });

  it('groups songs by set in set order and keeps the saved order', () => {
    const sets = setsFromSetlistSongs(
      [row('c', 2, 1), row('b', 1, 2), row('a', 1, 1), row('d', 2, 2)],
      title,
    );
    expect(sets.map((s) => s.title)).toEqual(['Set 1', 'Set 2']);
    expect(sets.map((s) => s.songs.map((sg) => sg.songId))).toEqual([['a', 'b'], ['c', 'd']]);
    expect(sets[0].songs[0]).toMatchObject({ title: 'a', artist: 'a artist', songId: 'a' });
  });

  it('puts rows without a set number in set 1 and names missing songs', () => {
    const sets = setsFromSetlistSongs([{ song_id: 'x', set_number: null, position: 1, song: null }], title);
    expect(sets).toHaveLength(1);
    expect(sets[0].songs[0]).toMatchObject({ songId: 'x', title: 'Untitled', artist: '' });
  });

  it('gives every set and song its own uid', () => {
    const sets = setsFromSetlistSongs([row('a', 1, 1), row('a', 1, 2)], title);
    const uids = [sets[0].uid, ...sets[0].songs.map((s) => s.uid)];
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('counts songs across sets', () => {
    expect(setSongCount(setsFromSetlistSongs([row('a', 1, 1), row('b', 2, 1), row('c', 2, 2)], title))).toBe(3);
    expect(setSongCount([])).toBe(0);
  });
});

describe('removeSongsFromSets', () => {
  it('drops the given songs from every set and keeps the sets', () => {
    const sets = setsFromSetlistSongs([row('a', 1, 1), row('b', 1, 2), row('c', 2, 1)], title);
    const out = removeSongsFromSets(sets, ['b', 'c']);
    expect(out.map((s) => s.songs.map((sg) => sg.songId))).toEqual([['a'], []]);
    expect(setSongCount(out)).toBe(1);
  });

  it('returns the same sets when nothing is removed', () => {
    const sets = setsFromSetlistSongs([row('a', 1, 1)], title);
    expect(removeSongsFromSets(sets, [])).toBe(sets);
  });
});
