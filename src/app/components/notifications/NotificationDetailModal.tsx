import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CalendarPlus,
  ArrowUpRight,
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
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
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

const getTypeLabel = (type: string): string => {
  if (type === 'event_invite') return 'EVENT';
  if (type === 'event_created') return 'EVENT';
  if (type.includes('rehearsal')) return 'REHEARSAL';
  if (type.includes('payment')) return 'PAYMENT';
  if (type.includes('quote')) return 'QUOTE';
  if (type.includes('invite')) return 'INVITE';
  if (type.includes('chat')) return 'CHAT';
  return 'NOTIFICATION';
};

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
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  const allNotifications =
    notifications.length > 0 ? notifications : notification ? [notification] : [];
  const isListView = allNotifications.length > 1 && viewingIndex === null;

  // Determine which notification to show in detail view
  const detailNotif = viewingIndex !== null
    ? allNotifications[viewingIndex]
    : allNotifications.length === 1
      ? allNotifications[0]
      : notification;

  if (!allNotifications.length && !notification) return null;

  const backToList = () => setViewingIndex(null);

  const handleAction = (action: string, notificationId?: string) => {
    onAction?.(action, notificationId || detailNotif?.id);
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[101] flex flex-col bg-background"
        >
          {/* Header */}
          <div className="flex items-center gap-4 px-4 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
            <button
              onClick={viewingIndex !== null ? backToList : onClose}
              className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-foreground/20"
            >
              <ArrowLeft className="w-[24px] h-[24px] text-foreground" />
            </button>
            <h1 className="text-[20px] font-bold uppercase text-foreground">
              {viewingIndex !== null ? 'DETAILS' : (isListView ? 'NOTIFICATIONS' : getTypeLabel(detailNotif?.type || ''))}
            </h1>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 pt-6 pb-40">
            {isListView ? (
              /* ═══ LIST VIEW — all notifications as compact rows ═══ */
              <div className="flex flex-col">
                {allNotifications.map((notif, i) => {
                  const isRead = notif.read;
                  const label = getTypeLabel(notif.type);
                  return (
                    <button
                      key={notif.id}
                      onClick={() => setViewingIndex(i)}
                      className="w-full text-left flex items-start gap-3 py-4 border-b border-border last:border-0 active:opacity-70 transition-opacity"
                    >
                      {/* Type badge */}
                      <div className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 mt-[2px]',
                        isRead ? 'bg-foreground/10 text-muted-foreground' : 'bg-foreground text-background'
                      )}>
                        {label}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn(
                            'text-[12px] font-bold uppercase truncate',
                            isRead ? 'text-muted-foreground' : 'text-foreground'
                          )}>
                            {notif.title}
                          </span>
                          <span className="text-[10px] font-bold text-foreground/40 shrink-0 mt-px">
                            {formatTime(notif.created_at)}
                          </span>
                        </div>
                        {notif.body && (
                          <p className="text-[10px] font-medium text-foreground/50 truncate mt-1">
                            {notif.body}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : detailNotif ? (
              /* ═══ DETAIL VIEW — single notification expanded ═══ */
              <div className="flex flex-col gap-8">
                {/* Title section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-foreground text-background">
                      {getTypeLabel(detailNotif.type)}
                    </span>
                    <span className="text-[10px] font-bold text-foreground/40">
                      {formatTime(detailNotif.created_at)}
                    </span>
                  </div>
                  <h2 className="text-[20px] font-bold uppercase text-foreground leading-tight">
                    {detailNotif.title}
                  </h2>
                  {detailNotif.body && (
                    <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
                      {detailNotif.body}
                    </p>
                  )}
                </div>

                {/* Event details */}
                {detailNotif.data && (() => {
                  const d = detailNotif.data as Record<string, any>;
                  const hasEventData = !!d.event_date;

                  if (!hasEventData && !Object.keys(d).length) return null;

                  return (
                    <div className="flex flex-col gap-6">
                      {hasEventData && (
                        <>
                          {d.event_title && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">EVENT</span>
                              <span className="text-[16px] font-bold uppercase text-foreground">{String(d.event_title)}</span>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-6">
                            {d.event_date && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DATE & TIME</span>
                                <span className="text-[16px] font-bold text-foreground">{formatEventDate(String(d.event_date))}</span>
                                {d.event_time && (
                                  <span className="text-[12px] font-bold text-muted-foreground">{String(d.event_time)}</span>
                                )}
                              </div>
                            )}
                            {d.venue && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">VENUE</span>
                                <span className="text-[16px] font-bold text-foreground uppercase">{String(d.venue)}</span>
                              </div>
                            )}
                          </div>
                          {(d.member_fee || d.fee) && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {d.member_fee ? 'YOUR FEE' : 'TOTAL FEE'}
                              </span>
                              <span className="text-[16px] font-bold text-foreground">€{Number(d.member_fee || d.fee).toLocaleString()}</span>
                            </div>
                          )}
                          <button
                            onClick={handleAddToCalendar}
                            disabled={isAddingToCalendar}
                            className="w-full py-3 rounded-[10px] flex items-center justify-center gap-2 bg-foreground/10"
                          >
                            <CalendarPlus className="w-4 h-4 text-foreground/60" />
                            <span className="text-[12px] font-bold uppercase text-foreground/60">
                              {isAddingToCalendar ? 'ADDING...' : 'ADD TO CALENDAR'}
                            </span>
                          </button>
                        </>
                      )}
                      {!hasEventData && (
                        <div className="flex flex-col gap-3">
                          {d.invitee_email && (
                            <div className="flex justify-between items-center py-3 border-b border-border">
                              <span className="text-[10px] font-bold uppercase text-muted-foreground">EMAIL</span>
                              <span className="text-[12px] font-bold text-foreground">{String(d.invitee_email)}</span>
                            </div>
                          )}
                          {d.inviter_name && (
                            <div className="flex justify-between items-center py-3 border-b border-border">
                              <span className="text-[10px] font-bold uppercase text-muted-foreground">INVITED BY</span>
                              <span className="text-[12px] font-bold text-foreground">{String(d.inviter_name)}</span>
                            </div>
                          )}
                          {d.member_name && (
                            <div className="flex justify-between items-center py-3 border-b border-border">
                              <span className="text-[10px] font-bold uppercase text-muted-foreground">MEMBER</span>
                              <span className="text-[12px] font-bold text-foreground">{String(d.member_name)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="fixed bottom-0 left-0 right-0 z-[102] bg-background px-4 pb-8 pt-4 border-t border-border">
            {isListView ? (
              <button
                onClick={onMarkAllAsRead}
                className="w-full py-4 rounded-[10px] flex items-center justify-center gap-2 bg-foreground"
              >
                <Check className="w-4 h-4 text-background" />
                <span className="text-[14px] font-bold uppercase text-background">MARK ALL READ</span>
              </button>
            ) : detailNotif?.type === 'event_invite' ? (
              <div className="flex flex-col gap-3 items-center">
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  <button
                    onClick={() => handleAction('decline_event')}
                    className="rounded-[10px] py-4 flex items-center justify-center bg-foreground/10"
                  >
                    <span className="text-[14px] font-bold uppercase text-foreground">DECLINE</span>
                  </button>
                  <button
                    onClick={() => handleAction('accept_event')}
                    className="rounded-[10px] py-4 flex items-center justify-center bg-foreground"
                  >
                    <span className="text-[14px] font-bold uppercase text-background">ACCEPT</span>
                  </button>
                </div>
                {!detailNotif.read && (
                  <button
                    onClick={() => onMarkAsRead?.(detailNotif.id)}
                    className="text-[11px] font-medium uppercase text-foreground/40"
                  >
                    MARK AS READ
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 items-center">
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  {!detailNotif?.read && (
                    <button
                      onClick={() => onMarkAsRead?.(detailNotif?.id)}
                      className="rounded-[10px] py-4 flex items-center justify-center gap-2 bg-foreground"
                    >
                      <Check className="w-4 h-4 text-background" />
                      <span className="text-[14px] font-bold uppercase text-background">READ</span>
                    </button>
                  )}
                  <button
                    onClick={() => onDelete?.(detailNotif?.id)}
                    className="rounded-[10px] py-4 flex items-center justify-center bg-foreground/10"
                  >
                    <span className="text-[14px] font-bold uppercase text-[#FF7C7C]">DELETE</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationDetailModal;