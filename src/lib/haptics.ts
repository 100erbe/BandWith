import { registerPlugin, Capacitor } from '@capacitor/core';

interface BandWithHapticsPlugin {
  impact(options?: { style?: 'light' | 'medium' | 'heavy' }): Promise<void>;
  notification(options?: { type?: 'success' | 'warning' | 'error' | 'delete' }): Promise<void>;
  selection(): Promise<void>;
}

const NativeHaptics = registerPlugin<BandWithHapticsPlugin>('BandWithHaptics');

/**
 * Haptic feedback utility providing subtle native tactile feedback on mobile devices,
 * with graceful web API fallbacks.
 */
export const haptic = {
  /**
   * Subtle tap - ideal for navbar items, tabs, small action triggers
   */
  tap: () => {
    if (Capacitor.isNativePlatform()) {
      NativeHaptics.impact({ style: 'light' }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch (_) {}
    }
  },

  /**
   * Medium impact - for noticeable user interactions like modals opening or primary actions
   */
  medium: () => {
    if (Capacitor.isNativePlatform()) {
      NativeHaptics.impact({ style: 'medium' }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch (_) {}
    }
  },

  /**
   * Success confirmation - for event creation, saving changes, RSVP accept
   */
  confirm: () => {
    if (Capacitor.isNativePlatform()) {
      NativeHaptics.notification({ type: 'success' }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([15, 60, 25]);
      } catch (_) {}
    }
  },

  /**
   * Destructive or warning action - for deleting events, cancelling, decline
   */
  delete: () => {
    if (Capacitor.isNativePlatform()) {
      NativeHaptics.notification({ type: 'delete' }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([30, 50, 30]);
      } catch (_) {}
    }
  },

  /**
   * Selection tick - for scroll wheels, toggle switches
   */
  selection: () => {
    if (Capacitor.isNativePlatform()) {
      NativeHaptics.selection().catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(5);
      } catch (_) {}
    }
  },
};
