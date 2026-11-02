import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  X,
  Check,
  CheckCheck,
  CalendarPlus,
  Calendar,
  Clock,
  MapPin,
  Euro,
  ChevronRight,
  Bell,
  BellOff,
  Sparkles,
  Music,
  UserPlus,
  Trash2,
  Mail,
  Shield,
  User,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

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
}

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
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
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

function getNotificationMeta(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('rehearsal')) {
    return {
      label: 'REHEARSAL',
      icon: Music,
      tileClass: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
      badgeClass: 'bg-indigo-500/15 text-indigo-400',
    };
  }
  if (t.includes('gig') || t.includes('event')) {
    const isConfirmed = t.includes('confirmed');
    return {
      label: isConfirmed ? 'CONFIRMED' : 'EVENT',
      icon: Calendar,
      tileClass: isConfirmed 
        ? 'bg-accent/15 text-accent border border-accent/25' 
        : 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
      badgeClass: isConfirmed ? 'bg-accent/15 text-accent' : 'bg-rose-500/15 text-rose-400',
    };
  }
  if (t.includes('quote') || t.includes('payment') || t.includes('finance')) {
    return {
      label: 'FINANCE',
      icon: Euro,
      tileClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
      badgeClass: 'bg-emerald-500/15 text-emerald-400',
    };
  }
  if (t.includes('invite') || t.includes('member')) {
    return {
      label: 'INVITE',
      icon: UserPlus,
      tileClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
      badgeClass: 'bg-amber-500/15 text-amber-400',
    };
  }
  return {
    label: 'ALERT',
    icon: Bell,
    tileClass: 'bg-primary/15 text-primary border border-primary/20',
    badgeClass: 'bg-primary/15 text-primary',
  };
}

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
}) => {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[101] flex flex-col bg-background text-foreground overflow-x-hidden"
          style={{ overscrollBehaviorX: 'none' }}
        >
          {/* ═══ STICKY HEADER ═══ */}
          <div
            className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              paddingBottom: '14px',
            }}
          >
            <div className="max-w-xl mx-auto w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {viewingIndex !== null && (
                  <button
                    onClick={backToList}
                    aria-label="Back to notification list"
                    className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground active:scale-90 transition-all shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider truncate">
                    {viewingIndex !== null ? 'NOTIFICATION DETAIL' : 'ACTIVITY & UPDATES'}
                  </span>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[20px] sm:text-[22px] font-black text-foreground uppercase tracking-tight leading-none truncate">
                      {viewingIndex !== null
                        ? (getNotificationMeta(detailNotif?.type || '').label)
                        : (isListView ? 'NOTIFICATIONS' : 'NOTIFICATION')}
                    </h1>
                    {isListView && unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-black leading-none">
                        {unreadCount} NEW
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {isListView && unreadCount > 0 && onMarkAllAsRead && (
                  <button
                    onClick={onMarkAllAsRead}
                    aria-label="Mark all as read"
                    title="Mark all as read"
                    className="px-3 py-1.5 rounded-[10px] bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-accent" />
                    <span className="hidden sm:inline">Mark Read</span>
                  </button>
                )}
                <button
                  onClick={handleClose}
                  aria-label="Close notifications"
                  className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* ═══ SCROLLABLE BODY (MAX-W-XL CENTERED) ═══ */}
          <div className="flex-1 overflow-y-auto px-4 py-5 pb-36">
            <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
              {isListView ? (
                /* ═══ LIST VIEW ═══ */
                <>
                  {/* Segmented Filter Pills */}
                  {allNotifications.length > 0 && (
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-1.5 p-1 rounded-[12px] bg-foreground/5 border border-foreground/10 text-[11px] font-bold uppercase">
                        <button
                          onClick={() => setFilter('all')}
                          className={cn(
                            'px-3 py-1 rounded-[8px] transition-all',
                            filter === 'all'
                              ? 'bg-foreground text-background shadow-xs'
                              : 'text-foreground/60 hover:text-foreground'
                          )}
                        >
                          All ({allNotifications.length})
                        </button>
                        <button
                          onClick={() => setFilter('unread')}
                          className={cn(
                            'px-3 py-1 rounded-[8px] transition-all flex items-center gap-1.5',
                            filter === 'unread'
                              ? 'bg-foreground text-background shadow-xs'
                              : 'text-foreground/60 hover:text-foreground'
                          )}
                        >
                          <span>Unread</span>
                          {unreadCount > 0 && (
                            <span className={cn(
                              'px-1.5 py-0.2 rounded-full text-[9px] font-black',
                              filter === 'unread' ? 'bg-background text-foreground' : 'bg-accent text-accent-foreground'
                            )}>
                              {unreadCount}
                            </span>
                          )}
                        </button>
                      </div>
                      <span className="text-[11px] font-semibold text-foreground/40">
                        {displayedNotifications.length} {displayedNotifications.length === 1 ? 'alert' : 'alerts'}
                      </span>
                    </div>
                  )}

                  {/* Empty state */}
                  {displayedNotifications.length === 0 ? (
                    <div className="p-8 rounded-[16px] bg-card border border-foreground/10 flex flex-col items-center justify-center text-center gap-3 shadow-2xs mt-4">
                      <div className="w-12 h-12 rounded-full bg-foreground/5 text-foreground/40 flex items-center justify-center">
                        <BellOff className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold uppercase text-foreground">
                          {filter === 'unread' ? 'No Unread Notifications' : 'All Caught Up'}
                        </h3>
                        <p className="text-xs text-foreground/50 max-w-xs">
                          {filter === 'unread'
                            ? 'All notifications have been reviewed.'
                            : 'There are no active alerts or gig updates at the moment.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Notification Cards List */
                    <div className="flex flex-col gap-2.5">
                      {displayedNotifications.map((notif, i) => {
                        const originalIndex = allNotifications.findIndex(n => n.id === notif.id);
                        const isRead = notif.read;
                        const meta = getNotificationMeta(notif.type);
                        const IconComponent = meta.icon;

                        return (
                          <div
                            key={notif.id}
                            onClick={() => setViewingIndex(originalIndex >= 0 ? originalIndex : i)}
                            className={cn(
                              'p-4 rounded-[14px] border transition-all cursor-pointer flex items-start gap-3.5 shadow-2xs active:scale-[0.99]',
                              isRead
                                ? 'bg-card/60 border-foreground/10 hover:border-foreground/20 hover:bg-card'
                                : 'bg-card border-foreground/20 hover:border-foreground/30 ring-1 ring-accent/20'
                            )}
                          >
                            {/* Type Icon Tile */}
                            <div className={cn(
                              'w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 shadow-xs',
                              meta.tileClass
                            )}>
                              <IconComponent className="w-5 h-5" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn(
                                    'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px]',
                                    meta.badgeClass
                                  )}>
                                    {meta.label}
                                  </span>
                                  {!isRead && (
                                    <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                                  )}
                                </div>
                                <span className="text-[10px] font-semibold text-foreground/40 shrink-0">
                                  {formatTime(notif.created_at)}
                                </span>
                              </div>

                              <h3 className={cn(
                                'text-sm font-bold uppercase mt-1.5 leading-snug truncate',
                                isRead ? 'text-foreground/80' : 'text-foreground'
                              )}>
                                {notif.title}
                              </h3>

                              {notif.body && (
                                <p className="text-xs text-foreground/60 line-clamp-2 mt-1 leading-relaxed">
                                  {notif.body}
                                </p>
                              )}
                            </div>

                            <ChevronRight className="w-4 h-4 text-foreground/30 shrink-0 mt-3" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : detailNotif ? (
                /* ═══ DETAIL VIEW ═══ */
                <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  {/* Hero Card */}
                  {(() => {
                    const meta = getNotificationMeta(detailNotif.type);
                    const IconComponent = meta.icon;

                    return (
                      <div className="p-5 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-4 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0',
                              meta.tileClass
                            )}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className={cn(
                              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px]',
                              meta.badgeClass
                            )}>
                              {meta.label}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-foreground/40">
                            {formatTime(detailNotif.created_at)}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <h2 className="text-lg sm:text-xl font-black uppercase text-foreground leading-tight">
                            {detailNotif.title}
                          </h2>
                          {detailNotif.body && (
                            <p className="text-xs sm:text-sm text-foreground/70 leading-relaxed font-normal">
                              {detailNotif.body}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Structured Event / Payload Details Card */}
                  {detailNotif.data && (() => {
                    const d = detailNotif.data as Record<string, any>;
                    const hasEventData = !!d.event_date;
                    const hasGenericFields = !!(d.invitee_email || d.inviter_name || d.member_name);

                    if (!hasEventData && !hasGenericFields) return null;

                    return (
                      <div className="p-5 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-4 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                          {hasEventData ? 'EVENT SPECIFICATIONS' : 'INVITATION DETAILS'}
                        </span>

                        {hasEventData && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {d.event_title && (
                              <div className="p-3.5 rounded-[12px] bg-foreground/5 border border-foreground/10 flex items-start gap-3 col-span-1 sm:col-span-2">
                                <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">EVENT</span>
                                  <span className="text-sm font-bold uppercase text-foreground truncate">{String(d.event_title)}</span>
                                </div>
                              </div>
                            )}

                            {d.event_date && (
                              <div className="p-3.5 rounded-[12px] bg-foreground/5 border border-foreground/10 flex items-start gap-3">
                                <Calendar className="w-4 h-4 text-foreground/60 shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">DATE & TIME</span>
                                  <span className="text-xs font-bold text-foreground">{formatEventDate(String(d.event_date))}</span>
                                  {d.event_time && (
                                    <span className="text-[11px] font-medium text-foreground/50">{String(d.event_time)}</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {d.venue && (
                              <div className="p-3.5 rounded-[12px] bg-foreground/5 border border-foreground/10 flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-foreground/60 shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">VENUE</span>
                                  <span className="text-xs font-bold uppercase text-foreground truncate">{String(d.venue)}</span>
                                </div>
                              </div>
                            )}

                            {(d.member_fee || d.fee) && (
                              <div className="p-3.5 rounded-[12px] bg-foreground/5 border border-foreground/10 flex items-start gap-3 col-span-1 sm:col-span-2">
                                <Euro className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                                    {d.member_fee ? 'ALLOCATED FEE' : 'TOTAL FEE'}
                                  </span>
                                  <span className="text-sm font-bold text-foreground">
                                    €{Number(d.member_fee || d.fee).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {hasGenericFields && (
                          <div className="flex flex-col gap-2">
                            {d.invitee_email && (
                              <div className="p-3 rounded-[10px] bg-foreground/5 flex justify-between items-center text-xs">
                                <span className="font-bold text-foreground/40 uppercase">EMAIL</span>
                                <span className="font-semibold text-foreground">{String(d.invitee_email)}</span>
                              </div>
                            )}
                            {d.inviter_name && (
                              <div className="p-3 rounded-[10px] bg-foreground/5 flex justify-between items-center text-xs">
                                <span className="font-bold text-foreground/40 uppercase">INVITED BY</span>
                                <span className="font-semibold text-foreground">{String(d.inviter_name)}</span>
                              </div>
                            )}
                            {d.member_name && (
                              <div className="p-3 rounded-[10px] bg-foreground/5 flex justify-between items-center text-xs">
                                <span className="font-bold text-foreground/40 uppercase">MEMBER</span>
                                <span className="font-semibold text-foreground">{String(d.member_name)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {hasEventData && (
                          <button
                            onClick={handleAddToCalendar}
                            disabled={isAddingToCalendar}
                            className="w-full py-2.5 rounded-[10px] flex items-center justify-center gap-2 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 active:scale-98 transition-all"
                          >
                            <CalendarPlus className="w-4 h-4 text-foreground/70" />
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                              {isAddingToCalendar ? 'ADDING...' : 'ADD TO GOOGLE CALENDAR'}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>

          {/* ═══ STICKY BOTTOM BAR ═══ */}
          <div className="fixed bottom-0 left-0 right-0 z-[102] bg-background/95 backdrop-blur-md px-4 pb-6 pt-3.5 border-t border-foreground/10">
            <div className="max-w-xl mx-auto w-full">
              {isListView ? (
                <button
                  onClick={handleClose}
                  className="w-full py-3.5 rounded-[12px] flex items-center justify-center gap-2 bg-foreground text-background font-bold uppercase text-xs tracking-wider active:scale-98 transition-all shadow-xs"
                >
                  <span>CLOSE NOTIFICATIONS</span>
                </button>
              ) : detailNotif?.type === 'event_invite' ? (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleAction('decline_event')}
                      className="rounded-[12px] py-3.5 flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 active:scale-98 transition-all"
                    >
                      <span className="text-xs font-bold uppercase text-foreground tracking-wider">DECLINE</span>
                    </button>
                    <button
                      onClick={() => handleAction('accept_event')}
                      className="rounded-[12px] py-3.5 flex items-center justify-center bg-foreground hover:bg-foreground/90 text-background active:scale-98 transition-all shadow-xs"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">ACCEPT EVENT</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(detailNotif?.id)}
                    className="text-[11px] font-semibold uppercase text-foreground/40 hover:text-foreground/70 py-1"
                  >
                    DISMISS NOTIFICATION
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={backToList}
                    className="flex-1 py-3.5 rounded-[12px] flex items-center justify-center gap-2 bg-foreground text-background font-bold uppercase text-xs tracking-wider active:scale-98 transition-all shadow-xs"
                  >
                    <span>BACK TO LIST</span>
                  </button>
                  <button
                    onClick={() => handleDelete(detailNotif?.id)}
                    aria-label="Delete notification"
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center bg-foreground/5 hover:bg-red-500/10 hover:text-red-500 text-foreground/50 border border-foreground/10 active:scale-95 transition-all shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationDetailModal;
