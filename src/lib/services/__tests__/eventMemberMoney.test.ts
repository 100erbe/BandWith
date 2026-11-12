/**
 * Fees and payouts go through RPCs (071), with a fallback while the database
 * does not have them yet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcResults: Record<string, { data: unknown; error: unknown }> = {};
const tableResult: { data: unknown; error: unknown } = { data: [], error: null };
const rpcCalls: Array<[string, unknown]> = [];
const tableCalls: Array<[string, ...unknown[]]> = [];

vi.mock('@/lib/supabase', () => {
  const chain: any = {
    select: (...a: unknown[]) => { tableCalls.push(['select', ...a]); return chain; },
    in: (...a: unknown[]) => { tableCalls.push(['in', ...a]); return chain; },
    eq: (...a: unknown[]) => { tableCalls.push(['eq', ...a]); return chain; },
    upsert: (...a: unknown[]) => { tableCalls.push(['upsert', ...a]); return Promise.resolve({ error: null }); },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(tableResult).then(res, rej),
  };
  return {
    supabase: {
      rpc: (fn: string, args: unknown) => {
        rpcCalls.push([fn, args]);
        return Promise.resolve(rpcResults[fn] ?? { data: null, error: null });
      },
      from: () => chain,
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }) },
    },
  };
});

import { getEventMemberMoney, saveEventLineup, withMoney } from '../eventMemberMoney';

const missing = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };

beforeEach(() => {
  for (const k of Object.keys(rpcResults)) delete rpcResults[k];
  rpcCalls.length = 0;
  tableCalls.length = 0;
  tableResult.data = [];
});

describe('getEventMemberMoney', () => {
  it('reads fees from the RPC', async () => {
    rpcResults.bw_event_member_money = { data: [{ event_id: 'e1', user_id: 'u1', fee: '150.00', paid_at: null }], error: null };
    const { data, error } = await getEventMemberMoney(['e1']);
    expect(error).toBeNull();
    expect(data).toEqual([{ event_id: 'e1', user_id: 'u1', fee: 150, paid_at: null }]);
    expect(rpcCalls[0]).toEqual(['bw_event_member_money', { p_event_ids: ['e1'] }]);
    expect(tableCalls).toHaveLength(0);
  });

  it('falls back to the columns before 071', async () => {
    rpcResults.bw_event_member_money = missing;
    tableResult.data = [{ event_id: 'e1', user_id: 'u1', fee: 90, paid_at: null }];
    const { data } = await getEventMemberMoney(['e1']);
    expect(data[0].fee).toBe(90);
    expect(tableCalls).toContainEqual(['in', 'event_id', ['e1']]);
  });

  it('skips the call for an empty list', async () => {
    const { data } = await getEventMemberMoney([]);
    expect(data).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('withMoney', () => {
  it('adds fees only to the rows the caller may see', async () => {
    rpcResults.bw_event_member_money = { data: [{ event_id: 'e1', user_id: 'me', fee: 80, paid_at: null }], error: null };
    const rows = await withMoney([{ user_id: 'me', status: 'confirmed' }, { user_id: 'other', status: 'pending' }], 'e1');
    expect(rows[0]).toMatchObject({ user_id: 'me', fee: 80 });
    expect(rows[1]).not.toHaveProperty('fee');
  });
});

describe('saveEventLineup', () => {
  it('saves through the RPC with defaults', async () => {
    rpcResults.bw_save_event_lineup = { data: 1, error: null };
    const { error } = await saveEventLineup('e1', [{ user_id: 'u1', fee: 100 }]);
    expect(error).toBeNull();
    expect(rpcCalls[0]).toEqual([
      'bw_save_event_lineup',
      { p_event_id: 'e1', p_rows: [{ user_id: 'u1', role: null, fee: 100, status: 'pending' }] },
    ]);
  });

  it('falls back to an upsert before 071', async () => {
    rpcResults.bw_save_event_lineup = missing;
    await saveEventLineup('e1', [{ user_id: 'u1', fee: 100, role: 'Bass', status: 'confirmed' }]);
    expect(tableCalls[0][0]).toBe('upsert');
  });
});
