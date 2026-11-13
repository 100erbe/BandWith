import { supabase, getSafeUser } from '../supabase';
import { parseLocalDate } from '@/lib/dates';
import { getActiveSymbol } from '@/lib/currency';

// Types
export type NotificationType =
  // Invites
  | 'invite_sent'
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'invite_expired'
  // Events
  | 'event_created'
  | 'event_invite'
  | 'event_reminder'
  | 'event_update'
  | 'event_cancelled'
  | 'event_confirmed'
  | 'member_dropped_out'
  // A deputy answered from the reply link (migration 084)
  | 'deputy_reply'
  // A deputy opened the app from their link (086): to the band's admins
  | 'deputy_joined'
  // To a deputy with the app (086): a band asks them, or their gig changed
  | 'deputy_request'
  | 'deputy_gig_changed'
  // Quotes
  | 'quote_received'
  | 'quote_accepted'
  | 'quote_declined'
  | 'quote_expired'
  // The client opened or wrote on the quote page (migration 099)
  | 'quote_viewed'
  | 'quote_message'
  // Payments
  | 'payment_received'
  | 'payment_due'
  | 'payment_overdue'
  // Your own fee on an event changed (migration 068)
  | 'fee_changed'
  // Members
  | 'member_joined'
  | 'member_left'
  | 'member_role_changed'
  // Content
  | 'song_added'
  | 'setlist_updated'
  | 'task_assigned'
  | 'task_completed'
  // Rehearsal
  | 'rehearsal_reminder'
  | 'rehearsal_notes_added'
  | 'rehearsal_proposal'
  | 'rehearsal_poll'
  | 'rehearsal_poll_finalized'
  // Chat
  | 'chat_message'
  | 'chat_mention'
  // System
  | 'system'
  | 'custom';

// Priority levels for notifications
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

// Action types for quick actions
export type NotificationAction = 
  | 'view'
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'complete'
  | 'dismiss';

export interface Notification {
  id: string;
  user_id: string;
  band_id?: string;
  
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  
  read: boolean;
  read_at?: string;
  archived?: boolean;
  
  // Actions
  action_url?: string;
  primary_action?: NotificationAction;
  secondary_action?: NotificationAction;
  
  // Metadata
  priority?: NotificationPriority;
  expires_at?: string;
  reference_id?: string; // ID of related entity (invite, event, etc.)
  reference_type?: string; // Type of related entity
  
  created_at: string;
}

// Notification category for UI grouping
export type NotificationCategory = 'invites' | 'events' | 'finance' | 'members' | 'content' | 'system';

// Get category from notification type
export const getNotificationCategory = (type: NotificationType): NotificationCategory => {
  if (type.startsWith('invite_')) return 'invites';
  if (type.startsWith('event_') || type.startsWith('rehearsal_') || type.startsWith('deputy_')) return 'events';
  if (type.startsWith('quote_') || type.startsWith('payment_') || type === 'fee_changed') return 'finance';
  if (type.startsWith('member_')) return 'members';
  if (type.startsWith('song_') || type.startsWith('setlist_') || type.startsWith('task_')) return 'content';
  return 'system';
};

// Get icon for notification type
export const getNotificationIcon = (type: NotificationType): string => {
  const icons: Record<string, string> = {
    // Invites
    invite_sent: 'send',
    invite_received: 'user-plus',
    invite_accepted: 'check-circle',
    invite_declined: 'x-circle',
    invite_expired: 'clock',
    // Events
    event_invite: 'calendar-plus',
    event_reminder: 'bell',
    event_update: 'calendar',
    event_cancelled: 'calendar-x',
    event_confirmed: 'calendar-check',
    // Quotes
    quote_received: 'file-text',
    quote_accepted: 'check',
    quote_declined: 'x',
    quote_expired: 'clock',
    quote_viewed: 'eye',
    quote_message: 'message-circle',
    // Payments
    payment_received: 'dollar-sign',
    payment_due: 'credit-card',
    payment_overdue: 'alert-circle',
    fee_changed: 'dollar-sign',
    // Members
    member_joined: 'user-plus',
    member_left: 'user-minus',
    member_role_changed: 'shield',
    // Content
    song_added: 'music',
    setlist_updated: 'list-music',
    task_assigned: 'clipboard',
    task_completed: 'check-square',
    // Rehearsal
    rehearsal_reminder: 'clock',
    rehearsal_notes_added: 'file-text',
    rehearsal_proposal: 'help-circle',
    rehearsal_poll: 'check-square',
    rehearsal_poll_finalized: 'calendar-check',
    // Chat
    chat_message: 'message-circle',
    chat_mention: 'at-sign',
    // System
    system: 'info',
    custom: 'bell',
  };
  return icons[type] || 'bell';
};

// Get color for notification type
export const getNotificationColor = (type: NotificationType): string => {
  if (type.includes('accepted') || type.includes('confirmed') || type.includes('completed') || type.includes('received')) {
    return 'var(--success)'; // Green
  }
  if (type.includes('declined') || type.includes('cancelled') || type.includes('expired') || type.includes('overdue')) {
    return 'var(--destructive)'; // Red
  }
  if (type.includes('reminder') || type.includes('due') || type.includes('pending')) {
    return 'var(--amber)'; // Amber
  }
  if (type.includes('invite') || type.includes('joined')) {
    return 'var(--accent)'; // Brand green
  }
  return 'var(--muted-fg)'; // Gray
};

// ============================================
// NOTIFICATIONS CRUD
// ============================================

export const getNotifications = async (options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ data: Notification[] | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.eq('read', false);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Deduplicate notifications (e.g. if push edge function and app both inserted an invite for the same event)
    const deduped: Notification[] = [];
    const seenEventInvites = new Set<string>();

    for (const notif of data || []) {
      const eventId = notif.data?.event_id as string | undefined;
      if (notif.type === 'event_invite' && eventId) {
        if (seenEventInvites.has(eventId)) {
          continue;
        }
        seenEventInvites.add(eventId);
      }
      deduped.push(notif);
    }

    return { data: deduped, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getUnreadCount = async (): Promise<{ data: number | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) throw error;

    return { data: count || 0, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const markAsRead = async (notificationId: string): Promise<{ error: Error | null }> => {
  try {
    console.log('[Notifications] Marking as read:', notificationId);
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      console.error('[Notifications] Mark as read error:', error);
      throw error;
    }

    console.log('[Notifications] Marked as read successfully');
    return { error: null };
  } catch (error: any) {
    console.error('[Notifications] Mark as read exception:', error);
    return { error };
  }
};

export const markAllAsRead = async (): Promise<{ error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// Mark all chat notifications for a specific chat as read
export const markChatNotificationsAsRead = async (chatId: string): Promise<{ error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    // Find and update all unread chat_message notifications for this chat
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('type', 'chat_message')
      .eq('read', false)
      .contains('data', { chat_id: chatId });

    if (error) throw error;

    console.log('[Notifications] Marked chat notifications as read for chat:', chatId);
    return { error: null };
  } catch (error: any) {
    console.warn('[Notifications] Error marking chat notifications as read:', error);
    return { error };
  }
};

export const deleteNotification = async (notificationId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const deleteAllNotifications = async (): Promise<{ error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// PUSH NOTIFICATION LOGIC
// ============================================

// Push is sent by the database (migration 046): every new notification row of a
// push-worthy type triggers the `send-push` edge function server-side. The app
// only writes rows; `sendPush: false` marks a row so the server skips the push.
const withPushFlag = <T extends { data?: Record<string, unknown> }>(n: T, sendPush?: boolean): T =>
  sendPush === false ? { ...n, data: { ...(n.data || {}), skip_push: true } } : n;

// ============================================
// CREATE NOTIFICATIONS (Internal use)
// ============================================

export const createNotification = async (
  userId: string,
  notification: {
    type: NotificationType;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    band_id?: string;
    action_url?: string;
    },
  options?: { sendPush?: boolean }
): Promise<{ data: Notification | null; error: Error | null }> => {
  try {
    // No `.select()`: reading the row back needs SELECT rights on it, and a
    // notification for someone else (e.g. a member alerting the band admin)
    // is only readable by its recipient, so the insert failed RLS.
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        ...withPushFlag(notification, options?.sendPush),
      });

    if (error) throw error;

    return { data: null, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const createBulkNotifications = async (
  notifications: Array<{
    user_id: string;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    band_id?: string;
    action_url?: string;
    }>,
  options?: { sendPush?: boolean }
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications.map((n) => withPushFlag(n, options?.sendPush)));

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// REALTIME SUBSCRIPTION
// ============================================

export const subscribeToNotifications = (
  callback: (notification: Notification) => void,
  onUpdate?: (notification: Notification) => void
) => {
  // Subscribe only once the user is known, with a server-side filter, so the
  // client never receives other users' notification rows.
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  getSafeUser().then(({ data: { user } }) => {
    if (cancelled || !user) return;
    const filter = `user_id=eq.${user.id}`;
    channel = supabase
      .channel(`notifications-realtime-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter },
        (payload) => {
          const notification = payload.new as Notification;
          if (notification.user_id === user.id) callback(notification);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter },
        (payload) => {
          const notification = payload.new as Notification;
          if (onUpdate && notification.user_id === user.id) onUpdate(notification);
        }
      )
      .subscribe();
  });

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
};

// ============================================
// ARCHIVE NOTIFICATIONS
// ============================================

export const archiveNotification = async (notificationId: string): Promise<{ error: Error | null }> => {
  try {
    // Mark as read (archived column is optional enhancement)
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// NOTIFICATION HELPERS - Create specific notifications
// ============================================

// Invite notifications
export const notifyInviteSent = async (
  adminUserId: string,
  bandId: string,
  bandName: string,
  inviteeEmail: string,
  options?: {
    inviteId?: string;
    role?: 'admin' | 'member';
    inviterName?: string;
  }
): Promise<{ error: Error | null }> => {
  return createNotification(adminUserId, {
    type: 'invite_sent',
    title: 'Invite Sent',
    body: `Invitation sent to ${inviteeEmail} to join ${bandName}`,
    band_id: bandId,
    data: { 
      invitee_email: inviteeEmail, 
      band_name: bandName,
      invite_id: options?.inviteId,
      role: options?.role || 'member',
      inviter_name: options?.inviterName,
      sent_at: new Date().toISOString(),
    },
  }).then(r => ({ error: r.error }));
};

export const notifyInviteAccepted = async (
  adminUserId: string,
  bandId: string,
  bandName: string,
  newMemberName: string
): Promise<{ error: Error | null }> => {
  return createNotification(adminUserId, {
    type: 'invite_accepted',
    title: 'Invite Accepted!',
    body: `${newMemberName} has joined ${bandName}`,
    band_id: bandId,
    data: { member_name: newMemberName, band_name: bandName },
  }).then(r => ({ error: r.error }));
};

export const notifyEventCreated = async (
  memberIds: string[],
  bandId: string,
  eventId: string,
  eventTitle: string,
  eventDate: string,
  eventType: 'gig' | 'rehearsal'
): Promise<{ error: Error | null }> => {
  const notifications = memberIds.map(userId => ({
    user_id: userId,
    type: (eventType === 'rehearsal' ? 'rehearsal_reminder' : 'event_invite') as NotificationType,
    title: eventType === 'rehearsal' ? 'New Rehearsal' : 'New Gig',
    body: `${eventTitle} on ${parseLocalDate(eventDate).toLocaleDateString()}`,
    band_id: bandId,
    data: { event_id: eventId, event_title: eventTitle, event_date: eventDate },
  }));
  return createBulkNotifications(notifications);
};

export const notifyEventReminder = async (
  memberIds: string[],
  bandId: string,
  eventId: string,
  eventTitle: string,
  hoursUntil: number
): Promise<{ error: Error | null }> => {
  const timeText = hoursUntil <= 1 ? 'in 1 hour' : hoursUntil <= 24 ? `in ${hoursUntil} hours` : 'tomorrow';
  const notifications = memberIds.map(userId => ({
    user_id: userId,
    type: 'event_reminder' as NotificationType,
    title: 'Event Reminder',
    body: `${eventTitle} starts ${timeText}`,
    band_id: bandId,
    data: { event_id: eventId, hours_until: hoursUntil },
  }));
  return createBulkNotifications(notifications);
};

// Quote notifications
export const notifyQuoteReceived = async (
  adminUserId: string,
  bandId: string,
  quoteId: string,
  clientName: string,
  amount: number
): Promise<{ error: Error | null }> => {
  return createNotification(adminUserId, {
    type: 'quote_received',
    title: 'New Quote Request',
    body: `${clientName} requested a quote for ${getActiveSymbol()}${amount.toLocaleString()}`,
    band_id: bandId,
    data: { quote_id: quoteId, client_name: clientName, amount },
  }).then(r => ({ error: r.error }));
};

export const notifyQuoteAccepted = async (
  memberIds: string[],
  bandId: string,
  quoteId: string,
  eventTitle: string,
  amount: number
): Promise<{ error: Error | null }> => {
  const notifications = memberIds.map(userId => ({
    user_id: userId,
    type: 'quote_accepted' as NotificationType,
    title: 'Quote Accepted!',
    body: `${eventTitle} confirmed for ${getActiveSymbol()}${amount.toLocaleString()}`,
    band_id: bandId,
    data: { quote_id: quoteId, event_title: eventTitle, amount },
  }));
  return createBulkNotifications(notifications);
};

export const notifyTaskAssigned = async (
  userId: string,
  bandId: string,
  taskId: string,
  taskTitle: string,
  assignedBy: string
): Promise<{ error: Error | null }> => {
  return createNotification(userId, {
    type: 'task_assigned',
    title: 'Task Assigned',
    body: `${assignedBy} assigned you: "${taskTitle}"`,
    band_id: bandId,
    data: { task_id: taskId, task_title: taskTitle, assigned_by: assignedBy },
  }).then(r => ({ error: r.error }));
};

// Chat notifications
export const notifyNewMessage = async (
  userId: string,
  bandId: string,
  chatId: string,
  senderName: string,
  messagePreview: string
): Promise<{ error: Error | null }> => {
  return createNotification(userId, {
    type: 'chat_message',
    title: senderName,
    body: messagePreview.substring(0, 100) + (messagePreview.length > 100 ? '...' : ''),
    band_id: bandId,
    data: { chat_id: chatId, sender_name: senderName },
  }).then(r => ({ error: r.error }));
};

// ============================================
// EVENT NOTIFICATIONS (Unified for all event types)
// ============================================

// Event type configurations for notifications
type EventTypeConfig = {
  label: string;
  requiresRsvp: boolean;
};

const EVENT_TYPE_CONFIG: Record<string, EventTypeConfig> = {
  rehearsal: { label: 'Rehearsal', requiresRsvp: true },
  gig: { label: 'Gig', requiresRsvp: true },
  wedding: { label: 'Wedding Gig', requiresRsvp: true },
  corporate: { label: 'Corporate Event', requiresRsvp: true },
  private: { label: 'Private Event', requiresRsvp: true },
  festival: { label: 'Festival', requiresRsvp: true },
  other: { label: 'Event', requiresRsvp: true },
};

// Unified notification for all event types
export const notifyEventMembersCreated = async (
  bandId: string,
  eventId: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  eventType: string,
  creatorId: string,
  creatorName: string,
  invitedMemberIds?: string[], // If empty, notify all band members
  additionalData?: {
    venue?: string;
    memberFees?: Record<string, number>;
    /** The fee is still to be discussed ("Fee TBD"). */
    feeTbd?: boolean;
    /** Quote stage: asks for availability before the client confirms. */
    tentative?: boolean;
  }
): Promise<{ error: Error | null }> => {
  try {
    // Get members to notify
    let userIds: string[] = [];
    
    if (invitedMemberIds && invitedMemberIds.length > 0) {
      userIds = invitedMemberIds.filter(id => id !== creatorId);
    } else {
      // Get all band members
      const { data: members, error: membersError } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId)
        .eq('is_active', true);
      
      if (membersError) throw membersError;
      userIds = members?.map(m => m.user_id).filter(id => id !== creatorId) || [];
    }
    
    if (userIds.length === 0) return { error: null };
    
    // Get event type config
    const config = EVENT_TYPE_CONFIG[eventType] || EVENT_TYPE_CONFIG.other;
    
    // Format date for display
    const dateObj = parseLocalDate(eventDate);
    const formattedDate = dateObj.toLocaleDateString('it-IT', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
    
    // Build per-member notification body (shows their personal fee, not total)
    const tentative = !!additionalData?.tentative;
    const buildBody = (userId: string) => {
      let b = tentative
        ? `${creatorName} is quoting "${eventTitle}" for ${formattedDate} at ${eventTime}. Not confirmed yet: the client hasn't accepted.`
        : `${creatorName} scheduled "${eventTitle}" for ${formattedDate} at ${eventTime}.`;
      if (additionalData?.venue) b += ` @ ${additionalData.venue}`;
      const personalFee = additionalData?.memberFees?.[userId];
      if (additionalData?.feeTbd && eventType !== 'rehearsal') {
        b += ' | Fee: to be discussed';
      } else if (personalFee && personalFee > 0 && eventType !== 'rehearsal') {
        b += ` | Your fee: ${getActiveSymbol()}${personalFee.toLocaleString()}`;
      }
      if (tentative) b += ' Are you available?';
      else if (config.requiresRsvp) b += ' Confirm your availability.';
      return b;
    };
    
    // Create notifications for invited members (each with their own member_fee and body)
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type: 'event_invite' as NotificationType,
      title: tentative ? `Availability check: ${eventTitle}` : `New ${config.label}`,
      body: buildBody(userId),
      band_id: bandId,
      data: { 
        event_id: eventId, 
        event_title: eventTitle,
        event_date: eventDate,
        event_time: eventTime,
        event_type: eventType,
        creator_id: creatorId,
        creator_name: creatorName,
        venue: additionalData?.venue,
        // Only the recipient's own fee: members never see the gig total.
        member_fee: additionalData?.memberFees?.[userId] ?? undefined,
        requires_rsvp: tentative || config.requiresRsvp,
        ...(tentative ? { tentative: true } : {}),
        ...(additionalData?.feeTbd ? { fee_tbd: true } : {}),
      },
      primary_action: 'accept' as NotificationAction,
      secondary_action: 'decline' as NotificationAction,
      read: false,
    }));
    
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (insertError) throw insertError;
    
    
    return { error: null };
  } catch (error: any) {
    console.error('Error notifying event members:', error);
    return { error };
  }
};

// Notify creator that event is pending confirmations
export const notifyEventPendingConfirmations = async (
  creatorId: string,
  bandId: string,
  eventId: string,
  eventTitle: string,
  eventType: string,
  invitedCount: number
): Promise<{ error: Error | null }> => {
  try {
    const config = EVENT_TYPE_CONFIG[eventType] || EVENT_TYPE_CONFIG.other;
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: creatorId,
        type: 'event_created' as NotificationType,
        title: `${config.label} Created`,
        body: `"${eventTitle}" is pending. Waiting for ${invitedCount} member${invitedCount > 1 ? 's' : ''} to confirm.`,
        band_id: bandId,
        data: { 
          event_id: eventId, 
          event_title: eventTitle,
          event_type: eventType,
          pending_confirmations: invitedCount,
        },
        read: false,
      });
    
    if (error) throw error;
    
    return { error: null };
  } catch (error: any) {
    console.error('Error notifying event creator:', error);
    return { error };
  }
};

// Notify admin when a member responds to an event
export const notifyEventResponse = async (
  adminIds: string[],
  bandId: string,
  eventId: string,
  eventTitle: string,
  eventType: string,
  memberName: string,
  response: 'confirmed' | 'declined' | 'tentative',
  alternativeDate?: string
): Promise<{ error: Error | null }> => {
  try {
    const config = EVENT_TYPE_CONFIG[eventType] || EVENT_TYPE_CONFIG.other;
    
    const responseTitle = {
      confirmed: `${config.label} Confirmed`,
      declined: `${config.label} Declined`,
      tentative: `${config.label} Tentative`
    };
    
    const responseText = {
      confirmed: `${memberName} confirmed for "${eventTitle}"`,
      declined: `${memberName} dropped out of "${eventTitle}"${alternativeDate ? ` (proposed: ${alternativeDate})` : ''}`,
      tentative: `${memberName} is tentative for "${eventTitle}"`
    };
    
    const notifType: NotificationType = response === 'declined' ? 'member_dropped_out' : 'event_confirmed';
    const tag = response === 'declined' ? 'Gig Alert' : 'Gig RSVP';
    const subtitle = `${config.label} · ${eventTitle}`;

    const notifications = adminIds.map(adminId => ({
      user_id: adminId,
      type: notifType,
      title: responseTitle[response],
      body: responseText[response],
      band_id: bandId,
      data: { 
        event_id: eventId, 
        event_title: eventTitle,
        event_type: eventType,
        member_name: memberName,
        response,
        alternative_date: alternativeDate,
        subtitle,
        tag,
      },
      read: false,
    }));
    
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (error) throw error;
    
    
    return { error: null };
  } catch (error: any) {
    console.error('Error notifying admins of response:', error);
    return { error };
  }
};

// Explicit notification when a band member drops out of a gig
export const notifyMemberDroppedOut = async (
  bandId: string,
  eventId: string,
  eventTitle: string,
  eventDate: string | undefined,
  memberName: string,
  memberUserId: string
): Promise<{ error: Error | null }> => {
  try {
    const adminUserIds = new Set<string>();

    // 1. Fetch band admins
    if (bandId) {
      const { data: bandAdmins } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId)
        .eq('role', 'admin')
        .eq('is_active', true);

      (bandAdmins || []).forEach((a: any) => {
        if (a.user_id && a.user_id !== memberUserId) {
          adminUserIds.add(a.user_id);
        }
      });
    }

    // 2. Fetch event creator
    if (eventId) {
      const { data: ev } = await supabase
        .from('events')
        .select('created_by')
        .eq('id', eventId)
        .maybeSingle();

      if (ev?.created_by && ev.created_by !== memberUserId) {
        adminUserIds.add(ev.created_by);
      }
    }

    const recipients = Array.from(adminUserIds);
    if (recipients.length === 0) return { error: null };

    const title = `${memberName} dropped out`;
    const subtitle = `Gig Alert · ${eventTitle}`;
    const dateFormatted = eventDate ? ` on ${eventDate}` : '';
    const body = `${memberName} dropped out of "${eventTitle}"${dateFormatted}. Roster replacement needed.`;

    // 3. Create in-app notification in database
    const notifications = recipients.map(adminId => ({
      user_id: adminId,
      type: 'member_dropped_out' as NotificationType,
      title,
      body,
      band_id: bandId,
      data: {
        event_id: eventId,
        event_title: eventTitle,
        event_date: eventDate,
        member_name: memberName,
        subtitle,
        tag: 'Gig Alert',
      },
      read: false,
    }));

    await supabase.from('notifications').insert(notifications);


    return { error: null };
  } catch (error: any) {
    console.error('Error notifying admins of member dropout:', error);
    return { error };
  }
};

// ============================================
// LEGACY WRAPPERS (for backward compatibility)
// ============================================

// Wrapper for rehearsal notifications (backward compatible)
export const notifyRehearsalCreated = async (
  bandId: string,
  eventId: string,
  rehearsalTitle: string,
  rehearsalDate: string,
  rehearsalTime: string,
  creatorId: string,
  creatorName: string,
  invitedMemberIds?: string[]
): Promise<{ error: Error | null }> => {
  return notifyEventMembersCreated(
    bandId,
    eventId,
    rehearsalTitle,
    rehearsalDate,
    rehearsalTime,
    'rehearsal',
    creatorId,
    creatorName,
    invitedMemberIds
  );
};

// Wrapper for rehearsal pending confirmations (backward compatible)
export const notifyRehearsalPendingConfirmations = async (
  creatorId: string,
  bandId: string,
  eventId: string,
  rehearsalTitle: string,
  invitedCount: number
): Promise<{ error: Error | null }> => {
  return notifyEventPendingConfirmations(
    creatorId,
    bandId,
    eventId,
    rehearsalTitle,
    'rehearsal',
    invitedCount
  );
};

// Wrapper for rehearsal response (backward compatible)
export const notifyRehearsalResponse = async (
  adminIds: string[],
  bandId: string,
  eventId: string,
  rehearsalTitle: string,
  memberName: string,
  response: 'confirmed' | 'declined' | 'tentative',
  alternativeDate?: string
): Promise<{ error: Error | null }> => {
  return notifyEventResponse(
    adminIds,
    bandId,
    eventId,
    rehearsalTitle,
    'rehearsal',
    memberName,
    response,
    alternativeDate
  );
};

// Notify all band members (except optionally one user)
export const notifyBandMembers = async (
  bandId: string,
  notification: {
    type: NotificationType;
    title: string;
    body: string;
    band_id?: string;
    data?: Record<string, unknown>;
    excludeUserId?: string;
  }
): Promise<{ error: Error | null }> => {
  try {
    // Get all band members
    const { data: members, error: membersError } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('is_active', true);
    
    if (membersError) throw membersError;
    if (!members || members.length === 0) return { error: null };
    
    // Filter out the excluded user and create notifications
    const userIds = members
      .map(m => m.user_id)
      .filter(id => id !== notification.excludeUserId);
    
    if (userIds.length === 0) return { error: null };
    
    // Create notifications for all members
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      band_id: bandId,
      data: notification.data,
      read: false,
    }));
    
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (insertError) throw insertError;
    
    return { error: null };
  } catch (error: any) {
    console.error('Error notifying band members:', error);
    return { error };
  }
};

/**
 * In-app (Inbox only, no push) note to the rest of the band that a song was
 * added to the repertoire, or suggested by a member for the admins to review.
 */
export const notifySongAdded = async (
  bandId: string,
  song: { id?: string; title: string; artist?: string },
  opts: { suggested: boolean; byName?: string }
): Promise<{ error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    const { data: members, error: membersError } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('is_active', true);
    if (membersError) throw membersError;
    const userIds = (members || []).map((m) => m.user_id).filter((id) => id && id !== user?.id);
    if (userIds.length === 0) return { error: null };
    const who = opts.byName?.trim() || 'A bandmate';
    const label = song.artist ? `"${song.title}" by ${song.artist}` : `"${song.title}"`;
    return createBulkNotifications(
      userIds.map((user_id) => ({
        user_id,
        type: 'song_added' as const,
        title: opts.suggested ? 'Song suggested' : 'New song in the repertoire',
        body: opts.suggested
          ? `${who} suggested ${label}. Admins can move it to Learning or Ready.`
          : `${who} added ${label}.`,
        band_id: bandId,
        data: { song_id: song.id, band_id: bandId, suggested: opts.suggested },
      })),
      { sendPush: false }
    );
  } catch (error: any) {
    console.error('Error notifying song added:', error);
    return { error };
  }
};

// Send push notifications to specific users via Edge Function
export const sendPushToUsers = async (
  userIds: string[],
  type: NotificationType,
  data: Record<string, any>
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    if (!userIds || userIds.length === 0) {
      return { success: true, error: null };
    }

    // Create notification content based on type
    let title = 'BandWith';
    let subtitle = data.subtitle || '';
    let tag = data.tag || '';
    let channelId = data.channel_id || 'bandwith_general';
    let body = '';

    switch (type) {
      case 'chat_message':
        title = data.senderName || 'New message';
        const isDirect = data.chatType === 'direct' || !data.band_id;
        subtitle = data.subtitle || (isDirect ? 'Private Message' : (data.bandName || 'Band Chat'));
        tag = isDirect ? 'Direct Message' : 'Band Message';
        channelId = 'bandwith_messages';
        body = data.content?.substring(0, 120) || 'New message';
        break;
      case 'chat_mention':
        title = data.senderName ? `${data.senderName} mentioned you` : 'You were mentioned';
        subtitle = data.bandName || 'Band Chat';
        tag = 'Mention';
        channelId = 'bandwith_messages';
        body = data.content?.substring(0, 120) || 'You were mentioned in chat';
        break;
      case 'event_invite':
        title = 'Gig Invitation';
        subtitle = data.bandName || data.venue || 'New Gig';
        tag = 'Gig Invitation';
        channelId = 'bandwith_events';
        body = data.eventTitle ? `You're invited to "${data.eventTitle}"` : (data.body || 'You have a new gig invitation');
        break;
      case 'member_dropped_out':
        title = `${data.memberName || 'Member'} dropped out`;
        subtitle = `Gig Alert · ${data.eventTitle || 'Event'}`;
        tag = 'Gig Alert';
        channelId = 'bandwith_events';
        body = data.body || `${data.memberName || 'A member'} dropped out of "${data.eventTitle || 'the gig'}". Roster action needed.`;
        break;
      case 'event_confirmed':
        title = `${data.memberName || 'Member'} confirmed`;
        subtitle = `Gig RSVP · ${data.eventTitle || 'Event'}`;
        tag = 'Gig RSVP';
        channelId = 'bandwith_events';
        body = data.body || `${data.memberName || 'Member'} confirmed attendance.`;
        break;
      case 'event_cancelled':
        title = 'Gig Cancelled';
        subtitle = data.eventTitle || 'Event Update';
        tag = 'Gig Alert';
        channelId = 'bandwith_events';
        body = `"${data.eventTitle || 'Event'}" has been cancelled.`;
        break;
      case 'event_reminder':
        title = 'Call Time Reminder';
        subtitle = data.eventTitle || 'Upcoming Gig';
        tag = 'Reminder';
        channelId = 'bandwith_events';
        body = data.body || `Reminder: "${data.eventTitle || 'Gig'}" is scheduled soon.`;
        break;
      case 'quote_accepted':
        title = 'Booking Confirmed!';
        subtitle = data.eventTitle || data.bandName || 'Finance';
        tag = 'Booking Confirmed';
        channelId = 'bandwith_finance';
        body = data.body || `Client accepted quote for "${data.eventTitle || 'event'}"`;
        break;
      case 'payment_received':
        title = 'Payment Received';
        subtitle = data.eventTitle || data.bandName || 'Finance';
        tag = 'Payment';
        channelId = 'bandwith_finance';
        body = data.body || `Payment processed for "${data.eventTitle || 'event'}"`;
        break;
      case 'invite_received':
        title = 'Band Invitation';
        subtitle = data.bandName || 'New Band';
        tag = 'Band Invitation';
        channelId = 'bandwith_general';
        body = `You've been invited to join ${data.bandName || 'a new band'}`;
        break;
      default:
        title = data.title || 'BandWith';
        subtitle = data.subtitle || '';
        tag = data.tag || 'Alert';
        body = data.body || data.content || 'New notification';
    }

    // Call the Edge Function
    
    const { data: result, error } = await supabase.functions.invoke('send-push', {
      body: {
        user_ids: userIds,
        title,
        subtitle,
        tag,
        channel_id: channelId,
        body,
        data: { type, subtitle, tag, channel_id: channelId, ...data },
      },
    });

    if (error) {
      console.error('[sendPushToUsers] Edge function error:', error);
      
      // Try to get more info
      if ('context' in error && error.context) {
        try {
          const text = await error.context.text?.();
          console.error('[sendPushToUsers] Response body:', text);
        } catch (e) {
          // ignore
        }
      }
      
      return { success: false, error: new Error(error.message || 'Edge function failed') };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('[sendPushToUsers] Error:', error);
    return { success: false, error };
  }
};
