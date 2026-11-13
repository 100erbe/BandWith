/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and Fingerprint authentication
 */

import { Capacitor } from '@capacitor/core';
import { 
  BiometricAuth, 
  BiometryType,
  type CheckBiometryResult 
} from '@aparajita/capacitor-biometric-auth';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { t } from '@/lib/i18n';

const CREDENTIALS_KEY = 'bandwith_auth_credentials';
const WEB_TEST_KEY = 'bandwith_auth_biometric_web_test';

/**
 * Simple key-based obfuscation for credentials in localStorage.
 * Not cryptographically secure — use platform secure storage in production.
 */
function obfuscate(data: string): string {
  const key = 'BandWith2026';
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function deobfuscate(encoded: string): string {
  const key = 'BandWith2026';
  const raw = atob(encoded);
  let result = '';
  for (let i = 0; i < raw.length; i++) {
    result += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/**
 * Native: credentials live in the iOS Keychain / Android Keystore, readable
 * only while the device is unlocked and never synced to iCloud. Web (dev
 * test only): obfuscated localStorage. Older builds kept the native copy in
 * localStorage too; it is moved to secure storage on first read.
 */
const readStoredCredentials = async (): Promise<string | null> => {
  if (!Capacitor.isNativePlatform()) return localStorage.getItem(CREDENTIALS_KEY);
  const legacy = localStorage.getItem(CREDENTIALS_KEY);
  if (legacy) {
    try {
      await SecureStorage.set(CREDENTIALS_KEY, legacy, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
      localStorage.removeItem(CREDENTIALS_KEY);
    } catch (err) {
      console.warn('[Biometric] Could not migrate stored credentials:', err);
      return legacy;
    }
  }
  try {
    const value = await SecureStorage.get(CREDENTIALS_KEY);
    return typeof value === 'string' ? value : null;
  } catch (err) {
    console.warn('[Biometric] Secure storage read failed:', err);
    return null;
  }
};

const writeStoredCredentials = async (value: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    localStorage.setItem(CREDENTIALS_KEY, value);
    return;
  }
  await SecureStorage.set(CREDENTIALS_KEY, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  localStorage.removeItem(CREDENTIALS_KEY);
};

const removeStoredCredentials = async (): Promise<void> => {
  localStorage.removeItem(CREDENTIALS_KEY);
  if (Capacitor.isNativePlatform()) {
    try {
      await SecureStorage.remove(CREDENTIALS_KEY);
    } catch {
      // nothing stored
    }
  }
};

/**
 * What quick sign-in keeps on the device (PR-41, PR-42): the Supabase refresh
 * token of the account, never the password, tied to that account's id and
 * email. Older builds stored { email, password }; that record is read once
 * more and replaced right after the next successful sign-in.
 */
interface StoredSession {
  v: 2;
  userId: string;
  email: string;
  refreshToken: string;
}
interface LegacyCredentials {
  email: string;
  password: string;
}

export type QuickSignIn =
  | { kind: 'session'; userId: string; email: string; refreshToken: string }
  | { kind: 'password'; email: string; password: string };

/** The minimum of a Supabase session quick sign-in needs. */
export interface SessionLike {
  refresh_token?: string | null;
  user?: { id: string; email?: string | null } | null;
}

const decodeRecord = (stored: string | null): StoredSession | LegacyCredentials | null => {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(deobfuscate(stored));
    if (parsed?.v === 2 && parsed.userId && parsed.refreshToken) return parsed as StoredSession;
    if (parsed?.email && parsed?.password) return parsed as LegacyCredentials;
  } catch {
    // corrupt
  }
  return null;
};

const encodeSession = (session: SessionLike): string | null => {
  const userId = session.user?.id;
  const refreshToken = session.refresh_token;
  if (!userId || !refreshToken) return null;
  const record: StoredSession = { v: 2, userId, email: (session.user?.email || '').toLowerCase(), refreshToken };
  return obfuscate(JSON.stringify(record));
};

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'faceId' | 'touchId' | 'fingerprint' | 'iris' | 'none';
  hasCredentials: boolean;
  /** Account quick sign-in belongs to (shown under the button). */
  email?: string;
  isWebTest?: boolean;
}

export interface BiometricOptions {
  /** Allow testing the biometric flow in web/browser (no actual hardware). Default false. */
  allowWebTest?: boolean;
}

/** Face ID / fingerprint only: no fallback to the device passcode (PR-41). */
const authenticate = (reason: string) =>
  BiometricAuth.authenticate({ reason, allowDeviceCredential: false });

/**
 * Check if biometric authentication is available on the device.
 * On native: queries the actual biometric hardware.
 * On web with allowWebTest: simulates availability if credentials exist.
 */
export const checkBiometricAvailability = async (
  options?: BiometricOptions
): Promise<BiometricStatus> => {
  const isNative = Capacitor.isNativePlatform();
  const allowWebTest = options?.allowWebTest ?? false;

  // Web/browser: optionally allow testing the biometric flow
  if (!isNative) {
    if (allowWebTest) {
      const record = decodeRecord(localStorage.getItem(CREDENTIALS_KEY));
      return {
        isAvailable: true,
        biometryType: 'fingerprint',
        hasCredentials: !!record,
        email: record?.email?.toLowerCase(),
        isWebTest: true,
      };
    }
    return { isAvailable: false, biometryType: 'none', hasCredentials: false };
  }

  try {
    let isAvailable = false;
    let biometryType: BiometricStatus['biometryType'] = 'none';

    try {
      const result: CheckBiometryResult = await BiometricAuth.checkBiometry();
      isAvailable = result.isAvailable;

      switch (result.biometryType) {
        case BiometryType.faceId:
          biometryType = 'faceId';
          break;
        case BiometryType.touchId:
          biometryType = 'touchId';
          break;
        case BiometryType.fingerprintAuthentication:
          biometryType = 'fingerprint';
          break;
        case BiometryType.irisAuthentication:
          biometryType = 'iris';
          break;
      }
    } catch (innerError) {
      // BUG FIX: On some Android devices checkBiometry() throws even though
      // hardware is present and working. Instead of calling checkBiometry()
      // again (which will also throw), assume biometric is available.
      console.warn(
        '[Biometric] checkBiometry threw, assuming device has biometric hardware:',
        innerError
      );
      isAvailable = true;
      biometryType = 'fingerprint'; // safe default for Android
    }

    // Check if we have stored credentials
    const record = decodeRecord(await readStoredCredentials());
    const hasCredentials = !!record;

    // BUG FIX: If credentials exist but biometric says unavailable, log warning
    if (hasCredentials && !isAvailable) {
      console.warn(
        '[Biometric] Stored credentials found but biometric hardware not detected — ' +
        'user may have enrolled after credential save, or hardware state changed.'
      );
    }

    return {
      isAvailable,
      biometryType,
      hasCredentials,
      email: record?.email?.toLowerCase(),
    };
  } catch (error) {
    console.error('[Biometric] Availability check failed:', error);
    return { isAvailable: false, biometryType: 'none', hasCredentials: false };
  }
};

/**
 * Get the display name for the biometry type
 */
export const getBiometryDisplayName = (type: BiometricStatus['biometryType']): string => {
  switch (type) {
    case 'faceId':
      return 'Face ID';
    case 'touchId':
      return 'Touch ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris';
    default:
      return 'Biometric';
  }
};

/**
 * Turns on quick sign-in for the signed-in account: after a Face ID /
 * fingerprint check, keeps its refresh token (not the password).
 */
export const saveSessionForBiometric = async (
  session: SessionLike,
  options?: BiometricOptions
): Promise<boolean> => {
  const isNative = Capacitor.isNativePlatform();
  const allowWebTest = options?.allowWebTest ?? false;
  if (!isNative && !allowWebTest) return false;

  const encoded = encodeSession(session);
  if (!encoded) return false;
  try {
    if (isNative) await authenticate(t('Confirm it’s you to turn on quick sign-in'));
    await writeStoredCredentials(encoded);
    return true;
  } catch (error) {
    console.warn('[Biometric] Quick sign-in not turned on:', error);
    return false;
  }
};

/**
 * Keeps the stored refresh token current. Supabase rotates it on every
 * refresh, so this runs on each SIGNED_IN / TOKEN_REFRESHED. It only touches
 * the record of the same account (or turns an old password record of the
 * same email into a token record). No biometric prompt.
 */
export const updateStoredSession = async (session: SessionLike | null | undefined): Promise<void> => {
  if (!session?.user?.id || !session.refresh_token) return;
  try {
    const record = decodeRecord(await readStoredCredentials());
    if (!record) return;
    const sameAccount = 'v' in record
      ? record.userId === session.user.id
      : record.email.toLowerCase() === (session.user.email || '').toLowerCase();
    if (!sameAccount) return;
    if ('v' in record && record.refreshToken === session.refresh_token) return;
    const encoded = encodeSession(session);
    if (encoded) await writeStoredCredentials(encoded);
  } catch {
    // keep the old record
  }
};

/** Account that quick sign-in belongs to, without a biometric prompt. */
export const getQuickSignInOwner = async (): Promise<{ userId?: string; email: string } | null> => {
  const record = decodeRecord(await readStoredCredentials());
  if (!record) return null;
  return 'v' in record ? { userId: record.userId, email: record.email } : { email: record.email.toLowerCase() };
};

/**
 * After a Face ID / fingerprint check, what to sign in with: the stored
 * refresh token (or, once, an old build's saved password).
 */
export const getQuickSignIn = async (
  reason?: string,
  options?: BiometricOptions
): Promise<QuickSignIn | null> => {
  const isNative = Capacitor.isNativePlatform();
  const allowWebTest = options?.allowWebTest ?? false;
  if (!isNative && !allowWebTest) return null;

  try {
    if (isNative) await authenticate(reason || t('Sign in to BandWith'));
  } catch {
    return null; // cancelled or failed
  }
  const stored = await readStoredCredentials();
  const record = decodeRecord(stored);
  if (!record) {
    if (stored) await removeStoredCredentials();
    return null;
  }
  return 'v' in record
    ? { kind: 'session', userId: record.userId, email: record.email, refreshToken: record.refreshToken }
    : { kind: 'password', email: record.email, password: record.password };
};

/**
 * Delete stored biometric credentials
 */
export const deleteBiometricCredentials = async (): Promise<boolean> => {
  try {
    await removeStoredCredentials();
    console.log('[Biometric] Credentials deleted successfully');
    return true;
  } catch (error) {
    console.error('[Biometric] Failed to delete credentials:', error);
    return false;
  }
};

/**
 * Check if biometric login is enabled (has stored credentials)
 */
export const isBiometricLoginEnabled = async (
  options?: BiometricOptions
): Promise<boolean> => {
  const status = await checkBiometricAvailability(options);
  return status.isAvailable && status.hasCredentials;
};