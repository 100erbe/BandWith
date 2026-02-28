import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  Users,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Euro
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
  notifications?: NotificationData[]; // For multiple notifications of same type
  onMarkAsRead?: (id?: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (id?: string) => void;
  onAction?: (action: string, notificationId?: string) => void;
}

// Format relative time
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

// Format date for display
const formatEventDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

// Get icon based on notification type
const getIcon = (type: string) => {
  if (type === 'invite_sent') return Send;
  if (type === 'invite_received') return UserPlus;
  if (type === 'invite_accepted' || type === 'member_joined') return CheckCircle;
  if (type === 'invite_declined' || type === 'member_left') return XCircle;
  if (type === 'invite_expired') return Clock;
  if (type.includes('event') || type.includes('rehearsal')) return Calendar;
  if (type.includes('quote') || type.includes('payment')) return Euro;
  return Users;
};

// Get colors based on notification type - Swiss Editorial style
const getTypeStyle = (type: string): { bg: string; accent: string; label: string } => {
  if (type === 'event_invite') return { bg: 'bg-[#D4FB46]', accent: 'text-black', label: 'Event Invitation' };
  if (type === 'event_created') return { bg: 'bg-emerald-500', accent: 'text-white', label: 'Event Created' };
  if (type.includes('invite')) return { bg: 'bg-blue-500', accent: 'text-white', label: 'Invitation' };
  if (type.includes('payment')) return { bg: 'bg-amber-500', accent: 'text-white', label: 'Payment' };
  if (type.includes('rehearsal')) return { bg: 'bg-[#0047FF]', accent: 'text-white', label: 'Rehearsal' };
  return { bg: 'bg-stone-700', accent: 'text-white', label: 'Notification' };
};

// Generate ICS content for calendar
const generateICS = (data: Record<string, unknown>): string => {
  const title = data.event_title as string || 'Event';
  const date = data.event_date as string;
  const time = data.event_time as string || '20:00';
  const venue = data.venue as string || '';
  
  const startDate = new Date(`${date}T${time}`);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours
  
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BandWith//Event//EN
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${title}
LOCATION:${venue}
DESCRIPTION:Event from BandWith
END:VEVENT
END:VCALENDAR`;
};

// Add to calendar function
const addToCalendar = async (data: Record<string, unknown>) => {
  try {
    const title = data.event_title as string || 'Event';
    const date = data.event_date as string;
    const time = data.event_time as string || '20:00';
    const venue = data.venue as string || '';
    
    const startDate = new Date(`${date}T${time}`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    
    // Format for Google Calendar URL
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&location=${encodeURIComponent(venue)}&sf=true`;
    
    if (Capacitor.isNativePlatform()) {
      // Open in browser on native platforms
      await Browser.open({ url: googleUrl });
    } else {
      // Web fallback
      window.open(googleUrl, '_blank');
    }
    
    console.log('Opening calendar');
  } catch (error) {
    console.error('Error adding to calendar:', error);
  }
};

// Compact notification item for list view
const NotificationListItem: React.FC<{
  notification: NotificationData;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ notification, isSelected, onSelect }) => {
  const Icon = getIcon(notification.type);
  const style = getTypeStyle(notification.type);
  
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-2xl transition-all",
        isSelected 
          ? "bg-white/10 ring-2 ring-[#D4FB46]" 
          : "bg-white/5 hover:bg-white/8"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", style.bg)}>
          <Icon className={cn("w-5 h-5", style.accent)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-sm text-white truncate">{notification.title}</h4>
            <span className="text-[10px] text-stone-500 flex-shrink-0 font-medium">
              {formatTime(notification.created_at)}
            </span>
          </div>
          <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">{notification.body}</p>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 rounded-full bg-[#D4FB46] flex-shrink-0 mt-2" />
        )}
      </div>
    </motion.button>
  );
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
  
  // Use notifications array if provided, otherwise use single notification
  const allNotifications = notifications.length > 0 ? notifications : (notification ? [notification] : []);
  const currentNotification = allNotifications[selectedIndex] || notification;
  const isMultiple = allNotifications.length > 1;
  
  if (!currentNotification) return null;

  const Icon = getIcon(currentNotification.type);
  const style = getTypeStyle(currentNotification.type);
  const data = currentNotification.data || {};
  
  // Check if this is an event notification with RSVP actions
  const isEventInvite = currentNotification.type === 'event_invite';
  const hasEventData = !!data.event_date;

  const handleAction = (action: string) => {
    console.log('[Modal] Action triggered:', action, 'for notification:', currentNotification.id);
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md" 
          />
          
          {/* Modal - Swiss Editorial Style */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#0A0A0A] rounded-t-[2rem] overflow-hidden"
            style={{ maxHeight: '85vh' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            
            {/* Header - Minimal */}
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", style.bg)}>
                    <Icon className={cn("w-6 h-6", style.accent)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                      {style.label}
                    </p>
                    <h2 className="text-lg font-black text-white">
                      {isMultiple ? `${allNotifications.length} Notifications` : currentNotification.title}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
              {isMultiple ? (
                // List view for multiple notifications
                <div className="space-y-2">
                  {allNotifications.map((notif, index) => (
                    <NotificationListItem
                      key={notif.id}
                      notification={notif}
                      isSelected={index === selectedIndex}
                      onSelect={() => setSelectedIndex(index)}
                    />
                  ))}
                </div>
              ) : (
                // Single notification detail view - Swiss Editorial Card
                <div className="space-y-4">
                  {/* Message */}
                  {currentNotification.body && (
                    <p className="text-white/80 text-base leading-relaxed">
                      {currentNotification.body}
                    </p>
                  )}
                  
                  {/* Event Details Card */}
                  {hasEventData && (
                    <div className="bg-white/5 rounded-2xl p-5 space-y-4 border border-white/5">
                      {/* Event Title */}
                      {data.event_title && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 mb-1">Event</p>
                          <p className="text-xl font-black text-white">{String(data.event_title)}</p>
                        </div>
                      )}
                      
                      {/* Date & Time */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#D4FB46]/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-[#D4FB46]" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">Date & Time</p>
                          <p className="text-sm font-bold text-white">
                            {data.event_date && formatEventDate(String(data.event_date))}
                            {data.event_time && ` at ${String(data.event_time)}`}
                          </p>
                        </div>
                      </div>
                      
                      {/* Venue */}
                      {data.venue && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">Venue</p>
                            <p className="text-sm font-bold text-white">{String(data.venue)}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Fee */}
                      {(data.member_fee || data.fee) && (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Euro className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500">
                              {data.member_fee ? 'Your Fee' : 'Total Fee'}
                            </p>
                            <p className="text-sm font-black text-[#D4FB46]">
                              €{Number(data.member_fee || data.fee).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Add to Calendar Button */}
                      <button
                        onClick={handleAddToCalendar}
                        disabled={isAddingToCalendar}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                      >
                        <CalendarPlus className="w-4 h-4 text-[#D4FB46]" />
                        <span className="text-sm font-bold text-white">
                          {isAddingToCalendar ? 'Adding...' : 'Add to Calendar'}
                        </span>
                      </button>
                    </div>
                  )}
                  
                  {/* Other Details */}
                  {!hasEventData && Object.keys(data).length > 0 && (
                    <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                      {data.invitee_email && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-stone-500 font-medium">Email</span>
                          <span className="text-sm font-bold text-white">{String(data.invitee_email)}</span>
                        </div>
                      )}
                      {data.inviter_name && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-stone-500 font-medium">Invited By</span>
                          <span className="text-sm font-bold text-white">{String(data.inviter_name)}</span>
                        </div>
                      )}
                      {data.member_name && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-stone-500 font-medium">Member</span>
                          <span className="text-sm font-bold text-white">{String(data.member_name)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Actions - Swiss Editorial CTAs */}
            <div className="px-6 pb-6 pt-2 border-t border-white/5 bg-[#0A0A0A]">
              {isEventInvite ? (
                // RSVP Actions for event invites
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction('decline_event')}
                      className="flex-1 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-black text-sm uppercase tracking-wider hover:bg-red-500/20 transition-all active:scale-[0.98]"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleAction('accept_event')}
                      className="flex-1 py-4 rounded-2xl bg-[#D4FB46] text-black font-black text-sm uppercase tracking-wider hover:bg-[#c4eb36] transition-all active:scale-[0.98]"
                    >
                      Accept
                    </button>
                  </div>
                  {!currentNotification.read && (
                    <button
                      onClick={() => onMarkAsRead?.(currentNotification.id)}
                      className="w-full py-3 rounded-xl bg-white/5 text-stone-400 font-medium text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Mark as Read
                    </button>
                  )}
                </div>
              ) : isMultiple ? (
                // Multiple notifications actions
                <button
                  onClick={onMarkAllAsRead}
                  className="w-full py-4 rounded-2xl bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Mark All as Read
                </button>
              ) : (
                // Single notification actions
                <div className="flex gap-3">
                  {!currentNotification.read && (
                    <button
                      onClick={() => onMarkAsRead?.(currentNotification.id)}
                      className="flex-1 py-3.5 rounded-xl bg-white/5 text-white font-medium text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Mark as Read
                    </button>
                  )}
                  <button
                    onClick={() => onDelete?.(currentNotification.id)}
                    className="px-4 py-3.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationDetailModal;
