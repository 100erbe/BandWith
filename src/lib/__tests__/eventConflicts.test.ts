import { describe, it, expect } from 'vitest';
import { findCalendarEvent, findEventConflicts } from '../eventConflicts';

const calendar = [
  { id: 101, eventId: 'uuid-invited', title: 'Invited gig', date: '2026-12-05', status: 'TENTATIVE' },
  { id: 102, eventId: 'uuid-other', title: 'Wedding', date: '2026-12-05', time: '18:00', status: 'CONFIRMED' },
  { id: 103, eventId: 'uuid-cancelled', title: 'Old', date: '2026-12-05', status: 'cancelled' },
  { id: 104, eventId: 'uuid-next-day', title: 'Club', date: '2026-12-06', status: 'CONFIRMED' },
];

describe('eventConflicts', () => {
  it('finds the invited event by UUID even when id is numeric', () => {
    expect(findCalendarEvent(calendar, 'uuid-invited')?.id).toBe(101);
    expect(findCalendarEvent(calendar, 'missing')).toBeNull();
  });

  it('returns other active events on the same date only', () => {
    const conflicts = findEventConflicts(calendar, { eventId: 'uuid-invited', date: '2026-12-05' });
    expect(conflicts.map((c) => c.eventId)).toEqual(['uuid-other']);
  });

  it('returns nothing without a date or calendar', () => {
    expect(findEventConflicts(calendar, { eventId: 'uuid-invited', date: null })).toEqual([]);
    expect(findEventConflicts(undefined, { eventId: 'x', date: '2026-12-05' })).toEqual([]);
  });
});
