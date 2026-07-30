export type RehearsalType = 'full_band' | 'vocals' | 'rhythm' | 'acoustic' | 'custom';
export type RecurrenceType = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type VenueType = 'free' | 'paid';
export type SongPriority = 'high' | 'medium' | 'low';

export interface RehearsalMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  fee: string;
  status: 'confirmed' | 'pending' | 'declined';
  arrivedAt?: string; // For live mode
}

export interface RehearsalSong {
  id: string;
  title: string;
  artist: string;
  duration: string; // "MM:SS"
  notes?: string;
  category?: string; // e.g., "Rock 70", "Italian", "Jazz"
  priority: SongPriority;
  type: 'song' | 'break';
  status?: 'played' | 'playing' | 'pending' | 'skipped'; // For live mode
  links?: string[];
  scoreUploaded?: boolean;
}

export interface SetlistTemplate {
  id: string;
  name: string;
  songIds: string[]; // Order preserved
  version: number;
  updatedAt: string;
  updatedBy: string;
  derivedFromId?: string;
  lastChangeSummary?: {
    added: number;
    removed: number;
    editedAt?: string;
  };
}

export interface RehearsalSetlistSnapshotFinal {
  id: string;
  name: string; // e.g. "Weekly Band Practice — Setlist"
  createdAt: string;
  createdBy?: string;
  
  sources: Array<{
    templateId: string;
    templateName: string;
    templateVersion: number;
  }>;

  songs: Array<{
    songId: string;
    titleAtSnapshot?: string;
    artistAtSnapshot?: string;
    durationAtSnapshot?: string;
    sourceTemplateId: string;
  }>;

  mergeReport: {
    totalImportedTemplates: number;
    totalSongsBeforeDedupe: number;
    totalDuplicatesSkipped: number;
    duplicatesSkippedSongIds: string[];
  };
}

export interface ProposalAttachment {
    id: string;
    type: 'link' | 'pdf' | 'image' | 'audio' | 'other';
    label: string;
    url?: string;
    fileMeta?: { name: string; sizeBytes?: number };
}

export interface SongProposal {
  id: string;
  title: string;
  artist: string;
  proposer: string;
  reason: string;
  attachments?: ProposalAttachment[];
  votes: { yes: number; no: number; comments: number };
  status: 'approved' | 'pending' | 'new';
  userVote?: 'yes' | 'no' | null;
  links?: string[]; // Legacy compatibility
  scoreUploaded?: boolean; // Legacy compatibility
  createdAt?: string;
}

export interface RehearsalTask {
  id: string;
  text: string;
  type: 'study' | 'bring' | 'fix' | 'prepare' | 'other';
  assignedTo: string[]; // Array of member IDs or ['all']
  relatedSongId?: string;
  notes?: string;
  isRecurring?: boolean;
  completed: boolean;
}

export interface RehearsalState {
  // Essentials
  type: RehearsalType;
  title: string;
  location: string;
  address: string;
  date: string;
  time: string;
  duration: string;
  
  // Cost & Venue
  venueType: VenueType;
  showCost: boolean;
  totalCost: string;
  splitMethod: 'equal' | 'custom' | 'admin';
  
  // Recurrence
  recurrence: RecurrenceType;
  // Legacy fields kept for compatibility during migration if needed, but primary is recurrence above
  recurrenceType?: 'one_time' | 'recurring';
  recurrenceFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';

  // Audience
  audienceIds: string[]; // If empty/all members included by default

  members: RehearsalMember[];
  
  // Runlist (ex-Setlist)
  setlist: RehearsalSong[]; // Legacy/Current working setlist for UI display
  setlistSnapshotFinal?: RehearsalSetlistSnapshotFinal;
  selectedTemplateIdsInOrder?: string[]; // Queue for merging
  proposals: SongProposal[];
  
  // Prep
  tasks: RehearsalTask[];
  defaultChecklist: string[]; // Admin defined
  personalChecklist: string[]; // Legacy/User defined
  bandChecklist?: string[]; // Admin-only editable band defaults
  reminderTime: string; // '1_day', etc.
  
  // Meta
  status: 'draft' | 'scheduled' | 'live' | 'completed';
}
