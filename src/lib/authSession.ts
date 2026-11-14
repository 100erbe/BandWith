import type { Session } from '@supabase/supabase-js';

/**
 * The session Supabase keeps on the device, read without the network.
 *
 * Offline with an expired access token, `getSession()` tries to refresh it,
 * fails with a retryable network error and returns no session, although the
 * refresh token is still stored (the library keeps it for the next try). The
 * app then uses this stored session so the person stays signed in on their
 * cached bands, and the library refreshes it once the network is back.
 */
export function parseStoredSession(raw: string | null | undefined): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Session> | null;
    // Older library versions wrapped it as { currentSession }.
    const s = (value && 'currentSession' in value ? (value as { currentSession?: Partial<Session> }).currentSession : value) ?? null;
    if (!s || typeof s.refresh_token !== 'string' || !s.refresh_token) return null;
    if (!s.user || typeof s.user.id !== 'string' || !s.user.id) return null;
    return s as Session;
  } catch {
    return null;
  }
}

/** True for a failure that says nothing about the session (no network, server unreachable). */
export function isOfflineAuthError(error: unknown, online = typeof navigator === 'undefined' ? true : navigator.onLine): boolean {
  if (!online) return true;
  const e = error as { name?: unknown; status?: unknown } | null | undefined;
  return !!e && (e.name === 'AuthRetryableFetchError' || e.status === 0);
}
