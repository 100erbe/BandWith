// Chat types
export type ChatType = 'direct' | 'band' | 'event';
export type ChatStatus = 'received' | 'read' | 'sent';

export interface ChatItem {
  id: number;
  uuid?: string; // Real UUID from database
  type: ChatType;
  name: string;
  initials: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: ChatStatus;
  role?: string;
  members?: number;
  date?: string;
  month?: string;
  // New fields for contextual info
  subtitle?: string;
  senderName?: string;
  bandName?: string;
  eventDate?: string;
  eventType?: 'gig' | 'rehearsal';
  lastMessageAt?: Date;
  isOnline?: boolean;
}
