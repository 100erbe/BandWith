import { useState, useEffect, useCallback, useRef } from 'react';
import { processSyncQueue, subscribeToSyncQueue, type DroppedMutation, type SyncResult } from './syncQueue';

export { isOfflineError } from './networkErrors';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  pendingSyncCount: number;
  /** Manual sync: retries rejected changes straight away. */
  triggerSync: () => Promise<SyncResult>;
}

/** While online with changes waiting, look again this often (each mutation keeps its own backoff). */
const PENDING_RECHECK_MS = 60_000;

type NetworkListener = (online: boolean) => void;
const networkListeners = new Set<NetworkListener>();
let currentOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;

export const getIsNetworkOnline = (): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  return currentOnlineState;
};

export const reportNetworkStatus = (online: boolean) => {
  currentOnlineState = online;
  networkListeners.forEach((cb) => cb(online));
};

export const useNetworkStatus = (
  onSyncSuccess?: (msg: string) => void,
  onSyncDropped?: (dropped: DroppedMutation[]) => void
): NetworkStatus => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const isInitialMount = useRef(true);

  // Callers pass inline callbacks: keep the latest ones in refs so the sync
  // triggers stay stable and only run on mount, reconnect, timer or tap.
  const onSyncSuccessRef = useRef(onSyncSuccess);
  const onSyncDroppedRef = useRef(onSyncDropped);
  onSyncSuccessRef.current = onSyncSuccess;
  onSyncDroppedRef.current = onSyncDropped;

  const runSync = useCallback(async (force: boolean) => {
    const result = await processSyncQueue(
      (msg) => onSyncSuccessRef.current?.(msg),
      force ? { force: true } : undefined
    );
    if (result.droppedMutations.length > 0) onSyncDroppedRef.current?.(result.droppedMutations);
    return result;
  }, []);

  const triggerSync = useCallback(() => runSync(true), [runSync]);

  // Subscribe to pending queue mutations
  useEffect(() => {
    const unsubscribe = subscribeToSyncQueue((count) => {
      setPendingSyncCount(count);
    });
    return unsubscribe;
  }, []);

  // Listen to programmatic network status reports & window online/offline events
  useEffect(() => {
    const handleStatusChange = (online: boolean) => {
      setIsOnline(online);
      if (!online) {
        setWasOffline(true);
      }
    };
    networkListeners.add(handleStatusChange);

    const handleOnline = async () => {
      currentOnlineState = true;
      setIsOnline(true);
      if (!isInitialMount.current) {
        setWasOffline(true);
        // Process offline mutation queue automatically on reconnect
        await runSync(false);
      }
    };

    const handleOffline = () => {
      currentOnlineState = false;
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check if starting online with pending mutations
    if (navigator.onLine) {
      void runSync(false);
    }
    isInitialMount.current = false;

    return () => {
      networkListeners.delete(handleStatusChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync]);

  // Rejected changes wait in backoff; look again periodically while there is work.
  useEffect(() => {
    if (!isOnline || pendingSyncCount === 0) return;
    const id = setInterval(() => { void runSync(false); }, PENDING_RECHECK_MS);
    return () => clearInterval(id);
  }, [isOnline, pendingSyncCount, runSync]);

  return {
    isOnline,
    wasOffline,
    pendingSyncCount,
    triggerSync,
  };
};
