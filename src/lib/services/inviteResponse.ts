import { supabase } from '@/lib/supabase';
import { t } from '@/lib/i18n';
import { respondToEventInvite } from './events';

/** The answer was not saved; the message is translated and safe to show. */
export class InviteResponseError extends Error {}

/**
 * Records the signed-in user's own answer to an event invite (notification
 * RSVP sheet, inbox Going / Can't make it). Throws InviteResponseError when
 * nothing was saved (offline, removed from the event, event deleted), so the
 * caller neither tells the admins nor shows the answer as sent.
 */
export const respondToOwnInvite = async (
  eventId: string,
  userId: string,
  status: 'confirmed' | 'declined'
): Promise<void> => {
  const { data: membership, error } = await supabase
    .from('event_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new InviteResponseError(t('Could not send your RSVP. Please try again.'));
  if (!membership) throw new InviteResponseError(t('You are no longer on this event, so there is nothing to answer.'));
  const { data, error: saveError } = await respondToEventInvite(membership.id, status);
  if (saveError || !data) throw new InviteResponseError(t('Could not send your RSVP. Please try again.'));
};
