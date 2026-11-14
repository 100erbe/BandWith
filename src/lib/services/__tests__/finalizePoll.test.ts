import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Every call in order: "<table>.<op>" plus the filters, so ordering can be checked. */
const log: string[] = [];
let claimRows: { id: string }[] = [{ id: 'p1' }];
let pollStatus = 'polling';

const query = (table: string) => {
  let op = 'select';
  let payload: any = null;
  const filters: string[] = [];
  const q: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') {
        return (res: (v: unknown) => void) => {
          log.push(`${table}.${op}${payload?.status ? `:${payload.status}` : ''}${filters.length ? `[${filters.join(',')}]` : ''}`);
          if (table === 'rehearsal_polls' && op === 'update' && payload?.status === 'confirmed') return res({ data: claimRows, error: null });
          return res({ data: [], error: null });
        };
      }
      if (prop === 'single') {
        return async () => {
          log.push(`${table}.single`);
          if (table === 'rehearsal_poll_options') return { data: { id: 'o1', proposed_date: '2026-12-01', start_time: '20:00' }, error: null };
          return { data: { id: 'p1', band_id: 'b1', title: 'Practice', status: pollStatus, invited_user_ids: [] }, error: null };
        };
      }
      return (...args: unknown[]) => {
        if (prop === 'update' || prop === 'insert' || prop === 'delete' || prop === 'upsert') {
          op = String(prop);
          payload = args[0];
        } else if (prop === 'eq' || prop === 'not' || prop === 'is') {
          filters.push(`${String(prop)}:${args.map(String).join(':')}`);
        }
        return q;
      };
    },
  });
  return q;
};

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => query(t), rpc: vi.fn() },
  getSafeUser: async () => ({ data: { user: { id: 'admin' } } }),
}));
vi.mock('../supabase', () => ({
  supabase: { from: (t: string) => query(t), rpc: vi.fn() },
  getSafeUser: async () => ({ data: { user: { id: 'admin' } } }),
}));

const createEvent = vi.fn();
vi.mock('../events', () => ({ createEvent: (...a: unknown[]) => createEvent(...a) }));
vi.mock('../bandMemberFees', () => ({ attachMemberFees: async (rows: unknown[]) => rows }));
vi.mock('../songs', () => ({ createSetlist: vi.fn(), deleteSetlist: vi.fn(async () => ({ error: null })) }));
vi.mock('../notifications', () => ({ createBulkNotifications: vi.fn(async () => ({ error: null })) }));

import { finalizePollIntoRehearsal, POLL_CLOSED } from '../rehearsalPolls';

const args = { pollId: 'p1', winningOptionId: 'o1', bandId: 'b1', location: 'Studio', adminId: 'admin' };

beforeEach(() => {
  log.length = 0;
  claimRows = [{ id: 'p1' }];
  pollStatus = 'polling';
  createEvent.mockReset();
  createEvent.mockImplementation(async () => {
    log.push('createEvent');
    return { data: { id: 'e1' }, error: null };
  });
});

describe('finalizePollIntoRehearsal (lock in once)', () => {
  it('claims the poll before creating the rehearsal', async () => {
    const { error } = await finalizePollIntoRehearsal(args);
    expect(error).toBeNull();
    const claim = log.findIndex((l) => l.startsWith('rehearsal_polls.update:confirmed'));
    expect(claim).toBeGreaterThan(-1);
    expect(log[claim]).toContain('not:status:in:(confirmed,cancelled)');
    expect(claim).toBeLessThan(log.indexOf('createEvent'));
  });

  it('creates nothing when another admin locked it in first', async () => {
    claimRows = [];
    const { error } = await finalizePollIntoRehearsal(args);
    expect((error as { code?: string }).code).toBe(POLL_CLOSED);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('creates nothing on a poll that is already confirmed', async () => {
    pollStatus = 'confirmed';
    const { error } = await finalizePollIntoRehearsal(args);
    expect((error as { code?: string }).code).toBe(POLL_CLOSED);
    expect(createEvent).not.toHaveBeenCalled();
    expect(log.some((l) => l.startsWith('rehearsal_polls.update'))).toBe(false);
  });

  it('opens the poll again when the rehearsal cannot be created', async () => {
    createEvent.mockImplementation(async () => ({ data: null, error: new Error('boom') }));
    const { error } = await finalizePollIntoRehearsal(args);
    expect(error?.message).toBe('boom');
    expect(log.some((l) => l.startsWith('rehearsal_polls.update:polling'))).toBe(true);
  });
});
