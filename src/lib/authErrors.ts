import { t } from '@/lib/i18n';

/**
 * Sign-in, sign-up and password errors in the app's language. Supabase and
 * fetch errors are English and technical ("Invalid login credentials",
 * "Failed to fetch"), so they are never shown as they are: the error's code
 * (or its kind) picks a sentence, and anything unknown gets a generic one.
 */

type AnyError = { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null | undefined;

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limit'
  | 'same_password'
  | 'weak_password'
  | 'already_registered'
  | 'signup_disabled'
  | 'invalid_email'
  | 'link_expired'
  | 'network'
  | 'unknown';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** What went wrong, from the error's code first and its message only as a fallback. */
export function authErrorKind(error: unknown): AuthErrorKind {
  const e = error as AnyError;
  if (!e) return 'unknown';
  const code = str(e.code);
  const name = str(e.name);
  const message = str(e.message).toLowerCase();

  switch (code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rate_limit';
    case 'same_password':
      return 'same_password';
    case 'weak_password':
      return 'weak_password';
    case 'user_already_exists':
    case 'email_exists':
      return 'already_registered';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'signup_disabled';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'invalid_email';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
      return 'link_expired';
  }

  if (name === 'AuthRetryableFetchError' || e.status === 0) return 'network';
  if (/failed to fetch|load failed|network ?error|networkerror|fetch failed|offline/.test(message)) return 'network';
  if (message.includes('invalid login credentials')) return 'invalid_credentials';
  if (message.includes('email not confirmed')) return 'email_not_confirmed';
  if (message.includes('already registered')) return 'already_registered';
  if (/only request this after|rate limit|too many/.test(message)) return 'rate_limit';
  if (message.includes('should be different from the old password')) return 'same_password';
  if (/expired|invalid flow state|code verifier/.test(message)) return 'link_expired';
  if (e.status === 429) return 'rate_limit';
  return 'unknown';
}

/** A sentence for the user, in the app's language. Never the server's own text. */
export function authErrorMessage(error: unknown): string {
  switch (authErrorKind(error)) {
    case 'invalid_credentials':
      return t('Wrong email or password.');
    case 'email_not_confirmed':
      return t('Confirm your email first: open the link we sent you, then sign in.');
    case 'rate_limit':
      return t('Too many attempts. Wait a minute and try again.');
    case 'same_password':
      return t('Choose a password different from your current one.');
    case 'weak_password':
      return t('This password is too easy to guess. Choose a longer one.');
    case 'already_registered':
      return t('This email is already registered. Try signing in.');
    case 'signup_disabled':
      return t('New accounts can’t be created right now. Try again later.');
    case 'invalid_email':
      return t('Enter a valid email address.');
    case 'link_expired':
      return t('This link has expired or was already used. Ask for a new one.');
    case 'network':
      return t('Check your connection and try again.');
    default:
      return t('Something went wrong. Please try again.');
  }
}
