import { supabase } from '../supabase';

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
  // Quotes
  | 'quote_received'
  | 'quote_accepted'
  | 'quote_declined'
  | 'quote_expired'
  // Payments
  | 'payment_received'
  | 'payment_due'
  | 'payment_overdue'
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
  action_label?: string;
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
  if (type.startsWith('event_') || type.startsWith('rehearsal_')) return 'events';
  if (type.startsWith('quote_') || type.startsWith('payment_')) return 'finance';
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
    // Payments
    payment_received: 'dollar-sign',
    payment_due: 'credit-card',
    payment_overdue: 'alert-circle',
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
    return '#22C55E'; // Green
  }
  if (type.includes('declined') || type.includes('cancelled') || type.includes('expired') || type.includes('overdue')) {
    return '#EF4444'; // Red
  }
  if (type.includes('reminder') || type.includes('due') || type.includes('pending')) {
    return '#F59E0B'; // Amber
  }
  if (type.includes('invite') || type.includes('joined')) {
    return '#D4FB46'; // Brand green
  }
  return '#6B7280'; // Gray
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
    const { data: { user } } = await supabase.auth.getUser();
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

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getUnreadCount = async (): Promise<{ data: number | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
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

// Determine if a notification type should trigger a push
const shouldSendPush = (type: NotificationType): boolean => {
  const pushTypes: NotificationType[] = [
    // High priority - requires action
    'invite_received',
    'event_invite',
    'quote_received',
    'task_assigned',
    // High priority - time-sensitive
    'event_reminder',
    'rehearsal_reminder',
    'payment_due',
    'payment_overdue',
    // Medium priority - important updates
    'event_confirmed',
    'quote_accepted',
    'payment_received',
    'member_joined', // Interessante sapere chi si è unito
    // Chat - real-time
    'chat_message',
    'chat_mention',
  ];
  return pushTypes.includes(type);
};

// Send push notification via Edge Function
const sendPushNotification = async (
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> => {
  try {
    // Convert data to string values for push payload
    const pushData: Record<string, string> = {};
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        pushData[key] = String(value);
      });
    }
    
    await supabase.functions.invoke('send-push', {
      body: {
        user_ids: userIds,
        title,
        body: body || '',
        data: pushData,
      },
    });
  } catch (error) {
    // Don't fail the notification if push fails
    console.error('Failed to send push notification:', error);
  }
};

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
    action_label?: string;
  },
  options?: { sendPush?: boolean }
): Promise<{ data: Notification | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        ...notification,
      })
      .select()
      .single();

    if (error) throw error;

    // Send push notification if applicable
    const shouldPush = options?.sendPush !== false && shouldSendPush(notification.type);
    if (shouldPush && data) {
      sendPushNotification(
        [userId],
        notification.title,
        notification.body || '',
        { ...notification.data, notification_id: data.id, type: notification.type }
      );
    }

    return { data, error: null };
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
    action_label?: string;
  }>,
  options?: { sendPush?: boolean }
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) throw error;

    // Send push notifications if applicable
    // Group by type to avoid sending multiple pushes for the same message
    if (options?.sendPush !== false && notifications.length > 0) {
      const firstNotif = notifications[0];
      if (shouldSendPush(firstNotif.type)) {
        const userIds = notifications.map(n => n.user_id);
        sendPushNotification(
          userIds,
          firstNotif.title,
          firstNotif.body || '',
          { ...firstNotif.data, type: firstNotif.type }
        );
      }
    }

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
  // Get current user to filter notifications
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) {
      console.log('[Notifications] No user for subscription');
      return;
    }
    
    console.log('[Notifications] Subscribing to realtime for user:', user.id);
  });

  const channel = supabase
    .channel('notifications-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      async (payload) => {
        const notification = payload.new as Notification;
        // Check if this notification is for the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user && notification.user_id === user.id) {
          console.log('[Notifications] Realtime INSERT received:', notification.title);
          callback(notification);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
      },
      async (payload) => {
        if (onUpdate) {
          const notification = payload.new as Notification;
          const { data: { user } } = await supabase.auth.getUser();
          if (user && notification.user_id === user.id) {
            console.log('[Notifications] Realtime UPDATE received:', notification.id);
            onUpdate(notification);
          }
        }
      }
    )
    .subscribe((status) => {
      console.log('[Notifications] Subscription status:', status);
    });

  return () => {
    console.log('[Notifications] Unsubscribing from realtime');
    channel.unsubscribe();
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
    action_label: 'View Pending Invites',
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
    action_label: 'View Band',
  }).then(r => ({ error: r.error }));
};

export const notifyMemberJoined = async (
  bandMemberIds: string[],
  bandId: string,
  bandName: string,
  newMemberName: string
): Promise<{ error: Error | null }> => {
  const notifications = bandMemberIds.map(userId => ({
    user_id: userId,
    type: 'member_joined' as NotificationType,
    title: 'New Band Member',
    body: `${newMemberName} has joined ${bandName}`,
    band_id: bandId,
    data: { member_name: newMemberName, band_name: bandName },
  }));
  return createBulkNotifications(notifications);
};

// Event notifications
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
    body: `${eventTitle} on ${new Date(eventDate).toLocaleDateString()}`,
    band_id: bandId,
    data: { event_id: eventId, event_title: eventTitle, event_date: eventDate },
    action_label: 'RSVP',
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
    action_label: 'View Event',
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
    body: `${clientName} requested a quote for €${amount.toLocaleString()}`,
    band_id: bandId,
    data: { quote_id: quoteId, client_name: clientName, amount },
    action_label: 'Review Quote',
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
    body: `${eventTitle} confirmed for €${amount.toLocaleString()}`,
    band_id: bandId,
    data: { quote_id: quoteId, event_title: eventTitle, amount },
  }));
  return createBulkNotifications(notifications);
};

// Payment notifications
export const notifyPaymentReceived = async (
  memberIds: string[],
  bandId: string,
  amount: number,
  eventTitle?: string
): Promise<{ error: Error | null }> => {
  const notifications = memberIds.map(userId => ({
    user_id: userId,
    type: 'payment_received' as NotificationType,
    title: 'Payment Received',
    body: eventTitle 
      ? `€${amount.toLocaleString()} received for ${eventTitle}`
      : `€${amount.toLocaleString()} received`,
    band_id: bandId,
    data: { amount, event_title: eventTitle },
  }));
  return createBulkNotifications(notifications);
};

// Task notifications
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
    action_label: 'View Task',
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
    action_label: 'Reply',
  }).then(r => ({ error: r.error }));
};

// ============================================
// EVENT NOTIFICATIONS (Unified for all event types)
// ============================================

// Event type configurations for notifications
type EventTypeConfig = {
  emoji: string;
  label: string;
  requiresRsvp: boolean;
};

const EVENT_TYPE_CONFIG: Record<string, EventTypeConfig> = {
  rehearsal: { emoji: '🎵', label: 'Rehearsal', requiresRsvp: true },
  gig: { emoji: '🎸', label: 'Gig', requiresRsvp: true },
  wedding: { emoji: '💒', label: 'Wedding Gig', requiresRsvp: true },
  corporate: { emoji: '🏢', label: 'Corporate Event', requiresRsvp: true },
  private: { emoji: '🎤', label: 'Private Event', requiresRsvp: true },
  festival: { emoji: '🎪', label: 'Festival', requiresRsvp: true },
  other: { emoji: '📅', label: 'Event', requiresRsvp: true },
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
    fee?: number;
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
        .eq('band_id', bandId);
      
      if (membersError) throw membersError;
      userIds = members?.map(m => m.user_id).filter(id => id !== creatorId) || [];
    }
    
    if (userIds.length === 0) return { error: null };
    
    // Get event type config
    const config = EVENT_TYPE_CONFIG[eventType] || EVENT_TYPE_CONFIG.other;
    
    // Format date for display
    const dateObj = new Date(eventDate);
    const formattedDate = dateObj.toLocaleDateString('it-IT', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
    
    // Build notification body based on event type
    let body = `${creatorName} scheduled "${eventTitle}" for ${formattedDate} at ${eventTime}.`;
    if (additionalData?.venue) {
      body += ` @ ${additionalData.venue}`;
    }
    if (additionalData?.fee && eventType !== 'rehearsal') {
      body += ` | €${additionalData.fee.toLocaleString()}`;
    }
    if (config.requiresRsvp) {
      body += ' Confirm your availability.';
    }
    
    // Create notifications for invited members
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type: 'event_invite' as NotificationType,
      title: `${config.emoji} New ${config.label}`,
      body,
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
        fee: additionalData?.fee,
        requires_rsvp: config.requiresRsvp,
      },
      action_label: config.requiresRsvp ? 'RSVP Now' : 'View Event',
      primary_action: 'accept' as NotificationAction,
      secondary_action: 'decline' as NotificationAction,
      read: false,
    }));
    
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (insertError) throw insertError;
    
    // Send push notifications
    await sendPushNotification(
      userIds,
      `${config.emoji} New ${config.label}`,
      `${creatorName} scheduled "${eventTitle}" for ${formattedDate}`,
      { event_id: eventId, type: 'event_invite', event_type: eventType }
    );
    
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
        action_label: 'View Status',
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
    
    const responseEmoji = {
      confirmed: '✓',
      declined: '✗',
      tentative: '?'
    };
    
    const responseText = {
      confirmed: `${memberName} confirmed for "${eventTitle}"`,
      declined: `${memberName} declined "${eventTitle}"${alternativeDate ? ` (proposed: ${alternativeDate})` : ''}`,
      tentative: `${memberName} is tentative for "${eventTitle}"`
    };
    
    const notifications = adminIds.map(adminId => ({
      user_id: adminId,
      type: 'event_confirmed' as NotificationType,
      title: `${responseEmoji[response]} ${config.label} RSVP`,
      body: responseText[response],
      band_id: bandId,
      data: { 
        event_id: eventId, 
        event_title: eventTitle,
        event_type: eventType,
        member_name: memberName,
        response,
        alternative_date: alternativeDate,
      },
      read: false,
    }));
    
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (error) throw error;
    
    // Send push for declined responses (important to know)
    if (response === 'declined') {
      await sendPushNotification(
        adminIds,
        `${responseEmoji[response]} RSVP Declined`,
        responseText[response],
        { event_id: eventId, type: 'event_confirmed', response }
      );
    }
    
    return { error: null };
  } catch (error: any) {
    console.error('Error notifying admins of response:', error);
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
    let body = '';

    switch (type) {
      case 'chat_message':
        title = `💬 ${data.senderName || 'New message'}`;
        body = data.content?.substring(0, 100) || 'New message';
        break;
      case 'event_created':
        title = '🎸 New Event';
        body = data.eventTitle || 'A new event has been created';
        break;
      case 'event_invite':
        title = '🎵 Event Invitation';
        body = `You're invited to "${data.eventTitle}"`;
        break;
      case 'member_joined':
        title = '👋 New Member';
        body = `${data.memberName || 'Someone'} joined the band`;
        break;
      default:
        title = data.title || 'BandWith';
        body = data.body || data.content || 'New notification';
    }

    // Call the Edge Function
    console.log('[sendPushToUsers] Calling Edge Function with:', { user_ids: userIds, title, body });
    
    const { data: result, error } = await supabase.functions.invoke('send-push', {
      body: {
        user_ids: userIds,
        title,
        body,
        data: { type, ...data },
      },
    });

    if (error) {
      console.error('[sendPushToUsers] Edge function error:', error);
      console.error('[sendPushToUsers] Error details:', JSON.stringify(error, null, 2));
      
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

    console.log('[sendPushToUsers] Push sent successfully:', result);
    return { success: true, error: null };
  } catch (error: any) {
    console.error('[sendPushToUsers] Error:', error);
    return { success: false, error };
  }
};
