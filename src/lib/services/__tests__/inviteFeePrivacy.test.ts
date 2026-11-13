// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const inserted = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock('@/lib/supabase', () => {
  const chain: any = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === 'insert') return (rows: any) => { inserted.rows = Array.isArray(rows) ? rows : [rows]; return chain; };
      if (prop === 'then') {
        const p = Promise.resolve({ data: [], error: null });
        return p.then.bind(p);
      }
      return chain;
    },
    apply: () => chain,
  });
  return { supabase: new Proxy({}, { get: () => () => chain }) };
});

import { notifyEventMembersCreated } from '../notifications';
import { inviteFeeToShow } from '@/lib/inviteFee';

beforeEach(() => { inserted.rows = []; });

describe('gig invite: a member sees only their own fee', () => {
  it('the notification data has the member fee and never the gig total', async () => {
    await notifyEventMembersCreated('b1', 'e1', 'Wedding Rossi', '2026-12-12', '19:30', 'gig', 'admin', 'Leo M.', ['m1', 'm2'], {
      // An older caller could still pass the total: it must not reach members.
      venue: 'Villa Clara', fee: 2400, memberFees: { m1: 360 },
    } as Parameters<typeof notifyEventMembersCreated>[9]);
    expect(inserted.rows).toHaveLength(2);
    for (const row of inserted.rows) {
      expect(row.data).not.toHaveProperty('fee');
      expect(JSON.stringify(row)).not.toContain('2400');
    }
    expect(inserted.rows.find((r) => r.user_id === 'm1').data.member_fee).toBe(360);
    expect(inserted.rows.find((r) => r.user_id === 'm2').data.member_fee).toBeUndefined();
  });

  it('the invite screens show the member fee, or nothing', () => {
    expect(inviteFeeToShow({ member_fee: 360, fee: 2400 })).toBe(360);
    expect(inviteFeeToShow({ fee: 2400 })).toBeNull();
    expect(inviteFeeToShow({ member_fee: 0 })).toBeNull();
    expect(inviteFeeToShow({ member_fee: '360' })).toBe(360);
  });
});
