import { describe, it, expect, beforeEach } from 'vitest';
import { authErrorKind, authErrorMessage } from '../authErrors';
import { parseStoredSession, isOfflineAuthError } from '../authSession';
import { setLocalePref } from '../i18n';

describe('auth errors in the app language', () => {
  beforeEach(() => setLocalePref('en'));

  it('reads the error code first', () => {
    expect(authErrorKind({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('invalid_credentials');
    expect(authErrorKind({ code: 'email_not_confirmed' })).toBe('email_not_confirmed');
    expect(authErrorKind({ code: 'over_email_send_rate_limit' })).toBe('rate_limit');
    expect(authErrorKind({ code: 'same_password' })).toBe('same_password');
    expect(authErrorKind({ code: 'weak_password' })).toBe('weak_password');
    expect(authErrorKind({ code: 'user_already_exists' })).toBe('already_registered');
    expect(authErrorKind({ code: 'otp_expired' })).toBe('link_expired');
  });

  it('falls back on the kind of error and its message', () => {
    expect(authErrorKind({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })).toBe('network');
    expect(authErrorKind(new TypeError('Load failed'))).toBe('network');
    expect(authErrorKind({ message: 'For security purposes, you can only request this after 52 seconds.' })).toBe('rate_limit');
    expect(authErrorKind({ message: 'User already registered' })).toBe('already_registered');
    expect(authErrorKind({ status: 500, message: 'Database error saving new user' })).toBe('unknown');
    expect(authErrorKind(null)).toBe('unknown');
  });

  it('never shows the server text', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('Wrong email or password.');
    expect(authErrorMessage({ message: 'Database error saving new user' })).toBe('Something went wrong. Please try again.');
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe('Check your connection and try again.');
  });

  it('translates', () => {
    setLocalePref('it');
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Email o password errata.');
  });
});

describe('stored session (offline start)', () => {
  const session = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'u1', email: 'leo@example.com' } };

  it('reads the session the library keeps on the device', () => {
    expect(parseStoredSession(JSON.stringify(session))?.user.id).toBe('u1');
    expect(parseStoredSession(JSON.stringify({ currentSession: session }))?.refresh_token).toBe('r');
  });

  it('ignores anything that cannot resume a session', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('{bad json')).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...session, refresh_token: '' }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...session, user: null }))).toBeNull();
  });

  it('only trusts it for network failures', () => {
    expect(isOfflineAuthError({ name: 'AuthRetryableFetchError', status: 0 }, true)).toBe(true);
    expect(isOfflineAuthError({ name: 'AuthApiError', status: 400 }, false)).toBe(true);
    expect(isOfflineAuthError({ name: 'AuthApiError', status: 400 }, true)).toBe(false);
    expect(isOfflineAuthError(null, true)).toBe(false);
  });
});
