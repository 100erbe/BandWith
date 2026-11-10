import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Haptic feedback on native (official @capacitor/haptics plugin) with a
 * navigator.vibrate fallback on the web. Every call is fire-and-forget and
 * never throws. Respects prefers-reduced-motion: users who ask for less motion
 * get no web vibration either.
 */
const isNative = () => Capacitor.isNativePlatform();

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const vibrate = (pattern: number | number[]) => {
  if (prefersReducedMotion()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
};

const run = (native: () => Promise<void>, web: number | number[]) => {
  if (isNative()) {
    native().catch(() => {});
  } else {
    vibrate(web);
  }
};

export const haptic = {
  /** Subtle tap: nav items, tabs, small triggers. */
  tap: () => run(() => Haptics.impact({ style: ImpactStyle.Light }), 10),

  /** Medium impact: sheets opening, primary actions. */
  medium: () => run(() => Haptics.impact({ style: ImpactStyle.Medium }), 20),

  /** Success: event created, changes saved, RSVP accepted. */
  confirm: () => run(() => Haptics.notification({ type: NotificationType.Success }), [15, 60, 25]),

  /** Destructive or warning: delete, cancel, decline. */
  delete: () => run(() => Haptics.notification({ type: NotificationType.Warning }), [30, 50, 30]),

  /** Selection tick: toggles, step pads, pickers. */
  selection: () => run(() => Haptics.selectionChanged(), 5),
};
