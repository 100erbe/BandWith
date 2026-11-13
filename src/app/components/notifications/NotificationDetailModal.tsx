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
  CheckCircle2,
  Poll,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { durations, easings } from '@/styles/motion';
import { parseLocalDate } from '@/lib/dates';
import { HeaderAction, IconButton, NavBackButton, Card, Tag } from '@/app/components/bw/Screen';
import { RailCover } from '@/lib/railActions';
import { useRailLayout } from '@/lib/deviceRegions';
import { PillButton, Selector } from '@/app/components/bw/Form';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { findCalendarEvent, findEventConflicts, type CalendarEventLike } from '@/lib/eventConflicts';
import { notificationBandId, notificationTarget, notificationTargetLabel } from '@/lib/notificationRouting';
import { SwipeRow } from '@/app/components/bw/SwipeRow';
import { DeleteChatSheet } from '@/app/components/chat/DeleteChatSheet';
import { haptic } from '@/lib/haptics';
import { t, useT, intlLocale } from '@/lib/i18n';

/** Calendar item fields the gig-invitation page reads (subset of EventItem). */
export interface NotificationCalendarEvent extends CalendarEventLike {
  loadInTime?: string;
  soundcheckTime?: string;
  venueName?: string;
  venueAddress?: string;
  distance?: string;
  venueCoordinates?: { lat: number; lng: number };
}

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
  /**
   * Opens the screen the notification is about (event, chat, quotes…). When
   * set, tapping such a notification in the list goes straight there.
   */
  onNavigate?: (notification: NotificationData) => void;
  /**
   * The user's calendar (same list EventRSVPSheet gets). Enables timings and the
   * schedule-conflict card on gig invitations; when absent the card is hidden.
   */
  calendarEvents?: NotificationCalendarEvent[];
  /**
   * Names of the user's bands by id. Pass it when the user is in more than one
   * band: each notification then says which band it comes from.
   */
  bandNames?: Record<string, string>;
  /** Deletes every notification in the list ("Clear all"). */
  onClearAll?: () => void;
}

const formatTime = (dateStr: string): string => {
  const date = parseLocalDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('now');
  if (diffMins < 60) return t('{count}m ago', { count: diffMins });
  if (diffHours < 24) return t('{count}h ago', { count: diffHours });
  if (diffDays < 7) return t('{count}d ago', { count: diffDays });
  return date.toLocaleDateString(intlLocale('en-US'), { month: 'short', day: 'numeric' });
};

const formatEventDate = (dateStr: string): string => {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString(intlLocale('en-US'), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const cleanNotificationTitle = (title?: string): string => {
  if (!title) return t('NOTIFICATION');
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
  const kind = (type || '').toLowerCase();
  const evType = String(data?.event_type || '').toLowerCase();
  const tag = data?.tag as string | undefined;

  if (kind === 'member_dropped_out' || kind === 'event_declined' || data?.response === 'declined') {
    return { label: tag || t('Dropout alert'), icon: AlertTriangle, fill: 'bg-destructive-solid text-white', onDark: true };
  }
  if (kind === 'rehearsal_poll') {
    return { label: tag || t('Poll'), icon: Poll, fill: 'bg-accent-rehearsal text-accent-rehearsal-foreground', onDark: true };
  }
  if (kind === 'rehearsal_proposal') {
    return { label: tag || t('Proposal'), icon: Mic2, fill: 'bg-accent-rehearsal text-accent-rehearsal-foreground', onDark: true };
  }
  if (kind.includes('rehearsal') || evType === 'rehearsal') {
    return { label: tag || t('Rehearsal'), icon: Music, fill: 'bg-accent-rehearsal text-accent-rehearsal-foreground', onDark: true };
  }
  if (kind.includes('chat')) {
    const isDirect = data?.chatType === 'direct' || data?.tag === 'Direct Message' || !data?.band_id;
    return {
      label: tag || (isDirect ? t('Private message') : t('Band message')),
      icon: MessageCircle,
      fill: 'bg-surface-inverse text-surface-inverse-foreground',
      onDark: true,
    };
  }
  if (kind === 'event_invite') {
    return { label: tag || t('Gig invitation'), icon: Music, fill: 'bg-accent-gig text-accent-gig-foreground', onDark: false };
  }
  if (kind === 'event_confirmed') {
    return { label: tag || t('Gig confirmed'), icon: CheckCheck, fill: 'bg-accent-gig text-accent-gig-foreground', onDark: false };
  }
  if (kind.includes('gig') || kind.includes('event')) {
    return { label: tag || t('Gig'), icon: Music, fill: 'bg-accent-gig text-accent-gig-foreground', onDark: false };
  }
  if (kind.includes('quote') || kind.includes('payment') || kind.includes('finance')) {
    return { label: tag || t('Finance'), icon: Euro, fill: 'bg-accent-quote text-accent-quote-foreground', onDark: false };
  }
  if (kind.includes('invite') || kind.includes('member')) {
    return { label: tag || t('Invite'), icon: UserPlus, fill: 'bg-accent-personal text-accent-personal-foreground', onDark: false };
  }
  return { label: tag || t('Alert'), icon: Bell, fill: 'bg-surface-inverse text-surface-inverse-foreground', onDark: true };
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
  onNavigate,
  calendarEvents,
  bandNames,
  onClearAll,
}) => {
  // Swipe left on a row reveals Delete; one row open at a time.
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const t = useT();
  useCurrency(); // re-render money labels when the band currency changes
  /** Band a notification comes from, when the user is in several. */
  const bandOf = (n: NotificationData): string | null => {
    const id = bandNames ? notificationBandId(n) : undefined;
    return (id && bandNames?.[id]) || null;
  };
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
      // A row left swiped open closes with the inbox.
      setOpenRowId(null);
      setConfirmClear(false);
    }
  }, [isOpen, notification]);

  const allNotifications =
    notifications.length > 0 ? notifications : notification ? [notification] : [];
  const isListView = viewingIndex === null && !notification;

  // iPhone Duo open (Figma "Open · Notifications / Activity | Notifications /
  // Gig invitation"): the activity list on the leading page and the selected
  // item, answered, on the trailing page. The first item that has a detail
  // page is shown until you pick another.
  const { twoPane } = useRailLayout();
  const split = twoPane && !notification;

  // Filtered notifications
  const displayedNotifications = filter === 'unread'
    ? allNotifications.filter(n => !n.read)
    : allNotifications;

  const unreadCount = allNotifications.filter(n => !n.read).length;

  const isPollNotif = (n: NotificationData) => n.type === 'rehearsal_poll' || n.type === 'rehearsal_proposal';
  const firstDetail = displayedNotifications.find((n) => !(isPollNotif(n) && onOpenPoll));
  const autoIndex = split && viewingIndex === null && firstDetail ? allNotifications.indexOf(firstDetail) : null;

  // Determine which notification to show in detail view
  const detailNotif = viewingIndex !== null
    ? allNotifications[viewingIndex]
    : autoIndex !== null
      ? allNotifications[autoIndex]
      : notification;

  // Auto-mark notification as read when viewed in detail (not the one the
  // open display shows by itself next to the list).
  useEffect(() => {
    if (isOpen && autoIndex === null && detailNotif && !detailNotif.read && onMarkAsRead) {
      onMarkAsRead(detailNotif.id);
    }
  }, [isOpen, autoIndex, detailNotif?.id, detailNotif?.read, onMarkAsRead]);

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
  const detailTarget = detailNotif ? notificationTarget(detailNotif.type, detailNotif.data) : null;

  const renderListHeader = () => (
            <header className="shrink-0 px-4 bg-background" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
              <div className="max-w-xl mx-auto w-full flex items-end gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="bw-label-sm text-muted-foreground">{t('Activity & updates')}</p>
                  <h1 className="bw-display-lg text-foreground truncate">{t('Inbox')}</h1>
                </div>
                {split ? (
                  <>
                    <NavBackButton label={t('Close notifications')} onClick={handleClose} />
                    <HeaderAction label={t('Close notifications')} icon={<X />} onClick={handleClose} />
                  </>
                ) : (
                  <>
                    <RailCover pane />
                    <HeaderAction pane label={t('Close notifications')} icon={<X />} onClick={handleClose} />
                  </>
                )}
              </div>
            </header>
  );
  const renderDetailHeader = () => (
            <header className="shrink-0 px-4 bg-background" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
              <div className="max-w-xl mx-auto w-full h-11 flex items-center gap-3">
                {split ? null : viewingIndex !== null ? (
                  <NavBackButton pane label={t('Back to notification list')} onClick={backToList} />
                ) : (
                  <>
                    <RailCover pane />
                    <HeaderAction pane label={t('Close notifications')} icon={<X />} onClick={handleClose} />
                  </>
                )}
                <p className={cn('flex-1 min-w-0 bw-label-sm text-muted-foreground truncate', split ? 'text-left' : 'text-center')}>{t('Notification detail')}</p>
                <HeaderAction pane label={t('Delete notification')} variant="ghost" icon={<Trash2 />} onClick={() => handleDelete(detailNotif?.id)} />
              </div>
            </header>
  );
  const renderList = () => (
    <>
                <>
                  {allNotifications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Selector size="md" selected={filter === 'all'} onClick={() => setFilter('all')} count={allNotifications.length}>
                          {t('All')}
                        </Selector>
                        <Selector size="md" selected={filter === 'unread'} onClick={() => setFilter('unread')} count={unreadCount}>
                          {t('Unread')}
                        </Selector>
                      </div>
                      {unreadCount > 0 && onMarkAllAsRead && (
                        <PillButton
                          variant="ghost"
                          size="sm"
                          fullWidth={false}
                          icon={<Check className="w-4 h-4" />}
                          onClick={onMarkAllAsRead}
                          aria-label={t('Mark all as read')}
                          className="px-0"
                        >
                          {t('Mark read')}
                        </PillButton>
                      )}
                      {onClearAll && (
                        <PillButton
                          variant="ghost"
                          size="sm"
                          fullWidth={false}
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={() => setConfirmClear(true)}
                          aria-label={t('Clear all notifications')}
                          className="px-0"
                        >
                          {t('Clear')}
                        </PillButton>
                      )}
                    </div>
                  )}
                  <DeleteChatSheet
                    open={confirmClear}
                    title={t('Clear all notifications?')}
                    body={allNotifications.length === 1 ? t("This removes the notification from your list. You can't undo this.") : t("This removes all {count} notifications from your list. You can't undo this.", { count: allNotifications.length })}
                    confirmLabel={t('Clear all')}
                    onCancel={() => setConfirmClear(false)}
                    onConfirm={() => {
                      setConfirmClear(false);
                      haptic.delete();
                      onClearAll?.();
                    }}
                  />

                  {displayedNotifications.length === 0 ? (
                    /* Figma: Inbox empty — centred icon tile, no card */
                    <div className="flex flex-col items-center text-center gap-4 py-16">
                      <span className="w-14 h-14 rounded-[16px] bg-card text-foreground flex items-center justify-center">
                        {filter === 'unread' || allNotifications.length > 0 ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <BellOff className="w-6 h-6" />
                        )}
                      </span>
                      <div className="flex flex-col gap-1 items-center">
                        <h3 className="bw-h3">
                          {filter === 'unread' || allNotifications.length > 0 ? t('All caught up') : t('No notifications yet')}
                        </h3>
                        <p className="bw-body-sm text-muted-foreground max-w-xs">
                          {filter === 'unread'
                            ? t("No unread notifications. We'll ping you for invites, polls and payments.")
                            : t("We'll ping you for invites, polls and payments.")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {displayedNotifications.map((notif, i) => {
                        const originalIndex = allNotifications.findIndex(n => n.id === notif.id);
                        const isRead = notif.read;
                        const meta = getNotificationMeta(notif.type, notif.data);
                        const IconComponent = meta.icon;
                        const subtitle = notif.data?.subtitle ? String(notif.data.subtitle) : null;
                        const fromBand = bandOf(notif);
                        const typeLine = [meta.label, fromBand && fromBand !== subtitle ? fromBand : null, subtitle]
                          .filter(Boolean)
                          .join(' · ');

                        const row = (
                            <button
                              type="button"
                              onClick={() => {
                                // Gig invitations open their detail page first; its
                                // primary CTA hands off to the RSVP sheet.
                                if ((notif.type === 'rehearsal_poll' || notif.type === 'rehearsal_proposal') && onOpenPoll) {
                                  onOpenPoll(notif);
                                  return;
                                }
                                // Everything else that belongs to a screen opens it
                                // directly; the rest shows its detail page.
                                if (notif.type !== 'event_invite' && onNavigate && notificationTarget(notif.type, notif.data)) {
                                  onNavigate(notif);
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
                                <span className="w-2 h-2 mt-1 rounded-full bg-destructive shrink-0" aria-label={t('Unread')} />
                              )}
                            </button>
                        );
                        return (
                          <li key={notif.id}>
                            {onDelete ? (
                              <SwipeRow
                                deleteLabel={t('Delete notification: {title}', { title: cleanNotificationTitle(notif.title) })}
                                open={openRowId === notif.id}
                                onOpenChange={(o) => setOpenRowId(o ? notif.id : null)}
                                onDelete={() => {
                                  haptic.delete();
                                  setOpenRowId(null);
                                  onDelete(notif.id);
                                }}
                              >
                                {row}
                              </SwipeRow>
                            ) : (
                              row
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
    </>
  );
  const renderDetail = () =>
    detailNotif ? (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200">
                  {(() => {
                    const meta = getNotificationMeta(detailNotif.type, detailNotif.data);
                    return (
                      <div
                        className={cn('p-5 rounded-[24px] flex flex-col gap-3', meta.fill, detailTarget && onNavigate && detailNotif.type !== 'event_invite' && 'cursor-pointer active:scale-[0.99] transition-transform')}
                        {...(detailTarget && onNavigate && detailNotif.type !== 'event_invite'
                          ? {
                              role: 'button',
                              tabIndex: 0,
                              onClick: () => onNavigate(detailNotif),
                              onKeyDown: (e: React.KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onNavigate(detailNotif);
                                }
                              },
                            }
                          : {})}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag variant="solid" className={meta.onDark ? 'bg-white text-black' : undefined}>
                            {meta.label}
                          </Tag>
                          {(() => {
                            const fromBand = bandOf(detailNotif);
                            return fromBand && fromBand !== String(detailNotif.data?.subtitle ?? '') ? (
                              <Tag variant="outline" className="border-current text-current">
                                {fromBand}
                              </Tag>
                            ) : null;
                          })()}
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

                    const isInvite = detailNotif.type === 'event_invite';
                    const eventId = d.event_id ? String(d.event_id) : null;
                    const calEvent = hasEventData ? findCalendarEvent(calendarEvents, eventId) : null;

                    // Figma "Timings": load-in · soundcheck · start, only the ones we have.
                    const loadIn = (d.load_in_time as string | undefined) || calEvent?.loadInTime;
                    const soundcheck = (d.soundcheck_time as string | undefined) || calEvent?.soundcheckTime;
                    const start = d.event_time ? String(d.event_time) : undefined;
                    const timings = [
                      loadIn && t('Load-in {time}', { time: loadIn }),
                      soundcheck && t('Soundcheck {time}', { time: soundcheck }),
                      start && t('Start {time}', { time: start }),
                    ]
                      .filter(Boolean)
                      .join(' · ');

                    const venue = (d.venue as string | undefined) || calEvent?.venueName;
                    const venueAddress = (d.venue_address as string | undefined) || calEvent?.venueAddress;
                    // Distance only when the event has real coordinates and a computed distance.
                    const distance = calEvent?.venueCoordinates && calEvent?.distance ? String(calEvent.distance) : null;

                    // "Event" KV only when it adds something beyond the hero title.
                    const eventTitle = d.event_title ? String(d.event_title) : '';
                    const showEventKV =
                      !!eventTitle &&
                      eventTitle.trim().toLowerCase() !== cleanNotificationTitle(detailNotif.title).trim().toLowerCase();

                    // Conflicts: only when we actually have the user's calendar.
                    const canCheckConflicts = isInvite && hasEventData && Array.isArray(calendarEvents);
                    const conflicts = canCheckConflicts
                      ? findEventConflicts(calendarEvents, { eventId, date: String(d.event_date) })
                      : [];

                    return (
                      <>
                        <h3 className="bw-label-sm text-muted-foreground">
                          {hasEventData ? t('Event specifications') : t('Invitation details')}
                        </h3>
                        <Card className="gap-4">
                          {hasEventData && (
                            <>
                              {showEventKV && <KV k={t('Event')} v={eventTitle} />}
                              <KV k={t('Date')} v={formatEventDate(String(d.event_date))} />
                              {timings && <KV k={t('Timings')} v={timings} />}
                              {venue && (
                                <KV
                                  k={t('Venue')}
                                  v={
                                    <span className="flex flex-col items-end gap-0.5">
                                      <span>{[venue, distance ? (distance.startsWith('~') ? distance : `~${distance}`) : null].filter(Boolean).join(' · ')}</span>
                                      {venueAddress && venueAddress !== venue && (
                                        <span className="bw-body-sm text-muted-foreground">{venueAddress}</span>
                                      )}
                                    </span>
                                  }
                                />
                              )}
                              {Boolean(d.member_fee || d.fee) && (
                                <KV
                                  k={d.member_fee ? t('Allocated fee') : t('Total fee')}
                                  v={`${sym()}${Number(d.member_fee || d.fee).toLocaleString(intlLocale())}`}
                                />
                              )}
                            </>
                          )}
                          {d.invitee_email && <KV k={t('Email')} v={String(d.invitee_email)} />}
                          {d.inviter_name && <KV k={t('Invited by')} v={String(d.inviter_name)} />}
                          {d.member_name && <KV k={t('Member')} v={String(d.member_name)} />}
                        </Card>

                        {canCheckConflicts &&
                          (conflicts.length > 0 ? (
                            <div role="status" className="flex items-start gap-3 p-4 rounded-[24px] border border-warning">
                              <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="bw-label-md text-foreground">
                                  {conflicts.length === 1 ? t('Schedule conflict') : t('{count} schedule conflicts', { count: conflicts.length })}
                                </span>
                                {conflicts.map((c, idx) => (
                                  <span key={String(c.eventId ?? c.id ?? idx)} className="bw-body-sm text-muted-foreground [overflow-wrap:anywhere]">
                                    {c.title || t('Event')}
                                    {c.time ? ` · ${c.time}` : ` · ${t('same day')}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <Card className="flex-row items-center gap-3">
                              <CheckCircle2 className="w-5 h-5 shrink-0 text-success" />
                              <span className="bw-body-sm text-foreground">{t('No schedule conflicts in your calendar')}</span>
                            </Card>
                          ))}

                        {hasEventData && (
                          <PillButton
                            variant="outline"
                            size="md"
                            onClick={handleAddToCalendar}
                            disabled={isAddingToCalendar}
                            icon={<CalendarPlus className="w-[18px] h-[18px]" />}
                          >
                            {isAddingToCalendar ? t('Adding…') : t('Add to Google Calendar')}
                          </PillButton>
                        )}
                      </>
                    );
                  })()}
                </div>
    ) : null;
  const renderDetailCta = () =>
    detailNotif?.type === 'event_invite' ? (
                <div className="flex items-center gap-3">
                  <PillButton variant="outline" className="flex-[0_0_36%]" onClick={() => handleAction('decline_event')}>
                    {t('Decline')}
                  </PillButton>
                  <PillButton
                    className="flex-1"
                    icon={<Check className="w-[18px] h-[18px]" />}
                    onClick={() => {
                      // Primary CTA hands off to the RSVP sheet (accept/decline + conflicts);
                      // falls back to the direct action when no sheet is wired.
                      if (onOpenRSVP && detailNotif) onOpenRSVP(detailNotif);
                      else handleAction('accept_event');
                    }}
                  >
                    {t('Accept event')}
                  </PillButton>
                </div>
              ) : isPollType ? (
                <div className="flex items-center gap-3">
                  <PillButton
                    variant="outline"
                    className="flex-[0_0_36%]"
                    onClick={viewingIndex !== null && !split ? backToList : handleClose}
                  >
                    {viewingIndex !== null && !split ? t('Back') : t('Close')}
                  </PillButton>
                  <PillButton className="flex-1" icon={<Calendar className="w-[18px] h-[18px]" />} onClick={() => detailNotif && onOpenPoll?.(detailNotif)}>
                    {detailNotif?.type === 'rehearsal_poll' ? t('Vote on dates') : t('View proposal')}
                  </PillButton>
                </div>
              ) : detailTarget && onNavigate ? (
                <div className="flex items-center gap-3">
                  <PillButton
                    variant="outline"
                    className="flex-[0_0_36%]"
                    onClick={viewingIndex !== null && !split ? backToList : handleClose}
                  >
                    {viewingIndex !== null && !split ? t('Back') : t('Close')}
                  </PillButton>
                  <PillButton className="flex-1" onClick={() => detailNotif && onNavigate(detailNotif)}>
                    {notificationTargetLabel(detailTarget)}
                  </PillButton>
                </div>
              ) : (
                <PillButton variant="dark" onClick={viewingIndex !== null && !split ? backToList : handleClose}>
                  {viewingIndex !== null && !split ? t('Back to list') : t('Close')}
                </PillButton>
              );

  return (
    <AnimatePresence>
      {isOpen && !split && (
        <motion.div
          key={"notifications"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: durations.normal, ease: easings.smooth }}
          className="bw-pane-detail fixed inset-0 z-[101] flex flex-col bg-background text-foreground overflow-x-hidden"
          style={{ overscrollBehaviorX: 'none' }}
        >
          {/* ═══ HEADER ═══ */}
          {isListView ? renderListHeader() : renderDetailHeader()}
          {/* ═══ SCROLLABLE BODY ═══ */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
              {isListView ? renderList() : renderDetail()}
            </div>
          </div>

          {/* ═══ CTA BAR ═══ (Laptop pose: Close is already in the Deck bar) */}
          <div
            className={cn('shrink-0 bg-background px-4 pt-3', isListView && 'bw-tabletop-hidden')}
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
          >
            <div className="max-w-xl mx-auto w-full">
              {isListView ? (
                <PillButton variant="dark" onClick={handleClose}>
                  {t('Close notifications')}
                </PillButton>
              ) : (
                renderDetailCta()
              )}
            </div>
          </div>
        </motion.div>
      )}
      {isOpen && split && (
        <motion.div
          key={"notifications-list"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: durations.normal, ease: easings.smooth }}
          className="bw-pane-hub fixed inset-0 z-[101] flex flex-col bg-background text-foreground overflow-x-hidden"
          style={{ overscrollBehaviorX: 'none' }}
        >
          {/* ═══ HEADER ═══ */}
          {renderListHeader()}
          {/* ═══ SCROLLABLE BODY ═══ */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
              {renderList()}
            </div>
          </div>
        </motion.div>
      )}
      {isOpen && split && detailNotif && (
        <motion.div
          key={"notifications-detail"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: durations.normal, ease: easings.smooth }}
          className="bw-pane-detail fixed inset-0 z-[101] flex flex-col bg-background text-foreground overflow-x-hidden"
          style={{ overscrollBehaviorX: 'none' }}
        >
          {/* ═══ HEADER ═══ */}
          {renderDetailHeader()}
          {/* ═══ SCROLLABLE BODY ═══ */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
              {renderDetail()}
            </div>
          </div>

          {/* ═══ CTA BAR ═══ */}
          <div className="shrink-0 bg-background px-4 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
            <div className="max-w-xl mx-auto w-full">
              {renderDetailCta()}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationDetailModal;
