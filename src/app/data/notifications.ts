// Notification types
export type NotificationType = 'chat' | 'event' | 'finance';
export type NotificationActionType = 'NAV_CHAT' | 'NAV_EVENTS' | 'NAV_EVENTS_CONFIRMED' | 'NAV_FINANCE';

export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionType: NotificationActionType;
  chatId?: string; // For deep linking to specific chat
  eventId?: string; // For deep linking to specific event
}

// Initial notifications data
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { 
    id: 1, 
    type: "chat", 
    title: "New Message", 
    message: "Laura (Wedding Planner): Can we change the setlist?", 
    time: "2m ago", 
    read: false,
    actionType: "NAV_CHAT"
  },
  { 
    id: 4, 
    type: "chat", 
    title: "New Message", 
    message: "Marco (Drummer): I'm running 5 mins late.", 
    time: "10m ago", 
    read: false,
    actionType: "NAV_CHAT"
  },
  { 
    id: 2, 
    type: "event", 
    title: "Gig Confirmed", 
    message: "Jazz Night at Blue Note is now confirmed.", 
    time: "1h ago", 
    read: false,
    actionType: "NAV_EVENTS_CONFIRMED"
  },
  { 
    id: 3, 
    type: "finance", 
    title: "Payment Received", 
    message: "Deposit for 'Private Party' (+€500) received.", 
    time: "3h ago", 
    read: true, 
    actionType: "NAV_FINANCE"
  }
];
