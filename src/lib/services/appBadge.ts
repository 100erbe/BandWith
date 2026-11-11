import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

type BadgeHandler = { postMessage: (n: number) => void };

let lastCount: number | null = null;

/**
 * Keeps the app icon in line with the unread notifications. Pushes set the
 * iOS badge from the server and nothing used to lower it again, so the icon
 * kept showing "1" after everything was read.
 * - iOS: the number on the icon (native bridge `bwBadge`).
 * - iOS and Android: with nothing unread, the delivered notifications leave
 *   Notification Center / the shade, which also clears Android's launcher dot.
 */
export function syncAppBadge(count: number): void {
  if (!Capacitor.isNativePlatform()) return;
  const n = Math.max(0, Math.floor(count || 0));
  const handler = (window as unknown as { webkit?: { messageHandlers?: { bwBadge?: BadgeHandler } } }).webkit
    ?.messageHandlers?.bwBadge;
  try {
    handler?.postMessage(n);
  } catch {
    /* older native shell */
  }
  if (n === 0) {
    void PushNotifications.removeAllDeliveredNotifications().catch(() => {});
    void LocalNotifications.removeAllDeliveredNotifications().catch(() => {});
  }
  lastCount = n;
}

/** Re-applies the last count (the app came back to the foreground). */
export function resyncAppBadge(): void {
  if (lastCount !== null) syncAppBadge(lastCount);
}
