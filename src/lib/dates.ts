/**
 * Local-calendar date helpers.
 *
 * `date.toISOString().split('T')[0]` converts to UTC first, so in Europe
 * (UTC+1/+2) local midnight becomes the previous day. Use these helpers for
 * every "calendar date" (YYYY-MM-DD) the app stores or compares.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Format a Date as YYYY-MM-DD using the device's local calendar. */
export function toLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayLocal(): string {
  return toLocalDateString(new Date());
}

/**
 * Parse a YYYY-MM-DD string as a *local* date (midnight local time).
 * `new Date('2026-11-09')` is parsed as UTC and shows the previous day west of UTC.
 * Strings with a time component are passed to the Date constructor unchanged.
 */
export function parseLocalDate(value: string | number | Date): Date {
  if (typeof value !== 'string') return new Date(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** First and last calendar day (YYYY-MM-DD) of the month containing `date`. */
export function monthRangeLocal(date: Date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toLocalDateString(start), end: toLocalDateString(end) };
}
