// App-wide type definitions

// Tab types
export type TabName = 'Home' | 'Events' | 'Chat' | 'More';

// View modes
export type EventViewMode = 'list' | 'calendar';
export type RehearsalViewMode = 'index' | 'overview' | 'setlist' | 'tasks' | 'live' | 'post';

// Card types for expanded state
export type ExpandedCardType = 'finance' | 'pending' | 'quotes' | 'confirmed' | 'rehearsal' | null;

// Event creation types
export type CreateEventType = 'gig' | 'quote' | 'rehearsal' | null;

// Quote modal types
export type QuoteModalType = 'create' | 'detail' | 'edit' | null;

// Re-export Quote types
export type { Quote, QuoteLineItem, QuoteStatus } from '../data/quotes';

// Re-export rehearsal types
export * from '../components/rehearsal/types';
