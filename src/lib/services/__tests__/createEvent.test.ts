import { describe, it, expect, vi, beforeEach } from 'vitest';

const from = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: (t: string) => from(t) },
  getSafeUser: async () => ({ data: { user: { id: 'me' } } }),
}));

import { createEvent } from '../events';

/** Chainable query stub that records insert payloads. */
const inserts: unknown[] = [];
const query = (result: unknown) => {
  const q: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => void) => res(result);
      return (...args: unknown[]) => {
        if (prop === 'insert') inserts.push(args[0]);
        return q;
      };
    },
  });
  return q;
};

beforeEach(() => {
  from.mockReset();
  inserts.length = 0;
  from.mockImplementation(() => query({ data: { id: 'e1' }, error: null }));
});

describe('createEvent payload', () => {
  it('keeps "Fee TBD" from the wizard', async () => {
    await createEvent({ band_id: 'b1', title: 'Wedding', event_type: 'wedding', payment_status: 'tbd' });
    expect(inserts[0]).toMatchObject({ band_id: 'b1', event_type: 'wedding', payment_status: 'tbd' });
  });

  it('leaves payment_status to the column default when not set', async () => {
    await createEvent({ band_id: 'b1', title: 'Club night' });
    expect(inserts[0]).not.toHaveProperty('payment_status');
  });
});
