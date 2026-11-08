/**
 * IndexedDB storage engine with localStorage fallback for BandWith offline data.
 */

const DB_NAME = 'bandwith_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

let dbPromise: Promise<IDBDatabase> | null = null;

const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
};

const getDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
};

/**
 * Generates an isolated cache key based on user and band scope.
 */
export const getCacheKey = (
  userId: string | null | undefined,
  bandId: string | null | undefined,
  queryKey: string
): string => {
  const u = userId || 'anonymous';
  const b = bandId || 'global';
  return `bw:${u}:${b}:${queryKey}`;
};

/**
 * Retrieve an item from IndexedDB with fallback to localStorage.
 */
export const getOfflineItem = async <T>(key: string): Promise<T | null> => {
  if (isIndexedDBAvailable()) {
    try {
      const db = await getDB();
      return await new Promise<T | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      // Fall through to localStorage
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[OfflineStorage] Failed to read ${key} from localStorage:`, err);
    return null;
  }
};

/**
 * Save an item to IndexedDB with fallback to localStorage.
 */
export const setOfflineItem = async <T>(key: string, value: T): Promise<void> => {
  if (isIndexedDBAvailable()) {
    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(value, key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
      return;
    } catch {
      // Fall through to localStorage
    }
  }

  // Fallback to localStorage
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[OfflineStorage] Failed to write ${key} to localStorage:`, err);
  }
};

/**
 * Delete a specific item.
 */
export const removeOfflineItem = async (key: string): Promise<void> => {
  if (isIndexedDBAvailable()) {
    try {
      const db = await getDB();
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // Ignore
    }
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
};

/**
 * Clear cache entries (optionally filtered by prefix, e.g. on logout).
 */
export const clearOfflineCache = async (prefix: string = 'bw:'): Promise<void> => {
  if (isIndexedDBAvailable()) {
    try {
      const db = await getDB();
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.openCursor();
          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const k = cursor.key;
              if (typeof k === 'string' && k.startsWith(prefix)) {
                cursor.delete();
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // Ignore
    }
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore
  }
};
