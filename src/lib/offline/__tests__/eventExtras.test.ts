import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSetlist: vi.fn(),
  replaceSetlistSongs: vi.fn(),
  updateSetlist: vi.fn(),
  syncEventTasks: vi.fn(),
  saveEventLineup: vi.fn(),
  persistComposerStage: vi.fn(),
  eventSetlistId: null as string | null,
  existingMembers: [] as { user_id: string; status: string }[],
  writes: [] as string[],
}));

const query = (table: string) => {
  let op = 'select';
  const q: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') {
        return (res: (v: unknown) => void) => {
          mocks.writes.push(`${table}.${op}`);
          return res({ data: table === 'event_members' && op === 'select' ? mocks.existingMembers : null, error: null });
        };
      }
      if (prop === 'maybeSingle') return async () => ({ data: { setlist_id: mocks.eventSetlistId }, error: null });
      return (..._args: unknown[]) => {
        if (prop === 'update' || prop === 'delete') op = String(prop);
        return q;
      };
    },
  });
  return q;
};

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => query(t) } }));
vi.mock('@/lib/services/songs', () => ({
  createSetlist: mocks.createSetlist,
  replaceSetlistSongs: mocks.replaceSetlistSongs,
  updateSetlist: mocks.updateSetlist,
}));
vi.mock('@/lib/services/eventTasks', () => ({ syncEventTasks: mocks.syncEventTasks }));
vi.mock('@/lib/services/eventMemberMoney', () => ({ saveEventLineup: mocks.saveEventLineup }));
vi.mock('@/lib/services/composerStage', () => ({ persistComposerStage: mocks.persistComposerStage }));

import { extrasOf, lineupDiff, mergeExtras, replayEventExtras } from '../eventExtras';

const setlist = { bandId: 'b1', name: 'Gig setlist', songs: [{ song_id: 's1', position: 0, set_number: 1 }] };

beforeEach(() => {
  Object.values(mocks).forEach((m) => typeof m === 'function' && (m as any).mockReset());
  mocks.createSetlist.mockResolvedValue({ data: { id: 'sl1' }, error: null });
  mocks.replaceSetlistSongs.mockResolvedValue({ error: null });
  mocks.updateSetlist.mockResolvedValue({ data: {}, error: null });
  mocks.syncEventTasks.mockResolvedValue({ error: null });
  mocks.saveEventLineup.mockResolvedValue({ error: null });
  mocks.persistComposerStage.mockResolvedValue(null);
  mocks.eventSetlistId = null;
  mocks.existingMembers = [];
  mocks.writes.length = 0;
});

describe('offline event extras', () => {
  it('keeps everyone’s RSVP, removes who was taken out, adds the new ones', () => {
    const { removed, rows } = lineupDiff(
      [{ user_id: 'a', status: 'confirmed' }, { user_id: 'b', status: 'declined' }],
      [{ user_id: 'a', status: 'pending' }, { user_id: 'c', status: 'pending' }],
    );
    expect(removed).toEqual(['b']);
    expect(rows).toEqual([{ user_id: 'a', status: 'confirmed' }, { user_id: 'c', status: 'pending' }]);
  });

  it('creates the setlist and links it when the event has none', async () => {
    const failed = await replayEventExtras('e1', { setlist });
    expect(failed).toEqual([]);
    expect(mocks.createSetlist).toHaveBeenCalledWith({ band_id: 'b1', name: 'Gig setlist', song_count: 1 }, setlist.songs);
    expect(mocks.writes).toContain('events.update');
  });

  it("replaces the songs of the event's own setlist when it has one", async () => {
    mocks.eventSetlistId = 'sl-old';
    await replayEventExtras('e1', { setlist });
    expect(mocks.createSetlist).not.toHaveBeenCalled();
    expect(mocks.replaceSetlistSongs).toHaveBeenCalledWith('sl-old', [{ song_id: 's1', set_number: 1 }]);
  });

  it('saves to-dos, the lineup and the stage, and reports what failed', async () => {
    mocks.existingMembers = [{ user_id: 'gone', status: 'confirmed' }];
    mocks.syncEventTasks.mockResolvedValue({ error: new Error('rls') });
    const failed = await replayEventExtras('e1', {
      tasks: { drafts: [{ title: 'Bring cables' }], originalIds: [], eventDate: '2026-12-01' },
      lineup: [{ user_id: 'u1', status: 'pending' }],
      stage: { bandId: 'b1', payload: { stage: null, createRider: true }, gig: { title: 'Gig' } },
    });
    expect(mocks.writes).toContain('event_members.delete');
    expect(mocks.saveEventLineup).toHaveBeenCalledWith('e1', [{ user_id: 'u1', status: 'pending' }]);
    expect(mocks.syncEventTasks).toHaveBeenCalledWith('e1', [{ title: 'Bring cables' }], '2026-12-01', []);
    expect(mocks.persistComposerStage).toHaveBeenCalled();
    expect(failed).toEqual(['tasks']);
  });

  it('reads extras from a payload and merges an edit into a pending create', () => {
    expect(extrasOf({})).toBeNull();
    expect(extrasOf({ extras: {} })).toBeNull();
    expect(mergeExtras({ setlist }, { lineup: [{ user_id: 'u1' }], tasks: { drafts: [], originalIds: ['t1'], eventDate: null } })).toEqual({
      setlist,
      tasks: { drafts: [], originalIds: ['t1'], eventDate: null },
    });
  });
});
