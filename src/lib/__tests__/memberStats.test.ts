import { describe, it, expect } from 'vitest';
import { memberStatsFromRows, orderMemberStats, stillOwed, type MemberEventRow } from '../memberStats';

const today = '2026-11-13';
const gig = (user_id: string, event_date: string, answer: string, extra: Partial<MemberEventRow> = {}): MemberEventRow => ({
  user_id, event_date, answer, event_type: 'wedding', event_status: 'confirmed', fee: 100, paid_at: null, ...extra,
});

describe('memberStatsFromRows', () => {
  it('returns a zero row for a member with no events and ignores strangers', () => {
    const stats = memberStatsFromRows([gig('x', '2026-10-01', 'confirmed')], [{ user_id: 'a' }], today);
    expect(stats).toEqual([{ user_id: 'a', is_active: true, gigs_played: 0, gigs_upcoming: 0, rehearsals: 0, declined: 0, pending: 0, earned: 0, paid: 0 }]);
  });

  it('counts played and upcoming booked gigs with fees earned and paid', () => {
    const [s] = memberStatsFromRows(
      [
        gig('a', '2026-10-01', 'confirmed', { fee: 250, paid_at: '2026-10-05T10:00:00Z' }),
        gig('a', '2026-11-01', 'confirmed', { fee: '150' }),
        gig('a', today, 'confirmed', { fee: 400 }), // today counts as coming up
        gig('a', '2026-09-01', 'confirmed', { event_status: 'tentative' }), // not booked
        gig('a', '2026-09-02', 'pending'), // never answered: not played
      ],
      [{ user_id: 'a' }],
      today,
    );
    expect(s).toMatchObject({ gigs_played: 2, gigs_upcoming: 1, earned: 400, paid: 250 });
    expect(stillOwed(s)).toBe(150);
  });

  it('counts rehearsals attended, declines and pending answers on events still to come', () => {
    const [s] = memberStatsFromRows(
      [
        gig('a', '2026-10-01', 'confirmed', { event_type: 'rehearsal', event_status: 'scheduled' }),
        gig('a', '2026-10-08', 'confirmed', { event_type: 'rehearsal', event_status: 'cancelled' }),
        gig('a', '2026-12-01', 'confirmed', { event_type: 'rehearsal', event_status: 'scheduled' }),
        gig('a', '2026-10-02', 'declined'),
        gig('a', '2026-12-02', 'pending'),
        gig('a', '2026-12-03', 'pending', { event_status: 'cancelled' }),
        gig('a', '2026-10-03', 'pending'),
      ],
      [{ user_id: 'a', is_active: false }],
      today,
    );
    expect(s).toMatchObject({ is_active: false, rehearsals: 1, declined: 1, pending: 1, gigs_played: 0, earned: 0 });
  });
});

describe('orderMemberStats', () => {
  const row = (user_id: string, name: string, played: number, extra = {}) => ({
    user_id, name, is_active: true, gigs_played: played, gigs_upcoming: 0, rehearsals: 0, declined: 0, pending: 0, earned: 0, paid: 0, ...extra,
  });
  it('puts the viewer first, then the busiest active members, former members last', () => {
    const out = orderMemberStats(
      [row('a', 'Ada', 1), row('b', 'Bea', 5), row('c', 'Cleo', 9, { is_active: false }), row('me', 'Me', 0), row('d', 'Dan', 1)],
      'me',
    );
    expect(out.map((r) => r.user_id)).toEqual(['me', 'b', 'a', 'd', 'c']);
  });
  it('never reports a negative amount owed', () => {
    expect(stillOwed({ earned: 100, paid: 150 })).toBe(0);
  });
});
