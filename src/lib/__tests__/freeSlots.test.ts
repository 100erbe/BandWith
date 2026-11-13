import { describe, expect, it } from 'vitest';
import { freeSlotsFromRows, heatLevel, toMinutes, windowSpan, type MemberCommitment } from '@/lib/freeSlots';

const M = ['a', 'b', 'c', 'd', 'e'];
const c = (x: Partial<MemberCommitment> & { user_id: string; event_date: string }): MemberCommitment => ({
  event_status: 'confirmed',
  answer: 'confirmed',
  ...x,
});

describe('freeSlotsFromRows', () => {
  it('counts every member free on an empty day', () => {
    const rows = freeSlotsFromRows(M, [], { from: '2026-12-14', to: '2026-12-15' });
    expect(rows).toEqual([
      { day: '2026-12-14', slotStart: null, free: 5, total: 5 },
      { day: '2026-12-15', slotStart: null, free: 5, total: 5 },
    ]);
  });

  it('marks a member busy once per day, whatever the number of events', () => {
    const rows = freeSlotsFromRows(
      M,
      [
        c({ user_id: 'a', event_date: '2026-12-14', start_time: '10:00', end_time: '11:00' }),
        c({ user_id: 'a', event_date: '2026-12-14', start_time: '20:00', end_time: '22:00' }),
        c({ user_id: 'b', event_date: '2026-12-14', answer: null }), // personal, whole day
      ],
      { from: '2026-12-14', to: '2026-12-14' },
    );
    expect(rows[0]).toMatchObject({ free: 3, total: 5 });
  });

  it('ignores declined answers, cancelled events, quotes, other people and the edited event', () => {
    const rows = freeSlotsFromRows(
      M,
      [
        c({ user_id: 'a', event_date: '2026-12-14', answer: 'declined' }),
        c({ user_id: 'b', event_date: '2026-12-14', event_status: 'cancelled' }),
        c({ user_id: 'c', event_date: '2026-12-14', event_status: 'QUOTE' }),
        c({ user_id: 'zz', event_date: '2026-12-14' }),
        c({ user_id: 'd', event_date: '2026-12-14', event_id: 'self' }),
      ],
      { from: '2026-12-14', to: '2026-12-14', excludeEventId: 'self' },
    );
    expect(rows[0]).toMatchObject({ free: 5, total: 5 });
  });

  it('with a window, only overlapping events count; no start time fills the day', () => {
    const list = [
      c({ user_id: 'a', event_date: '2026-12-14', start_time: '12:00', end_time: '15:00' }),
      c({ user_id: 'b', event_date: '2026-12-14', start_time: '22:30', end_time: '00:30' }),
      c({ user_id: 'c', event_date: '2026-12-14' }),
      c({ user_id: 'd', event_date: '2026-12-14', start_time: '18:30' }), // +3h → 21:30
    ];
    const rows = freeSlotsFromRows(M, list, { from: '2026-12-14', to: '2026-12-14', start: '21:00', end: '23:30' });
    expect(rows).toEqual([{ day: '2026-12-14', slotStart: '21:00', free: 2, total: 5 }]);
  });

  it('splits a window past midnight into slots', () => {
    const rows = freeSlotsFromRows(
      M,
      [c({ user_id: 'e', event_date: '2026-12-11', start_time: '19:00', end_time: '21:00' })],
      { from: '2026-12-11', to: '2026-12-11', start: '19:00', end: '01:00', slotMinutes: 60 },
    );
    expect(rows.map(r => `${r.slotStart} ${r.free}/${r.total}`)).toEqual([
      '19:00 4/5',
      '20:00 4/5',
      '21:00 5/5',
      '22:00 5/5',
      '23:00 5/5',
      '00:00 5/5',
    ]);
  });
});

describe('helpers', () => {
  it('parses times and windows', () => {
    expect(toMinutes('21:30:00')).toBe(1290);
    expect(toMinutes('')).toBeNull();
    expect(windowSpan('23:00', '01:00')).toEqual([1380, 1500]);
    expect(windowSpan('21:00', null)).toBeNull();
  });

  it('maps counts to heat levels', () => {
    expect(heatLevel({ free: 5, total: 5 })).toBe(4);
    expect(heatLevel({ free: 4, total: 5 })).toBe(3);
    expect(heatLevel({ free: 3, total: 5 })).toBe(2);
    expect(heatLevel({ free: 1, total: 5 })).toBe(1);
    expect(heatLevel({ free: 0, total: 5 })).toBe(0);
    expect(heatLevel(null)).toBe(0);
  });
});
