import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Mic2, X, ArrowRight, Sparkles } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import type { Notification } from '@/lib/services/notifications';

interface UrgentNotificationPopupProps {
  notification: Notification;
  onOpen: () => void;
  onDismiss: () => void;
}

export const UrgentNotificationPopup: React.FC<UrgentNotificationPopupProps> = ({
  notification,
  onOpen,
  onDismiss,
}) => {
  const data = (notification.data || {}) as Record<string, unknown>;
  const type = notification.type;
  const isRehearsalPoll = type === 'rehearsal_poll';
  const isRehearsalProposal = type === 'rehearsal_proposal';
  const isEventInvite = type === 'event_invite';

  const eventType = (data.event_type as string) || 'gig';
  const isRehearsalInvite = isEventInvite && eventType === 'rehearsal';

  // Semantic styles
  const isPollOrProposal = isRehearsalPoll || isRehearsalProposal;
  const accentColor = isPollOrProposal || isRehearsalInvite
    ? 'var(--accent-rehearsal)'
    : 'var(--accent-gig)';
  const accentFgColor = isPollOrProposal || isRehearsalInvite
    ? 'var(--accent-rehearsal-fg)'
    : 'var(--accent-gig-fg)';

  const IconComponent = isRehearsalProposal
    ? Sparkles
    : isPollOrProposal || isRehearsalInvite
    ? Calendar
    : Mic2;

  const eyebrowLabel = isRehearsalPoll
    ? 'REHEARSAL POLL'
    : isRehearsalProposal
    ? 'REHEARSAL PROPOSAL'
    : isRehearsalInvite
    ? 'REHEARSAL INVITE'
    : 'GIG INVITATION';

  const actionLabel = isRehearsalPoll
    ? 'VOTE NOW'
    : isRehearsalProposal
    ? 'VIEW'
    : 'CONFIRM';

  const title = (data.event_title as string) || notification.title || 'New Urgent Action';

  const subtitle = isRehearsalPoll
    ? 'Select your available dates'
    : isRehearsalProposal
    ? 'New proposal needs poll setup'
    : data.venue
    ? `${data.venue}${data.event_date ? ` • ${data.event_date}` : ''}`
    : 'Urgent response needed';

  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
      className="fixed top-3 sm:top-5 left-3 right-3 sm:left-auto sm:right-6 sm:w-[420px] z-[98] bg-card border border-foreground/15 rounded-2xl shadow-2xl overflow-hidden select-none"
    >
      {/* Top semantic accent strip */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
        {/* Left: Icon & Clickable summary */}
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }}
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
              color: accentColor,
            }}
          >
            <IconComponent className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-black uppercase tracking-wider leading-none"
                style={{ color: accentColor }}
              >
                {eyebrowLabel}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-foreground/10 text-foreground/70 uppercase">
                Urgent
              </span>
            </div>

            <h4 className="text-sm font-black uppercase text-foreground truncate mt-1 leading-tight">
              {title}
            </h4>

            <p className="text-[11px] font-medium text-muted-foreground truncate mt-0.5 leading-tight">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: Action Button & Close */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpen}
            className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-xs hover:opacity-95 active:scale-95 transition-all"
            style={{
              backgroundColor: accentColor,
              color: accentFgColor,
            }}
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label="Dismiss alert"
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 active:scale-90 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
