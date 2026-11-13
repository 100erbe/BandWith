import { describe, it, expect } from 'vitest';
import { gigTypeOf, revenueByType } from '../revenueByType';

describe('gigTypeOf', () => {
  it('keeps known types, files the rest under other and skips non-gigs', () => {
    expect(gigTypeOf('Wedding')).toBe('wedding');
    expect(gigTypeOf('gig')).toBe('gig');
    expect(gigTypeOf('quote')).toBe('other');
    expect(gigTypeOf(null)).toBe('other');
    expect(gigTypeOf('rehearsal')).toBeNull();
    expect(gigTypeOf('personal')).toBeNull();
  });
});

describe('revenueByType', () => {
  it('returns nothing for no booked gigs', () => {
    expect(revenueByType([])).toEqual({ rows: [], total: 0 });
    expect(revenueByType([{ event_type: 'wedding', status: 'tentative', fee: 900 }])).toEqual({ rows: [], total: 0 });
  });

  it('sums confirmed and completed gigs per type, highest first', () => {
    const { rows, total } = revenueByType([
      { event_type: 'wedding', status: 'confirmed', fee: 3000 },
      { event_type: 'wedding', status: 'completed', fee: '1000' },
      { event_type: 'club', status: 'confirmed', fee: 1000 },
      { event_type: 'club', status: 'cancelled', fee: 5000 },
      { event_type: 'rehearsal', status: 'confirmed', fee: 200 },
    ]);
    expect(total).toBe(5000);
    expect(rows).toEqual([
      { type: 'wedding', total: 4000, count: 2, share: 0.8 },
      { type: 'club', total: 1000, count: 1, share: 0.2 },
    ]);
  });

  it('counts gigs without a fee and orders ties by number of gigs', () => {
    const { rows, total } = revenueByType([
      { event_type: 'pub', status: 'confirmed', fee: null },
      { event_type: 'festival', status: 'confirmed', fee: 0 },
      { event_type: 'festival', status: 'confirmed', fee: -5 },
    ]);
    expect(total).toBe(0);
    expect(rows.map((r) => [r.type, r.count, r.share])).toEqual([['festival', 2, 0], ['pub', 1, 0]]);
  });
});
