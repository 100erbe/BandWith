import { supabase, getSafeUser } from '@/lib/supabase';
import { t } from '@/lib/i18n';

/**
 * Personal privacy preferences, stored on the user's own profile row in
 * `profiles.privacy` (jsonb, migration 056_profile_privacy.sql).
 *
 * - hidePersonalGigDetails: bands see the user as busy on a personal gig's
 *   date, without its title or venue.
 *
 * Until migration 056 is applied the column doesn't exist: loading then
 * reports `unavailable` instead of pretending a value was saved.
 */
export interface PrivacyPrefs {
  hidePersonalGigDetails: boolean;
}

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  hidePersonalGigDetails: false,
};

export type PrivacyPrefsLoad =
  | { status: 'ready'; prefs: PrivacyPrefs }
  | { status: 'unavailable' }
  | { status: 'error'; error: Error };

export const PRIVACY_UNAVAILABLE_MESSAGE =
  'Privacy settings aren’t available on this server yet. Try again after the next update.';

/** The message above in the app language (English: the same text). */
const privacyUnavailableMessage = () =>
  t('Privacy settings aren’t available on this server yet. Try again after the next update.');

type PgLikeError = { code?: string; message?: string } | null | undefined;

/** Postgres 42703 / PostgREST PGRST204: the `privacy` column isn't there. */
export const isMissingPrivacyColumn = (error: PgLikeError): boolean => {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return /privacy/i.test(error.message || '') && /column/i.test(error.message || '');
};

const toError = (e: unknown, fallback: string): Error =>
  e instanceof Error ? e : new Error((e as { message?: string })?.message || fallback);

export const parsePrivacyPrefs = (raw: unknown): PrivacyPrefs => {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    hidePersonalGigDetails:
      typeof obj.hidePersonalGigDetails === 'boolean'
        ? obj.hidePersonalGigDetails
        : DEFAULT_PRIVACY_PREFS.hidePersonalGigDetails,
  };
};

export const loadPrivacyPrefs = async (): Promise<PrivacyPrefsLoad> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) return { status: 'error', error: new Error('Not signed in') };
    const { data, error } = await supabase
      .from('profiles')
      .select('privacy')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      if (isMissingPrivacyColumn(error)) return { status: 'unavailable' };
      return { status: 'error', error: toError(error, t('Could not load privacy settings')) };
    }
    return { status: 'ready', prefs: parsePrivacyPrefs(data?.privacy) };
  } catch (e) {
    return { status: 'error', error: toError(e, t('Could not load privacy settings')) };
  }
};

export const savePrivacyPref = async <K extends keyof PrivacyPrefs>(
  key: K,
  value: PrivacyPrefs[K]
): Promise<{ error: Error | null; unavailable?: boolean }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not signed in');
    const { data: current, error: readError } = await supabase
      .from('profiles')
      .select('privacy')
      .eq('id', user.id)
      .maybeSingle();
    if (readError) {
      if (isMissingPrivacyColumn(readError)) {
        return { error: new Error(privacyUnavailableMessage()), unavailable: true };
      }
      throw readError;
    }
    const existing =
      current?.privacy && typeof current.privacy === 'object' ? (current.privacy as Record<string, unknown>) : {};
    const merged = { ...existing, [key]: value };
    const { error } = await supabase.from('profiles').update({ privacy: merged }).eq('id', user.id);
    if (error) {
      if (isMissingPrivacyColumn(error)) {
        return { error: new Error(privacyUnavailableMessage()), unavailable: true };
      }
      throw error;
    }
    return { error: null };
  } catch (e) {
    return { error: toError(e, t('Could not save privacy settings')) };
  }
};
