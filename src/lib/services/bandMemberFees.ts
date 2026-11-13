/**
 * Band member fees (migration 076).
 *
 * `default_fee` and `fee_percentage` on band_members are read through
 * bw_band_member_fees(): admins get every member of their bands, a member
 * only their own row. band_members itself is read with BAND_MEMBER_COLUMNS,
 * which leaves the fees out, so step 2 (077) can revoke them.
 */
import { supabase } from '@/lib/supabase';

/** Every band_members column except the fees. */
export const BAND_MEMBER_COLUMNS = 'id, band_id, user_id, role, instrument, stage_name, is_active, joined_at, left_at';

export interface BandMemberFee {
  band_id: string;
  user_id: string;
  default_fee: number | null;
  fee_percentage: number | null;
}

const keyOf = (bandId: string, userId: string) => `${bandId}:${userId}`;

const toNumber = (v: unknown): number | null => (v == null ? null : Number(v));

/** Database before 076: read the columns directly, as before. */
const isMissingRpc = (err: { code?: string; message?: string } | null): boolean =>
  !!err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message || ''));

/** Fee rows the caller may see for these bands. */
export async function getBandMemberFees(
  bandIds: string[],
): Promise<{ data: BandMemberFee[]; error: Error | null }> {
  const ids = [...new Set(bandIds.filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.rpc('bw_band_member_fees', { p_band_ids: ids });
  let rows: any[] | null = Array.isArray(data) ? data : null;
  if (error && isMissingRpc(error)) {
    const legacy = await supabase
      .from('band_members')
      .select('band_id, user_id, default_fee, fee_percentage')
      .in('band_id', ids);
    if (legacy.error) return { data: [], error: new Error(legacy.error.message) };
    rows = legacy.data || [];
  } else if (error) {
    return { data: [], error: new Error(error.message) };
  }
  return {
    data: (rows || []).map((r) => ({
      band_id: r.band_id,
      user_id: r.user_id,
      default_fee: toNumber(r.default_fee),
      fee_percentage: toNumber(r.fee_percentage),
    })),
    error: null,
  };
}

/**
 * Adds `default_fee` and `fee_percentage` to band_members rows. Rows whose
 * fees the caller may not see get neither field (a member's colleagues).
 */
export function withMemberFees<T extends { band_id: string; user_id: string }>(
  members: T[],
  fees: BandMemberFee[],
): (T & { default_fee?: number; fee_percentage?: number })[] {
  const byKey = new Map(fees.map((f) => [keyOf(f.band_id, f.user_id), f]));
  return members.map((m) => {
    const { default_fee: _fee, fee_percentage: _pct, ...rest } = m as T & { default_fee?: unknown; fee_percentage?: unknown };
    const f = byKey.get(keyOf(m.band_id, m.user_id));
    if (!f) return rest as T;
    return {
      ...(rest as T),
      ...(f.default_fee != null ? { default_fee: f.default_fee } : {}),
      ...(f.fee_percentage != null ? { fee_percentage: f.fee_percentage } : {}),
    };
  });
}

/** Reads the fees for these rows and merges them in. */
export async function attachMemberFees<T extends { band_id: string; user_id: string }>(
  members: T[],
): Promise<(T & { default_fee?: number; fee_percentage?: number })[]> {
  if (members.length === 0) return members;
  const { data } = await getBandMemberFees(members.map((m) => m.band_id));
  return withMemberFees(members, data);
}
