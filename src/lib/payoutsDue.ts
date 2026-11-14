import { isGigOver } from './gigTiming';

/** Window event fired after payouts are marked paid, so Home updates at once. */
export const PAYOUTS_CHANGED = 'bw:payouts-changed';

/**
 * Payouts due (Figma "Phone · Next", Home action center): musicians the band
 * still has to pay for gigs that are over.
 *
 * A payout is due when the gig is a band gig that took place (confirmed or
 * completed, and over, including shows that end after midnight), the musician
 * confirmed, has a fee above zero and has no `paid_at`. Pending and declined
 * musicians are not owed anything. This is the band paying its musicians,
 * not the client paying the band (`events.payment_status`).
 *
 * Privacy: members only ever get their own payout; the fee rows come from
 * bw_event_member_money (071), which already limits them, and this filter
 * keeps it that way whatever the input.
 */

export interface PayoutsDueInput {
  gigs: {
    id: string;
    band_id?: string | null;
    title?: string | null;
    event_type?: string | null;
    status?: string | null;
    event_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
  }[];
  /** event_members rows: who is on the gig and their RSVP. */
  members: { event_id: string; user_id: string; status?: string | null }[];
  /** Fee rows from getEventMemberMoney(). */
  money: { event_id: string; user_id: string; fee: number | null; paid_at: string | null }[];
  now: Date;
  viewerId: string | null | undefined;
  isAdmin: boolean;
}

export interface DuePayout {
  userId: string;
  fee: number;
}

export interface GigPayouts {
  eventId: string;
  title: string;
  date: string;
  payouts: DuePayout[];
  total: number;
}

const PLAYED = new Set(['confirmed', 'completed']);

/**
 * Band events that are not gigs. The gig wizards save the gig's kind
 * (club, wedding, pub…) in event_type, so a gig is any band event that is
 * not one of these.
 */
export const NOT_GIG_TYPES = ['rehearsal', 'quote'] as const;

export function isGigType(eventType: string | null | undefined): boolean {
  return !(NOT_GIG_TYPES as readonly string[]).includes((eventType || '').toLowerCase());
}

export function payoutsDue(input: PayoutsDueInput): GigPayouts[] {
  const statusOf = new Map(input.members.map((m) => [`${m.event_id}:${m.user_id}`, (m.status || '').toLowerCase()]));
  const result: GigPayouts[] = [];

  for (const gig of input.gigs) {
    if (!gig.band_id || !isGigType(gig.event_type)) continue;
    if (!PLAYED.has((gig.status || '').toLowerCase())) continue;
    const date = gig.event_date || '';
    if (!date || !isGigOver({ date, start: gig.start_time, end: gig.end_time }, input.now)) continue;

    const payouts: DuePayout[] = [];
    for (const row of input.money) {
      if (row.event_id !== gig.id) continue;
      if (!input.isAdmin && row.user_id !== input.viewerId) continue;
      if (statusOf.get(`${gig.id}:${row.user_id}`) !== 'confirmed') continue;
      const fee = Number(row.fee);
      if (!(fee > 0) || row.paid_at) continue;
      payouts.push({ userId: row.user_id, fee });
    }
    if (payouts.length === 0) continue;
    result.push({
      eventId: gig.id,
      title: gig.title || '',
      date,
      payouts,
      total: payouts.reduce((sum, p) => sum + p.fee, 0),
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
