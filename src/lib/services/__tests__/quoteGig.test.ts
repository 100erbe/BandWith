/**
 * "Create gig from quote" (audit C3): the gig gets the quote's musicians and
 * fees as its lineup, and a second tap or a failed link back to the quote
 * never makes a second gig.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
const notify = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t) },
  getSafeUser: async () => ({ data: { user: { id: ME, email: 'demo@example.com', user_metadata: {} } } }),
}));
vi.mock('../notifications', () => ({ notifyEventMembersCreated: (...a: unknown[]) => notify(...a) }));

import { convertQuoteToEvent, gigFromAcceptedQuote, lineupFromQuoteMusicians } from '../quotes';

const ME = '10000001-0000-4000-8000-000000000001';
const U2 = '10000002-0000-4000-8000-000000000002';
const U3 = '10000003-0000-4000-8000-000000000003';

type Call = { method: string; args: unknown[] };
/** Chainable query stub; `result(calls)` decides what awaiting it returns. */
const query = (result: (calls: Call[]) => unknown, log: Call[][]) => {
  const calls: Call[] = [];
  log.push(calls);
  const q: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (res: (v: unknown) => void) => res(result(calls));
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return q;
        };
      },
    },
  );
  return q;
};
const did = (calls: Call[], method: string) => calls.some((c) => c.method === method);

interface Setup {
  quote?: Record<string, unknown>;
  musicians?: unknown[];
  existingEventId?: string | null;
  linkError?: unknown;
  lineupError?: unknown;
}

let log: Record<string, Call[][]>;
let inserted: number;

const setup = (o: Setup = {}) => {
  log = { events: [], quotes: [], quote_musicians: [], profiles: [] };
  inserted = 0;
  const quote = { id: 'q1', band_id: 'band-1', event_name: 'Wedding', event_type: 'wedding', event_date: '2027-06-12', event_time_start: '20:30:00', total: 3000, client_name: 'Client A', created_by: ME, converted_to_event_id: null, ...o.quote };
  let existing = o.existingEventId ?? null;
  from.mockImplementation((table: string) => {
    if (table === 'events') {
      return query((calls) => {
        if (did(calls, 'insert')) {
          inserted += 1;
          existing = `e-new-${inserted}`;
          return { data: { id: existing }, error: null };
        }
        return { data: existing ? [{ id: existing }] : [], error: null };
      }, log.events);
    }
    if (table === 'quotes') {
      return query((calls) => (did(calls, 'update') ? { error: o.linkError ?? null } : { data: quote, error: null }), log.quotes);
    }
    if (table === 'quote_musicians') return query(() => ({ data: o.musicians ?? [], error: null }), log.quote_musicians);
    if (table === 'profiles') return query(() => ({ data: { full_name: 'Leo M.' }, error: null }), log.profiles);
    return query(() => ({ data: null, error: null }), []);
  });
  rpc.mockImplementation(async (fn: string) => (fn === 'bw_save_event_lineup' ? { error: o.lineupError ?? null } : { data: null, error: null }));
  notify.mockResolvedValue({ error: null });
};

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  notify.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('lineupFromQuoteMusicians', () => {
  it('keeps musicians with an account, once each, with their role and fee', () => {
    const rows = lineupFromQuoteMusicians(
      [
        { user_id: ME, instrument: 'Vocals', fee: 300 },
        { user_id: U2, instrument: ' Bass ', fee: 250.555 },
        { user_id: undefined, instrument: 'Sax', fee: 200 },
        { user_id: U2, instrument: 'Bass', fee: 999 },
        { user_id: U3, instrument: '', fee: undefined },
      ],
      ME,
    );
    expect(rows).toEqual([
      { user_id: ME, role: 'Vocals', fee: 300, status: 'confirmed' },
      { user_id: U2, role: 'Bass', fee: 250.56, status: 'pending' },
      { user_id: U3, role: 'Musician', fee: 0, status: 'pending' },
    ]);
  });

  it('is empty without musicians', () => {
    expect(lineupFromQuoteMusicians(undefined)).toEqual([]);
    expect(lineupFromQuoteMusicians(null)).toEqual([]);
  });
});

describe('convertQuoteToEvent', () => {
  it('creates the gig with the quote lineup and fees, and tells each musician only their own fee', async () => {
    setup({
      musicians: [
        { user_id: ME, instrument: 'Vocals', fee: 300 },
        { user_id: U2, instrument: 'Bass', fee: 250 },
        { user_id: null, name: 'External sax', instrument: 'Sax', fee: 200 },
      ],
    });
    const { data, error } = await convertQuoteToEvent('q1');

    expect(error).toBeNull();
    expect(data).toEqual({ eventId: 'e-new-1', created: true });
    expect(rpc).toHaveBeenCalledWith('bw_save_event_lineup', {
      p_event_id: 'e-new-1',
      p_rows: [
        { user_id: ME, role: 'Vocals', fee: 300, status: 'confirmed' },
        { user_id: U2, role: 'Bass', fee: 250, status: 'pending' },
      ],
    });
    expect(notify).toHaveBeenCalledTimes(1);
    const args = notify.mock.calls[0];
    expect(args[8]).toEqual([U2]);
    expect(args[9]).toMatchObject({ memberFees: { [U2]: 250 } });
    // The quote now points at its gig.
    const update = log.quotes.flat().find((c) => c.method === 'update');
    expect(update?.args[0]).toEqual({ converted_to_event_id: 'e-new-1' });
  });

  it('uses the gig already made from the quote instead of making a second one', async () => {
    setup({ existingEventId: 'e-old', musicians: [{ user_id: U2, instrument: 'Bass', fee: 250 }] });
    const { data, error } = await convertQuoteToEvent('q1');

    expect(error).toBeNull();
    expect(data).toEqual({ eventId: 'e-old', created: false });
    expect(inserted).toBe(0);
    expect(rpc).not.toHaveBeenCalledWith('bw_save_event_lineup', expect.anything());
    const update = log.quotes.flat().find((c) => c.method === 'update');
    expect(update?.args[0]).toEqual({ converted_to_event_id: 'e-old' });
  });

  it('a failed link back still returns the gig, and the next try finds it (no duplicate)', async () => {
    setup({ linkError: { message: 'network' } });
    const first = await convertQuoteToEvent('q1');
    expect(first.error).toBeNull();
    expect(first.data?.eventId).toBe('e-new-1');

    const second = await convertQuoteToEvent('q1');
    expect(second.data).toEqual({ eventId: 'e-new-1', created: false });
    expect(inserted).toBe(1);
  });

  it('says so when the gig was made but its lineup was not saved', async () => {
    setup({ musicians: [{ user_id: U2, instrument: 'Bass', fee: 250 }], lineupError: { message: 'denied' } });
    const { data, error } = await convertQuoteToEvent('q1');
    expect(error).toBeNull();
    expect(data).toEqual({ eventId: 'e-new-1', created: true, lineupError: true });
    expect(notify).not.toHaveBeenCalled();
  });

  it('names an untitled gig after the client', async () => {
    setup({ quote: { event_name: null, client_name: 'Client B' } });
    await convertQuoteToEvent('q1');
    const insert = log.events.flat().find((c) => c.method === 'insert');
    expect((insert?.args[0] as { title: string }).title).toBe('Gig for Client B');
  });
});

describe('gigFromAcceptedQuote', () => {
  it('two taps at once make one gig', async () => {
    setup();
    const [a, b] = await Promise.all([gigFromAcceptedQuote('q1'), gigFromAcceptedQuote('q1')]);
    expect(a.data?.eventId).toBe('e-new-1');
    expect(b.data?.eventId).toBe('e-new-1');
    expect(inserted).toBe(1);
  });

  it('confirms the tentative gig made with the quote', async () => {
    setup({ quote: { converted_to_event_id: 'e-tentative' } });
    const { data } = await gigFromAcceptedQuote('q1');
    expect(data).toEqual({ eventId: 'e-tentative', created: false });
    expect(inserted).toBe(0);
  });
});
