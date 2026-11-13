import { describe, it, expect } from 'vitest';
import { timelineDates, gigEndsAt, isGigOver, isLiveDay } from '../gigTiming';

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);

describe('gigTiming', () => {
  it('reads each step on the event day, local time', () => {
    expect(timelineDates('2026-12-12', ['17:00', '18:30:00', '20:30'])).toEqual([
      at(2026, 12, 12, 17), at(2026, 12, 12, 18, 30), at(2026, 12, 12, 20, 30),
    ]);
  });

  it('moves a step that comes before the previous one to the next day', () => {
    // Show 21:00, end 01:00: the end is after midnight.
    expect(timelineDates('2026-12-12', ['21:00', '01:00'])).toEqual([at(2026, 12, 12, 21), at(2026, 12, 13, 1)]);
  });

  it('keeps a missing step empty and still rolls the next ones', () => {
    expect(timelineDates('2026-12-31', ['22:00', undefined, '00:30'])).toEqual([
      at(2026, 12, 31, 22), null, at(2027, 1, 1, 0, 30),
    ]);
  });

  it('returns no dates without a valid day', () => {
    expect(timelineDates(undefined, ['20:00'])).toEqual([null]);
    expect(timelineDates('soon', ['20:00'])).toEqual([null]);
  });

  it('ends a gig at its end time, the next day when it passes midnight', () => {
    expect(gigEndsAt('2026-12-12', '19:30', '01:00')).toEqual(at(2026, 12, 13, 1));
    expect(gigEndsAt('2026-12-12', '19:30', '23:00')).toEqual(at(2026, 12, 12, 23));
    expect(gigEndsAt('2026-12-12', undefined, '23:00')).toEqual(at(2026, 12, 12, 23));
    expect(gigEndsAt('2026-12-12', '19:30')).toBeNull();
  });

  it('is over only after the event day and after a late end', () => {
    const late = { date: '2026-12-12', start: '21:00', end: '02:00' };
    expect(isGigOver(late, at(2026, 12, 12, 23, 59))).toBe(false);
    // Past midnight but still playing: not over.
    expect(isGigOver(late, at(2026, 12, 13, 0, 30))).toBe(false);
    expect(isGigOver(late, at(2026, 12, 13, 2, 0))).toBe(true);
    // A same-day end never makes it "past" before midnight.
    const early = { date: '2026-12-12', start: '18:00', end: '20:00' };
    expect(isGigOver(early, at(2026, 12, 12, 22))).toBe(false);
    expect(isGigOver(early, at(2026, 12, 13, 0, 0))).toBe(true);
    // No times: the day ends at midnight.
    expect(isGigOver({ date: '2026-12-12' }, at(2026, 12, 13, 0, 0))).toBe(true);
    expect(isGigOver({ date: undefined }, at(2026, 12, 13))).toBe(false);
  });

  it('is gig day on the date and through a show that runs past midnight', () => {
    const late = { date: '2026-12-12', start: '21:00', end: '02:00' };
    expect(isLiveDay(late, at(2026, 12, 11, 23))).toBe(false);
    expect(isLiveDay(late, at(2026, 12, 12, 9))).toBe(true);
    expect(isLiveDay(late, at(2026, 12, 13, 1, 30))).toBe(true);
    expect(isLiveDay(late, at(2026, 12, 13, 2, 0))).toBe(false);
    expect(isLiveDay({ date: '2026-12-12', start: '18:00', end: '20:00' }, at(2026, 12, 13, 1))).toBe(false);
  });
});
