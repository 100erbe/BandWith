/**
 * Gig price, payments and client (migration 078).
 *
 * Only whoever manages an event (an active admin of its band, or the creator
 * of a personal gig) may see its price, fee, deposit, payment status, client
 * details, internal notes and contract. They come from bw_event_private();
 * the events table itself is read with EVENT_PUBLIC_COLUMNS, so step 2 can
 * revoke the rest. A member's own fee stays in event_members (071).
 */
import { supabase } from '@/lib/supabase';

/** Columns every member may read: the gig and its logistics. */
export const EVENT_PUBLIC_COLUMNS =
  'id, band_id, title, description, event_type, venue, address, date, time, duration_hours, status, notes, created_by, created_at, updated_at, currency, dress_code, quote_id, event_date, start_time, end_time, venue_name, venue_address, venue_city, venue_country, venue_coordinates, indoor_outdoor, load_in_time, soundcheck_time, setlist_id, attachments, is_recurring, recurrence_rule, parent_event_id, capacity';

/** Columns returned by bw_event_private() to managers only. */
export const EVENT_PRIVATE_COLUMNS = [
  'price', 'fee', 'pay', 'deposit_amount', 'deposit_paid', 'payment_status',
  'client_name', 'client_email', 'client_phone', 'client_company',
  'internal_notes', 'contract_url', 'contract_signed',
] as const;

export interface EventPrivateRow {
  event_id: string;
  private: Record<string, unknown>;
}

/** Database before 078: read the columns directly, as before. */
const isMissingRpc = (err: { code?: string; message?: string } | null): boolean =>
  !!err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message || ''));

/** Private rows for the events the caller manages (none for a member). */
export async function getEventPrivate(
  eventIds: string[],
): Promise<{ data: EventPrivateRow[]; error: Error | null }> {
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.rpc('bw_event_private', { p_event_ids: ids });
  if (error && isMissingRpc(error)) {
    const legacy = await supabase
      .from('events')
      .select(`id, ${EVENT_PRIVATE_COLUMNS.join(', ')}`)
      .in('id', ids);
    if (legacy.error) return { data: [], error: new Error(legacy.error.message) };
    return {
      data: (legacy.data || []).map(({ id, ...rest }: any) => ({ event_id: id, private: rest })),
      error: null,
    };
  }
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: (Array.isArray(data) ? data : []).map((r: any) => ({
      event_id: r.event_id,
      private: r.private && typeof r.private === 'object' ? r.private : {},
    })),
    error: null,
  };
}

/**
 * Adds the private fields to events the caller manages. Other events keep
 * only the public columns: any private field they carry is dropped.
 */
export function withEventPrivate<T extends { id: string }>(events: T[], rows: EventPrivateRow[]): T[] {
  const byId = new Map(rows.map((r) => [r.event_id, r.private]));
  return events.map((e) => {
    const clean = { ...e } as Record<string, unknown>;
    for (const col of EVENT_PRIVATE_COLUMNS) delete clean[col];
    const priv = byId.get(e.id);
    return (priv ? { ...clean, ...priv } : clean) as T;
  });
}

/**
 * The private fields a write just set (no read). Writes return only the
 * public columns, so the saved row is completed from what was sent.
 */
export function privateFieldsOf(values: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!values) return out;
  for (const col of EVENT_PRIVATE_COLUMNS) if (values[col] !== undefined) out[col] = values[col];
  return out;
}

/**
 * Reads the private data for these events and merges it in. Throws when the
 * read fails, like the events query itself: an admin must never get a gig
 * without its price, or saving the edit form could overwrite it.
 */
export async function attachEventPrivate<T extends { id: string }>(events: T[]): Promise<T[]> {
  if (events.length === 0) return events;
  const { data, error } = await getEventPrivate(events.map((e) => e.id));
  if (error) throw error;
  return withEventPrivate(events, data);
}
