import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useEventTasks } from '@/lib/services/eventTasks';
import { computeReadiness, type Readiness } from '@/lib/readiness';

/** A gig row as Home has it (database columns). */
export interface ReadinessGig {
  eventId: string;
  start_time?: string | null;
  venue_name?: string | null;
  venue_city?: string | null;
  setlist_id?: string | null;
  deposit_amount?: number | string | null;
  deposit_paid?: boolean | null;
}

/**
 * Show readiness of one gig for Home, from the same checks as the gig screen.
 * Loads the setlist size and the to-dos; the lineup comes from the caller.
 * Null until everything is loaded, so the count never jumps.
 */
export function useGigReadiness(
  gig: ReadinessGig | null,
  lineup: { status?: string | null }[] | undefined,
  isAdmin: boolean,
): Readiness | null {
  const eventId = gig?.eventId ?? null;
  const setlistId = gig?.setlist_id ?? null;
  const { tasks, loading: tasksLoading } = useEventTasks(eventId);
  const [songs, setSongs] = useState<{ setlistId: string | null; count: number } | null>(null);

  useEffect(() => {
    if (!setlistId) {
      setSongs({ setlistId: null, count: 0 });
      return;
    }
    let cancelled = false;
    setSongs(null);
    supabase
      .from('setlist_songs')
      .select('id')
      .eq('setlist_id', setlistId)
      .then(({ data, error }: { data: unknown[] | null; error: unknown }) => {
        if (cancelled) return;
        // On an error the count stays unknown: no readiness rather than a wrong one.
        setSongs(error ? null : { setlistId, count: data?.length ?? 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [setlistId]);

  return useMemo(() => {
    if (!gig || !lineup || tasksLoading || !songs || songs.setlistId !== setlistId) return null;
    return computeReadiness({
      timeSet: !!gig.start_time,
      venueSet: !!(gig.venue_name || gig.venue_city),
      lineup,
      setlistSongs: songs.count,
      tasks,
      deposit: isAdmin ? { amount: Number(gig.deposit_amount) || 0, paid: !!gig.deposit_paid } : undefined,
    });
  }, [gig, lineup, tasksLoading, songs, setlistId, tasks, isAdmin]);
}
