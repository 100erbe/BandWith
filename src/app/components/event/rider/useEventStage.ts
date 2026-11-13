import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocale, useT } from '@/lib/i18n';
import { starterStage, isStageEmpty, type LineupPlayer, type StageData } from '@/lib/stagePlot';
import { getEventRider, getEventStage, riderShareLink, saveEventStage, type EventRider } from '@/lib/services/eventStage';
import { buildContractPdf, contractFileName, createContract, fetchBandName, standardTerms, updateContract, type Contract } from '@/lib/services/contracts';
import { shareFile, shareLink } from '@/lib/nativeFiles';

interface Options {
  eventId?: string;
  bandId?: string | null;
  eventTitle: string;
  eventDate?: string;
  venueName?: string;
  /** The gig's lineup, for the suggested plot and inputs. */
  lineup: LineupPlayer[];
  isAdmin: boolean;
  /** Personal gigs, quotes, rehearsals: nothing to load. */
  disabled?: boolean;
}

/**
 * Rider & stage of a gig: the saved stage (or, for admins, a suggestion made
 * from the lineup until they save it), the linked rider and the actions on
 * them. `available` is false on databases without migrations 092 / 093.
 */
export function useEventStage({ eventId, bandId, eventTitle, eventDate, venueName, lineup, isAdmin, disabled }: Options) {
  const t = useT();
  const [stage, setStage] = useState<StageData | null>(null);
  const [saved, setSaved] = useState(false);
  const [available, setAvailable] = useState(true);
  const [rider, setRider] = useState<EventRider | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!eventId || !bandId || disabled) {
      setStage(null);
      setRider(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [s, r] = await Promise.all([getEventStage(eventId), getEventRider(eventId)]);
      if (cancelled) return;
      if (s.error) setError(s.error.message);
      else setError(null);
      setAvailable(s.data !== null || !!s.error);
      setStage(s.data?.data ?? null);
      setSaved(!!s.data?.saved);
      setRider(r.data);
      setLoading(false);
    })().catch((e) => {
      if (cancelled) return;
      setError(e?.message || t('Could not load the rider & stage.'));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, bandId, disabled, reloadKey, t]);

  // Nothing saved yet: admins start from the lineup (shown as a suggestion).
  const lineupKey = lineup.map((p) => `${p.name}:${p.instrument ?? ''}`).join('|');
  const suggestion = useMemo(
    () => (isAdmin && !saved && lineup.length > 0 ? starterStage(lineup, t) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, saved, lineupKey, t],
  );
  const shown: StageData | null = saved ? stage : stage && !isStageEmpty(stage) ? stage : suggestion ?? stage;
  const isSuggestion = !saved && !!suggestion && shown === suggestion;

  const save = useCallback(
    async (next: StageData): Promise<boolean> => {
      if (!eventId || !bandId) return false;
      setError(null);
      const prev = { stage, saved };
      setStage(next);
      setSaved(true);
      const { error: err } = await saveEventStage(eventId, bandId, next);
      if (err) {
        setStage(prev.stage);
        setSaved(prev.saved);
        setError(err.message);
        return false;
      }
      return true;
    },
    [eventId, bandId, stage, saved],
  );

  /** Admins: a rider document linked to this gig (Contracts & docs). */
  const createRider = useCallback(async (): Promise<boolean> => {
    if (!eventId || !bandId) return false;
    setError(null);
    const { error: err } = await createContract({
      bandId,
      type: 'rider',
      title: t('Technical rider · {event}', { event: eventTitle }),
      clientName: venueName || eventTitle,
      eventName: eventTitle,
      eventDate,
      content: standardTerms('rider', getLocale()),
      eventId,
    });
    if (err) {
      setError(err.message);
      return false;
    }
    const r = await getEventRider(eventId);
    setRider(r.data);
    return true;
  }, [eventId, bandId, eventTitle, eventDate, venueName, t]);

  /**
   * Admins: share the venue's web link (opening it marks the rider seen). A
   * rider still in draft is marked sent once the link has gone out.
   */
  const shareRiderLink = useCallback(async (): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> => {
    if (!rider) return 'failed';
    setError(null);
    const { data: url, error: err } = await riderShareLink(rider.id);
    if (err || !url) {
      setError(err?.message || t('Could not create the link.'));
      return 'failed';
    }
    try {
      const res = await shareLink(url, {
        title: rider.title,
        text: t('Technical rider for {event}: stage plot, input list and who brings what.', { event: eventTitle }),
        dialogTitle: t('Share rider link'),
      });
      if (res !== 'cancelled' && !rider.sentAt) {
        const now = new Date().toISOString();
        const { error: upErr } = await updateContract(rider.id, { status: rider.viewedAt ? 'viewed' : 'sent', sent_at: now });
        if (!upErr) setRider({ ...rider, sentAt: now, status: rider.viewedAt ? 'viewed' : 'sent' });
      }
      return res;
    } catch (e: any) {
      setError(e?.message || t('Could not share the link.'));
      return 'failed';
    }
  }, [rider, eventTitle, t]);

  /** Rider PDF with the stage, for the share sheet. Members get it without client details. */
  const shareRiderPdf = useCallback(async (): Promise<void> => {
    if (!bandId) return;
    setError(null);
    const doc: Contract = {
      id: rider?.id || 'stage',
      band_id: bandId,
      event_id: eventId,
      title: rider?.title || t('Technical rider · {event}', { event: eventTitle }),
      type: 'rider',
      status: rider?.status || 'draft',
      event_name: eventTitle,
      event_date: eventDate || null,
      created_at: new Date().toISOString(),
    };
    try {
      const bandName = await fetchBandName(bandId);
      const blob = buildContractPdf(doc, { bandName, lang: getLocale(), stage: shown });
      await shareFile(blob, contractFileName(doc), { title: doc.title, dialogTitle: t('Share rider PDF') });
    } catch (e: any) {
      setError(e?.message || t('Could not create the PDF.'));
    }
  }, [bandId, eventId, eventTitle, eventDate, rider, shown, t]);

  return {
    available,
    loading,
    error,
    stage: shown,
    saved,
    isSuggestion,
    rider,
    save,
    reload,
    createRider,
    shareRiderLink,
    shareRiderPdf,
  };
}

export type EventStageState = ReturnType<typeof useEventStage>;

/**
 * Rider & stage while a gig is being created (iPad composer, Figma iPad · 04
 * "New gig": Setlist · Rider & stage · Tasks). Nothing exists in the database
 * yet, so edits stay here and are saved with the gig (persistComposerStage).
 * `riderWanted`: also create the rider document when the gig is created.
 */
export function useDraftStage({ lineup, isAdmin }: { lineup: LineupPlayer[]; isAdmin: boolean }) {
  const t = useT();
  const [stage, setStage] = useState<StageData | null>(null);
  const [riderWanted, setRiderWanted] = useState(false);
  const lineupKey = lineup.map((p) => `${p.name}:${p.instrument ?? ''}`).join('|');
  const suggestion = useMemo(
    () => (isAdmin && !stage && lineup.length > 0 ? starterStage(lineup, t) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, !!stage, lineupKey, t],
  );
  const shown = stage ?? suggestion;
  const state: EventStageState = {
    available: true,
    loading: false,
    error: null,
    stage: shown,
    saved: !!stage,
    isSuggestion: !stage && !!suggestion,
    rider: null,
    save: async (next: StageData) => {
      setStage(next);
      return true;
    },
    reload: () => {},
    createRider: async () => {
      setRiderWanted((w) => !w);
      return true;
    },
    shareRiderLink: async () => 'failed' as const,
    shareRiderPdf: async () => {},
  };
  /** What to save with the gig: the edited stage, or the suggestion when a rider is wanted. */
  const pending: StageData | null = stage ?? (riderWanted ? suggestion : null);
  return { state, riderWanted, pending, edited: !!stage };
}
