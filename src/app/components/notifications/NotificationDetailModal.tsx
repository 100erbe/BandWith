import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  X,
  Check,
  CheckCheck,
  CalendarPlus,
  Calendar,
  Euro,
  Bell,
  BellOff,
  Music,
  Mic2,
  MessageCircle,
  UserPlus,
  Trash2,
  AlertTriangle,
  Poll,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { durations, easings } from '@/styles/motion';
import { parseLocalDate } from '@/lib/dates';
import { HeaderAction, IconButton, NavBackButton, Card, Tag } from '@/app/components/bw/Screen';
import { RailCover } from '@/lib/railActions';
import { PillButton, Selector } from '@/app/components/bw/Form';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  band_id?: string;
  created_at: string;
  read: boolean;
}

interface NotificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: NotificationData | null;
  notifications?: NotificationData[];
  onMarkAsRead?: (id?: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (id?: string) => void;
  onAction?: (action: string, notificationId?: string) => void;
  onOpenRSVP?: (notification: NotificationData) => void;
  onOpenPoll?: (notification: NotificationData) => void;
}

const formatTime = (dateStr: string): string => {
  const date = parseLocalDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatEventDate = (dateStr: string): string => {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const cleanNotificationTitle = (title?: string): string => {
  if (!title) return 'NOTIFICATION';
  return title
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D✓✗?]+\s*/gu, '')
    .trim();
};


/**
 * Per-type label + colour (Figma: Notifications / Activity — 44pt icon tile in
 * the event colour; the detail hero card uses the same fill).
 * `onDark` = the fill is dark, so the hero badge flips to white.
 */
interface NotificationMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  fill: string;
  onDark: boolean;
}

function getNotificationMeta(type: string, data?: Record<string, unknown>): NotificationMeta {
  const t = (type || '').toLowerCase();
  const evType = String(data?.event_type || '').toLowerCase();
  const tag = data?.tag as string | undefined;

  if (t === 'member_dropped_out' || t === 'event_declined' || data?.response === 'declined') {
    return { label: tag || 'Dropout alert', icon: AlertTriangle, fill: 'bg-destructive-solid text-white', onDark: true };
  }
  if (t === 'rehearsal_poll') {
    return { label: tag || 'Poll', icon: Poll, fill: 'bg-accent-rehearsal text-accent-rehearsal-foreground', onDark: true };
  }
  if (t === 'rehearsal_proposal') {
    return { label: tag || 'Proposal', icon: Mic2, fill: 'bg-accent-rehearsal text-accent-rehearsal-foreground', onDark: true };
  }
  if (t.includes('rehearsal') || evType === 'rehearsal') {
    return { label: tag || 'Rehearsal', icon: Music, fill: 'bg-accent-rehearsal text-accent-rehearsal-foreground', onDark: true };
  }
  if (t.includes('chat')) {
    const isDirect = data?.chatType === 'direct' || data?.tag === 'Direct Message' || !data?.band_id;
    return {
      label: tag || (isDirect ? 'Private message' : 'Band message'),
      icon: MessageCircle,
      fill: 'bg-surface-inverse text-surface-inverse-foreground',
      onDark: true,
    };
  }
  if (t === 'event_invite') {
    return { label: tag || 'Gig invitation', icon: Music, fill: 'bg-accent-gig text-accent-gig-foreground', onDark: false };
  }
  if (t === 'event_confirmed') {
    return { label: tag || 'Gig confirmed', icon: CheckCheck, fill: 'bg-accent-gig text-accent-gig-foreground', onDark: false };
  }
  if (t.includes('gig') || t.includes('event')) {
    return { label: tag || 'Gig', icon: Music, fill: 'bg-accent-gig text-accent-gig-foreground', onDark: false };
  }
  if (t.includes('quote') || t.includes('payment') || t.includes('finance')) {
    return { label: tag || 'Finance', icon: Euro, fill: 'bg-accent-quote text-accent-quote-foreground', onDark: false };
  }
  if (t.includes('invite') || t.includes('member')) {
    return { label: tag || 'Invite', icon: UserPlus, fill: 'bg-accent-personal text-accent-personal-foreground', onDark: false };
  }
  return { label: tag || 'Alert', icon: Bell, fill: 'bg-surface-inverse text-surface-inverse-foreground', onDark: true };
}

/** Key/value line of the Figma "Event specifications" card. */
const KV: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex items-baseline gap-3">
    <span className="bw-body-md text-muted-foreground shrink-0">{k}</span>
    <span className="flex-1 min-w-0 text-right bw-label-md text-foreground [overflow-wrap:anywhere]">{v}</span>
  </div>
);

const addToCalendar = async (data: Record<string, unknown>) => {
  try {
    const title = (data.event_title as string) || 'Event';
    const date = data.event_date as string;
    const time = (data.event_time as string) || '20:00';
    const venue = (data.venue as string) || '';

    const startDate = new Date(`${date}T${time}`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const formatGoogleDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&location=${encodeURIComponent(venue)}&sf=true`;

    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: googleUrl });
    } else {
      window.open(googleUrl, '_blank');
    }
  } catch (error) {
    console.error('Error adding to calendar:', error);
  }
};

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  isOpen,
  onClose,
  notification,
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onAction,
  onOpenRSVP,
  onOpenPoll,
}) => {
  useCurrency(); // re-render money labels when the band currency changes
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  // When modal closes or when hub is opened (notification is null), always reset viewingIndex and filter
  useEffect(() => {
    if (!isOpen || !notification) {
      setViewingIndex(null);
    }
    if (!isOpen) {
      setFilter('all');
    }
  }, [isOpen, notification]);

  const allNotifications =
    notifications.length > 0 ? notifications : notification ? [notification] : [];
  const isListView = viewingIndex === null && !notification;

  // Filtered notifications
  const displayedNotifications = filter === 'unread'
    ? allNotifications.filter(n => !n.read)
    : allNotifications;

  const unreadCount = allNotifications.filter(n => !n.read).length;

  // Determine which notification to show in detail view
  const detailNotif = viewingIndex !== null
    ? allNotifications[viewingIndex]
    : notification;

  // Auto-mark notification as read when viewed in detail
  useEffect(() => {
    if (isOpen && detailNotif && !detailNotif.read && onMarkAsRead) {
      onMarkAsRead(detailNotif.id);
    }
  }, [isOpen, detailNotif?.id, detailNotif?.read, onMarkAsRead]);

  const handleClose = () => {
    setViewingIndex(null);
    setFilter('all');
    onClose();
  };

  const backToList = () => setViewingIndex(null);

  const handleAction = (action: string, notificationId?: string) => {
    setViewingIndex(null);
    onAction?.(action, notificationId || detailNotif?.id);
  };

  const handleDelete = (id?: string) => {
    setViewingIndex(null);
    onDelete?.(id || detailNotif?.id);
  };

  const handleAddToCalendar = async () => {
    const notif = detailNotif;
    if (!notif?.data) return;
    setIsAddingToCalendar(true);
    await addToCalendar(notif.data as Record<string, unknown>);
    setIsAddingToCalendar(false);
  };


  const isPollType = detailNotif?.type === 'rehearsal_poll' || detailNotif?.type === 'rehearsal_proposal';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: durations.normal, ease: easings.smooth }}
          className="bw-pane-detail fixed inset-0 z-[101] flex flex-col bg-background text-foreground overflow-x-hidden"
          style={{ overscrollBehaviorX: 'none' }}
        >
          {/* ═══ HEADER ═══ */}
          {isListView ? (
            /* Figma: Kicker (Activity & updates / Inbox) + Outline close */
            <header className="shrink-0 px-4 bg-background" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
              <div className="max-w-xl mx-auto w-full flex items-end gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="bw-label-sm text-muted-foreground">Activity &amp; updates</p>
                  <h1 className="bw-display-lg text-foreground truncate">Inbox</h1>
                </div>
                <RailCover pane />
                <HeaderAction pane label="Close notifications" icon={<X />} onClick={handleClose} />
              </div>
            </header>
          ) : (
            /* Figma: back · NOTIFICATION DETAIL · delete */
            <header className="shrink-0 px-4 bg-background" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
              <div className="max-w-xl mx-auto w-full h-11 flex items-center gap-3">
                {viewingIndex !== null ? (
                  <NavBackButton pane label="Back to notification list" onClick={backToList} />
                ) : (
                  <>
                    <RailCover pane />
                    <HeaderAction pane label="Close notifications" icon={<X />} onClick={handleClose} />
                  </>
                )}
                <p className="flex-1 min-w-0 text-center bw-label-sm text-muted-foreground truncate">Notification detail</p>
                <HeaderAction pane label="Delete notification" variant="ghost" icon={<Trash2 />} onClick={() => handleDelete(detailNotif?.id)} />
              </div>
            </header>
          )}

          {/* ═══ SCROLLABLE BODY ═══ */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
              {isListView ? (
                /* ═══ LIST VIEW ═══ */
                <>
                  {allNotifications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Selector size="md" selected={filter === 'all'} onClick={() => setFilter('all')} count={allNotifications.length}>
                          All
                        </Selector>
                        <Selector size="md" selected={filter === 'unread'} onClick={() => setFilter('unread')} count={unreadCount}>
                          Unread
                        </Selector>
                      </div>
                      {unreadCount > 0 && onMarkAllAsRead && (
                        <PillButton
                          variant="ghost"
                          size="sm"
                          fullWidth={false}
                          icon={<Check className="w-4 h-4" />}
                          onClick={onMarkAllAsRead}
                          aria-label="Mark all as read"
                          className="px-0"
                        >
                          Mark read
                        </PillButton>
                      )}
                    </div>
                  )}

                  {displayedNotifications.length === 0 ? (
                    <Card className="items-center text-center py-10 gap-4">
                      <BellOff className="w-10 h-10 text-muted-foreground" />
                      <div className="flex flex-col gap-1">
                        <h3 className="bw-h3">{filter === 'unread' ? 'No unread notifications' : 'All caught up'}</h3>
                        <p className="bw-body-sm text-muted-foreground max-w-xs">
                          {filter === 'unread'
                            ? 'All notifications have been reviewed.'
                            : 'There are no active alerts or gig updates at the moment.'}
                        </p>
                      </div>
                    </Card>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {displayedNotifications.map((notif, i) => {
                        const originalIndex = allNotifications.findIndex(n => n.id === notif.id);
                        const isRead = notif.read;
                        const meta = getNotificationMeta(notif.type, notif.data);
                        const IconComponent = meta.icon;
                        const typeLine = [meta.label, notif.data?.subtitle ? String(notif.data.subtitle) : null]
                          .filter(Boolean)
                          .join(' · ');

                        return (
                          <li key={notif.id}>
                            <button
                              type="button"
                              onClick={() => {
                                if (notif.type === 'event_invite' && onOpenRSVP) {
                                  onOpenRSVP(notif);
                                  return;
                                }
                                if ((notif.type === 'rehearsal_poll' || notif.type === 'rehearsal_proposal') && onOpenPoll) {
                                  onOpenPoll(notif);
                                  return;
                                }
                                setViewingIndex(originalIndex >= 0 ? originalIndex : i);
                              }}
                              className={cn(
                                'w-full text-left p-4 rounded-[24px] flex items-start gap-3 active:scale-[0.99] transition-transform',
                                isRead ? 'border border-border' : 'bg-card',
                              )}
                            >
                              <span className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0', meta.fill)}>
                                <IconComponent className="w-5 h-5" />
                              </span>
                              <span className="flex-1 min-w-0 flex flex-col gap-1">
                                <span className="flex items-center gap-2">
                                  <span className="flex-1 min-w-0 bw-label-xs text-muted-foreground truncate">{typeLine}</span>
                                  <span className="bw-label-xs text-muted-foreground shrink-0">{formatTime(notif.created_at)}</span>
                                </span>
                                <span className="bw-label-md text-foreground truncate">{cleanNotificationTitle(notif.title)}</span>
                                {notif.body && <span className="bw-body-sm text-muted-foreground line-clamp-2">{notif.body}</span>}
                              </span>
                              {!isRead && (
                                <span className="w-2 h-2 mt-1 rounded-full bg-destructive shrink-0" aria-label="Unread" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : detailNotif ? (
                /* ═══ DETAIL VIEW (Figma: Notifications / Gig invitation) ═══ */
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200">
                  {(() => {
                    const meta = getNotificationMeta(detailNotif.type, detailNotif.data);
                    return (
                      <div className={cn('p-5 rounded-[24px] flex flex-col gap-3', meta.fill)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag variant="solid" className={meta.onDark ? 'bg-white text-black' : undefined}>
                            {meta.label}
                          </Tag>
                          {Boolean(detailNotif.data?.subtitle) && (
                            <Tag variant="outline" className="border-current text-current">
                              {String(detailNotif.data?.subtitle)}
                            </Tag>
                          )}
                          <span className="flex-1" />
                          <span className="bw-label-xs opacity-70">{formatTime(detailNotif.created_at)}</span>
                        </div>
                        <h2 className="bw-display-lg [overflow-wrap:anywhere]">{cleanNotificationTitle(detailNotif.title)}</h2>
                        {detailNotif.body && <p className="bw-body-md">{detailNotif.body}</p>}
                      </div>
                    );
                  })()}

                  {detailNotif.data && (() => {
                    const d = detailNotif.data as Record<string, any>;
                    const hasEventData = !!d.event_date;
                    const hasGenericFields = !!(d.invitee_email || d.inviter_name || d.member_name);

                    if (!hasEventData && !hasGenericFields) return null;

                    return (
                      <>
                        <h3 className="bw-label-sm text-muted-foreground">
                          {hasEventData ? 'Event specifications' : 'Invitation details'}
                        </h3>
                        <Card className="gap-4">
                          {hasEventData && (
                            <>
                              {d.event_title && <KV k="Event" v={String(d.event_title)} />}
                              <KV
                                k="Date & time"
                                v={[formatEventDate(String(d.event_date)), d.event_time ? String(d.event_time) : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              />
                              {d.venue && <KV k="Venue" v={String(d.venue)} />}
                              {(d.member_fee || d.fee) && (
                                <KV
                                  k={d.member_fee ? 'Allocated fee' : 'Total fee'}
                                  v={`${sym()}${Number(d.member_fee || d.fee).toLocaleString()}`}
                                />
                              )}
                            </>
                          )}
                          {d.invitee_email && <KV k="Email" v={String(d.invitee_email)} />}
                          {d.inviter_name && <KV k="Invited by" v={String(d.inviter_name)} />}
                          {d.member_name && <KV k="Member" v={String(d.member_name)} />}
                        </Card>

                        {hasEventData && (
                          <PillButton
                            variant="outline"
                            size="md"
                            onClick={handleAddToCalendar}
                            disabled={isAddingToCalendar}
                            icon={<CalendarPlus className="w-[18px] h-[18px]" />}
                          >
                            {isAddingToCalendar ? 'Adding…' : 'Add to Google Calendar'}
                          </PillButton>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>

          {/* ═══ CTA BAR ═══ */}
          <div className="shrink-0 bg-background px-4 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
            <div className="max-w-xl mx-auto w-full">
              {isListView ? (
                <PillButton variant="dark" onClick={handleClose}>
                  Close notifications
                </PillButton>
              ) : detailNotif?.type === 'event_invite' ? (
                <div className="flex items-center gap-3">
                  <PillButton variant="outline" className="flex-[0_0_36%]" onClick={() => handleAction('decline_event')}>
                    Decline
                  </PillButton>
                  <PillButton className="flex-1" icon={<Check className="w-[18px] h-[18px]" />} onClick={() => handleAction('accept_event')}>
                    Accept event
                  </PillButton>
                </div>
              ) : isPollType ? (
                <div className="flex items-center gap-3">
                  <PillButton
                    variant="outline"
                    className="flex-[0_0_36%]"
                    onClick={viewingIndex !== null ? backToList : handleClose}
                  >
                    {viewingIndex !== null ? 'Back' : 'Close'}
                  </PillButton>
                  <PillButton className="flex-1" icon={<Calendar className="w-[18px] h-[18px]" />} onClick={() => detailNotif && onOpenPoll?.(detailNotif)}>
                    {detailNotif?.type === 'rehearsal_poll' ? 'Vote on dates' : 'View proposal'}
                  </PillButton>
                </div>
              ) : (
                <PillButton variant="dark" onClick={viewingIndex !== null ? backToList : handleClose}>
                  {viewingIndex !== null ? 'Back to list' : 'Close'}
                </PillButton>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationDetailModal;
