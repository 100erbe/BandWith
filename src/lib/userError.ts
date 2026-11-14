/**
 * Errors shown to people: never the raw text from Postgres, PostgREST or
 * Storage (English, technical: "new row violates row-level security
 * policy"). Known cases get a translated message, anything else the
 * caller's translated fallback; the raw message goes to the console.
 */
import { t } from './i18n';

/** An error whose message is already written (and translated) for people. */
export class UserError extends Error {
  readonly userFacing = true;
}

const isUserError = (e: unknown): e is UserError => !!e && typeof e === 'object' && (e as { userFacing?: unknown }).userFacing === true;

/** `[known reason]` or the fallback, translated. */
export function userMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (isUserError(error)) return error.message;
  const e = error as { message?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
  const msg = typeof e.message === 'string' ? e.message : '';
  const code = String(e.code ?? '');
  const status = Number(e.status ?? e.statusCode ?? 0);
  if (msg) console.warn('[BandWith]', msg);
  // "Could not delete the song" → "Could not delete the song. <reason>"
  fallback = /[.!?…]$/.test(fallback) ? fallback : `${fallback}.`;
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|offline/i.test(msg)) {
    return `${fallback} ${t('Check your connection and try again.')}`;
  }
  if (code === '42501' || status === 401 || status === 403 || /row-level security|permission denied|not authori[sz]ed|only band admins/i.test(msg)) {
    return `${fallback} ${t('Only band admins can do this.')}`;
  }
  if (status === 413 || /maximum allowed size|payload too large|too large/i.test(msg)) {
    return `${fallback} ${t('This file is too large.')}`;
  }
  if (/mime type|invalid_mime|not supported/i.test(msg)) {
    return `${fallback} ${t('This file type is not supported.')}`;
  }
  return `${fallback} ${t('Try again.')}`;
}
