import { useState, useEffect, useCallback, useRef } from 'react';
import { processSyncQueue, subscribeToSyncQueue } from './syncQueue';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  pendingSyncCount: number;
  triggerSync: () => Promise<{ synced: number; failed: number }>;
}

type NetworkListener = (online: boolean) => void;
const networkListeners = new Set<NetworkListener>();

export const reportNetworkStatus = (online: boolean) => {
  networkListeners.forEach((cb) => cb(online));
};

export const isOfflineError = (err: any): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err) return false;
  const msg = String(err?.message || err?.error_description || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('offline') ||
    msg.includes('fetch error') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('err_network')
  );
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
      setIsOnline(true);
      if (!isInitialMount.current) {
        setWasOffline(true);
        // Process offline mutation queue automatically on reconnect
        await triggerSync();
      }
    };

    const handleOffline = () => {
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
