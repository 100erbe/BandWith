/**
 * Fees and payouts on event_members (migration 071).
 *
 * The `fee` and `paid_at` columns are not readable directly: the database
 * returns them through bw_event_member_money(), every row to the event's
 * admins and only the caller's own row to members. Lineup writes that set
 * fees go through bw_save_event_lineup() (a client upsert would have to read
 * the fee column).
 */
import { supabase } from '@/lib/supabase';

export interface EventMemberMoney {
  event_id: string;
  user_id: string;
  fee: number | null;
  paid_at: string | null;
}

export interface LineupRow {
  user_id: string;
  role?: string | null;
  fee?: number | null;
  status?: string | null;
}

const keyOf = (eventId: string, userId: string) => `${eventId}:${userId}`;

/**
 * The RPC is not there yet (database before 071): fall back to the old
 * direct column access so the app works during the rollout.
 */
const isMissingRpc = (err: { code?: string; message?: string } | null): boolean =>
  !!err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message || ''));

/**
 * Fee and payout rows the caller may see. `eventIds` omitted = all of the
 * caller's own rows.
 */
export async function getEventMemberMoney(
  eventIds?: string[],
): Promise<{ data: EventMemberMoney[]; error: Error | null }> {
  if (eventIds && eventIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.rpc(
    'bw_event_member_money',
    eventIds ? { p_event_ids: eventIds } : {},
  );
  if (error && isMissingRpc(error)) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    let q = supabase.from('event_members').select('event_id, user_id, fee, paid_at');
    q = eventIds ? q.in('event_id', eventIds) : q.eq('user_id', user?.id ?? '');
    const legacy = await q;
    if (legacy.error) return { data: [], error: new Error(legacy.error.message) };
    return { data: (legacy.data || []).map((r: any) => ({ event_id: r.event_id, user_id: r.user_id, fee: r.fee == null ? null : Number(r.fee), paid_at: r.paid_at ?? null })), error: null };
  }
  if (error) return { data: [], error: new Error(error.message) };
  const rows = (Array.isArray(data) ? data : []).map((r: any) => ({
    event_id: r.event_id,
    user_id: r.user_id,
    fee: r.fee == null ? null : Number(r.fee),
    paid_at: r.paid_at ?? null,
  }));
  return { data: rows, error: null };
}

/** Lookup by event and user, from getEventMemberMoney(). */
export function moneyLookup(rows: EventMemberMoney[]) {
  const map = new Map(rows.map((r) => [keyOf(r.event_id, r.user_id), r]));
  return (eventId: string, userId: string) => map.get(keyOf(eventId, userId));
}

/**
 * Adds `fee` and `paid_at` to lineup rows read from event_members. Rows the
 * caller may not see the money of get `fee: undefined`.
 */
export async function withMoney<T extends { event_id?: string; user_id: string }>(
  rows: T[],
  eventId?: string,
): Promise<(T & { fee?: number | null; paid_at?: string | null })[]> {
  const ids = [...new Set(rows.map((r) => r.event_id || eventId).filter(Boolean) as string[])];
  if (rows.length === 0 || ids.length === 0) return rows;
  const { data } = await getEventMemberMoney(ids);
  const find = moneyLookup(data);
  return rows.map((r) => {
    const m = find((r.event_id || eventId) as string, r.user_id);
    return m ? { ...r, fee: m.fee, paid_at: m.paid_at } : r;
  });
}

/**
 * Saves an event's lineup with roles and fees. New people get the given
 * status; people already in it keep their RSVP. Admins (or the creator of a
 * personal gig) only.
 */
export async function saveEventLineup(eventId: string, rows: LineupRow[]): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null };
  const payload = rows.map((r) => ({
    user_id: r.user_id,
    role: r.role ?? null,
    fee: r.fee ?? 0,
    status: r.status ?? 'pending',
  }));
  const { error } = await supabase.rpc('bw_save_event_lineup', { p_event_id: eventId, p_rows: payload });
  if (error && isMissingRpc(error)) {
    const legacy = await supabase
      .from('event_members')
      .upsert(payload.map((r) => ({ ...r, event_id: eventId })), { onConflict: 'event_id,user_id' });
    return { error: legacy.error ? new Error(legacy.error.message) : null };
  }
  return { error: error ? new Error(error.message) : null };
}

/** Admins: stamps paid_at on every non-declined member still unpaid. */
export async function markEventPaid(
  eventId: string,
): Promise<{ data: { user_id: string; paid_at: string }[]; error: Error | null }> {
  const { data, error } = await supabase.rpc('bw_mark_event_paid', { p_event_id: eventId });
  if (error && isMissingRpc(error)) {
    const legacy = await supabase
      .from('event_members')
      .update({ paid_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .is('paid_at', null)
      .neq('status', 'declined')
      .select('user_id, paid_at');
    if (legacy.error) return { data: [], error: new Error(legacy.error.message) };
    return { data: (legacy.data || []) as { user_id: string; paid_at: string }[], error: null };
  }
  if (error) return { data: [], error: new Error(error.message) };
  return { data: (Array.isArray(data) ? data : []) as { user_id: string; paid_at: string }[], error: null };
}

/** Columns of event_members readable by app users (fee and paid_at excluded). */
export const EVENT_MEMBER_COLUMNS =
  'id, event_id, user_id, status, responded_at, created_at, decline_reason, role, notes';
