import { describe, it, expect } from 'vitest';
import { monthStats } from '../modes/PlannerMode';
import { bestOption } from '../modes/FindADateMode';
import { quoteDeskLinesFromQuote } from '../modes/QuoteDeskMode';
import { durationSeconds, hhmm, clock } from '../modes/shared';
import type { RehearsalPollOption } from '@/lib/services/rehearsalPolls';

describe('monthStats', () => {
  it('counts gigs, rehearsals, gig fees and free weekends in the month', () => {
    // November 2026: Saturdays are 7, 14, 21, 28.
    const stats = monthStats(
      [
        { id: '1', title: 'Club', date: '2026-11-07', kind: 'gig', fee: 800 },
        { id: '2', title: 'Wedding', date: '2026-11-22', kind: 'gig', fee: 1500 },
        { id: '3', title: 'Practice', date: '2026-11-11', kind: 'rehearsal' },
        { id: '4', title: 'Quote', date: '2026-11-14', kind: 'quote', fee: 999 },
        { id: '5', title: 'December', date: '2026-12-05', kind: 'gig', fee: 400 },
      ],
      new Date(2026, 10, 1),
    );
    expect(stats).toEqual({ gigs: 2, rehearsals: 1, fees: 2300, freeWeekends: 1 });
  });
});

describe('bestOption', () => {
  const opt = (id: string, date: string, votes: number): RehearsalPollOption => ({
    id, poll_id: 'p', proposed_date: date, start_time: '19:00', created_at: '', vote_count: votes,
  });
  it('picks the most voted option, the earliest on ties, none without votes', () => {
    expect(bestOption([opt('a', '2026-11-20', 2), opt('b', '2026-11-18', 3)])?.id).toBe('b');
    expect(bestOption([opt('a', '2026-11-20', 2), opt('b', '2026-11-18', 2)])?.id).toBe('b');
    expect(bestOption([opt('a', '2026-11-20', 0)])).toBeNull();
  });
});

describe('quoteDeskLinesFromQuote', () => {
  it('prefers stored line items, else moments and custom items', () => {
    expect(
      quoteDeskLinesFromQuote({ lineItems: [{ id: 'l1', description: 'Band', quantity: 1, unitPrice: 2000, total: 2000 }] }),
    ).toEqual([{ id: 'l1', description: 'Band', quantity: 1, unitPrice: 2000 }]);
    const lines = quoteDeskLinesFromQuote({
      selectedMoments: [{ id: 'm', name: 'Ceremony', description: '', musicians: 3, duration: 30, instruments: [], price: 600 }],
      customItems: [{ id: 'c', name: 'Sax', amount: 250, quantity: 2 }],
    });
    expect(lines).toEqual([
      { id: 'm-m', description: 'Ceremony', quantity: 1, unitPrice: 600, adjustable: false },
      { id: 'c-c', description: 'Sax', quantity: 2, unitPrice: 250 },
    ]);
  });
});

describe('mode helpers', () => {
  it('formats times and durations', () => {
    expect(hhmm('7:05:00')).toBe('07:05');
    expect(hhmm(null)).toBeNull();
    expect(durationSeconds('3:45')).toBe(225);
    expect(durationSeconds('1:00:05')).toBe(3605);
    expect(durationSeconds('abc')).toBeNull();
    expect(clock(3605)).toBe('1:00:05');
    expect(clock(65)).toBe('1:05');
  });
});
