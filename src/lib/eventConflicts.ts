/**
 * Calendar conflict detection for event invitations.
 *
 * Shared by the notification detail page (gig invitation) and, potentially,
 * EventRSVPSheet. A conflict is another event on the same date that is not
 * cancelled/declined. Works on the app's calendar items (EventItem: numeric
 * `id` + UUID `eventId`) as well as raw rows keyed by UUID `id`.
 */

export interface CalendarEventLike {
  id?: string | number;
  /** UUID of the event (EventItem keeps the numeric id in `id`). */
  eventId?: string;
  title?: string;
  date?: string;
  time?: string;
  status?: string;
}

const INACTIVE_STATUSES = new Set(['declined', 'cancelled', 'canceled']);

/** True when the calendar item refers to the given event UUID. */
export function isSameCalendarEvent(item: CalendarEventLike, eventId?: string | null): boolean {
  if (!eventId) return false;
  const target = String(eventId);
  return (item.eventId != null && String(item.eventId) === target) || (item.id != null && String(item.id) === target);
}

/** The calendar item for an event UUID, if the user's calendar has it. */
export function findCalendarEvent<T extends CalendarEventLike>(
  calendarEvents: readonly T[] | undefined | null,
  eventId?: string | null,
): T | null {
  if (!eventId || !calendarEvents?.length) return null;
  return calendarEvents.find((e) => isSameCalendarEvent(e, eventId)) ?? null;
}

/**
 * Other active events on the same date as the invited one.
 * Returns [] when the date is unknown or the calendar is empty.
 */
export function findEventConflicts<T extends CalendarEventLike>(
  calendarEvents: readonly T[] | undefined | null,
  target: { eventId?: string | null; date?: string | null },
): T[] {
  const date = target.date ? String(target.date).slice(0, 10) : '';
  if (!date || !calendarEvents?.length) return [];
  return calendarEvents.filter((e) => {
    if (isSameCalendarEvent(e, target.eventId)) return false;
    if (!e.date || String(e.date).slice(0, 10) !== date) return false;
    const status = String(e.status || '').toLowerCase();
    return !INACTIVE_STATUSES.has(status);
  });
}
