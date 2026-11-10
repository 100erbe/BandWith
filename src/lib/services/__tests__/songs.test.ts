import { describe, it, expect, vi, beforeEach } from 'vitest';

type Call = { table: string; op: string; payload?: any; filters: [string, any][] };
type Handler = (call: Call) => { data?: any; error?: any; count?: number | null };

const calls: Call[] = [];
let handler: Handler = () => ({ data: null, error: null });

/** Minimal chainable stand-in for the PostgREST builder: records each query. */
const builder = (table: string) => {
  const call: Call = { table, op: 'select', filters: [] };
  const b: any = {
    select: () => b,
    insert: (v: any) => ((call.op = 'insert'), (call.payload = v), b),
    update: (v: any) => ((call.op = 'update'), (call.payload = v), b),
    delete: () => ((call.op = 'delete'), b),
    eq: (c: string, v: any) => (call.filters.push([c, v]), b),
    order: () => b,
    single: () => b,
    maybeSingle: () => b,
    then: (res: any, rej: any) => {
      calls.push(call);
      const out = handler(call);
      return Promise.resolve({ data: out.data ?? null, error: out.error ?? null, count: out.count ?? null }).then(res, rej);
    },
  };
  return b;
};

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => builder(t), rpc: vi.fn() },
  getSafeUser: async () => ({ data: { user: { id: 'user-1' } } }),
}));

import { createSetlist, replaceSetlistSongs, addSongToSetlist } from '../songs';
import { supabase } from '@/lib/supabase';

beforeEach(() => {
  calls.length = 0;
  handler = () => ({ data: null, error: null });
});

describe('replaceSetlistSongs', () => {
  it('keeps set numbers and existing notes, and still accepts plain ids', async () => {
    handler = (c) =>
      c.table === 'setlist_songs' && c.op === 'select'
        ? { data: [{ id: 'r1', setlist_id: 'sl', song_id: 'a', position: 1, set_number: 1, notes: 'segue' }] }
        : {};

    const { error } = await replaceSetlistSongs('sl', [
      { song_id: 'a', set_number: 1 },
      { song_id: 'b', set_number: 2 },
      'c',
    ]);
    expect(error).toBeNull();
    const insert = calls.find((c) => c.table === 'setlist_songs' && c.op === 'insert');
    expect(insert?.payload).toEqual([
      { setlist_id: 'sl', song_id: 'a', position: 1, set_number: 1, notes: 'segue' },
      { setlist_id: 'sl', song_id: 'b', position: 2, set_number: 2, notes: null },
      { setlist_id: 'sl', song_id: 'c', position: 3, set_number: 1, notes: null },
    ]);
    expect(calls.find((c) => c.table === 'setlists' && c.op === 'update')?.payload).toEqual({ song_count: 3 });
  });

  it('puts the previous rows back when the insert fails', async () => {
    const previous = [{ id: 'r1', setlist_id: 'sl', song_id: 'a', position: 1, set_number: 2, notes: null }];
    let inserts = 0;
    handler = (c) => {
      if (c.table === 'setlist_songs' && c.op === 'select') return { data: previous };
      if (c.table === 'setlist_songs' && c.op === 'insert') {
        inserts += 1;
        return inserts === 1 ? { error: { message: 'boom' } } : {};
      }
      return {};
    };

    const { error } = await replaceSetlistSongs('sl', ['b']);
    expect(error).toMatchObject({ message: 'boom' });
    const restore = calls.filter((c) => c.table === 'setlist_songs' && c.op === 'insert')[1];
    expect(restore?.payload).toEqual(previous);
    expect(calls.some((c) => c.table === 'setlists' && c.op === 'update')).toBe(false);
  });
});

describe('createSetlist', () => {
  it('fails and removes the new setlist when its songs cannot be added', async () => {
    handler = (c) => {
      if (c.table === 'setlists' && c.op === 'insert') return { data: { id: 'new-sl', name: 'Gig' } };
      if (c.table === 'setlist_songs' && c.op === 'insert') return { error: { message: 'denied' } };
      return {};
    };

    const { data, error } = await createSetlist({ band_id: 'band', name: 'Gig' }, [{ song_id: 'a', position: 0 }]);
    expect(data).toBeNull();
    expect(error).toMatchObject({ message: 'denied' });
    const del = calls.find((c) => c.table === 'setlists' && c.op === 'delete');
    expect(del?.filters).toContainEqual(['id', 'new-sl']);
  });
});

describe('addSongToSetlist', () => {
  it('recounts songs with a query instead of the missing RPC', async () => {
    handler = (c) => {
      if (c.table === 'setlist_songs' && c.op === 'insert') return { data: { id: 'r1' } };
      if (c.table === 'setlist_songs' && c.op === 'select') return { count: 4 };
      return {};
    };
    const { error } = await addSongToSetlist('sl', 'a', 4);
    expect(error).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(calls.find((c) => c.table === 'setlists' && c.op === 'update')?.payload).toEqual({ song_count: 4 });
  });
});
