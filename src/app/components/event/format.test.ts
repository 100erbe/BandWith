import { describe, expect, it } from 'vitest';
import { setLocalePref } from '@/lib/i18n';
import {
  dayBefore,
  daysUntil,
  durationHours,
  formatDayShort,
  formatHours,
  formatTime12,
  formatTime24,
  parseAmount,
  rehearsalCadence,
  shortPlace,
} from './format';

describe('event format helpers', () => {
  it('formats times', () => {
    expect(formatTime24('9:05:00')).toBe('09:05');
    expect(formatTime24('21:30')).toBe('21:30');
    expect(formatTime24(undefined)).toBe('');
    expect(formatTime12('19:00:00')).toBe('7 PM');
    expect(formatTime12('00:30')).toBe('12:30 AM');
  });

  it('uses the 24-hour clock outside English', () => {
    setLocalePref('it');
    try {
      expect(formatTime12('19:00:00')).toBe('19:00');
      expect(formatTime12('9:05')).toBe('09:05');
      expect(formatTime12('')).toBe('');
    } finally {
      setLocalePref('en');
    }
  });

  it('formats short days and the day before', () => {
    expect(formatDayShort('2026-12-19')).toBe('Sat 19 Dec');
    expect(dayBefore('2026-12-01')).toBe('2026-11-30');
    expect(dayBefore('')).toBe('');
  });

  it('counts days until a date', () => {
    const now = new Date(2026, 10, 10, 15, 0);
    expect(daysUntil('2026-11-10', now)).toBe(0);
    expect(daysUntil('2026-11-17', now)).toBe(7);
    expect(daysUntil('2026-11-09', now)).toBe(-1);
    expect(daysUntil(undefined, now)).toBeNull();
  });

  it('measures rehearsal length', () => {
    expect(durationHours('19:00', '22:00')).toBe(3);
    expect(durationHours('22:00', '00:30')).toBe(2.5);
    expect(durationHours('19:00', undefined)).toBeNull();
    expect(formatHours(3)).toBe('3');
    expect(formatHours(2.5)).toBe('2.5');
  });

  it('parses amounts and places', () => {
    expect(parseAmount('€1,250')).toBe(1250);
    expect(parseAmount(80)).toBe(80);
    expect(parseAmount('')).toBe(0);
    expect(shortPlace('Studio 4, Via Roma 1')).toBe('Studio 4');
  });

  it('names rehearsal cadence', () => {
    expect(rehearsalCadence(true, { freq: 'weekly', interval: 1 }, '2026-11-10')).toBe('EVERY TUESDAY');
    expect(rehearsalCadence(true, { freq: 'weekly', interval: 2 }, '2026-11-10')).toBe('EVERY OTHER TUESDAY');
    expect(rehearsalCadence(true, { frequency: 'monthly' }, '2026-11-10')).toBe('MONTHLY');
    expect(rehearsalCadence(false, undefined, '2026-11-10')).toBe('ONCE');
  });
});
