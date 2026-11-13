import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useEventTasks } from '@/lib/services/eventTasks';
import { computeReadiness, hasLyricsOrChart, type Readiness, type ReadinessInput } from '@/lib/readiness';
import { getEventRider } from '@/lib/services/eventStage';
import { eventContractState } from '@/lib/services/contracts';

/** A gig row as Home has it (database columns). */
export interface ReadinessGig {
  eventId: string;
  /** Band gigs have a rider (personal gigs don't). */
  band_id?: string | null;
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
  const [songs, setSongs] = useState<{ setlistId: string | null; count: number; covered: number } | null>(null);
  const bandId = gig?.band_id ?? null;
  // Rider (members may read it) and, for admins, the contract.
  const [docs, setDocs] = useState<{ eventId: string; rider: ReadinessInput['rider']; contract: ReadinessInput['contract'] } | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setDocs(null);
    (async () => {
      const [r, c] = await Promise.all([
        bandId ? getEventRider(eventId) : Promise.resolve(null),
        bandId && isAdmin ? eventContractState(eventId) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setDocs({
        eventId,
        rider: r && !r.error ? (r.data ? { version: r.data.version, sent: !!r.data.sentAt, seen: !!r.data.viewedAt } : null) : undefined,
        contract: c && !c.error ? c.data : undefined,
      });
    })().catch(() => !cancelled && setDocs({ eventId, rider: undefined, contract: undefined }));
    return () => {
      cancelled = true;
    };
  }, [eventId, bandId, isAdmin]);

  useEffect(() => {
    if (!setlistId) {
      setSongs({ setlistId: null, count: 0, covered: 0 });
      return;
    }
    let cancelled = false;
    setSongs(null);
    supabase
      .from('setlist_songs')
      .select('id, song:songs(lyrics, chord_chart)')
      .eq('setlist_id', setlistId)
      .then(({ data, error }) => {
        if (cancelled) return;
        // On an error the count stays unknown: no readiness rather than a wrong one.
        const rows = (data ?? []) as unknown as { song?: { lyrics?: string | null; chord_chart?: unknown } | null }[];
        setSongs(error ? null : { setlistId, count: rows.length, covered: rows.filter((r) => hasLyricsOrChart(r.song?.lyrics, r.song?.chord_chart)).length });
      });
    return () => {
      cancelled = true;
    };
  }, [setlistId]);

  return useMemo(() => {
    if (!gig || !lineup || tasksLoading || !songs || songs.setlistId !== setlistId || !docs || docs.eventId !== gig.eventId) return null;
    return computeReadiness({
      timeSet: !!gig.start_time,
      venueSet: !!(gig.venue_name || gig.venue_city),
      lineup,
      setlistSongs: songs.count,
      lyricsCovered: songs.covered,
      rider: docs.rider,
      contract: docs.contract,
      tasks,
      deposit: isAdmin ? { amount: Number(gig.deposit_amount) || 0, paid: !!gig.deposit_paid } : undefined,
    });
  }, [gig, lineup, tasksLoading, songs, setlistId, tasks, isAdmin, docs]);
}
