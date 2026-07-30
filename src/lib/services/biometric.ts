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

export interface BiometricCredentials {
  email: string;
  password: string;
}

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'faceId' | 'touchId' | 'fingerprint' | 'iris' | 'none';
  hasCredentials: boolean;
  isWebTest?: boolean;
}

export interface BiometricOptions {
  /** Allow testing the biometric flow in web/browser (no actual hardware). Default false. */
  allowWebTest?: boolean;
}

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
      const hasCredentials = !!localStorage.getItem(CREDENTIALS_KEY);
      return {
        isAvailable: true,
        biometryType: 'fingerprint',
        hasCredentials,
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
    const hasCredentials = !!localStorage.getItem(CREDENTIALS_KEY);

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
 * Save credentials securely for biometric access.
 * On native: verifies biometric first, then stores obfuscated credentials.
 * On web with allowWebTest: stores directly (for testing).
 */
export const saveCredentialsForBiometric = async (
  email: string,
  password: string,
  options?: BiometricOptions
): Promise<boolean> => {
  const isNative = Capacitor.isNativePlatform();
  const allowWebTest = options?.allowWebTest ?? false;

  if (!isNative && !allowWebTest) {
    console.log('[Biometric] Not on native platform, skipping credential save');
    return false;
  }

  try {
    // Verify biometric first before saving (native only)
    if (isNative) {
      await BiometricAuth.authenticate({
        reason: "Conferma la tua identità per abilitare l'accesso biometrico",
        allowDeviceCredential: true,
      });
    }

    // Store obfuscated credentials
    const credentials = obfuscate(JSON.stringify({ email, password }));
    localStorage.setItem(CREDENTIALS_KEY, credentials);

    console.log('[Biometric] Credentials saved successfully');
    return true;
  } catch (error) {
    console.error('[Biometric] Failed to save credentials:', error);
    return false;
  }
};

/**
 * Get stored credentials after biometric verification.
 * On native: requires biometric authentication first.
 * On web with allowWebTest: returns stored credentials without hardware check.
 */
export const getCredentialsWithBiometric = async (
  reason?: string,
  options?: BiometricOptions
): Promise<BiometricCredentials | null> => {
  const isNative = Capacitor.isNativePlatform();
  const allowWebTest = options?.allowWebTest ?? false;

  if (!isNative && !allowWebTest) {
    return null;
  }

  try {
    // Verify with biometric (native only)
    if (isNative) {
      await BiometricAuth.authenticate({
        reason: reason || 'Accedi con biometria',
        allowDeviceCredential: true,
      });
    }

    // Get stored credentials
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (!stored) {
      console.log('[Biometric] No stored credentials found');
      return null;
    }

    try {
      const credentials = JSON.parse(deobfuscate(stored));
      return {
        email: credentials.email,
        password: credentials.password,
      };
    } catch (parseError) {
      console.error('[Biometric] Failed to decode stored credentials:', parseError);
      // Corrupt storage — clean up
      localStorage.removeItem(CREDENTIALS_KEY);
      return null;
    }
  } catch (error: any) {
    console.log('[Biometric] Authentication cancelled or failed:', error);
    return null;
  }
};

/**
 * Delete stored biometric credentials
 */
export const deleteBiometricCredentials = async (): Promise<boolean> => {
  try {
    localStorage.removeItem(CREDENTIALS_KEY);
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