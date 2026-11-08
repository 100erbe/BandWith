import { getOfflineItem, setOfflineItem } from './storage';
import * as eventsService from '@/lib/services/events';

const MUTATION_QUEUE_KEY = 'bw_offline_mutation_queue';

export interface OfflineMutation {
  id: string;
  type: 'create_event' | 'update_event' | 'delete_event';
  timestamp: number;
  payload: any;
  retryCount: number;
}

type SyncCallback = (count: number) => void;
const subscribers = new Set<SyncCallback>();

const notifySubscribers = async () => {
  const mutations = await getPendingMutations();
  subscribers.forEach((cb) => cb(mutations.length));
};

export const subscribeToSyncQueue = (cb: SyncCallback): (() => void) => {
  subscribers.add(cb);
  getPendingMutations().then((m) => cb(m.length)).catch(() => cb(0));
  return () => subscribers.delete(cb);
};

export const getPendingMutations = async (): Promise<OfflineMutation[]> => {
  const items = await getOfflineItem<OfflineMutation[]>(MUTATION_QUEUE_KEY);
  return items || [];
};

export const enqueueMutation = async (
  type: OfflineMutation['type'],
  payload: any,
  tempId?: string
): Promise<string> => {
  const id = tempId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const current = await getPendingMutations();
  
  const newMutation: OfflineMutation = {
    id,
    type,
    timestamp: Date.now(),
    payload,
    retryCount: 0,
  };

  current.push(newMutation);
  await setOfflineItem(MUTATION_QUEUE_KEY, current);
  notifySubscribers();
  return id;
};

export const removeMutation = async (id: string): Promise<void> => {
  const current = await getPendingMutations();
  const filtered = current.filter((m) => m.id !== id);
  await setOfflineItem(MUTATION_QUEUE_KEY, filtered);
  notifySubscribers();
};

let isProcessing = false;

/**
 * Replays pending mutations silently to Supabase.
 */
export const processSyncQueue = async (
  onSuccessToast?: (msg: string) => void
): Promise<{ synced: number; failed: number }> => {
  if (isProcessing) return { synced: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isProcessing = true;
  let synced = 0;
  let failed = 0;

  try {
    const queue = await getPendingMutations();
    if (queue.length === 0) {
      isProcessing = false;
      return { synced: 0, failed: 0 };
    }

    const remainingQueue: OfflineMutation[] = [];

    for (const mutation of queue) {
      try {
        if (mutation.type === 'create_event') {
          const { eventData, memberIds, isPersonalGig, personalGigInput } = mutation.payload;
          if (isPersonalGig && personalGigInput) {
            const { data, error } = await eventsService.createPersonalGig(personalGigInput);
            if (!error && data) {
              synced++;
            } else {
              mutation.retryCount = (mutation.retryCount || 0) + 1;
              remainingQueue.push(mutation);
              failed++;
            }
          } else {
            // Clean temporary offline flags from DB payload
            const { _isPendingSync, _tempId, id, eventId, ...cleanEventData } = eventData || {};
            const normalizedMembers = Array.isArray(memberIds)
              ? memberIds
                  .map((m: any) => ({
                    user_id: m.user_id || m.id,
                    role: m.role || undefined,
                    fee: m.fee != null ? Number(m.fee) || 0 : 0,
                    status: m.status || 'confirmed',
                  }))
                  .filter((m: any) => Boolean(m.user_id))
              : undefined;
            const { data, error } = await eventsService.createEvent(cleanEventData, normalizedMembers);

            if (!error && data) {
              synced++;
            } else {
              mutation.retryCount = (mutation.retryCount || 0) + 1;
              remainingQueue.push(mutation);
              failed++;
            }
          }
        } else if (mutation.type === 'update_event') {
          const { eventId, updates, isPersonalGig, personalGigInput } = mutation.payload;
          if (String(eventId).startsWith('offline_')) {
            // If updating an event that hasn't synced yet, fold updates into its pending create_event
            const createIdx = remainingQueue.findIndex(m => m.id === eventId && m.type === 'create_event');
            if (createIdx >= 0) {
              remainingQueue[createIdx].payload.eventData = {
                ...remainingQueue[createIdx].payload.eventData,
                ...updates,
              };
            }
            synced++;
          } else if (isPersonalGig && personalGigInput) {
            const { error } = await eventsService.updatePersonalGig(personalGigInput);
            if (!error) {
              synced++;
            } else {
              mutation.retryCount = (mutation.retryCount || 0) + 1;
              remainingQueue.push(mutation);
              failed++;
            }
          } else {
            const { _isPendingSync, _tempId, ...cleanUpdates } = updates || {};
            const { error } = await eventsService.updateEvent(eventId, cleanUpdates);

            if (!error) {
              synced++;
            } else {
              mutation.retryCount = (mutation.retryCount || 0) + 1;
              remainingQueue.push(mutation);
              failed++;
            }
          }
        } else if (mutation.type === 'delete_event') {
          const { eventId } = mutation.payload;
          const { error } = await eventsService.deleteEvent(eventId);

          if (!error) {
            synced++;
          } else {
            mutation.retryCount = (mutation.retryCount || 0) + 1;
            remainingQueue.push(mutation);
            failed++;
          }
        }
      } catch (err) {
        console.warn(`[SyncQueue] Error executing mutation ${mutation.id}:`, err);
        mutation.retryCount = (mutation.retryCount || 0) + 1;
        remainingQueue.push(mutation);
        failed++;
      }
    }

    await setOfflineItem(MUTATION_QUEUE_KEY, remainingQueue);
    notifySubscribers();

    if (synced > 0 && onSuccessToast) {
      onSuccessToast(`Synced ${synced} offline update${synced > 1 ? 's' : ''}`);
    }
  } finally {
    isProcessing = false;
  }

  return { synced, failed };
};
