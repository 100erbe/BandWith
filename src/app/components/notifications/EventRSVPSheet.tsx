import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ArrowUpRight, 
  MapPin, 
  Clock, 
  Calendar, 
  Euro, 
  Navigation, 
  AlertTriangle, 
  CheckCircle2 
} from '@/app/components/icons';
import { usePeekingScroll } from '@/app/components/ui/PeekingScrollContainer';
import type { Notification } from '@/lib/services/notifications';

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
    const d = new Date(dateStr);
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
  const accentColor = isRehearsal
    ? 'var(--accent-rehearsal)'
    : isQuote
    ? 'var(--accent-quote)'
    : 'var(--accent-gig)';
  const accentText = isRehearsal
    ? 'var(--accent-rehearsal-fg)'
    : isQuote
    ? 'var(--accent-quote-fg)'
    : 'var(--accent-gig-fg)';
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        ref={containerRef}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
        className="fixed bottom-0 left-0 right-0 z-[91] bg-card text-card-foreground border-t sm:border border-foreground/15 rounded-t-[28px] sm:rounded-[28px] px-5 pt-4 shadow-2xl sm:max-w-lg sm:mx-auto sm:bottom-6 max-h-[90vh] overflow-y-auto"
        style={{
          paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
          ...maskStyle,
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span 
              className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-2xs"
              style={{ backgroundColor: accentColor, color: accentText }}
            >
              {label} INVITATION
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full border border-foreground/15 flex items-center justify-center text-foreground active:scale-90 transition-transform hover:bg-foreground/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Creator */}
        <div className="flex flex-col gap-1 mb-5">
          <h3 className="text-[22px] sm:text-[24px] font-black text-foreground uppercase tracking-tight leading-tight">
            {eventTitle}
          </h3>
          {creatorName && (
            <p className="text-[12px] font-medium text-muted-foreground">
              Scheduled by <span className="font-bold text-foreground">{creatorName}</span>
            </p>
          )}
        </div>

        {/* Key Event Details Grid */}
        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/10 mb-4">
          {/* Date & Main Time */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-foreground/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                <span className="text-[14px] font-black text-foreground">
                  {eventDate ? formatDate(eventDate) : 'Date TBD'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-right">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Time</span>
                <span className="text-[14px] font-black text-foreground">
                  {eventTime ? formatTime(eventTime) : 'TBD'}
                </span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Schedule Strip (Load-in, Sound, Show) if available */}
          {(loadInTime || soundCheckTime || showTime) && (
            <div className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-foreground/5 text-xs text-foreground/80 font-medium">
              {loadInTime && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Load</span>
                  <span className="font-bold">{loadInTime}</span>
                </div>
              )}
              {soundCheckTime && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Sound</span>
                  <span className="font-bold">{soundCheckTime}</span>
                </div>
              )}
              {showTime && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Show</span>
                  <span className="font-bold">{showTime}</span>
                </div>
              )}
            </div>
          )}

          {/* Location & Distance */}
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</span>
                <span className="text-[13px] font-bold text-foreground truncate">
                  {venue || 'Venue TBD'}
                </span>
                {venueAddress && venueAddress !== venue && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {venueAddress}
                  </span>
                )}
              </div>
            </div>

            {/* Distance Indicator */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/10 shrink-0 text-muted-foreground">
              <Navigation className="w-3 h-3 text-primary" />
              <span className="text-[11px] font-bold text-foreground">~12 km</span>
            </div>
          </div>

          {/* Fee Strip */}
          {displayFee != null && displayFee > 0 && (
            <div className="flex items-center justify-between pt-2.5 border-t border-foreground/10">
              <div className="flex items-center gap-2">
                <Euro className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {feeLabel}
                </span>
              </div>
              <span className="text-[18px] font-black text-foreground">
                €{displayFee.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Schedule Conflict Notice */}
        <div className="mb-6">
          {conflictEvent ? (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-black uppercase tracking-wider text-[11px]">Potential Schedule Conflict</span>
                <span className="text-foreground/80 leading-snug">
                  You already have <strong>"{conflictEvent.title}"</strong> scheduled on this date ({conflictEvent.time || 'same day'}).
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>No schedule conflicts detected in your calendar</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('decline')}
            disabled={isSubmitting}
            className="py-3.5 rounded-xl border border-foreground/20 text-foreground font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 hover:bg-foreground/5 cursor-pointer"
          >
            DECLINE
          </button>
          <button
            onClick={() => handleAction('accept')}
            disabled={isSubmitting}
            className="py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 hover:opacity-95 shadow-md cursor-pointer"
            style={{ backgroundColor: accentColor, color: accentText }}
          >
            {isSubmitting ? 'SAVING...' : 'ACCEPT INVITATION'}
          </button>
        </div>
      </motion.div>
    </>
  );
};
