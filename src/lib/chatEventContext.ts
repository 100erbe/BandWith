/**
 * The event strip pinned at the top of an event chat:
 * "Wedding Rossi · Sat 12 Dec · Load-in 17:00 · Villa Clara".
 * Only logistics that every lineup member can read (no fee, no client).
 */
import { parseLocalDate, todayLocal } from '@/lib/dates';

/** Public event columns the strip needs (see EVENT_PUBLIC_COLUMNS). */
export const CHAT_EVENT_COLUMNS =
  'id, title, event_type, status, event_date, date, start_time, time, load_in_time, venue_name, venue, venue_city';

export interface ChatEventRow {
  id: string;
  title?: string | null;
  event_type?: string | null;
  status?: string | null;
  event_date?: string | null;
  date?: string | null;
  start_time?: string | null;
  time?: string | null;
  load_in_time?: string | null;
  venue_name?: string | null;
  venue?: string | null;
  venue_city?: string | null;
}

export interface ChatEventContext {
  id: string;
  title: string;
  eventType: string;
  /** YYYY-MM-DD, or null when the event has no date. */
  day: string | null;
  /** 'today' | 'tomorrow' | 'past' | 'later'. */
  when: 'today' | 'tomorrow' | 'past' | 'later' | null;
  /** Load-in wins over the start time: it's when the band must be there. */
  time: { kind: 'loadIn' | 'start'; value: string } | null;
  place: string | null;
  cancelled: boolean;
}

const hhmm = (v?: string | null) => (v && /^\d{1,2}:\d{2}/.test(v) ? v.slice(0, v.indexOf(':') + 3).padStart(5, '0') : null);

export function chatEventContext(row: ChatEventRow, today = todayLocal()): ChatEventContext {
  const day = (row.event_date || row.date || '').slice(0, 10) || null;
  let when: ChatEventContext['when'] = null;
  if (day) {
    const tomorrow = parseLocalDate(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tm = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    when = day === today ? 'today' : day === tm ? 'tomorrow' : day < today ? 'past' : 'later';
  }
  const loadIn = hhmm(row.load_in_time);
  const start = hhmm(row.start_time) || hhmm(row.time);
  const venue = (row.venue_name || row.venue || '').trim();
  const city = (row.venue_city || '').trim();
  const place = venue && city && !venue.toLowerCase().includes(city.toLowerCase()) ? `${venue}, ${city}` : venue || city || null;
  return {
    id: row.id,
    title: (row.title || '').trim(),
    eventType: row.event_type || 'gig',
    day,
    when,
    time: loadIn ? { kind: 'loadIn', value: loadIn } : start ? { kind: 'start', value: start } : null,
    place,
    cancelled: row.status === 'cancelled',
  };
}
