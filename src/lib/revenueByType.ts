/**
 * Band revenue split by gig type (events.event_type: wedding, corporate,
 * private, festival, club, pub, other, gig).
 *
 * Counts booked gigs only: confirmed or completed, never rehearsals.
 * Fees come from bw_event_private, so only admins have them.
 */

export const GIG_TYPES = ['wedding', 'corporate', 'private', 'festival', 'club', 'pub', 'gig', 'other'] as const;
export type GigType = (typeof GIG_TYPES)[number];

export interface RevenueEvent {
  event_type?: string | null;
  status?: string | null;
  fee?: number | string | null;
}

export interface TypeRevenue {
  type: GigType;
  total: number;
  count: number;
  /** Part of the overall total, 0–1 (0 when nothing was earned). */
  share: number;
}

const BOOKED = new Set(['confirmed', 'completed']);

/** The gig type an event is filed under; null for what isn't a gig. */
export function gigTypeOf(eventType: string | null | undefined): GigType | null {
  const type = (eventType || '').trim().toLowerCase();
  if (type === 'rehearsal' || type === 'personal') return null;
  return (GIG_TYPES as readonly string[]).includes(type) ? (type as GigType) : 'other';
}

/** Totals per type, highest revenue first (then most gigs). */
export function revenueByType(events: RevenueEvent[]): { rows: TypeRevenue[]; total: number } {
  const byType = new Map<GigType, { total: number; count: number }>();
  for (const e of events) {
    if (!BOOKED.has((e.status || '').toLowerCase())) continue;
    const type = gigTypeOf(e.event_type);
    if (!type) continue;
    const fee = Number(e.fee);
    const entry = byType.get(type) ?? { total: 0, count: 0 };
    entry.count += 1;
    entry.total += Number.isFinite(fee) && fee > 0 ? fee : 0;
    byType.set(type, entry);
  }
  const total = [...byType.values()].reduce((sum, e) => sum + e.total, 0);
  const rows = [...byType.entries()]
    .map(([type, e]) => ({ type, total: e.total, count: e.count, share: total > 0 ? e.total / total : 0 }))
    .sort((a, b) => b.total - a.total || b.count - a.count || GIG_TYPES.indexOf(a.type) - GIG_TYPES.indexOf(b.type));
  return { rows, total };
}
