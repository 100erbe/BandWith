import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t) },
  getSafeUser: async () => ({ data: { user: { id: 'me' } } }),
}));

import { EVENT_PRIVATE_COLUMNS, EVENT_PUBLIC_COLUMNS, attachEventPrivate, getEventPrivate, privateFieldsOf, withEventPrivate } from '../eventPrivate';
import { getEvents } from '../events';

/** Chainable query stub: every builder method returns itself, awaiting it resolves `result`. */
const query = (result: unknown) => {
  const calls: { method: string; args: unknown[] }[] = [];
  const q: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => void) => res(result);
      if (prop === 'calls') return calls;
      return (...args: unknown[]) => { calls.push({ method: String(prop), args }); return q; };
    },
  });
  return q;
};

/** Every events column in production on 2026-11-13. */
const PRODUCTION_COLUMNS = [
  'id', 'band_id', 'title', 'description', 'event_type', 'venue', 'address', 'date', 'time', 'duration_hours',
  'status', 'pay', 'notes', 'client_name', 'client_email', 'client_phone', 'created_by', 'created_at', 'updated_at',
  'fee', 'currency', 'deposit_amount', 'deposit_paid', 'payment_status', 'dress_code', 'internal_notes',
  'contract_url', 'contract_signed', 'quote_id', 'event_date', 'start_time', 'end_time', 'venue_name',
  'venue_address', 'venue_city', 'venue_country', 'venue_coordinates', 'indoor_outdoor', 'load_in_time',
  'soundcheck_time', 'setlist_id', 'client_company', 'attachments', 'is_recurring', 'recurrence_rule',
  'parent_event_id', 'price', 'capacity',
];

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe('event private data (078)', () => {
  it('public and private columns split every events column, with no overlap', () => {
    const publicCols = EVENT_PUBLIC_COLUMNS.split(',').map((c) => c.trim());
    for (const col of EVENT_PRIVATE_COLUMNS) expect(publicCols).not.toContain(col);
    expect([...publicCols, ...EVENT_PRIVATE_COLUMNS].sort()).toEqual([...PRODUCTION_COLUMNS].sort());
  });

  it('a member keeps the logistics and loses price and client, a manager gets them', () => {
    const events = [
      { id: 'managed', title: 'Wedding', venue_name: 'Villa' },
      { id: 'member', title: 'Club', venue_name: 'Blue Note', price: 1200, client_name: 'Leaky Ltd' },
    ];
    const merged = withEventPrivate(events, [{ event_id: 'managed', private: { price: 3000, client_name: 'Giulia & Marco' } }]);
    expect(merged[0]).toMatchObject({ venue_name: 'Villa', price: 3000, client_name: 'Giulia & Marco' });
    expect(merged[1]).toEqual({ id: 'member', title: 'Club', venue_name: 'Blue Note' });
  });

  it('asks the RPC once per distinct event', async () => {
    rpc.mockResolvedValue({ data: [{ event_id: 'e1', private: { price: 3000 } }], error: null });
    const { data } = await getEventPrivate(['e1', 'e1', '']);
    expect(rpc).toHaveBeenCalledWith('bw_event_private', { p_event_ids: ['e1'] });
    expect(data).toEqual([{ event_id: 'e1', private: { price: 3000 } }]);
    expect(from).not.toHaveBeenCalled();
  });

  it('falls back to the columns while the database is before 078', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    from.mockReturnValue(query({ data: [{ id: 'e1', price: 3000 }], error: null }));
    const { data } = await getEventPrivate(['e1']);
    expect(from).toHaveBeenCalledWith('events');
    expect(data).toEqual([{ event_id: 'e1', private: { price: 3000 } }]);
  });

  it('a failed read fails the load instead of returning gigs without a price', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'network' } });
    await expect(attachEventPrivate([{ id: 'e1' }])).rejects.toThrow('network');
  });

  it('a write completes its row from the private values it sent', () => {
    expect(privateFieldsOf({ title: 'Gig', price: 3000, client_name: undefined, fee: 0 })).toEqual({ price: 3000, fee: 0 });
  });
});

describe('getEvents (078)', () => {
  it('reads only public columns and merges price and client for managed events', async () => {
    const q = query({ data: [{ id: 'e1', title: 'Wedding' }, { id: 'e2', title: 'Club' }], error: null });
    from.mockReturnValue(q);
    rpc.mockResolvedValue({ data: [{ event_id: 'e1', private: { price: 3000 } }], error: null });

    const { data, error } = await getEvents(['band-1']);

    expect(error).toBeNull();
    const select = q.calls.find((c: { method: string }) => c.method === 'select');
    expect(String(select.args[0])).toBe(EVENT_PUBLIC_COLUMNS);
    expect(data?.[0]).toMatchObject({ id: 'e1', price: 3000 });
    expect(data?.[1]).not.toHaveProperty('price');
  });
});

describe('convertQuoteToEvent (078)', () => {
  it('reads back only the new event id, never the price or client columns', async () => {
    const quote = { id: 'q1', band_id: 'band-1', event_name: 'Wedding', total: 3000, client_name: 'Giulia', created_by: 'me' };
    const eventsQ = query({ data: { id: 'e1' }, error: null });
    from.mockImplementation((t: string) => (t === 'events' ? eventsQ : query({ data: quote, error: null })));

    const { convertQuoteToEvent } = await import('../quotes');
    const { data, error } = await convertQuoteToEvent('q1');

    expect(error).toBeNull();
    expect(data).toEqual({ eventId: 'e1' });
    const select = eventsQ.calls.find((c: { method: string }) => c.method === 'select');
    expect(select.args).toEqual(['id']);
  });
});
