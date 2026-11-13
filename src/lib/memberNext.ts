/**
 * "Next for Marta" on the member detail (Figma "Phone · Next / Band / Member
 * detail – stats"): the member's next events in this band and their answer.
 * Logistics only (title, day, start, part): no fee, no client.
 */
import { lineupStatus, type LineupStatus } from './lineupSoFar';

export interface MemberNextRow {
  event_id: string;
  status?: string | null;
  role?: string | null;
}

export interface MemberNextEvent {
  id: string;
  band_id?: string | null;
  title?: string | null;
  event_type?: string | null;
  status?: string | null;
  event_date?: string | null;
  start_time?: string | null;
}

export interface MemberNextItem {
  eventId: string;
  title: string;
  eventType: string;
  eventStatus: string;
  day: string;
  start: string | null;
  part: string | null;
  answer: LineupStatus;
}

const CANCELLED = new Set(['cancelled', 'canceled']);
const hhmm = (v?: string | null) => (v && /^\d{1,2}:\d{2}/.test(v) ? v.slice(0, v.indexOf(':') + 3).padStart(5, '0') : null);

export function memberNext(
  rows: MemberNextRow[],
  events: MemberNextEvent[],
  opts: { bandId: string; today: string; limit?: number },
): MemberNextItem[] {
  const answerOf = new Map(rows.map((r) => [r.event_id, r]));
  const out: MemberNextItem[] = [];
  for (const e of events) {
    const row = answerOf.get(e.id);
    if (!row || e.band_id !== opts.bandId) continue;
    const day = (e.event_date || '').slice(0, 10);
    if (!day || day < opts.today) continue;
    const status = (e.status || '').toLowerCase();
    if (CANCELLED.has(status)) continue;
    const answer = lineupStatus(row.status);
    if (answer === 'out') continue;
    const role = (row.role || '').trim();
    out.push({
      eventId: e.id,
      title: (e.title || '').trim(),
      eventType: (e.event_type || 'gig').toLowerCase(),
      eventStatus: status,
      day,
      start: hhmm(e.start_time),
      part: role && !['admin', 'member'].includes(role.toLowerCase()) ? role : null,
      answer,
    });
  }
  out.sort((a, b) => a.day.localeCompare(b.day) || (a.start || '').localeCompare(b.start || ''));
  return out.slice(0, opts.limit ?? 3);
}
