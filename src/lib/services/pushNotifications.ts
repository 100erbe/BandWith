/**
 * Push Notifications Service - iOS APNs + Android FCM
 * Based on the working implementation from BandOps Mobile App
 */

import { supabase } from '../supabase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getActiveChat } from './activeChatTracker';

// Cache the token to avoid re-registration issues
let cachedToken: string | null = null;

// Types
export interface PushNotificationToken {
  value: string;
}

export interface PushNotificationData {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

export interface PushNotificationListeners {
  onRegistration?: (token: PushNotificationToken) => void;
  onRegistrationError?: (error: any) => void;
  onPushReceived?: (notification: PushNotificationData) => void;
  onPushActionPerformed?: (notification: { notification: PushNotificationData; actionId: string }) => void;
}

// Check if we're running in native app
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Check if push notifications are supported
export const isPushSupported = (): boolean => {
  return isNative();
};

// Check current permission status
export const checkPushPermissions = async (): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> => {
  if (!isNative()) {
    return 'unavailable';
  }
  
  try {
    const result = await PushNotifications.checkPermissions();
    console.log('[Push] Permission check result:', result.receive);
    return result.receive as 'granted' | 'denied' | 'prompt';
  } catch (error) {
    console.error('[Push] Permission check error:', error);
    return 'unavailable';
  }
};

// Subscribe to push notifications
/**
 * iOS uses APNs directly. Android goes through Firebase Cloud Messaging and
 * is enabled only for builds made with VITE_ANDROID_PUSH=true (i.e. when
 * android/app/google-services.json is present).
 */
export const isRemotePushConfigured = (): boolean => {
  if (Capacitor.getPlatform() !== 'android') return true;
  return import.meta.env.VITE_ANDROID_PUSH === 'true';
};

export const subscribeToPush = async (userId: string): Promise<{ success: boolean; error: Error | null }> => {
  if (!userId) {
    return { success: false, error: new Error('User ID required') };
  }

  if (!isNative()) {
    console.log('[Push] Not on native platform');
    return { success: false, error: new Error('Not on native platform') };
  }

  if (!isRemotePushConfigured()) {
    // Android remote push needs Firebase (google-services.json). Without it
    // PushNotifications.register() crashes natively, so skip it; local
    // notifications keep working.
    console.log('[Push] Remote push not configured on this platform');
    return { success: false, error: new Error('Push not configured') };
  }

  try {
    console.log('[Push] Starting subscription for user:', userId);
    
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    console.log('[Push] Permission result:', permResult);
    
    if (permResult.receive !== 'granted') {
      return { success: false, error: new Error('Permission denied') };
    }

    // If we already have a cached token, just save it
    if (cachedToken) {
      console.log('[Push] Using cached token:', cachedToken.substring(0, 20) + '...');
      return await saveTokenToDatabase(userId, cachedToken);
    }

    // Wait for the token - set up listeners BEFORE calling register
    return new Promise((resolve) => {
      let resolved = false;
      let regHandle: any = null;
      let errHandle: any = null;

      const cleanup = () => {
        if (regHandle) {
          regHandle.remove().catch(() => {});
          regHandle = null;
        }
        if (errHandle) {
          errHandle.remove().catch(() => {});
          errHandle = null;
        }
      };

      const timeout = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        console.log('[Push] Registration timeout - checking DB');
        const exists = await checkExistingSubscription(userId);
        if (exists) {
          resolve({ success: true, error: null });
        } else {
          resolve({ success: false, error: new Error('Registration timeout') });
        }
      }, 10000);

      const registrationHandler = async (token: { value: string }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        cachedToken = token.value;
        console.log('[Push] Got token:', token.value.substring(0, 20) + '...');
        
        const result = await saveTokenToDatabase(userId, token.value);
        resolve(result);
      };

      const errorHandler = (error: { error: string }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        console.error('[Push] Registration error:', error);
        resolve({ success: false, error: new Error(error.error) });
      };

      // Add listeners FIRST without wiping existing notification listeners
      (async () => {
        try {
          regHandle = await PushNotifications.addListener('registration', registrationHandler);
          errHandle = await PushNotifications.addListener('registrationError', errorHandler);
          await PushNotifications.register();
          console.log('[Push] Registered with APNs/FCM');
        } catch (err: any) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          console.error('[Push] Register call failed:', err);
          resolve({ success: false, error: err instanceof Error ? err : new Error(String(err)) });
        }
      })();
    });
  } catch (err: any) {
    console.error('[Push] Subscribe error:', err);
    return { success: false, error: err };
  }
};

// Save the device token for the signed-in user. The RPC (migration 046) moves
// the token to this account if another account used this device before;
// the plain upsert is the fallback until the migration is applied.
const saveTokenToDatabase = async (userId: string, token: string): Promise<{ success: boolean; error: Error | null }> => {
  const platform = Capacitor.getPlatform();

  try {
    const { error: rpcError } = await supabase.rpc('bw_register_push_token', { p_token: token, p_platform: platform });
    if (!rpcError) return { success: true, error: null };

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[Push] Token save failed:', error.message);
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, error: null };
  } catch (err: any) {
    console.error('[Push] Save error:', err);
    return { success: false, error: err };
  }
};

/**
 * Stop pushes to this device for the account that is signing out. Call it
 * BEFORE the session ends (the RPC needs the user's JWT).
 */
export const unregisterPushToken = async (): Promise<void> => {
  if (!isNative() || !cachedToken) return;
  try {
    const { error } = await supabase.rpc('bw_unregister_push_token', { p_token: cachedToken });
    if (error) {
      await supabase.from('push_tokens').update({ is_active: false }).eq('token', cachedToken);
    }
  } catch {
    /* best effort: never block sign-out */
  }
};

// Check if subscription exists
const checkExistingSubscription = async (userId: string): Promise<boolean> => {
  try {
    const { data } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    return !!data;
  } catch {
    return false;
  }
};

// Setup native listeners for receiving notifications
export const setupNativePushListeners = (
  onNotification: (n: PushNotificationData) => void,
  onAction: (a: { notification: PushNotificationData; actionId: string }) => void
): (() => void) => {
  if (!isNative()) return () => {};

  // Request local notification permissions (for foreground display)
  LocalNotifications.requestPermissions().catch(() => {});

  const handles: Array<{ remove: () => Promise<void> }> = [];

  // Listen for push notifications received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    console.log('[Push] Notification received in foreground:', notification);
    
    // Check if this is a chat notification for the currently open chat
    const notificationChatId = notification.data?.chatId || notification.data?.chat_id;
    const activeChat = getActiveChat();
    
    if (notificationChatId && activeChat === notificationChatId) {
      console.log('[Push] Skipping notification - user is already viewing this chat');
      return;
    }

    // Suppress local notification for event invites - the in-app RSVP sheet handles these
    if (notification.data?.type === 'event_invite') {
      console.log('[Push] Skipping local notification for event_invite - RSVP sheet handles it');
      onNotification({ title: notification.title, body: notification.body, data: notification.data });
      return;
    }
    
    // iOS already shows the banner in the foreground (presentationOptions in
    // capacitor.config), so a local notification would show it twice.
    if (Capacitor.getPlatform() === 'ios') {
      onNotification({ title: notification.title, body: notification.body, data: notification.data });
      return;
    }

    // Android: show a local notification so the user sees it in the foreground
    try {
      // Use a smaller ID that fits in Java int (max ~2 billion)
      const notificationId = Math.floor(Math.random() * 2147483647);
      
      const channelId = (notification.data?.channel_id as string) || 'bandwith_messages';
      const summaryText = (notification.data?.subtitle as string) || (notification.data?.tag as string) || undefined;

      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: notification.title || 'BandWith',
          body: notification.body || '',
          largeBody: notification.body,
          summaryText: summaryText,
          sound: 'default',
          channelId: channelId,
          smallIcon: 'ic_stat_notification',
          iconColor: '#050505',
          extra: notification.data,
        }],
      });
      console.log('[Push] Local notification shown with id:', notificationId);
    } catch (e) {
      console.warn('[Push] Failed to show local notification:', e);
    }
    
    // Also notify the callback
    onNotification({
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });
  }).then(h => handles.push(h));
  
  // Listen for push notification actions (when user taps the notification)
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Push notification TAP:', JSON.stringify(action));
    console.log('[Push] Push notification data:', JSON.stringify(action.notification.data));
    onAction({
      notification: {
        title: action.notification.title,
        body: action.notification.body,
        data: action.notification.data,
      },
      actionId: action.actionId,
    });
  }).then(h => handles.push(h));

  // Also listen for local notification actions
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    console.log('[Push] Local notification TAP:', JSON.stringify(action));
    console.log('[Push] Local notification extra:', JSON.stringify(action.notification.extra));
    onAction({
      notification: {
        title: action.notification.title,
        body: action.notification.body,
        data: action.notification.extra,
      },
      actionId: action.actionId,
    });
  }).then(h => handles.push(h));
  
  // Return cleanup function removing only this instance's listeners
  return () => {
    handles.forEach(h => {
      try {
        h.remove().catch(() => {});
      } catch (_) {}
    });
  };
};

// Create notification channel for Android
export const createNotificationChannel = async (
  id: string,
  name: string,
  description: string,
  importance: number = 4
): Promise<void> => {
  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    await PushNotifications.createChannel({
      id,
      name,
      description,
      importance: importance as any,
      visibility: 1,
      lights: true,
      vibration: true,
    });
    console.log('[Push] Channel created:', id);
  } catch (error) {
    console.error('[Push] Error creating channel:', error);
  }
};

// Remove listeners
export const removePushListeners = async (): Promise<void> => {
  if (!isNative()) return;
  
  try {
    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error('[Push] Error removing listeners:', error);
  }
};

// Legacy exports for compatibility
export const initializePushNotifications = async (
  listeners: PushNotificationListeners
): Promise<boolean> => {
  console.log('[Push] initializePushNotifications called');
  // This is now handled by subscribeToPush
  // Just setup the notification listeners
  if (listeners.onPushReceived || listeners.onPushActionPerformed) {
    setupNativePushListeners(
      listeners.onPushReceived || (() => {}),
      listeners.onPushActionPerformed || (() => {})
    );
  }
  return true;
};

export const savePushToken = async (
  token: string,
  userId: string
): Promise<{ error: Error | null }> => {
  const result = await saveTokenToDatabase(userId, token);
  return { error: result.error };
};

export default {
  isNative,
  isPushSupported,
  checkPushPermissions,
  subscribeToPush,
  setupNativePushListeners,
  createNotificationChannel,
  removePushListeners,
};
