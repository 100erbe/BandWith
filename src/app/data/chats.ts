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
  subtitle?: string; // "Jazz Quartet" for direct, "Jazz Quartet • Jan 26" for events
  senderName?: string; // Who sent the last message (for groups)
  bandName?: string; // Band context
  eventDate?: string; // Event date for display
  eventType?: 'gig' | 'rehearsal';
  lastMessageAt?: Date; // For sorting
  isOnline?: boolean;
}

// Chats data
export const CHATS_DATA: ChatItem[] = [
  { 
    id: 1, 
    type: 'direct', 
    name: 'Laura (Wedding Planner)', 
    initials: 'LW', 
    lastMessage: 'Can we change the setlist for the cake cutting?', 
    time: '2m', 
    unread: 1, 
    status: 'received',
    role: 'Planner',
    bandName: 'BandWith',
    isOnline: true
  },
  { 
    id: 2, 
    type: 'direct', 
    name: 'Marco Drummer', 
    initials: 'MD', 
    lastMessage: 'I\'m running 5 mins late, traffic is hell.', 
    time: '10m', 
    unread: 2, 
    status: 'received',
    role: 'Member',
    bandName: 'Jazz Trio',
    isOnline: true
  },
  { 
    id: 3, 
    type: 'band', 
    name: 'BandWith Official', 
    initials: 'BW', 
    lastMessage: 'Setlist updated for Saturday.', 
    time: '1h', 
    unread: 0, 
    status: 'read',
    members: 4,
    senderName: 'GB',
    isOnline: false
  },
  { 
    id: 4, 
    type: 'event', 
    name: 'Jazz Night @ Blue Note', 
    date: '26', 
    month: 'JAN',
    initials: '',
    lastMessage: 'Load-in is via back door only.', 
    time: '3h', 
    unread: 0, 
    status: 'read',
    eventType: 'gig',
    senderName: 'Venue',
    isOnline: false
  },
  { 
    id: 5, 
    type: 'direct', 
    name: 'Centerbe', 
    initials: 'CE', 
    lastMessage: 'Sent the invoice #402', 
    time: '1d', 
    unread: 0, 
    status: 'sent',
    role: 'Guitar',
    bandName: 'BandWith',
    isOnline: true
  },
  { 
    id: 6, 
    type: 'band', 
    name: 'Jazz Trio', 
    initials: 'JT', 
    lastMessage: 'New rehearsal added for Tuesday.', 
    time: '2d', 
    unread: 0, 
    status: 'read',
    members: 3,
    senderName: 'Marco',
    isOnline: false
  }
];
