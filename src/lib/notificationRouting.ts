/**
 * Where a notification leads. Shared by push taps and the in-app inbox so both
 * open the same screen. The result is the `detail` of the `push-navigate`
 * window event handled in AuthenticatedApp.
 */
export type NotificationTarget =
  | { screen: 'chat'; chatId: string }
  | { screen: 'event'; eventId?: string }
  | { screen: 'quotes' }
  | { screen: 'finance' }
  | { screen: 'invites' }
  | { screen: 'bandMembers' }
  | { screen: 'repertoire' };

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined;

/** The screen a notification opens, or null when it has no screen of its own. */
export function notificationTarget(
  type: string | undefined | null,
  data?: Record<string, unknown> | null
): NotificationTarget | null {
  const t = String(type || data?.type || '');
  const d = data || {};
  const chatId = str(d.chatId) || str(d.chat_id);
  const eventId = str(d.eventId) || str(d.event_id);

  if (t === 'chat_message' || t === 'chat_mention') {
    return chatId ? { screen: 'chat', chatId } : null;
  }
  if (
    t.startsWith('event_') ||
    t.startsWith('gig_') ||
    t === 'member_dropped_out' ||
    t === 'setlist_updated' ||
    t === 'rehearsal_reminder' ||
    t === 'rehearsal_poll_finalized'
  ) {
    return { screen: 'event', eventId };
  }
  if (t === 'rehearsal_poll' || t === 'rehearsal_proposal') return { screen: 'event' };
  if (t.startsWith('quote_')) return { screen: 'quotes' };
  if (t.startsWith('payment_')) return { screen: 'finance' };
  if (t === 'invite_received' || t === 'band_invite') return { screen: 'invites' };
  if (t === 'song_added') return { screen: 'repertoire' };
  if (t === 'member_joined' || t === 'member_left') {
    // Someone removed from a band can no longer open its member list.
    return d.removed ? null : { screen: 'bandMembers' };
  }
  return null;
}

/** Button label for the detail page's "open" action. */
export function notificationTargetLabel(target: NotificationTarget): string {
  switch (target.screen) {
    case 'chat':
      return 'Open chat';
    case 'event':
      return target.eventId ? 'Open event' : 'Open calendar';
    case 'quotes':
      return 'Open quotes';
    case 'finance':
      return 'Open finance';
    case 'invites':
      return 'View invite';
    case 'bandMembers':
      return 'Open members';
    case 'repertoire':
      return 'Open repertoire';
  }
}

/** The band a notification belongs to (column or payload), if any. */
export function notificationBandId(n: { band_id?: string | null; data?: Record<string, unknown> | null }): string | undefined {
  return (n.band_id || str(n.data?.band_id) || str(n.data?.bandId)) ?? undefined;
}

/**
 * Opens the target. `bandId` is the band the notification belongs to: when it
 * isn't the active band, the app asks whether to switch first.
 */
export function navigateToNotificationTarget(target: NotificationTarget | null, bandId?: string): void {
  const detail = target ? { ...target, ...(bandId ? { bandId } : {}) } : { screen: 'home' };
  window.dispatchEvent(new CustomEvent('push-navigate', { detail }));
}
