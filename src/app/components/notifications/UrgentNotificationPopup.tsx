import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, X } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw/Form';
import type { Notification } from '@/lib/services/notifications';
import { springs } from '@/styles/motion';
import { useT } from '@/lib/i18n';

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
  const t = useT();
  const data = (notification.data || {}) as Record<string, unknown>;
  const type = notification.type;
  const isRehearsalPoll = type === 'rehearsal_poll';
  const isRehearsalProposal = type === 'rehearsal_proposal';
  const isEventInvite = type === 'event_invite';

  const eventType = (data.event_type as string) || 'gig';
  const isRehearsalInvite = isEventInvite && eventType === 'rehearsal';

  const eyebrowLabel = isRehearsalPoll
    ? t('REHEARSAL POLL')
    : isRehearsalProposal
    ? t('REHEARSAL PROPOSAL')
    : isRehearsalInvite
    ? t('REHEARSAL INVITE')
    : t('GIG INVITATION');

  const actionLabel = isRehearsalPoll
    ? t('VOTE NOW')
    : isRehearsalProposal
    ? t('VIEW')
    : t('CONFIRM');

  const title = (data.event_title as string) || notification.title || t('New Urgent Action');

  const subtitle = isRehearsalPoll
    ? t('Select your available dates')
    : isRehearsalProposal
    ? t('New proposal needs poll setup')
    : data.venue
    ? `${data.venue}${data.event_date ? ` • ${data.event_date}` : ''}`
    : t('Urgent response needed');

  return (
    <>
    {/* Figma: the screen behind the urgent card is dimmed; tapping it dismisses. */}
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onDismiss}
      className="bw-pane-dialog fixed inset-0 z-[182] bg-black/80"
    />
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.97 }}
      transition={springs.snappy}
      // Figma: Notifications / Urgent popup — lime card docked under the status bar.
      className="bw-pane-float bg-accent text-accent-foreground fixed left-4 right-4 bw-status-clear-inset mx-auto max-w-[420px] z-[183] rounded-[24px] p-5 flex flex-col gap-3 select-none"
      style={{ top: 'calc(var(--safe-top) + 4px)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-destructive-solid text-white bw-label-xs shrink-0">{t('Urgent')}</span>
        <span className="flex-1 min-w-0 bw-label-xs truncate">{eyebrowLabel}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label={t('Dismiss alert')}
          className="-m-3 w-11 h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-transform"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

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
        className="flex flex-col gap-2 min-w-0 cursor-pointer"
      >
        <span className="bw-h3 [overflow-wrap:anywhere] line-clamp-2">{title}</span>
        <span className="bw-body-md truncate">{subtitle}</span>
      </div>

      <PillButton
        variant="white"
        size="md"
        onClick={onOpen}
        className="mt-1"
        trailingIcon={<ArrowUpRight className="w-[18px] h-[18px]" />}
      >
        {actionLabel}
      </PillButton>
    </motion.div>
    </>
  );
};
