// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  createPersonalGig: vi.fn(),
  updatePersonalGig: vi.fn(),
  replayEventExtras: vi.fn(),
  authCallbacks: [] as Array<(event: string, session: any) => void>,
}));

vi.mock('@/lib/services/events', () => ({
  createEvent: mocks.createEvent,
  updateEvent: mocks.updateEvent,
  deleteEvent: mocks.deleteEvent,
  createPersonalGig: mocks.createPersonalGig,
  updatePersonalGig: mocks.updatePersonalGig,
}));

vi.mock('../eventExtras', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventExtras')>()),
  replayEventExtras: mocks.replayEventExtras,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        mocks.authCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));

type Q = typeof import('../syncQueue');
type S = typeof import('../storage');
let q: Q;
let storage: S;

const USER = 'user_a';
const queueKey = (u = USER) => `bw:offline_queue:${u}`;
const stored = (u = USER) => JSON.parse(localStorage.getItem(queueKey(u)) || 'null');
const pgError = (code: string, message = `pg ${code}`) => Object.assign(new Error(message), { code });

const enqueueOfflineCreate = (tempId: string, eventData: Record<string, any> = {}) =>
  q.enqueueMutation(
    'create_event',
    { eventData: { id: tempId, _tempId: tempId, _isPendingSync: true, band_id: 'b1', title: 'Gig', ...eventData } },
    tempId
  );

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  mocks.authCallbacks.length = 0;
  Object.values(mocks).forEach((m) => typeof m === 'function' && (m as any).mockReset());
  mocks.createEvent.mockImplementation(async (data: any) => ({ data: { id: data.id || 'server-id' }, error: null }));
  mocks.updateEvent.mockResolvedValue({ data: {}, error: null });
  mocks.deleteEvent.mockResolvedValue({ error: null });
  mocks.createPersonalGig.mockImplementation(async (input: any) => ({ data: { id: input.id || 'server-id' }, error: null }));
  mocks.updatePersonalGig.mockResolvedValue({ data: {}, error: null });
  mocks.replayEventExtras.mockResolvedValue([]);
  q = await import('../syncQueue');
  storage = await import('../storage');
  q.setOfflineQueueUser(USER);
});

describe('fix 1: updates to offline-created events', () => {
  it('folds the update into the create when the create succeeds, and does not send it separately', async () => {
    await enqueueOfflineCreate('offline_ev_1', { title: 'Old title' });
    await q.enqueueMutation('update_event', { eventId: 'offline_ev_1', updates: { title: 'New title', _isPendingSync: true } });

    const res = await q.processSyncQueue();

    expect(mocks.createEvent).toHaveBeenCalledTimes(1);
    const sent = mocks.createEvent.mock.calls[0][0];
    expect(sent.title).toBe('New title');
    expect(sent._isPendingSync).toBeUndefined();
    expect(sent._tempId).toBeUndefined();
    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(res.synced).toBe(1);
    expect(stored()).toEqual([]);
  });

  it('keeps the folded payload on the create when the create fails', async () => {
    mocks.createEvent.mockResolvedValue({ data: null, error: pgError('23514', 'check violation') });
    await enqueueOfflineCreate('offline_ev_1', { title: 'Old title' });
    await q.enqueueMutation('update_event', { eventId: 'offline_ev_1', updates: { title: 'New title' } });

    await q.processSyncQueue();

    const queue = stored();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('create_event');
    expect(queue[0].payload.eventData.title).toBe('New title');
    expect(queue[0].retryCount).toBe(1);
  });

  it('folds personal gig inputs too', async () => {
    await q.enqueueMutation(
      'create_event',
      { eventData: { id: 'offline_ev_2' }, isPersonalGig: true, personalGigInput: { userId: USER, title: 'A', eventDate: '2026-01-01' } },
      'offline_ev_2'
    );
    await q.enqueueMutation('update_event', {
      eventId: 'offline_ev_2',
      updates: { title: 'B' },
      isPersonalGig: true,
      personalGigInput: { eventId: 'offline_ev_2', userId: USER, title: 'B', eventDate: '2026-01-02' },
    });

    await q.processSyncQueue();

    expect(mocks.createPersonalGig).toHaveBeenCalledTimes(1);
    const input = mocks.createPersonalGig.mock.calls[0][0];
    expect(input).toMatchObject({ title: 'B', eventDate: '2026-01-02' });
    expect(input.eventId).toBeUndefined();
    expect(mocks.updatePersonalGig).not.toHaveBeenCalled();
  });

  it('remaps the temp id for an update enqueued after its create already synced', async () => {
    await enqueueOfflineCreate('offline_ev_3');
    await q.processSyncQueue();
    const realId = mocks.createEvent.mock.calls[0][0].id;

    await q.enqueueMutation('update_event', { eventId: 'offline_ev_3', updates: { title: 'Later' } });
    await q.processSyncQueue();

    expect(mocks.updateEvent).toHaveBeenCalledWith(realId, { title: 'Later' });
    expect(stored()).toEqual([]);
  });

  it('keeps an edit of a synced create across a restart (temp id saved as the real id)', async () => {
    await enqueueOfflineCreate('offline_ev_5');
    await q.processSyncQueue();
    const realId = mocks.createEvent.mock.calls[0][0].id;

    await q.enqueueMutation('update_event', { eventId: 'offline_ev_5', updates: { title: 'Edited' } });
    mocks.updateEvent.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    await q.processSyncQueue();
    expect(stored()[0].payload.eventId).toBe(realId);

    // App killed: the in-memory temp -> real map is gone.
    vi.resetModules();
    q = await import('../syncQueue');
    q.setOfflineQueueUser(USER);
    const res = await q.processSyncQueue();
    expect(res.dropped).toBe(0);
    expect(mocks.updateEvent).toHaveBeenLastCalledWith(realId, { title: 'Edited' });
    expect(stored()).toEqual([]);
  });

  it('cancels a create that was deleted before it synced', async () => {
    await enqueueOfflineCreate('offline_ev_4');
    await q.enqueueMutation('delete_event', { eventId: 'offline_ev_4' });

    await q.processSyncQueue();

    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(stored()).toEqual([]);
  });
});

describe('fix 2: mutations enqueued during a sync', () => {
  it('are not lost when the sync writes its result', async () => {
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: { title: 'x' } });

    let release!: () => void;
    mocks.updateEvent.mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve({ data: {}, error: null }); })
    );

    const syncing = q.processSyncQueue();
    await vi.waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled());
    const lateId = await q.enqueueMutation('delete_event', { eventId: 'real-2' });
    release();
    const res = await syncing;

    expect(res.synced).toBe(1);
    const queue = stored();
    expect(queue.map((m: any) => m.id)).toEqual([lateId]);
  });

  it('does not resurrect a queue that was cleared (logout) during the sync', async () => {
    mocks.updateEvent.mockResolvedValue({ data: null, error: pgError('42501', 'rls') });
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: {} });

    let release!: () => void;
    mocks.updateEvent.mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve({ data: null, error: pgError('42501', 'rls') }); })
    );
    const syncing = q.processSyncQueue();
    await vi.waitFor(() => expect(mocks.updateEvent).toHaveBeenCalled());
    await storage.clearOfflineCache();
    release();
    await syncing;

    expect(localStorage.getItem(queueKey())).toBeNull();
  });
});

describe('fix 3: retry cap', () => {
  it(`drops a permanently failing mutation after ${5} attempts and reports it`, async () => {
    mocks.updateEvent.mockResolvedValue({ data: null, error: pgError('42501', 'new row violates row-level security policy') });
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: { title: 'x' } });

    for (let i = 1; i < q.MAX_RETRIES; i++) {
      const res = await q.processSyncQueue(undefined, { force: true });
      expect(res).toMatchObject({ synced: 0, failed: 1, dropped: 0 });
      expect(stored()[0].retryCount).toBe(i);
    }

    const last = await q.processSyncQueue(undefined, { force: true });
    expect(last.failed).toBe(1);
    expect(last.dropped).toBe(1);
    expect(last.droppedMutations[0]).toMatchObject({ reason: 'max_retries' });
    expect(last.droppedMutations[0].error).toMatch(/row-level security/);
    expect(stored()).toEqual([]);
    expect(mocks.updateEvent).toHaveBeenCalledTimes(q.MAX_RETRIES);
  });

  it('does not count network errors towards the cap and keeps later mutations untouched', async () => {
    mocks.updateEvent.mockResolvedValue({ data: null, error: new Error('Failed to fetch') });
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: {} });
    await q.enqueueMutation('delete_event', { eventId: 'real-2' });

    for (let i = 0; i < q.MAX_RETRIES + 2; i++) {
      const res = await q.processSyncQueue();
      expect(res.dropped).toBe(0);
    }

    const queue = stored();
    expect(queue).toHaveLength(2);
    expect(queue.every((m: any) => m.retryCount === 0)).toBe(true);
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });

  it('drops orphaned temp-id mutations instead of sending them', async () => {
    await q.enqueueMutation('update_event', { eventId: 'offline_ev_gone', updates: {} });

    const res = await q.processSyncQueue();

    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(res.dropped).toBe(1);
    expect(res.droppedMutations[0].reason).toBe('orphaned');
    expect(stored()).toEqual([]);
  });

  it('classifies errors', () => {
    expect(q.isTransientSyncError(new Error('Failed to fetch'))).toBe(true);
    expect(q.isTransientSyncError(pgError('PGRST301', 'JWT expired'))).toBe(true);
    expect(q.isTransientSyncError(pgError('08006'))).toBe(true);
    expect(q.isTransientSyncError(pgError('42501'))).toBe(false);
    // SQLSTATE wins over message sniffing ("offline_" in an invalid-uuid message is not a network error)
    expect(q.isTransientSyncError(pgError('22P02', 'invalid input syntax for type uuid: "offline_ev_1"'))).toBe(false);
  });
});

describe('fix 4: idempotent creates', () => {
  it('assigns a client UUID at enqueue time and sends it as the row id', async () => {
    await enqueueOfflineCreate('offline_ev_1');
    const [m] = await q.getPendingMutations();
    expect(typeof m.payload.clientId).toBe('string');
    expect(m.payload.clientId).not.toMatch(/^offline_/);
    expect(m.payload.eventData.id).toBe('offline_ev_1'); // UI temp id untouched

    await q.processSyncQueue();
    expect(mocks.createEvent.mock.calls[0][0].id).toBe(m.payload.clientId);
  });

  it('sends the same id on retry and treats a 23505 unique violation as success', async () => {
    await enqueueOfflineCreate('offline_ev_1');
    mocks.createEvent.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') });
    await q.processSyncQueue();
    expect(stored()).toHaveLength(1);

    mocks.createEvent.mockResolvedValueOnce({ data: null, error: pgError('23505', 'duplicate key value violates unique constraint "events_pkey"') });
    const res = await q.processSyncQueue();

    const [first, second] = mocks.createEvent.mock.calls;
    expect(second[0].id).toBe(first[0].id);
    expect(res.synced).toBe(1);
    expect(stored()).toEqual([]);
  });

  it('passes the client id to personal gig creates', async () => {
    await q.enqueueMutation(
      'create_event',
      { eventData: { id: 'offline_ev_9' }, isPersonalGig: true, personalGigInput: { userId: USER, title: 'A', eventDate: '2026-01-01' } },
      'offline_ev_9'
    );
    const [m] = await q.getPendingMutations();
    await q.processSyncQueue();
    expect(mocks.createPersonalGig.mock.calls[0][0].id).toBe(m.payload.clientId);
  });

  it('reuses an existing UUID row id instead of generating one', async () => {
    const uuid = '2f1c7a9e-5b3d-4c8e-9a1f-0d2e3b4c5d6e';
    await q.enqueueMutation('create_event', { eventData: { id: uuid, band_id: 'b1' } });
    const [m] = await q.getPendingMutations();
    expect(m.payload.clientId).toBe(uuid);
  });

  it('generateClientId falls back to a v4 UUID without crypto.randomUUID', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: original.getRandomValues }, configurable: true });
    try {
      expect(q.generateClientId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});

describe('fix 5: user scoping', () => {
  it('stores the queue under bw:offline_queue:<userId> and isolates users', async () => {
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: {} });
    expect(stored(USER)).toHaveLength(1);
    expect(localStorage.getItem('bw_offline_mutation_queue')).toBeNull();

    q.setOfflineQueueUser('user_b');
    expect(await q.getPendingMutations()).toEqual([]);
    await q.processSyncQueue();
    expect(mocks.updateEvent).not.toHaveBeenCalled();

    q.setOfflineQueueUser(USER);
    expect(await q.getPendingMutations()).toHaveLength(1);
  });

  it('follows Supabase auth events', async () => {
    await q.getPendingMutations(); // binds to auth
    expect(mocks.authCallbacks).toHaveLength(1);
    mocks.authCallbacks[0]('SIGNED_IN', { user: { id: 'user_c' } });
    await q.enqueueMutation('delete_event', { eventId: 'real-1' });
    expect(stored('user_c')).toHaveLength(1);

    mocks.authCallbacks[0]('SIGNED_OUT', null);
    expect(await q.getPendingMutations()).toEqual([]);
  });

  it('logout (clearOfflineCache) wipes the queue so the next user cannot replay it', async () => {
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: {} });
    await storage.clearOfflineCache();
    expect(await q.getPendingMutations()).toEqual([]);
  });

  it('clearOfflineQueue removes the current user queue and the legacy key', async () => {
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: {} });
    localStorage.setItem('bw_offline_mutation_queue', '[]');
    await q.clearOfflineQueue();
    expect(localStorage.getItem(queueKey())).toBeNull();
    expect(localStorage.getItem('bw_offline_mutation_queue')).toBeNull();
  });

  it('migrates a legacy queue owned by the signing-in user', async () => {
    localStorage.setItem(
      'bw_offline_mutation_queue',
      JSON.stringify([{ id: 'offline_ev_x', type: 'create_event', timestamp: 1, retryCount: 0, payload: { eventData: { id: 'offline_ev_x', created_by: 'user_d' } } }])
    );
    q.setOfflineQueueUser('user_d');
    const pending = await q.getPendingMutations();
    expect(pending.map((m) => m.id)).toEqual(['offline_ev_x']);
    expect(localStorage.getItem('bw_offline_mutation_queue')).toBeNull();
  });

  it('discards a legacy queue that belongs to another user', async () => {
    localStorage.setItem(
      'bw_offline_mutation_queue',
      JSON.stringify([{ id: 'offline_ev_x', type: 'create_event', timestamp: 1, retryCount: 0, payload: { eventData: { created_by: 'someone_else' } } }])
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    q.setOfflineQueueUser('user_e');
    expect(await q.getPendingMutations()).toEqual([]);
    expect(localStorage.getItem('bw_offline_mutation_queue')).toBeNull();
    warn.mockRestore();
  });
});

describe('fix 6: retry backoff', () => {
  const rejectRls = () =>
    mocks.updateEvent.mockResolvedValue({ data: null, error: pgError('42501', 'new row violates row-level security policy') });

  afterEach(() => vi.useRealTimers());

  it('does not retry a rejected mutation on back-to-back automatic passes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    rejectRls();
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: { title: 'x' } });

    for (let i = 0; i < q.MAX_RETRIES + 3; i++) await q.processSyncQueue();

    expect(mocks.updateEvent).toHaveBeenCalledTimes(1);
    expect(stored()).toHaveLength(1);
    expect(stored()[0].retryCount).toBe(1);
  });

  it('retries once the delay has passed, with a growing delay', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    rejectRls();
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: { title: 'x' } });

    await q.processSyncQueue();
    vi.setSystemTime(Date.now() + q.retryDelayMs(1) - 1);
    await q.processSyncQueue();
    expect(mocks.updateEvent).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 1);
    await q.processSyncQueue();
    expect(mocks.updateEvent).toHaveBeenCalledTimes(2);
    expect(q.retryDelayMs(2)).toBeGreaterThan(q.retryDelayMs(1));
  });

  it('a waiting mutation does not block the others', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    rejectRls();
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: { title: 'x' } });
    await q.processSyncQueue();
    await q.enqueueMutation('delete_event', { eventId: 'real-2' });

    const res = await q.processSyncQueue();

    expect(mocks.deleteEvent).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ synced: 1, failed: 0, dropped: 0 });
    expect(stored()).toHaveLength(1);
  });

  it('a forced pass retries straight away', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    rejectRls();
    await q.enqueueMutation('update_event', { eventId: 'real-1', updates: { title: 'x' } });
    await q.processSyncQueue();
    await q.processSyncQueue(undefined, { force: true });
    expect(mocks.updateEvent).toHaveBeenCalledTimes(2);
  });
});

describe('setlist, to-dos and lineup saved offline (B5)', () => {
  const extras = {
    setlist: { bandId: 'b1', name: 'Gig setlist', songs: [{ song_id: 's1', position: 0, set_number: 1 }] },
    tasks: { drafts: [{ title: 'Print setlists' }], originalIds: [], eventDate: '2026-12-01' },
  };

  it('replays them on the created event once it is on the server', async () => {
    await q.enqueueMutation(
      'create_event',
      { eventData: { id: 'offline_ev_x', _tempId: 'offline_ev_x', band_id: 'b1', title: 'Gig' }, memberIds: [], extras },
      'offline_ev_x'
    );
    await q.processSyncQueue();
    const realId = mocks.createEvent.mock.calls[0][0].id;
    expect(mocks.replayEventExtras).toHaveBeenCalledWith(realId, extras);
  });

  it('does not replay them when the create fails', async () => {
    mocks.createEvent.mockResolvedValue({ data: null, error: pgError('23514', 'check violation') });
    await q.enqueueMutation('create_event', { eventData: { id: 'offline_ev_y', band_id: 'b1' }, extras }, 'offline_ev_y');
    await q.processSyncQueue();
    expect(mocks.replayEventExtras).not.toHaveBeenCalled();
  });

  it('replays an edit: lineup, setlist and to-dos after the event row', async () => {
    const editExtras = { ...extras, lineup: [{ user_id: 'u2', role: 'Bass', fee: 200, status: 'pending' }] };
    await q.enqueueMutation('update_event', { eventId: 'ev-1', updates: { title: 'Gig' }, extras: editExtras });
    await q.processSyncQueue();
    expect(mocks.updateEvent).toHaveBeenCalledWith('ev-1', { title: 'Gig' });
    expect(mocks.replayEventExtras).toHaveBeenCalledWith('ev-1', editExtras);
  });

  it('an edit of a not-yet-synced gig carries its lineup and setlist into the create', async () => {
    await q.enqueueMutation(
      'create_event',
      { eventData: { id: 'offline_ev_z', band_id: 'b1' }, memberIds: [{ id: 'u1', status: 'confirmed' }], extras: { tasks: extras.tasks } },
      'offline_ev_z'
    );
    const lineup = [{ user_id: 'u1', status: 'confirmed' }, { user_id: 'u3', status: 'pending' }];
    await q.enqueueMutation('update_event', { eventId: 'offline_ev_z', updates: {}, extras: { setlist: extras.setlist, lineup } });
    await q.processSyncQueue();
    expect(mocks.createEvent.mock.calls[0][1].map((m: any) => m.user_id)).toEqual(['u1', 'u3']);
    const [, replayed] = mocks.replayEventExtras.mock.calls[0];
    expect(replayed).toEqual({ tasks: extras.tasks, setlist: extras.setlist });
  });
});
