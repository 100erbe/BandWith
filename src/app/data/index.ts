/**
 * FALLBACK/DEMO DATA
 * 
 * These modules contain mock data that is used as fallback when:
 * - Real data from Supabase is not available
 * - User is in demo/preview mode
 * - Database tables are empty
 * 
 * In production, the app should primarily use real data from:
 * - src/lib/services/ (Supabase queries)
 * - src/app/hooks/useData.ts (React hooks wrapping services)
 * 
 * The App.tsx component handles the logic to switch between
 * real data and these fallbacks.
 */

export * from './user';
export * from './bands';
export * from './events';
export * from './chats';
export * from './notifications';
export * from './metrics';
export * from './quotes';
