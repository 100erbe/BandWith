import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getEventMemberMoney } from '@/lib/services/eventMemberMoney';
import { payoutsDue, PAYOUTS_CHANGED, NOT_GIG_TYPES, type GigPayouts } from '@/lib/payoutsDue';

/** Payouts older than this are not chased on Home. */
const LOOKBACK_DAYS = 365;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Payouts due for a band's past gigs (see payoutsDue). Admins get every
 * musician; members only their own fee (the money RPC returns only their row).
 *
 * When a query fails the previous result stays: a failed fee lookup never
 * turns into "nothing owed" or €0. Null until the first load.
 */
export function usePayoutsDue(
  bandId: string | null | undefined,
  viewerId: string | null | undefined,
  isAdmin: boolean,
): GigPayouts[] | null {
  const [result, setResult] = useState<GigPayouts[] | null>(null);

  const load = useCallback(async (isCancelled: () => boolean) => {
    if (!bandId || !viewerId) {
      setResult([]);
      return;
    }
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const { data: gigs, error: gigsError } = await supabase
      .from('events')
      .select('id, band_id, title, event_type, status, event_date, start_time, end_time')
      .eq('band_id', bandId)
      // Gigs are saved with their kind (club, wedding…), not 'gig'.
      .or(`event_type.is.null,event_type.not.in.(${NOT_GIG_TYPES.join(',')})`)
      .gte('event_date', ymd(since))
      .lte('event_date', ymd(now))
      .order('event_date', { ascending: false })
      .limit(200);
    if (isCancelled() || gigsError) return;
    const ids = (gigs || []).map((g: { id: string }) => g.id);
    if (ids.length === 0) {
      setResult([]);
      return;
    }
    const [{ data: members, error: membersError }, money] = await Promise.all([
      supabase.from('event_members').select('event_id, user_id, status').in('event_id', ids),
      getEventMemberMoney(ids),
    ]);
    if (isCancelled() || membersError || money.error) return;
    setResult(payoutsDue({ gigs: gigs || [], members: members || [], money: money.data, now, viewerId, isAdmin }));
  }, [bandId, viewerId, isAdmin]);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    setResult(null);
    void load(isCancelled);
    // Paid from the gig screen, or back to the app: load again.
    const reload = () => void load(isCancelled);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener(PAYOUTS_CHANGED, reload);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener(PAYOUTS_CHANGED, reload);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return result;
}
