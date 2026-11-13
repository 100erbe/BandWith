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
 * Claims the waiting token, if any. Network errors keep it for the next try;
 * any answer from the server (linked, taken…) clears it.
 */
export async function claimPendingDeputyToken(): Promise<DeputyClaimResult | null> {
  const token = pendingDeputyToken();
  if (!token || claiming) return null;
  claiming = true;
  bump();
  try {
    const { data, error } = await claimDeputy(token);
    if (error || !data) return null;
    clearPendingDeputyToken();
    result = data;
    return data;
  } finally {
    claiming = false;
    bump();
  }
}

/** The last claim's result until dismissed, and whether one is still waiting or running. */
export function useDeputyClaim(): { result: DeputyClaimResult | null; pending: boolean; dismiss: () => void } {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    result,
    pending: claiming || !!pendingDeputyToken(),
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
  version = 0;
}
