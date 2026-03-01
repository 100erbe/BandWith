import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Send,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  Users,
  Check,
  CalendarPlus,
  Euro,
  ArrowUpRight
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

const getTypeBg = (type: string): string => {
  if (type === 'event_invite' || type === 'event_created') return '#D5FB46';
  if (type.includes('rehearsal')) return '#0147FF';
  if (type.includes('quote') || type.includes('payment')) return '#9A8878';
  return '#1A1A1A';
};

const getTypeText = (type: string): string => {
  if (type === 'event_invite' || type === 'event_created') return 'black';
  return 'white';
};

const getTypeLabel = (type: string): string => {
  if (type === 'event_invite') return 'EVENT INVITE';
  if (type === 'event_created') return 'NEW EVENT';
  if (type.includes('invite')) return 'INVITATION';
  if (type.includes('rehearsal')) return 'REHEARSAL';
  if (type.includes('payment')) return 'PAYMENT';
  if (type.includes('quote')) return 'QUOTE';
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);

  const allNotifications =
    notifications.length > 0 ? notifications : notification ? [notification] : [];
  const currentNotification = allNotifications[selectedIndex] || notification;
  const isMultiple = allNotifications.length > 1;

  if (!currentNotification) return null;

  const bgColor = getTypeBg(currentNotification.type);
  const textColor = getTypeText(currentNotification.type);
  const typeLabel = getTypeLabel(currentNotification.type);
  const data = currentNotification.data || {};
  const isEventInvite = currentNotification.type === 'event_invite';
  const hasEventData = !!data.event_date;

  const handleAction = (action: string) => {
    onAction?.(action, currentNotification.id);
  };

  const handleAddToCalendar = async () => {
    setIsAddingToCalendar(true);
    await addToCalendar(data);
    setIsAddingToCalendar(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ backgroundColor: bgColor }}
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-0 z-[101] flex flex-col overflow-y-auto"
            style={{ backgroundColor: bgColor }}
          >
            <div className="flex-1 flex flex-col gap-[40px] px-[16px] pt-[62px] pb-[200px]">
              {/* Header */}
              <div className="flex items-center gap-[20px]">
                <button
                  onClick={onClose}
                  className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2"
                  style={{
                    backgroundColor: 'rgba(216,216,216,0.2)',
                    borderColor: textColor,
                  }}
                >
                  <ArrowLeft className="w-[24px] h-[24px]" style={{ color: textColor }} />
                </button>
                <span className="text-[32px] font-bold uppercase" style={{ color: textColor }}>
                  {typeLabel}
                </span>
              </div>

              {isMultiple ? (
                <div className="flex flex-col gap-[10px]">
                  {allNotifications.map((notif, index) => (
                    <button
                      key={notif.id}
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full text-left p-[16px] rounded-[10px] transition-all',
                        index === selectedIndex
                          ? textColor === 'white' ? 'bg-white/20' : 'bg-black/10'
                          : textColor === 'white' ? 'bg-white/10' : 'bg-black/5'
                      )}
                    >
                      <div className="flex items-start justify-between gap-[8px]">
                        <div className="flex-1 min-w-0">
                          <span className="text-[14px] font-bold truncate block" style={{ color: textColor }}>
                            {notif.title}
                          </span>
                          {notif.body && (
                            <span className="text-[12px] block mt-[2px] line-clamp-1" style={{ color: textColor, opacity: 0.6 }}>
                              {notif.body}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold shrink-0" style={{ color: textColor, opacity: 0.5 }}>
                          {formatTime(notif.created_at)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-[40px]">
                  {/* Notification title */}
                  <div className="flex flex-col gap-[4px]">
                    <div className="flex gap-[4px] flex-wrap">
                      <div
                        className="px-[10px] py-[4px] rounded-[6px]"
                        style={{
                          backgroundColor: textColor === 'white' ? 'white' : 'black',
                          color: textColor === 'white' ? bgColor : '#D5FB46',
                        }}
                      >
                        <span className="text-[12px] font-bold uppercase">{typeLabel}</span>
                      </div>
                    </div>
                    <h2 className="text-[32px] font-bold uppercase leading-tight" style={{ color: textColor }}>
                      {currentNotification.title}
                    </h2>
                    {currentNotification.body && (
                      <p className="text-[14px] font-medium" style={{ color: textColor, opacity: 0.7 }}>
                        {currentNotification.body}
                      </p>
                    )}
                  </div>

                  {/* Event details */}
                  {hasEventData && (
                    <div className="flex flex-col gap-[20px]">
                      {data.event_title && (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-[6px]">
                            <span className="text-[12px] font-bold uppercase" style={{ color: textColor }}>EVENT</span>
                            <ArrowUpRight className="w-[14px] h-[14px]" style={{ color: textColor }} />
                          </div>
                          <span className="text-[42px] font-bold leading-none" style={{ color: textColor }}>
                            {String(data.event_title).toUpperCase()}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-[20px]">
                        {data.event_date && (
                          <div className="flex flex-col gap-[4px]">
                            <span className="text-[12px] font-bold uppercase" style={{ color: textColor }}>
                              DATE & TIME
                            </span>
                            <span className="text-[22px] font-bold" style={{ color: textColor }}>
                              {formatEventDate(String(data.event_date))}
                            </span>
                            {data.event_time && (
                              <span className="text-[16px] font-bold" style={{ color: textColor, opacity: 0.7 }}>
                                {String(data.event_time)}
                              </span>
                            )}
                          </div>
                        )}
                        {data.venue && (
                          <div className="flex flex-col gap-[4px]">
                            <div className="flex items-center gap-[6px]">
                              <span className="text-[12px] font-bold uppercase" style={{ color: textColor }}>VENUE</span>
                              <ArrowUpRight className="w-[14px] h-[14px]" style={{ color: textColor }} />
                            </div>
                            <span className="text-[22px] font-bold" style={{ color: textColor }}>
                              {String(data.venue).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {(data.member_fee || data.fee) && (
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold uppercase" style={{ color: textColor }}>
                            {data.member_fee ? 'YOUR FEE' : 'TOTAL FEE'}
                          </span>
                          <span className="text-[42px] font-bold leading-none" style={{ color: textColor }}>
                            €{Number(data.member_fee || data.fee).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={handleAddToCalendar}
                        disabled={isAddingToCalendar}
                        className="w-full py-[16px] rounded-[10px] flex items-center justify-center gap-[8px]"
                        style={{
                          backgroundColor: textColor === 'white' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                        }}
                      >
                        <CalendarPlus className="w-[18px] h-[18px]" style={{ color: textColor }} />
                        <span className="text-[14px] font-bold uppercase" style={{ color: textColor }}>
                          {isAddingToCalendar ? 'ADDING...' : 'ADD TO CALENDAR'}
                        </span>
                      </button>
                    </div>
                  )}

                  {!hasEventData && Object.keys(data).length > 0 && (
                    <div className="flex flex-col gap-[10px]">
                      {data.invitee_email && (
                        <div className="flex justify-between items-center py-[10px] border-b" style={{ borderColor: textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                          <span className="text-[12px] font-bold uppercase" style={{ color: textColor, opacity: 0.5 }}>EMAIL</span>
                          <span className="text-[14px] font-bold" style={{ color: textColor }}>{String(data.invitee_email)}</span>
                        </div>
                      )}
                      {data.inviter_name && (
                        <div className="flex justify-between items-center py-[10px] border-b" style={{ borderColor: textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                          <span className="text-[12px] font-bold uppercase" style={{ color: textColor, opacity: 0.5 }}>INVITED BY</span>
                          <span className="text-[14px] font-bold" style={{ color: textColor }}>{String(data.inviter_name)}</span>
                        </div>
                      )}
                      {data.member_name && (
                        <div className="flex justify-between items-center py-[10px] border-b" style={{ borderColor: textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                          <span className="text-[12px] font-bold uppercase" style={{ color: textColor, opacity: 0.5 }}>MEMBER</span>
                          <span className="text-[14px] font-bold" style={{ color: textColor }}>{String(data.member_name)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="fixed bottom-0 left-0 right-0 rounded-t-[26px] px-[16px] pt-[20px] pb-[30px] z-[102]"
              style={{ backgroundColor: bgColor, boxShadow: '0px -4px 20px rgba(0,0,0,0.15)' }}
            >
              {isEventInvite ? (
                <div className="flex flex-col gap-[20px] items-center">
                  <div className="grid grid-cols-2 gap-[10px] w-full">
                    <button
                      onClick={() => handleAction('decline_event')}
                      className="rounded-[10px] py-[16px] flex items-center justify-center"
                      style={{
                        backgroundColor: textColor === 'white' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                      }}
                    >
                      <span className="text-[16px] font-bold uppercase" style={{ color: textColor }}>
                        DECLINE
                      </span>
                    </button>
                    <button
                      onClick={() => handleAction('accept_event')}
                      className="rounded-[10px] py-[16px] flex items-center justify-center"
                      style={{
                        backgroundColor: textColor === 'white' ? 'white' : 'black',
                      }}
                    >
                      <span
                        className="text-[16px] font-bold uppercase"
                        style={{ color: textColor === 'white' ? bgColor : '#D5FB46' }}
                      >
                        ACCEPT
                      </span>
                    </button>
                  </div>
                  {!currentNotification.read && (
                    <button
                      onClick={() => onMarkAsRead?.(currentNotification.id)}
                      className="text-[12px] font-medium uppercase"
                      style={{ color: textColor, opacity: 0.5 }}
                    >
                      MARK AS READ
                    </button>
                  )}
                </div>
              ) : isMultiple ? (
                <button
                  onClick={onMarkAllAsRead}
                  className="w-full py-[16px] rounded-[10px] flex items-center justify-center gap-[8px]"
                  style={{
                    backgroundColor: textColor === 'white' ? 'white' : 'black',
                  }}
                >
                  <Check className="w-[18px] h-[18px]" style={{ color: textColor === 'white' ? bgColor : '#D5FB46' }} />
                  <span
                    className="text-[16px] font-bold uppercase"
                    style={{ color: textColor === 'white' ? bgColor : '#D5FB46' }}
                  >
                    MARK ALL READ
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-[20px] items-center">
                  <div className="grid grid-cols-2 gap-[10px] w-full">
                    {!currentNotification.read && (
                      <button
                        onClick={() => onMarkAsRead?.(currentNotification.id)}
                        className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px]"
                        style={{
                          backgroundColor: textColor === 'white' ? 'white' : 'black',
                        }}
                      >
                        <Check className="w-[18px] h-[18px]" style={{ color: textColor === 'white' ? bgColor : '#D5FB46' }} />
                        <span
                          className="text-[16px] font-bold uppercase"
                          style={{ color: textColor === 'white' ? bgColor : '#D5FB46' }}
                        >
                          READ
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => onDelete?.(currentNotification.id)}
                      className="rounded-[10px] py-[16px] flex items-center justify-center"
                      style={{
                        backgroundColor: textColor === 'white' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                      }}
                    >
                      <span className="text-[16px] font-bold uppercase text-[#FF7C7C]">DELETE</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationDetailModal;
