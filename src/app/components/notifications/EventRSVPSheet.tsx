import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  X,
  MapPin,
  Clock,
  Calendar,
  CurrencyIcon,
  AlertTriangle,
  CheckCircle2,
} from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { RailSheet } from '@/lib/railActions';
import { PillButton, PillField, FormError } from '@/app/components/bw/Form';
import { usePeekingScroll } from '@/app/components/ui/PeekingScrollContainer';
import type { Notification } from '@/lib/services/notifications';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { MapsLink } from '@/app/components/ui/MapsLink';
import { supabase } from '@/lib/supabase';
import { findCalendarEvent, findEventConflicts } from '@/lib/eventConflicts';
import { cn } from '@/app/components/ui/utils';
import { formatDayShort, formatTime12 } from '@/app/components/event/format';
import { inviteFeeToShow } from '@/lib/inviteFee';
import { useSheetDrag } from '@/app/components/bw/useSheetDrag';
import { useT, intlLocale } from '@/lib/i18n';
import { useLineupSoFar } from '@/app/hooks/useLineupSoFar';
import { LineupSoFar } from '@/app/components/event/LineupSoFar';

export type RsvpStatus = 'confirmed' | 'maybe' | 'declined';

export interface EventRSVPSheetProps {
  notification: Notification;
  /** GOING. The optional note is also saved by the sheet itself (event_members.notes). */
  onAccept: (note?: string) => Promise<void>;
  /** CAN'T MAKE IT. */
  onDecline: (note?: string) => Promise<void>;
  /**
   * Optional single handler for all three answers. When given it is used
   * instead of onAccept / onDecline, and it is the only way "maybe" reaches
   * the parent. Without it the sheet records "maybe" itself.
   */
  onRespond?: (status: RsvpStatus, note?: string) => Promise<void>;
  onClose: () => void;
  calendarEvents?: any[];
  currentUserId?: string;
  /** Answer to preselect (e.g. the member's current status). */
  initialStatus?: RsvpStatus;
}

const kindOf = (e: any): 'personal gig' | 'rehearsal' | 'gig' => {
  if (!e?.band_id) return 'personal gig';
  return String(e.status || '').toUpperCase() === 'REHEARSAL' ? 'rehearsal' : 'gig';
};

/** Figma "Event / RSVP – conflict" (23:1213): dark sheet, three answers, optional note. */
export const EventRSVPSheet: React.FC<EventRSVPSheetProps> = ({
  notification,
  onAccept,
  onDecline,
  onRespond,
  onClose,
  calendarEvents = [],
  currentUserId,
  initialStatus,
}) => {
  const t = useT();
  const drag = useSheetDrag(onClose);
  useCurrency(); // re-render money labels when the band currency changes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [choice, setChoice] = useState<RsvpStatus | null>(initialStatus ?? null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { containerRef, maskStyle } = usePeekingScroll<HTMLDivElement>();

  const CHOICES: { value: RsvpStatus; label: string }[] = [
    { value: 'confirmed', label: t('GOING') },
    { value: 'maybe', label: t("MAYBE — I'LL CONFIRM LATER") },
    { value: 'declined', label: t("CAN'T MAKE IT") },
  ];
  const KIND_LABEL = { 'personal gig': t('personal gig'), rehearsal: t('rehearsal'), gig: t('gig') };

  const data = notification.data || {};
  const eventId = data.event_id as string | undefined;
  // Calendar items keep a numeric `id` and the UUID in `eventId`.
  const matchedEvent = useMemo<any>(() => findCalendarEvent(calendarEvents, eventId), [calendarEvents, eventId]);

  const matchedStatus = String(matchedEvent?.status || '').toUpperCase();
  const eventType =
    (data.event_type as string) ||
    (matchedStatus === 'REHEARSAL' ? 'rehearsal' : matchedStatus === 'QUOTE' || matchedStatus === 'QUOTED' ? 'quote' : 'gig');
  const eventTitle = (data.event_title as string) || matchedEvent?.title || notification.title;
  const eventDate = (data.event_date as string) || matchedEvent?.date;
  const eventTime = (data.event_time as string) || matchedEvent?.time;
  const venue = (data.venue as string) || matchedEvent?.location;
  const venueAddress = (data.venue_address as string) || matchedEvent?.venueAddress;

  // Who else is on the gig so far: names, parts and answers, never fees.
  const lineup = useLineupSoFar(
    eventId,
    notification.band_id || (data.band_id as string | undefined) || matchedEvent?.bandId || null,
    currentUserId,
  );

  // Members see only their own fee, never the gig total.
  const memberFee = inviteFeeToShow(data);
  const creatorName = (data.creator_name as string) || (data.creator_id ? t('Band Admin') : null);

  const loadInTime = matchedEvent?.loadInTime as string | undefined;
  const soundcheckTime = matchedEvent?.soundcheckTime as string | undefined;
  const showTime = matchedEvent?.time as string | undefined;

  // Calendar conflict: another active event on the same date.
  const conflictEvent = useMemo<any>(
    () => findEventConflicts(calendarEvents, { eventId, date: eventDate })[0] ?? null,
    [calendarEvents, eventDate, eventId],
  );

  const isRehearsal = eventType === 'rehearsal';
  const isQuote = eventType === 'quote';
  const label = isRehearsal ? t('Rehearsal') : isQuote ? t('Quote') : t('Gig');

  const dayLabel = formatDayShort(eventDate);
  const dateLabel = dayLabel || t('Date TBD');
  const timeLabel = eventTime ? formatTime12(eventTime) : t('TBD');
  const schedule = [
    loadInTime && t('Load {time}', { time: formatTime12(loadInTime) }),
    soundcheckTime && t('Sound {time}', { time: formatTime12(soundcheckTime) }),
    showTime && t('Show {time}', { time: formatTime12(showTime) }),
  ]
    .filter(Boolean)
    .join(' · ');

  const conflictLine = conflictEvent
    ? (() => {
        const start = formatTime12(conflictEvent.time);
        const end = formatTime12(conflictEvent.endTime);
        const when = start ? (end ? `${start} – ${end}` : start) : t('same day');
        return `${conflictEvent.title || t('Event')} · ${when} (${KIND_LABEL[kindOf(conflictEvent)]})`;
      })()
    : '';

  /** Writes the answer (maybe without a parent handler) and/or the note on the member's own row. */
  const saveOwnRow = async (patch: Record<string, unknown>): Promise<string | null> => {
    if (!eventId || !currentUserId) return t('Could not find your invitation for this event.');
    const { data: rows, error: upErr } = await supabase
      .from('event_members')
      .update(patch)
      .eq('event_id', eventId)
      .eq('user_id', currentUserId)
      .select('id');
    if (upErr) return upErr.message;
    if (!rows || rows.length === 0) return t('Could not find your invitation for this event.');
    return null;
  };

  const handleSend = async () => {
    if (isSubmitting || !choice) return;
    setIsSubmitting(true);
    setError(null);
    const trimmed = note.trim();
    try {
      if (choice === 'maybe' && !onRespond) {
        // No parent handler for "maybe": record it here, then close.
        const err = await saveOwnRow({
          status: 'maybe',
          responded_at: new Date().toISOString(),
          ...(trimmed ? { notes: trimmed } : {}),
        });
        if (err) {
          setError(err);
          return;
        }
        onClose();
        return;
      }
      // Save the note first: the parent closes the sheet once it has the answer.
      if (trimmed) {
        const err = await saveOwnRow({ notes: trimmed });
        if (err) {
          setError(t('Your note was not saved: {error}', { error: err }));
          return;
        }
      }
      if (onRespond) await onRespond(choice, trimmed || undefined);
      else if (choice === 'confirmed') await onAccept(trimmed || undefined);
      else await onDecline(trimmed || undefined);
    } catch (err: any) {
      console.error('RSVP action error:', err);
      setError(err?.message || t('Could not send your RSVP. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bw-rail-sheet fixed inset-0 z-[184] bg-black/60"
        onClick={onClose}
      />

      {/* Figma: Event / RSVP – conflict (Sheet, Style=Dark) */}
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('RSVP: {title}', { title: eventTitle })}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
        className="bw-rail-sheet bw-sheet-card fixed bottom-0 left-0 right-0 z-[185] bg-sheet text-sheet-foreground rounded-t-[32px] sm:rounded-[32px] px-5 pt-3 sm:max-w-lg sm:mx-auto sm:bottom-6 max-h-[90vh] overflow-y-auto flex flex-col gap-4"
        style={{
          paddingBottom: 'calc(16px + var(--safe-bottom))',
          ...maskStyle,
        }}
        {...drag.sheet}
      >
        {/* Sheet header */}
        <div className="flex flex-col gap-3" {...drag.handle}>
          <span className="bw-grabber mx-auto w-10 h-[5px] rounded-full bg-sheet-foreground/85" />
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="bw-label-sm text-sheet-foreground/85">{t('RSVP')}{dayLabel ? ` · ${dayLabel}` : ''}</p>
              <h2 className="bw-h1 [overflow-wrap:anywhere]">{t('Can you make it?')}</h2>
              {creatorName && (
                <p className="bw-body-sm text-sheet-foreground/70 mt-1">{t('Scheduled by {name}', { name: creatorName })}</p>
              )}
            </div>
            <RailSheet onClose={onClose} />
            <IconButton label={t('Close')} icon={<X />} size="sm" variant="sheet" onClick={onClose} />
          </div>
        </div>

        {/* Event details */}
        <div className="flex flex-col gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="bw-label-xs text-sheet-foreground/70">{label}</span>
            <span className="bw-label-md [overflow-wrap:anywhere]">{eventTitle}</span>
          </div>
          <SheetKV icon={<Calendar className="w-4 h-4" />} k={t('Date')} v={dateLabel} />
          <SheetKV icon={<Clock className="w-4 h-4" />} k={t('Time')} v={timeLabel} />
          {schedule && <SheetKV k={t('Timings')} v={schedule} />}
          <SheetKV
            icon={<MapPin className="w-4 h-4" />}
            k={t('Venue')}
            v={
              <span className="flex flex-col items-end gap-1">
                <MapsLink
                  query={[venue, venueAddress && venueAddress !== venue ? venueAddress : ''].filter(Boolean).join(', ')}
                  className="justify-end"
                >
                  {venue || t('Venue TBD')}
                </MapsLink>
                {venueAddress && venueAddress !== venue && (
                  <span className="block bw-body-sm normal-case text-sheet-foreground/70">{venueAddress}</span>
                )}
              </span>
            }
          />
          {memberFee != null && (
            <SheetKV
              icon={<CurrencyIcon className="w-4 h-4" />}
              k={t('Your fee')}
              v={`${sym()}${memberFee.toLocaleString(intlLocale())}`}
            />
          )}
        </div>

        {lineup && <LineupSoFar lineup={lineup} tone="sheet" />}

        {/* Schedule conflict notice */}
        {conflictEvent ? (
          <div className="flex items-start gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
            <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="bw-label-md">{t("You're already booked")}</span>
              <span className="bw-body-sm text-sheet-foreground/80 [overflow-wrap:anywhere]">{conflictLine}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
            <span className="bw-body-sm">{t('No schedule conflicts in your calendar')}</span>
          </div>
        )}

        {/* Answers */}
        <div role="radiogroup" aria-label={t('Your answer')} className="flex flex-col gap-2">
          {CHOICES.map((c) => {
            const on = choice === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={isSubmitting}
                onClick={() => setChoice(c.value)}
                className={cn(
                  'flex items-center gap-3 min-h-14 px-4 rounded-[16px] text-left transition-colors cursor-pointer',
                  'active:scale-[var(--press-scale,0.97)] disabled:opacity-60',
                  on ? 'bg-accent text-accent-foreground' : 'bg-sheet-foreground/[0.08]',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'w-5 h-5 rounded-full border-[1.5px] shrink-0 flex items-center justify-center',
                    on ? 'border-current' : 'border-sheet-foreground/60',
                  )}
                >
                  {on && <span className="w-2.5 h-2.5 rounded-full bg-current" />}
                </span>
                <span className="bw-label-md">{c.label}</span>
              </button>
            );
          })}
        </div>

        <PillField
          tone="sheet"
          label={t('Note for the band (optional)')}
          value={note}
          maxLength={280}
          onChange={(e) => setNote(e.target.value)}
          disabled={isSubmitting}
        />

        {error && <FormError>{error}</FormError>}

        <div className="pt-1">
          <PillButton onClick={handleSend} loading={isSubmitting} disabled={!choice}>
            {isSubmitting ? t('Sending…') : t('Send RSVP')}
          </PillButton>
        </div>
      </motion.div>
    </>
  );
};

/** Key/value row on the dark sheet. */
const SheetKV: React.FC<{ k: string; v: React.ReactNode; icon?: React.ReactNode }> = ({ k, v, icon }) => (
  <div className="flex items-start gap-3">
    <span className="flex items-center gap-2 bw-body-md text-sheet-foreground/70 shrink-0">
      {icon}
      {k}
    </span>
    <span className="flex-1 min-w-0 text-right bw-label-md pt-[3px] [overflow-wrap:anywhere]">{v}</span>
  </div>
);
