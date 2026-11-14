import { describe, it, expect } from 'vitest';
import { payoutsDue, type PayoutsDueInput } from '../payoutsDue';

const now = new Date(2026, 11, 14, 12, 0); // Mon 14 Dec 2026, noon

const gig = (id: string, date: string, extra: Partial<PayoutsDueInput['gigs'][number]> = {}) => ({
  id,
  band_id: 'band',
  title: `Gig ${id}`,
  event_type: 'gig',
  status: 'confirmed',
  event_date: date,
  start_time: '20:00',
  end_time: '23:00',
  ...extra,
});

const base: PayoutsDueInput = {
  gigs: [gig('g1', '2026-12-12')],
  members: [
    { event_id: 'g1', user_id: 'me', status: 'confirmed' },
    { event_id: 'g1', user_id: 'marta', status: 'confirmed' },
    { event_id: 'g1', user_id: 'omar', status: 'pending' },
    { event_id: 'g1', user_id: 'sara', status: 'declined' },
    { event_id: 'g1', user_id: 'paid', status: 'confirmed' },
    { event_id: 'g1', user_id: 'free', status: 'confirmed' },
  ],
  money: [
    { event_id: 'g1', user_id: 'me', fee: 360, paid_at: null },
    { event_id: 'g1', user_id: 'marta', fee: 450, paid_at: null },
    { event_id: 'g1', user_id: 'omar', fee: 360, paid_at: null },
    { event_id: 'g1', user_id: 'sara', fee: 360, paid_at: null },
    { event_id: 'g1', user_id: 'paid', fee: 360, paid_at: '2026-12-13T10:00:00Z' },
    { event_id: 'g1', user_id: 'free', fee: 0, paid_at: null },
  ],
  now,
  viewerId: 'me',
  isAdmin: true,
};

describe('payoutsDue', () => {
  it('owes only confirmed musicians with a fee who are not paid yet', () => {
    const [g] = payoutsDue(base);
    expect(g.eventId).toBe('g1');
    expect(g.payouts.map((p) => p.userId)).toEqual(['me', 'marta']);
    expect(g.total).toBe(810);
  });

  it('shows a member only their own payout, never the others', () => {
    const r = payoutsDue({ ...base, isAdmin: false });
    expect(r).toHaveLength(1);
    expect(r[0].payouts).toEqual([{ userId: 'me', fee: 360 }]);
    expect(r[0].total).toBe(360);
    expect(payoutsDue({ ...base, isAdmin: false, viewerId: 'omar' })).toEqual([]);
  });

  it('waits until the gig is over', () => {
    expect(payoutsDue({ ...base, gigs: [gig('g1', '2026-12-14')] })).toEqual([]);
    expect(payoutsDue({ ...base, gigs: [gig('g1', '2026-12-20')] })).toEqual([]);
  });

  it('counts a show past midnight as over only once it ends', () => {
    const late = [gig('g1', '2026-12-13', { start_time: '21:00', end_time: '02:00' })];
    expect(payoutsDue({ ...base, gigs: late, now: new Date(2026, 11, 14, 1, 0) })).toEqual([]);
    expect(payoutsDue({ ...base, gigs: late, now: new Date(2026, 11, 14, 2, 0) })).toHaveLength(1);
  });

  it('counts gigs saved with their kind (club, wedding…) as gigs', () => {
    for (const event_type of ['club', 'Wedding', 'pub', 'corporate', null]) {
      expect(payoutsDue({ ...base, gigs: [gig('g1', '2026-12-12', { event_type })] })).toHaveLength(1);
    }
  });

  it('skips cancelled gigs, quotes, rehearsals and personal gigs', () => {
    for (const extra of [
      { status: 'cancelled' },
      { status: 'tentative' },
      { status: 'draft' },
      { event_type: 'rehearsal' },
      { event_type: 'quote' },
      { band_id: null },
    ]) {
      expect(payoutsDue({ ...base, gigs: [gig('g1', '2026-12-12', extra)] })).toEqual([]);
    }
    expect(payoutsDue({ ...base, gigs: [gig('g1', '2026-12-12', { status: 'completed' })] })).toHaveLength(1);
  });

  it('drops a gig once everyone is paid', () => {
    const money = base.money.map((m) => ({ ...m, paid_at: '2026-12-13T10:00:00Z' }));
    expect(payoutsDue({ ...base, money })).toEqual([]);
  });

  it('lists the oldest gig first', () => {
    const r = payoutsDue({
      ...base,
      gigs: [gig('new', '2026-12-12'), gig('old', '2026-11-28')],
      members: [
        { event_id: 'new', user_id: 'me', status: 'confirmed' },
        { event_id: 'old', user_id: 'me', status: 'confirmed' },
      ],
      money: [
        { event_id: 'new', user_id: 'me', fee: 100, paid_at: null },
        { event_id: 'old', user_id: 'me', fee: 200, paid_at: null },
      ],
    });
    expect(r.map((g) => g.eventId)).toEqual(['old', 'new']);
  });

  it('needs the fee row: no money row means nothing is shown (never €0)', () => {
    expect(payoutsDue({ ...base, money: [] })).toEqual([]);
  });
});
