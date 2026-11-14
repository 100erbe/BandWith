import { useSyncExternalStore } from 'react';
import { claimDeputy, type DeputyClaimResult } from '@/lib/services/deputies';

/**
 * "Get BandWith" on the deputy reply page opens the app with the request's
 * token (`/?deputy=<token>`). The token waits here until the user is signed
 * in (it survives a sign-up or a reload), then bw_deputy_claim (086) links
 * the account to the band's deputy entry and the app shows the result.
 */

const KEY = 'bw_pending_deputy_token';
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function deputyTokenFromUrl(href: string): string | null {
  try {
    const raw = new URL(href).searchParams.get('deputy')?.trim().toLowerCase() ?? '';
    return TOKEN_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function savePendingDeputyToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* private mode: the claim still runs in this session */
  }
  memoryToken = token;
  bump();
}

export function pendingDeputyToken(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v && TOKEN_RE.test(v)) return v;
  } catch {
    /* ignore */
  }
  return memoryToken;
}

function clearPendingDeputyToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  memoryToken = null;
}

let memoryToken: string | null = null;
let result: DeputyClaimResult | null = null;
let claiming = false;
/** The last try didn't reach the server (offline, weak signal). */
let failed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Bumps whenever a token waits or a claim finishes. */
let version = 0;
const snapshot = () => version;
const bump = () => {
  version += 1;
  emit();
};

/**
 * After a failed try, try again when the connection comes back or the app
 * returns to the foreground (instead of "Linking…" forever).
 */
let disarmRetry: (() => void) | null = null;
function armRetry() {
  if (disarmRetry || typeof window === 'undefined') return;
  const again = () => {
    if (document.visibilityState === 'hidden') return;
    disarmRetry?.();
    void claimPendingDeputyToken();
  };
  disarmRetry = () => {
    disarmRetry = null;
    window.removeEventListener('online', again);
    document.removeEventListener('visibilitychange', again);
  };
  window.addEventListener('online', again);
  document.addEventListener('visibilitychange', again);
}

/**
 * Claims the waiting token, if any. Network errors keep it for the next try
 * (made again when back online / in the foreground); any answer from the
 * server (linked, taken…) clears it.
 */
export async function claimPendingDeputyToken(): Promise<DeputyClaimResult | null> {
  const token = pendingDeputyToken();
  if (!token || claiming) return null;
  claiming = true;
  failed = false;
  bump();
  try {
    const { data, error } = await claimDeputy(token).catch(() => ({ data: null, error: true }));
    if (error || !data) {
      failed = true;
      armRetry();
      return null;
    }
    clearPendingDeputyToken();
    result = data;
    return data;
  } finally {
    claiming = false;
    bump();
  }
}

/**
 * The last claim's result until dismissed, whether one is still waiting or
 * running, and whether the last try failed (`retry` tries again now).
 */
export function useDeputyClaim(): {
  result: DeputyClaimResult | null;
  pending: boolean;
  failed: boolean;
  retry: () => void;
  dismiss: () => void;
} {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    result,
    pending: claiming || !!pendingDeputyToken(),
    failed: failed && !claiming,
    retry: () => void claimPendingDeputyToken(),
    dismiss: () => {
      result = null;
      bump();
    },
  };
}

/** For tests. */
export function resetDeputyClaimForTests() {
  clearPendingDeputyToken();
  result = null;
  claiming = false;
  failed = false;
  disarmRetry?.();
  version = 0;
}
