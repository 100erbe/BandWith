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
export const subscribeToPush = async (userId: string): Promise<{ success: boolean; error: Error | null }> => {
  if (!userId) {
    return { success: false, error: new Error('User ID required') };
  }

  if (!isNative()) {
    console.log('[Push] Not on native platform');
    return { success: false, error: new Error('Not on native platform') };
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

    // Remove old listeners before adding new ones
    try {
      await PushNotifications.removeAllListeners();
      console.log('[Push] Cleared old listeners');
    } catch (e) {
      // Ignore errors
    }

    // Wait for the token - set up listeners BEFORE calling register
    return new Promise((resolve) => {
      let resolved = false;
      
      const timeout = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
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
        cachedToken = token.value;
        console.log('[Push] Got token:', token.value.substring(0, 20) + '...');
        
        const result = await saveTokenToDatabase(userId, token.value);
        resolve(result);
      };

      const errorHandler = (error: { error: string }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        console.error('[Push] Registration error:', error);
        resolve({ success: false, error: new Error(error.error) });
      };

      // Add listeners FIRST
      PushNotifications.addListener('registration', registrationHandler);
      PushNotifications.addListener('registrationError', errorHandler);
      
      // THEN call register
      PushNotifications.register().then(() => {
        console.log('[Push] Registered with APNs/FCM');
      }).catch((err) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        console.error('[Push] Register call failed:', err);
        resolve({ success: false, error: err });
      });
    });
  } catch (err: any) {
    console.error('[Push] Subscribe error:', err);
    return { success: false, error: err };
  }
};

// Helper to save token to database
const saveTokenToDatabase = async (userId: string, token: string): Promise<{ success: boolean; error: Error | null }> => {
  const platform = Capacitor.getPlatform();
  
  try {
    console.log('[Push] Saving token for platform:', platform);
    
    // Delete existing tokens for this user/platform
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform);
    
    // Small delay to ensure delete is processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Insert fresh record
    const { error: insertError } = await supabase
      .from('push_tokens')
      .insert({
        user_id: userId,
        token: token,
        platform: platform,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[Push] Insert error:', insertError);
      return { success: false, error: new Error(insertError.message) };
    }
    
    console.log('[Push] Token saved successfully!');
    return { success: true, error: null };
  } catch (err: any) {
    console.error('[Push] Save error:', err);
    return { success: false, error: err };
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

  // Listen for push notifications received while app is in foreground
  PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    console.log('[Push] Notification received in foreground:', notification);
    
    // Check if this is a chat notification for the currently open chat
    const notificationChatId = notification.data?.chatId || notification.data?.chat_id;
    const activeChat = getActiveChat();
    
    if (notificationChatId && activeChat === notificationChatId) {
      console.log('[Push] Skipping notification - user is already viewing this chat');
      // Don't show notification, don't call callback - user sees messages live
      return;
    }
    
    // Show a local notification so user sees it even when app is in foreground
    try {
      // Use a smaller ID that fits in Java int (max ~2 billion)
      const notificationId = Math.floor(Math.random() * 2147483647);
      
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: notification.title || 'BandWith',
          body: notification.body || '',
          largeBody: notification.body,
          sound: 'default',
          channelId: 'bandwith_messages',
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
  });
  
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
  });

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
  });
  
  // Return cleanup function
  return () => {
    PushNotifications.removeAllListeners();
    LocalNotifications.removeAllListeners();
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
      importance,
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
