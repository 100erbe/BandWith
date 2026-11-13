import { describe, it, expect } from 'vitest';
import {
  moveItem,
  moveSongBy,
  moveSongTo,
  playNumber,
  projectedOrder,
  setStartNumbers,
  withSetSongs,
} from '../setlistOrder';

const songs = (...uids: string[]) => uids.map((uid) => ({ uid, title: uid.toUpperCase() }));
const ids = (list: { uid: string }[]) => list.map((s) => s.uid);

describe('moveItem', () => {
  it('moves an item down and up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('clamps the target and returns the same list for no-op moves', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 2, -5)).toEqual(['c', 'a', 'b']);
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 7, 0)).toBe(list);
  });

  it('does not mutate the input', () => {
    const list = ['a', 'b', 'c'];
    moveItem(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});

describe('moveSongTo', () => {
  it('drops the dragged song where the hovered song was', () => {
    expect(ids(moveSongTo(songs('a', 'b', 'c', 'd'), 'a', 'c'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(moveSongTo(songs('a', 'b', 'c', 'd'), 'd', 'a'))).toEqual(['d', 'a', 'b', 'c']);
  });

  it('keeps the list when a song is unknown or dropped on itself', () => {
    const list = songs('a', 'b');
    expect(moveSongTo(list, 'x', 'a')).toBe(list);
    expect(moveSongTo(list, 'a', 'x')).toBe(list);
    expect(moveSongTo(list, 'a', 'a')).toBe(list);
  });

  it('keeps each song object (title, ids) intact', () => {
    const out = moveSongTo(songs('a', 'b'), 'b', 'a');
    expect(out[0]).toEqual({ uid: 'b', title: 'B' });
  });
});

describe('moveSongBy (keyboard)', () => {
  it('moves one step up or down', () => {
    expect(ids(moveSongBy(songs('a', 'b', 'c'), 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveSongBy(songs('a', 'b', 'c'), 'b', 1))).toEqual(['a', 'c', 'b']);
  });

  it('stays put at either end or for an unknown song', () => {
    const list = songs('a', 'b', 'c');
    expect(moveSongBy(list, 'a', -1)).toBe(list);
    expect(moveSongBy(list, 'c', 1)).toBe(list);
    expect(moveSongBy(list, 'x', 1)).toBe(list);
  });
});

describe('withSetSongs', () => {
  it('replaces only the given set', () => {
    const sets = [
      { uid: 's1', title: 'Set 1', songs: songs('a', 'b') },
      { uid: 's2', title: 'Set 2', songs: songs('c') },
    ];
    const out = withSetSongs(sets, 's1', songs('b', 'a'));
    expect(ids(out[0].songs)).toEqual(['b', 'a']);
    expect(out[0].title).toBe('Set 1');
    expect(out[1]).toBe(sets[1]);
  });
});

describe('play numbers', () => {
  it('numbers songs across sets starting at 1', () => {
    expect(setStartNumbers([{ songs: [1, 2, 3] }, { songs: [] }, { songs: [4, 5] }, {}])).toEqual([1, 4, 4, 6]);
    expect(setStartNumbers([])).toEqual([]);
  });

  it('pads to two digits', () => {
    expect(playNumber(1)).toBe('01');
    expect(playNumber(9)).toBe('09');
    expect(playNumber(10)).toBe('10');
    expect(playNumber(123)).toBe('123');
  });

  it('renumbers to match the new order after a drop', () => {
    const order = moveSongTo(songs('a', 'b', 'c'), 'c', 'a');
    expect(order.map((s, i) => `${playNumber(i + 1)} ${s.title}`)).toEqual(['01 C', '02 A', '03 B']);
  });
});

describe('projectedOrder (numbers while dragging)', () => {
  it('shows the order the drop would give', () => {
    expect(projectedOrder(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('keeps the order when nothing is dragged or the target is unknown', () => {
    const uids = ['a', 'b'];
    expect(projectedOrder(uids, null, 'a')).toBe(uids);
    expect(projectedOrder(uids, 'a', null)).toBe(uids);
    expect(projectedOrder(uids, 'a', 'a')).toBe(uids);
    expect(projectedOrder(uids, 'a', 'x')).toBe(uids);
  });
});
