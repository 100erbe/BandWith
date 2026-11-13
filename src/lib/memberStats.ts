/**
 * Member stats (Phase 4.4). The database computes them in bw_member_stats
 * (migration 083): admins get every member's row, other members only their
 * own. memberStatsFromRows() is the same aggregation in TypeScript, for the
 * demo client and the tests; keep the two in step.
 */

export interface MemberStats {
  user_id: string;
  is_active: boolean;
  gigs_played: number;
  gigs_upcoming: number;
  rehearsals: number;
  declined: number;
  pending: number;
  earned: number;
  paid: number;
}

/** One lineup row joined with its event. */
export interface MemberEventRow {
  user_id: string;
  /** event_members.status: confirmed, pending, declined… */
  answer?: string | null;
  fee?: number | string | null;
  paid_at?: string | null;
  event_date: string; // YYYY-MM-DD
  event_type?: string | null;
  event_status?: string | null;
}

const lower = (v?: string | null) => (v || '').trim().toLowerCase();
const CANCELLED = new Set(['cancelled', 'canceled']);

/** Same rules as bw_member_stats: one entry per member, zeros included. */
export function memberStatsFromRows(
  rows: MemberEventRow[],
  members: { user_id: string; is_active?: boolean | null }[],
  today: string,
): MemberStats[] {
  const out = new Map<string, MemberStats>();
  for (const m of members) {
    if (!m.user_id || out.has(m.user_id)) continue;
    out.set(m.user_id, {
      user_id: m.user_id,
      is_active: m.is_active ?? true,
      gigs_played: 0,
      gigs_upcoming: 0,
      rehearsals: 0,
      declined: 0,
      pending: 0,
      earned: 0,
      paid: 0,
    });
  }
  for (const r of rows) {
    const s = out.get(r.user_id);
    if (!s) continue;
    const answer = lower(r.answer);
    const status = lower(r.event_status);
    const rehearsal = lower(r.event_type) === 'rehearsal';
    const cancelled = CANCELLED.has(status);
    const past = r.event_date < today;
    const bookedGig = !rehearsal && (status === 'confirmed' || status === 'completed') && answer === 'confirmed';
    if (bookedGig && past) {
      s.gigs_played += 1;
      const fee = Number(r.fee) || 0;
      s.earned += fee;
      if (r.paid_at) s.paid += fee;
    }
    if (bookedGig && !past) s.gigs_upcoming += 1;
    if (rehearsal && !cancelled && answer === 'confirmed' && past) s.rehearsals += 1;
    if (answer === 'declined') s.declined += 1;
    if (answer === 'pending' && !cancelled && !past) s.pending += 1;
  }
  return [...out.values()];
}

/** Fee earned for gigs played and not paid yet. */
export const stillOwed = (s: Pick<MemberStats, 'earned' | 'paid'>) => Math.max(0, (Number(s.earned) || 0) - (Number(s.paid) || 0));

/**
 * Order for the list: the viewer first, then active members by gigs
 * (played + coming up), rehearsals, then name; former members last.
 */
export function orderMemberStats<T extends MemberStats & { name: string }>(rows: T[], viewerId?: string): T[] {
  const gigs = (s: MemberStats) => s.gigs_played + s.gigs_upcoming;
  return [...rows].sort(
    (a, b) =>
      Number(b.user_id === viewerId) - Number(a.user_id === viewerId) ||
      Number(b.is_active) - Number(a.is_active) ||
      gigs(b) - gigs(a) ||
      b.rehearsals - a.rehearsals ||
      a.name.localeCompare(b.name),
  );
}
