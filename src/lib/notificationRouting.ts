import { t } from '@/lib/i18n';
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
  | { screen: 'repertoire' }
  // The account's requests as a deputy for other bands (migration 086).
  | { screen: 'deputyGigs'; requestId?: string };

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : undefined;

/** The screen a notification opens, or null when it has no screen of its own. */
export function notificationTarget(
  type: string | undefined | null,
  data?: Record<string, unknown> | null
): NotificationTarget | null {
  const kind = String(type || data?.type || '');
  const d = data || {};
  const chatId = str(d.chatId) || str(d.chat_id);
  const eventId = str(d.eventId) || str(d.event_id);

  // Pushes to a deputy: not their band, so they open their deputy gigs.
  if (kind === 'deputy_request' || kind === 'deputy_gig_changed') {
    const requestId = str(d.deputy_request_id) || str(d.deputyRequestId);
    return requestId ? { screen: 'deputyGigs', requestId } : { screen: 'deputyGigs' };
  }
  if (kind === 'chat_message' || kind === 'chat_mention') {
    return chatId ? { screen: 'chat', chatId } : null;
  }
  if (
    kind.startsWith('event_') ||
    kind.startsWith('gig_') ||
    kind === 'member_dropped_out' ||
    kind === 'deputy_reply' ||
    kind === 'deputy_joined' ||
    kind === 'setlist_updated' ||
    kind === 'rehearsal_reminder' ||
    kind === 'rehearsal_poll_finalized'
  ) {
    return { screen: 'event', eventId };
  }
  if (kind === 'rehearsal_poll' || kind === 'rehearsal_proposal') return { screen: 'event' };
  if (kind.startsWith('quote_')) return { screen: 'quotes' };
  if (kind.startsWith('payment_')) return { screen: 'finance' };
  if (kind === 'invite_received' || kind === 'band_invite') return { screen: 'invites' };
  if (kind === 'song_added') return { screen: 'repertoire' };
  if (kind === 'member_joined' || kind === 'member_left') {
    // Someone removed from a band can no longer open its member list.
    return d.removed ? null : { screen: 'bandMembers' };
  }
  return null;
}

/** Button label for the detail page's "open" action. */
export function notificationTargetLabel(target: NotificationTarget): string {
  switch (target.screen) {
    case 'chat':
      return t('Open chat');
    case 'event':
      return target.eventId ? t('Open event') : t('Open calendar');
    case 'quotes':
      return t('Open quotes');
    case 'finance':
      return t('Open finance');
    case 'invites':
      return t('View invite');
    case 'bandMembers':
      return t('Open members');
    case 'repertoire':
      return t('Open repertoire');
    case 'deputyGigs':
      return t('Open deputy gigs');
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
