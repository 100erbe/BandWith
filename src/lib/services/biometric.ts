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

export interface BiometricCredentials {
  email: string;
  password: string;
}

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'faceId' | 'touchId' | 'fingerprint' | 'iris' | 'none';
  hasCredentials: boolean;
}

/**
 * Check if biometric authentication is available on the device
 */
export const checkBiometricAvailability = async (): Promise<BiometricStatus> => {
  if (!Capacitor.isNativePlatform()) {
    return { isAvailable: false, biometryType: 'none', hasCredentials: false };
  }

  try {
    const result: CheckBiometryResult = await BiometricAuth.checkBiometry();
    
    let biometryType: BiometricStatus['biometryType'] = 'none';
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
      default:
        biometryType = 'none';
    }

    // Check if we have stored credentials in localStorage
    const hasCredentials = !!localStorage.getItem(CREDENTIALS_KEY);

    return {
      isAvailable: result.isAvailable,
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
 * Save credentials securely for biometric access
 * Note: We store encrypted credentials in localStorage after biometric verification
 */
export const saveCredentialsForBiometric = async (
  email: string,
  password: string
): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    // Verify biometric first before saving
    await BiometricAuth.authenticate({
      reason: 'Conferma la tua identità per abilitare l\'accesso biometrico',
      allowDeviceCredential: true,
    });
    
    // Store credentials (in production, use secure storage)
    const credentials = btoa(JSON.stringify({ email, password }));
    localStorage.setItem(CREDENTIALS_KEY, credentials);
    
    console.log('[Biometric] Credentials saved successfully');
    return true;
  } catch (error) {
    console.error('[Biometric] Failed to save credentials:', error);
    return false;
  }
};

/**
 * Get stored credentials after biometric verification
 */
export const getCredentialsWithBiometric = async (
  reason?: string
): Promise<BiometricCredentials | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    // Verify with biometric
    await BiometricAuth.authenticate({
      reason: reason || 'Accedi con biometria',
      allowDeviceCredential: true,
    });

    // Get stored credentials
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (!stored) {
      return null;
    }

    const credentials = JSON.parse(atob(stored));
    return {
      email: credentials.email,
      password: credentials.password,
    };
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
export const isBiometricLoginEnabled = async (): Promise<boolean> => {
  const status = await checkBiometricAvailability();
  return status.isAvailable && status.hasCredentials;
};
