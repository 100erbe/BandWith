import type { ReceiptStatus } from '@/lib/services/chats';
// Chat types
export type ChatType = 'direct' | 'band' | 'event';
export type ChatFilterType = 'all' | 'direct' | 'band' | 'event';
export type ChatStatus = 'received' | 'read' | 'sent';

export interface ChatItem {
  id: number;
  uuid?: string; // Real UUID from database
  type: ChatType;
  name: string;
  initials: string;
  avatarUrl?: string;
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
  /**
   * Band shown next to a direct or event chat when the user is in several
   * bands, so it's clear where the conversation lives.
   */
  bandLabel?: string;
  eventDate?: string;
  eventType?: 'gig' | 'rehearsal';
  lastMessageAt?: Date;
  isOnline?: boolean;
  isLastMessageMine?: boolean;
  isLastMessageRead?: boolean;
  lastMessageStatus?: ReceiptStatus;
}

export const toTitleCase = (str?: string): string => {
  if (!str) return '';
  const isAllUpper = str === str.toUpperCase() && str !== str.toLowerCase();
  const isAllLower = str === str.toLowerCase() && str !== str.toUpperCase();
  if (isAllUpper || isAllLower) {
    return str.replace(
      /\b\w+/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
  }
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};
