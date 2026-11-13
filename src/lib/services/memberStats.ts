/**
 * Per-member stats for a band (bw_member_stats, migration 083): admins get
 * every member, other members only themselves.
 */
import { supabase } from '@/lib/supabase';
import type { MemberStats } from '@/lib/memberStats';

const toNumber = (v: unknown) => Number(v) || 0;

export async function getMemberStats(
  bandId: string,
  from: string,
  to: string,
  today: string,
): Promise<{ data: MemberStats[]; error: Error | null }> {
  const { data, error } = await supabase.rpc('bw_member_stats', {
    p_band_id: bandId,
    p_from: from,
    p_to: to,
    p_today: today,
  });
  if (error) return { data: [], error: new Error(error.message || 'bw_member_stats failed') };
  return {
    data: ((data as any[]) || []).map((r) => ({
      user_id: String(r.user_id),
      is_active: r.is_active !== false,
      gigs_played: toNumber(r.gigs_played),
      gigs_upcoming: toNumber(r.gigs_upcoming),
      rehearsals: toNumber(r.rehearsals),
      declined: toNumber(r.declined),
      pending: toNumber(r.pending),
      earned: toNumber(r.earned),
      paid: toNumber(r.paid),
    })),
    error: null,
  };
}
