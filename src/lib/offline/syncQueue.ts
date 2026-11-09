import {
  getOfflineItem,
  setOfflineItem,
  removeOfflineItem,
  LEGACY_MUTATION_QUEUE_KEY,
} from './storage';
import { isOfflineError } from './networkErrors';
import * as eventsService from '@/lib/services/events';
import { supabase } from '@/lib/supabase';

/** Per-user queue keys live under the `bw:` prefix that clearOfflineCache() wipes on logout. */
export const OFFLINE_QUEUE_PREFIX = 'bw:offline_queue:';
/** A non-network failure is retried this many times before the mutation is dropped. */
export const MAX_RETRIES = 5;
/** How long queue operations wait for the auth layer to report the current user. */
const USER_RESOLVE_TIMEOUT_MS = 2000;

export interface OfflineMutation {
  id: string;
  type: 'create_event' | 'update_event' | 'delete_event';
  timestamp: number;
  payload: any;
  retryCount: number;
  /** Message of the last non-network failure, if any. */
  lastError?: string;
}

export interface DroppedMutation {
  mutation: OfflineMutation;
  error: string;
  /** max_retries: rejected by the server MAX_RETRIES times; orphaned: targets an offline event that no longer exists. */
  reason: 'max_retries' | 'orphaned';
}

export interface SyncResult {
  /** Mutations successfully applied on the server this pass. */
  synced: number;
  /** Mutations that failed this pass (still queued for retry, or dropped). */
  failed: number;
  /** Mutations permanently removed from the queue without being applied. */
  dropped: number;
  droppedMutations: DroppedMutation[];
}

const emptyResult = (): SyncResult => ({ synced: 0, failed: 0, dropped: 0, droppedMutations: [] });

// ---------------------------------------------------------------------------
// User scoping
// ---------------------------------------------------------------------------

export const getOfflineQueueKey = (userId: string | null | undefined): string =>
  `${OFFLINE_QUEUE_PREFIX}${userId || 'anonymous'}`;

let currentUserId: string | null = null;
let userResolved = false;
let resolveUserReady: () => void = () => {};
const userReady = new Promise<void>((resolve) => {
  resolveUserReady = resolve;
});

/** temp (offline_*) event id -> real server id, for mutations enqueued after their create synced. */
const tempIdMap = new Map<string, string>();

/**
 * Serialises every read-modify-write of the stored queue so an enqueue that
 * happens while a sync is in flight cannot be overwritten.
 */
let queueLock: Promise<unknown> = Promise.resolve();
const withQueueLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => {});
  return run;
};

const readQueue = async (key: string): Promise<OfflineMutation[] | null> => {
  const items = await getOfflineItem<OfflineMutation[]>(key);
  return Array.isArray(items) ? items : null;
};

/** Best-effort owner of a queued mutation, from fields callers already put in the payload. */
const ownerHint = (m: OfflineMutation): string | undefined =>
  m?.payload?.personalGigInput?.userId || m?.payload?.eventData?.created_by || undefined;

/**
 * Moves mutations from an un-owned key (legacy global queue, or the anonymous
 * queue used before the user was known) into the user's queue. If any
 * mutation is visibly owned by someone else the whole orphan queue is
 * discarded rather than replayed under the wrong account.
 */
const adoptOrphanQueue = async (fromKey: string, userId: string): Promise<void> => {
  const orphan = await readQueue(fromKey);
  if (orphan === null) return;
  await removeOfflineItem(fromKey);
  if (orphan.length === 0) return;
  if (orphan.some((m) => ownerHint(m) && ownerHint(m) !== userId)) {
    console.warn(`[SyncQueue] Discarded ${orphan.length} queued mutation(s) from ${fromKey} owned by another user`);
    return;
  }
  const key = getOfflineQueueKey(userId);
  const current = (await readQueue(key)) || [];
  const known = new Set(current.map((m) => m.id));
  await setOfflineItem(key, [...current, ...orphan.filter((m) => !known.has(m.id))]);
};

/**
 * Sets the user whose offline queue is read, written and synced. Called
 * automatically from Supabase auth events; callers may also call it directly
 * (e.g. right after sign-in / sign-out).
 */
export const setOfflineQueueUser = (userId: string | null): void => {
  const changed = !userResolved || userId !== currentUserId;
  currentUserId = userId;
  if (!userResolved) {
    userResolved = true;
    resolveUserReady();
  }
  if (!changed) return;
  tempIdMap.clear();
  if (userId) {
    withQueueLock(async () => {
      await adoptOrphanQueue(LEGACY_MUTATION_QUEUE_KEY, userId);
      await adoptOrphanQueue(getOfflineQueueKey(null), userId);
    })
      .catch((err) => console.warn('[SyncQueue] Failed to migrate orphan queue:', err))
      .finally(() => notifySubscribers());
  } else {
    notifySubscribers();
  }
};

let authBound = false;
const ensureAuthBinding = () => {
  if (authBound) return;
  authBound = true;
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      // An INITIAL_SESSION without a session (e.g. offline with an expired
      // token) must not override a user that was already set explicitly.
      if (event === 'INITIAL_SESSION' && !session && userResolved) return;
      setOfflineQueueUser(session?.user?.id ?? null);
    });
  } catch (err) {
    console.warn('[SyncQueue] Could not subscribe to auth changes:', err);
  }
};

const resolveUser = async (): Promise<string | null> => {
  ensureAuthBinding();
  if (!userResolved) {
    await Promise.race([
      userReady,
      new Promise<void>((resolve) => setTimeout(resolve, USER_RESOLVE_TIMEOUT_MS)),
    ]);
  }
  return currentUserId;
};

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

type SyncCallback = (count: number) => void;
const subscribers = new Set<SyncCallback>();

const notifySubscribers = async () => {
  try {
    const mutations = await getPendingMutations();
    subscribers.forEach((cb) => cb(mutations.length));
  } catch {
    // Ignore
  }
};

export const subscribeToSyncQueue = (cb: SyncCallback): (() => void) => {
  subscribers.add(cb);
  getPendingMutations().then((m) => cb(m.length)).catch(() => cb(0));
  return () => subscribers.delete(cb);
};

// ---------------------------------------------------------------------------
// Queue API
// ---------------------------------------------------------------------------

export const getPendingMutations = async (): Promise<OfflineMutation[]> => {
  const userId = await resolveUser();
  await queueLock; // let a pending orphan-queue migration land first
  return (await readQueue(getOfflineQueueKey(userId))) || [];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4122 v4 UUID; crypto.randomUUID when available, with fallbacks. */
export const generateClientId = (): string => {
  const c: Crypto | undefined = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Give create payloads a stable row id so a replayed insert cannot duplicate. */
const withClientId = (payload: any): any => {
  if (!payload || typeof payload !== 'object' || payload.clientId) return payload;
  const existing = payload.eventData?.id;
  const clientId = typeof existing === 'string' && UUID_RE.test(existing) ? existing : generateClientId();
  return { ...payload, clientId };
};

export const enqueueMutation = async (
  type: OfflineMutation['type'],
  payload: any,
  tempId?: string
): Promise<string> => {
  const id = tempId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newMutation: OfflineMutation = {
    id,
    type,
    timestamp: Date.now(),
    payload: type === 'create_event' ? withClientId(payload) : payload,
    retryCount: 0,
  };

  const userId = await resolveUser();
  await withQueueLock(async () => {
    const key = getOfflineQueueKey(userId);
    const current = (await readQueue(key)) || [];
    current.push(newMutation);
    await setOfflineItem(key, current);
  });
  notifySubscribers();
  return id;
};

export const removeMutation = async (id: string): Promise<void> => {
  const userId = await resolveUser();
  await withQueueLock(async () => {
    const key = getOfflineQueueKey(userId);
    const current = await readQueue(key);
    if (current === null) return;
    await setOfflineItem(key, current.filter((m) => m.id !== id));
  });
  notifySubscribers();
};

/**
 * Removes the offline queue of the given user (default: current user) plus
 * the legacy global queue. clearOfflineCache() on logout also covers this.
 */
export const clearOfflineQueue = async (userId?: string | null): Promise<void> => {
  const target = userId !== undefined ? userId : await resolveUser();
  await withQueueLock(async () => {
    await removeOfflineItem(getOfflineQueueKey(target));
    await removeOfflineItem(LEGACY_MUTATION_QUEUE_KEY);
  });
  tempIdMap.clear();
  notifySubscribers();
};

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

const isTempId = (id: unknown): id is string => typeof id === 'string' && id.startsWith('offline_');

/** Every temp id a create mutation can be referenced by. */
const tempIdsOf = (m: OfflineMutation): string[] =>
  [m.id, m.payload?.eventData?.id, m.payload?.eventData?._tempId].filter(isTempId);

const errorMessage = (err: any): string =>
  String(err?.message || err?.error_description || err || 'Unknown error');

const errorCode = (err: any): string | undefined =>
  err && typeof err === 'object' && err.code != null ? String(err.code) : undefined;

/** Postgres unique_violation: on a create with a client id it means "already inserted". */
const isDuplicateKeyError = (err: any): boolean => errorCode(err) === '23505';

/**
 * Errors worth retrying indefinitely (connectivity, auth/session, server
 * load). Anything else (RLS 42501, constraint / type errors, 4xx) counts
 * towards MAX_RETRIES.
 */
export const isTransientSyncError = (err: any): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const code = errorCode(err);
  const msg = errorMessage(err).toLowerCase();
  if (code === 'PGRST301' || msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('authentication is required')) {
    return true;
  }
  if (code && /^[0-9A-Z]{5}$/.test(code)) {
    // SQLSTATE: connection exception, transaction rollback, insufficient resources, operator intervention
    return /^(08|40|53|57)/.test(code);
  }
  if (code && code.startsWith('PGRST')) return false;
  const status = Number(err?.status);
  if (status === 401 || status === 408 || status === 429 || status >= 500) return true;
  return isOfflineError(err);
};

type ExecOutcome =
  | { ok: true; realId?: string }
  | { ok: false; error: any; orphaned?: boolean };

const resolveEventId = (eventId: any): { id: any; orphaned: boolean } => {
  if (!isTempId(eventId)) return { id: eventId, orphaned: false };
  const real = tempIdMap.get(eventId);
  return real ? { id: real, orphaned: false } : { id: eventId, orphaned: true };
};

const executeMutation = async (mutation: OfflineMutation): Promise<ExecOutcome> => {
  if (mutation.type === 'create_event') {
    const { eventData, memberIds, isPersonalGig, personalGigInput, clientId } = mutation.payload || {};
    let result: { data: any; error: any };
    if (isPersonalGig && personalGigInput) {
      const input = (clientId ? { ...personalGigInput, id: clientId } : personalGigInput) as eventsService.CreatePersonalGigInput;
      result = await eventsService.createPersonalGig(input);
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
      result = await eventsService.createEvent(
        clientId ? { ...cleanEventData, id: clientId } : cleanEventData,
        normalizedMembers
      );
    }
    if (!result.error && result.data) return { ok: true, realId: result.data.id || clientId };
    if (clientId && isDuplicateKeyError(result.error)) return { ok: true, realId: clientId };
    return { ok: false, error: result.error || new Error('Create returned no data') };
  }

  if (mutation.type === 'update_event') {
    const { eventId, updates, isPersonalGig, personalGigInput } = mutation.payload || {};
    const target = resolveEventId(eventId);
    if (target.orphaned) {
      return { ok: false, orphaned: true, error: new Error(`Offline event ${eventId} no longer pending`) };
    }
    if (isPersonalGig && personalGigInput) {
      const { error } = await eventsService.updatePersonalGig({ ...personalGigInput, eventId: target.id });
      return error ? { ok: false, error } : { ok: true };
    }
    const { _isPendingSync, _tempId, ...cleanUpdates } = updates || {};
    const { error } = await eventsService.updateEvent(target.id, cleanUpdates);
    return error ? { ok: false, error } : { ok: true };
  }

  if (mutation.type === 'delete_event') {
    const target = resolveEventId(mutation.payload?.eventId);
    if (target.orphaned) {
      return { ok: false, orphaned: true, error: new Error(`Offline event ${mutation.payload?.eventId} no longer pending`) };
    }
    const { error } = await eventsService.deleteEvent(target.id);
    return error ? { ok: false, error } : { ok: true };
  }

  return { ok: false, orphaned: true, error: new Error(`Unknown mutation type ${(mutation as any).type}`) };
};

/** Merge an update to a not-yet-synced event into its pending create. */
const foldUpdateIntoCreate = (create: OfflineMutation, update: OfflineMutation): OfflineMutation => {
  const { eventId: _ignored, ...gigFields } = update.payload?.personalGigInput || {};
  const payload = {
    ...create.payload,
    eventData: { ...(create.payload?.eventData || {}), ...(update.payload?.updates || {}) },
  };
  if (create.payload?.personalGigInput && update.payload?.personalGigInput) {
    payload.personalGigInput = { ...create.payload.personalGigInput, ...gigFields };
  }
  return { ...create, payload };
};

let isProcessing = false;

/**
 * Replays pending mutations silently to Supabase.
 */
export const processSyncQueue = async (
  onSuccessToast?: (msg: string) => void
): Promise<SyncResult> => {
  if (isProcessing) return emptyResult();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return emptyResult();
  }

  isProcessing = true;
  const result = emptyResult();

  try {
    const userId = await resolveUser();
    if (!userId) return result;
    const key = getOfflineQueueKey(userId);
    const snapshot = (await getPendingMutations()) || [];
    if (snapshot.length === 0) return result;

    /** ids to delete from storage at the end (applied, folded, cancelled or dropped). */
    const processed = new Set<string>();
    /** replacement versions of mutations that stay queued (folded payload / bumped retryCount). */
    const updated = new Map<string, OfflineMutation>();

    // Pass 1: fold updates/deletes that target a pending offline create into that create.
    const work: OfflineMutation[] = [];
    const pendingCreates = new Map<string, OfflineMutation>();
    for (const original of snapshot) {
      const m: OfflineMutation = { ...original };
      const targetId = m.payload?.eventId;
      const create = (m.type === 'update_event' || m.type === 'delete_event') && isTempId(targetId)
        ? pendingCreates.get(targetId)
        : undefined;

      if (create && m.type === 'update_event') {
        const folded = foldUpdateIntoCreate(create, m);
        const idx = work.indexOf(create);
        work[idx] = folded;
        tempIdsOf(create).forEach((t) => pendingCreates.set(t, folded));
        updated.set(folded.id, folded);
        processed.add(m.id);
        continue;
      }
      if (create && m.type === 'delete_event') {
        // Created and deleted while offline: nothing to send.
        work.splice(work.indexOf(create), 1);
        tempIdsOf(create).forEach((t) => pendingCreates.delete(t));
        updated.delete(create.id);
        processed.add(create.id);
        processed.add(m.id);
        continue;
      }
      if (m.type === 'create_event') {
        tempIdsOf(m).forEach((t) => pendingCreates.set(t, m));
      }
      work.push(m);
    }

    // Pass 2: replay in order.
    for (const mutation of work) {
      let outcome: ExecOutcome;
      try {
        outcome = await executeMutation(mutation);
      } catch (err) {
        console.warn(`[SyncQueue] Error executing mutation ${mutation.id}:`, err);
        outcome = { ok: false, error: err };
      }

      if (outcome.ok) {
        result.synced++;
        processed.add(mutation.id);
        updated.delete(mutation.id);
        if (mutation.type === 'create_event' && outcome.realId) {
          tempIdsOf(mutation).forEach((t) => tempIdMap.set(t, outcome.realId as string));
        }
        continue;
      }

      result.failed++;
      const message = errorMessage(outcome.error);

      if (outcome.orphaned) {
        processed.add(mutation.id);
        updated.delete(mutation.id);
        result.droppedMutations.push({ mutation, error: message, reason: 'orphaned' });
        continue;
      }

      if (isTransientSyncError(outcome.error)) {
        // Connectivity/auth problem: keep this and everything after it as-is and stop.
        break;
      }

      const retried: OfflineMutation = {
        ...mutation,
        retryCount: (mutation.retryCount || 0) + 1,
        lastError: message,
      };
      if (retried.retryCount >= MAX_RETRIES) {
        console.warn(`[SyncQueue] Dropping mutation ${mutation.id} after ${retried.retryCount} failed attempts:`, message);
        processed.add(mutation.id);
        updated.delete(mutation.id);
        result.droppedMutations.push({ mutation: retried, error: message, reason: 'max_retries' });
      } else {
        updated.set(mutation.id, retried);
      }
    }
    result.dropped = result.droppedMutations.length;

    // Reconcile against what is stored *now*, so mutations enqueued during the
    // sync survive and a queue cleared during the sync (logout) is not revived.
    await withQueueLock(async () => {
      const stored = await readQueue(key);
      if (stored === null) return;
      const next = stored
        .filter((m) => !processed.has(m.id))
        .map((m) => updated.get(m.id) ?? m);
      await setOfflineItem(key, next);
    });
    notifySubscribers();

    if (result.synced > 0 && onSuccessToast) {
      onSuccessToast(`Synced ${result.synced} offline update${result.synced > 1 ? 's' : ''}`);
    }
  } finally {
    isProcessing = false;
  }

  return result;
};
