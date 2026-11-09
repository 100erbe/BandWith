import { useState, useEffect, useCallback, useRef } from 'react';
import { processSyncQueue, subscribeToSyncQueue, type SyncResult } from './syncQueue';

export { isOfflineError } from './networkErrors';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  pendingSyncCount: number;
  triggerSync: () => Promise<SyncResult>;
}

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

export const useNetworkStatus = (onSyncSuccess?: (msg: string) => void): NetworkStatus => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const isInitialMount = useRef(true);

  const triggerSync = useCallback(async () => {
    return await processSyncQueue(onSyncSuccess);
  }, [onSyncSuccess]);

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
        await triggerSync();
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
      triggerSync();
    }
    isInitialMount.current = false;

    return () => {
      networkListeners.delete(handleStatusChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  return {
    isOnline,
    wasOffline,
    pendingSyncCount,
    triggerSync,
  };
};
