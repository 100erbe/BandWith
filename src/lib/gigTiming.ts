/**
 * Clock times of a gig on its calendar day. A show often ends after midnight
 * (21:00–02:00): a time earlier than the step before it belongs to the next
 * day, and the gig is not over (nor "past") until it really ends.
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const CLOCK = /^(\d{1,2}):(\d{2})/;

/** Local midnight of a YYYY-MM-DD day (new Date('2026-12-12') would be UTC). */
function localDay(date?: string): Date | null {
  const m = date ? DAY.exec(date) : null;
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0) : null;
}

/**
 * Each "HH:MM" step as a date on the event day, in order. A step earlier than
 * the previous one moves to the next day. Missing or unreadable steps are null.
 */
export function timelineDates(date: string | undefined, times: (string | null | undefined)[]): (Date | null)[] {
  const day = localDay(date);
  let offsetDays = 0;
  let prev: number | null = null;
  return times.map((time) => {
    const m = time ? CLOCK.exec(time) : null;
    if (!day || !m) return null;
    const minutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    if (prev != null && minutes < prev) offsetDays += 1;
    prev = minutes;
    const d = new Date(day);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
  });
}

/** When the gig ends: its end time, on the next day when it passes midnight. Null without an end time. */
export function gigEndsAt(date: string | undefined, start?: string | null, end?: string | null): Date | null {
  if (!end) return null;
  return timelineDates(date, [start, end])[1];
}

export interface GigTimes {
  date?: string;
  /** Start time; leave out when the gig has none (not an invented default). */
  start?: string | null;
  end?: string | null;
}

/** First moment after the event day. */
function dayAfter(date?: string): Date | null {
  const day = localDay(date);
  if (!day) return null;
  day.setDate(day.getDate() + 1);
  return day;
}

/**
 * The gig is over: its day has ended and, for a show that runs past midnight,
 * so has the show. A same-day end time never makes it over before midnight.
 */
export function isGigOver(gig: GigTimes, now: Date = new Date()): boolean {
  const next = dayAfter(gig.date);
  if (!next) return false;
  const ends = gigEndsAt(gig.date, gig.start, gig.end);
  const over = ends && ends > next ? ends : next;
  return now >= over;
}

/** Gig day: the event's date, and the hours after midnight while the show is still on. */
export function isLiveDay(gig: GigTimes, now: Date = new Date()): boolean {
  const day = localDay(gig.date);
  if (!day) return false;
  return now >= day && !isGigOver(gig, now);
}
