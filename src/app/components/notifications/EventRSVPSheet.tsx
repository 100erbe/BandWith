import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Check,
  MapPin,
  Clock,
  Calendar,
  Euro,
  AlertTriangle,
  CheckCircle2,
} from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { usePeekingScroll } from '@/app/components/ui/PeekingScrollContainer';
import type { Notification } from '@/lib/services/notifications';
import { parseLocalDate } from '@/lib/dates';

interface EventRSVPSheetProps {
  notification: Notification;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  onClose: () => void;
  calendarEvents?: any[];
  currentUserId?: string;
}

const formatDate = (dateStr: string): string => {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    }).toUpperCase();
  } catch { 
    return dateStr; 
  }
};

const formatTime = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m || '00'} ${ampm}`;
};

export const EventRSVPSheet: React.FC<EventRSVPSheetProps> = ({
  notification,
  onAccept,
  onDecline,
  onClose,
  calendarEvents = [],
  currentUserId,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { containerRef, maskStyle } = usePeekingScroll<HTMLDivElement>();

  const data = notification.data || {};
  const eventId = data.event_id as string;
  const matchedEvent = useMemo(() => {
    if (!eventId || !calendarEvents.length) return null;
    return calendarEvents.find((e: any) => String(e.id) === String(eventId));
  }, [eventId, calendarEvents]);

  const eventType = (data.event_type as string) || matchedEvent?.type || 'gig';
  const eventTitle = (data.event_title as string) || matchedEvent?.title || notification.title;
  const eventDate = (data.event_date as string) || matchedEvent?.date;
  const eventTime = (data.event_time as string) || matchedEvent?.time;
  const venue = (data.venue as string) || matchedEvent?.location;
  const venueAddress = (data.venue_address as string) || matchedEvent?.venueAddress;
  
  const memberFee = (data.member_fee as number) || matchedEvent?.fee;
  const totalFee = (data.fee as number) || matchedEvent?.fee;
  const displayFee = memberFee || totalFee;
  const feeLabel = memberFee ? 'YOUR FEE' : 'FEE';
  const creatorName = (data.creator_name as string) || (data.creator_id ? 'Band Admin' : null);

  const loadInTime = matchedEvent?.loadInTime;
  const soundCheckTime = matchedEvent?.soundCheckTime;
  const showTime = matchedEvent?.showTime;

  // Calendar conflict detection
  const conflictEvent = useMemo(() => {
    if (!eventDate || !calendarEvents.length) return null;
    return calendarEvents.find((e: any) => {
      const isDifferentEvent = String(e.id) !== String(eventId);
      const isSameDate = e.date === eventDate;
      const isNotDeclined = e.status !== 'declined' && e.status !== 'cancelled';
      return isDifferentEvent && isSameDate && isNotDeclined;
    });
  }, [calendarEvents, eventDate, eventId]);

  const isRehearsal = eventType === 'rehearsal';
  const isQuote = eventType === 'quote';
  const label = isRehearsal ? 'REHEARSAL' : isQuote ? 'QUOTE' : 'GIG';

  const handleAction = async (action: 'accept' | 'decline') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (action === 'accept') await onAccept();
      else await onDecline();
    } catch (err) {
      console.error('RSVP action error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateLabel = eventDate ? formatDate(eventDate) : 'Date TBD';
  const timeLabel = eventTime ? formatTime(eventTime) : 'TBD';
  const schedule = [
    loadInTime && `Load ${loadInTime}`,
    soundCheckTime && `Sound ${soundCheckTime}`,
    showTime && `Show ${showTime}`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[90] bg-black/60"
        onClick={onClose}
      />

      {/* Figma: Event / RSVP – conflict (Sheet, Style=Dark) */}
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`RSVP: ${eventTitle}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
        className="fixed bottom-0 left-0 right-0 z-[91] bg-sheet text-sheet-foreground rounded-t-[32px] sm:rounded-[32px] px-5 pt-3 sm:max-w-lg sm:mx-auto sm:bottom-6 max-h-[90vh] overflow-y-auto flex flex-col gap-4"
        style={{
          paddingBottom: 'calc(16px + var(--safe-bottom))',
          ...maskStyle,
        }}
      >
        {/* Sheet header */}
        <div className="flex flex-col gap-3">
          <span className="mx-auto w-10 h-[5px] rounded-full bg-sheet-foreground/85" />
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="bw-label-sm text-sheet-foreground/85">
                {label} invitation · {dateLabel}
              </p>
              <h2 className="bw-h1 [overflow-wrap:anywhere]">{eventTitle}</h2>
              {creatorName && (
                <p className="bw-body-sm text-sheet-foreground/70 mt-1">Scheduled by {creatorName}</p>
              )}
            </div>
            <IconButton label="Close" icon={<X />} size="sm" variant="sheet" onClick={onClose} />
          </div>
        </div>

        {/* Event details */}
        <div className="flex flex-col gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
          <SheetKV icon={<Calendar className="w-4 h-4" />} k="Date" v={dateLabel} />
          <SheetKV icon={<Clock className="w-4 h-4" />} k="Time" v={timeLabel} />
          {schedule && <SheetKV k="Timings" v={schedule} />}
          <SheetKV
            icon={<MapPin className="w-4 h-4" />}
            k="Venue"
            v={
              <>
                {venue || 'Venue TBD'}
                {venueAddress && venueAddress !== venue && (
                  <span className="block bw-body-sm normal-case text-sheet-foreground/70">{venueAddress}</span>
                )}
              </>
            }
          />
          {displayFee != null && displayFee > 0 && (
            <SheetKV icon={<Euro className="w-4 h-4" />} k={memberFee ? 'Your fee' : 'Fee'} v={`€${displayFee.toLocaleString()}`} />
          )}
        </div>

        {/* Schedule conflict notice */}
        {conflictEvent ? (
          <div className="flex items-start gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
            <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="bw-label-md">You&apos;re already booked</span>
              <span className="bw-body-sm text-sheet-foreground/80">
                {conflictEvent.title}
                {conflictEvent.time ? ` · ${conflictEvent.time}` : ' · same day'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-[16px] bg-sheet-foreground/[0.08]">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
            <span className="bw-body-sm">No schedule conflicts in your calendar</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <PillButton
            variant="outline"
            className="flex-[0_0_38%] border-sheet-foreground text-sheet-foreground"
            onClick={() => handleAction('decline')}
            disabled={isSubmitting}
            icon={<X className="w-[18px] h-[18px]" />}
          >
            Decline
          </PillButton>
          <PillButton
            className="flex-1"
            onClick={() => handleAction('accept')}
            loading={isSubmitting}
            icon={<Check className="w-[18px] h-[18px]" />}
          >
            {isSubmitting ? 'Saving…' : 'Accept'}
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
