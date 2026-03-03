import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowUpRight, MapPin, Clock, Calendar, Euro } from 'lucide-react';
import type { Notification } from '@/lib/services/notifications';

interface EventRSVPSheetProps {
  notification: Notification;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  onClose: () => void;
}

const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  } catch { return dateStr; }
};

const formatTime = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export const EventRSVPSheet: React.FC<EventRSVPSheetProps> = ({
  notification,
  onAccept,
  onDecline,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const data = notification.data || {};
  const eventType = (data.event_type as string) || 'gig';
  const eventTitle = (data.event_title as string) || notification.title;
  const eventDate = data.event_date as string;
  const eventTime = data.event_time as string;
  const venue = data.venue as string;
  const memberFee = data.member_fee as number;
  const totalFee = data.fee as number;
  const displayFee = memberFee || totalFee;
  const feeLabel = memberFee ? 'YOUR FEE' : 'TOTAL FEE';
  const creatorName = data.creator_name as string;

  const isRehearsal = eventType === 'rehearsal';
  const isQuote = eventType === 'quote';
  const accentColor = isRehearsal ? '#0147FF' : isQuote ? '#9A8878' : '#D5FB46';
  const accentText = isRehearsal || isQuote ? 'white' : 'black';
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
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[10px]"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed bottom-0 left-0 right-0 z-[91] bg-black rounded-t-[26px] px-4 pt-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
        style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>

        <div className="flex items-end justify-between mb-6">
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider">
            EVENT INVITATION
          </p>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase" style={{ color: accentColor }}>
                {label}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5" style={{ color: accentColor }} />
            </div>
            <h3 className="text-[22px] font-bold text-white uppercase leading-tight">
              {eventTitle}
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {eventDate && (
              <div className="flex items-center gap-3 text-white/50">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="text-[13px] font-bold">{formatDate(eventDate)}</span>
              </div>
            )}
            {eventTime && (
              <div className="flex items-center gap-3 text-white/50">
                <Clock className="w-4 h-4 shrink-0" />
                <span className="text-[13px] font-bold">{formatTime(eventTime)}</span>
              </div>
            )}
            {venue && (
              <div className="flex items-center gap-3 text-white/50">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="text-[13px] font-bold">{venue}</span>
              </div>
            )}
            {displayFee != null && displayFee > 0 && (
              <div className="flex items-center gap-3 text-white/50">
                <Euro className="w-4 h-4 shrink-0" />
                <span className="text-[13px] font-bold">{feeLabel}: €{displayFee.toLocaleString()}</span>
              </div>
            )}
          </div>

          {creatorName && (
            <p className="text-[12px] font-medium text-white/30">
              Invited by <span className="text-white/60">{creatorName}</span>
            </p>
          )}

          <div className="grid grid-cols-6 gap-1 w-full">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-[15px] rounded-[10px]"
                style={{ backgroundColor: i < 1 ? accentColor : 'rgba(255,255,255,0.2)' }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('decline')}
            disabled={isSubmitting}
            className="py-4 rounded-[10px] border-2 border-white/20 text-white font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          >
            DECLINE
          </button>
          <button
            onClick={() => handleAction('accept')}
            disabled={isSubmitting}
            className="py-4 rounded-[10px] font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: accentColor, color: accentText }}
          >
            {isSubmitting ? '...' : 'ACCEPT'}
          </button>
        </div>
      </motion.div>
    </>
  );
};
