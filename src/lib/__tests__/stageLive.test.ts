import { describe, expect, it } from 'vitest';
import { applyOrder, indexOf, isNewer, moveItem, parseStageState, reorderRows, sameOrder, stageTopic } from '../stageLive';

const songs = [
  { id: 'a', songId: 'sa', setNumber: 1, title: 'A' },
  { id: 'b', songId: 'sb', setNumber: 1, title: 'B' },
  { id: 'c', songId: 'sc', setNumber: 2, title: 'C' },
  { id: 'd', songId: 'sd', setNumber: 2, title: 'D' },
];

describe('stageLive', () => {
  it('names the gig topic the way migration 085 checks it', () => {
    expect(stageTopic('11111111-1111-1111-1111-111111111111')).toBe('stage:event:11111111-1111-1111-1111-111111111111');
  });

  it('orders by the Lamport clock, ties to the larger sender', () => {
    expect(isNewer({ seq: 1, from: 'x' }, null)).toBe(true);
    expect(isNewer({ seq: 2, from: 'a' }, { seq: 1, from: 'z' })).toBe(true);
    expect(isNewer({ seq: 1, from: 'z' }, { seq: 2, from: 'a' })).toBe(false);
    expect(isNewer({ seq: 3, from: 'b' }, { seq: 3, from: 'a' })).toBe(true);
    expect(isNewer({ seq: 3, from: 'a' }, { seq: 3, from: 'a' })).toBe(false);
  });

  it('drops malformed payloads', () => {
    expect(parseStageState(null)).toBeNull();
    expect(parseStageState({ seq: 'x', from: 'a', songId: null, order: null })).toBeNull();
    expect(parseStageState({ seq: 1, from: '', songId: null, order: null })).toBeNull();
    expect(parseStageState({ seq: 1, from: 'a', songId: 5, order: null })).toBeNull();
    expect(parseStageState({ seq: 1, from: 'a', songId: null, order: [1] })).toBeNull();
    expect(parseStageState({ seq: 1, from: 'a', songId: 'b', order: ['b', 'a'] })).toEqual({ seq: 1, from: 'a', songId: 'b', order: ['b', 'a'] });
  });

  it('applies a live order and keeps songs it does not know at the end', () => {
    expect(applyOrder(songs, null)).toBe(songs);
    expect(applyOrder(songs, ['c', 'a']).map((s) => s.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(applyOrder(songs, ['x', 'd', 'd', 'b', 'a', 'c']).map((s) => s.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('moves one item', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    const same = ['a'];
    expect(moveItem(same, 0, 1)).toBe(same);
  });

  it('saves positions 1..n and keeps each slot set number', () => {
    const ordered = [songs[2], songs[0], songs[1], songs[3]];
    expect(reorderRows('L', songs, ordered)).toEqual([
      { id: 'c', setlist_id: 'L', song_id: 'sc', position: 1, set_number: 1 },
      { id: 'a', setlist_id: 'L', song_id: 'sa', position: 2, set_number: 1 },
      { id: 'b', setlist_id: 'L', song_id: 'sb', position: 3, set_number: 2 },
      { id: 'd', setlist_id: 'L', song_id: 'sd', position: 4, set_number: 2 },
    ]);
  });

  it('finds the current song, first song as fallback', () => {
    expect(indexOf(songs, 'c')).toBe(2);
    expect(indexOf(songs, 'gone')).toBe(0);
    expect(indexOf(songs, null)).toBe(0);
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});
