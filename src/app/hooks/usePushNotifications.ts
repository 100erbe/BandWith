import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  checkPushPermissions,
  subscribeToPush,
  setupNativePushListeners,
  removePushListeners,
  createNotificationChannel,
  isNative,
  type PushNotificationData,
} from '@/lib/services/pushNotifications';
import { Capacitor } from '@capacitor/core';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unavailable' | 'loading';
  lastNotification: PushNotificationData | null;
  initialize: () => Promise<boolean>;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unavailable' | 'loading'>('loading');
  const [lastNotification, setLastNotification] = useState<PushNotificationData | null>(null);
  const initializingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  const isSupported = isNative();

  const initialize = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('[usePush] Not on native platform');
      setPermissionStatus('unavailable');
      return false;
    }

    if (!user?.id) {
      console.log('[usePush] No user ID');
      return false;
    }

    if (initializingRef.current) {
      console.log('[usePush] Already initializing');
      return false;
    }

    initializingRef.current = true;
    console.log('[usePush] Starting initialization for user:', user.id);

    try {
      // Create notification channels for Android
      if (Capacitor.getPlatform() === 'android') {
        await createNotificationChannel(
          'bandwith_general',
          'General Notifications',
          'General app notifications',
          4
        );
        await createNotificationChannel(
          'bandwith_messages',
          'Messages',
          'Chat messages and direct messages',
          5
        );
        await createNotificationChannel(
          'bandwith_events',
          'Event Notifications',
          'Notifications about events and gigs',
          5
        );
      }

      // Subscribe to push notifications
      const result = await subscribeToPush(user.id);
      console.log('[usePush] Subscribe result:', result);
      
      if (result.success) {
        setPermissionStatus('granted');
        
        // Setup listeners for receiving notifications
        cleanupRef.current = setupNativePushListeners(
          (notification) => {
            console.log('[usePush] Notification received:', notification);
            setLastNotification(notification);
          },
          (action) => {
            console.log('[usePush] Notification action:', action);
            handleNotificationAction(action);
          }
        );
        
        return true;
      } else {
        console.log('[usePush] Subscribe failed:', result.error?.message);
        setPermissionStatus('denied');
        return false;
      }
    } catch (error) {
      console.error('[usePush] Initialize error:', error);
      setPermissionStatus('unavailable');
      return false;
    } finally {
      initializingRef.current = false;
    }
  }, [isSupported, user?.id]);

  // Defer permission check to avoid native bridge calls during cold start
  useEffect(() => {
    if (!isSupported) {
      setPermissionStatus('unavailable');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const status = await checkPushPermissions();
        setPermissionStatus(status);
      } catch (error) {
        console.warn('[usePush] Permission check failed:', error);
        setPermissionStatus('unavailable');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSupported]);

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Handle notification action (when user taps on notification)
  const handleNotificationAction = (action: { notification: PushNotificationData; actionId: string }) => {
    const { notification } = action;
    const data = notification.data;

    console.log('[usePush] Handling notification tap with data:', data);

    if (!data) {
      console.log('[usePush] No data in notification, navigating to home');
      window.dispatchEvent(new CustomEvent('push-navigate', { 
        detail: { screen: 'home' } 
      }));
      return;
    }

    // Support both chatId and chat_id (Edge Function uses snake_case)
    const chatId = data.chatId || data.chat_id;
    const eventId = data.eventId || data.event_id;

    // Navigate based on notification type
    switch (data.type) {
      case 'chat_message':
        console.log('[usePush] Navigating to chat:', chatId);
        window.dispatchEvent(new CustomEvent('push-navigate', { 
          detail: { screen: 'chat', chatId } 
        }));
        break;
      case 'event_reminder':
      case 'event_invite':
        console.log('[usePush] Navigating to event:', eventId);
        window.dispatchEvent(new CustomEvent('push-navigate', { 
          detail: { screen: 'event', eventId } 
        }));
        break;
      case 'quote_update':
        window.dispatchEvent(new CustomEvent('push-navigate', { 
          detail: { screen: 'quotes' } 
        }));
        break;
      case 'band_invite':
      case 'member_joined':
        window.dispatchEvent(new CustomEvent('push-navigate', { 
          detail: { screen: 'bandMembers' } 
        }));
        break;
      default:
        console.log('[usePush] Unknown type, navigating to home');
        window.dispatchEvent(new CustomEvent('push-navigate', { 
          detail: { screen: 'home' } 
        }));
    }
  };

  return {
    isSupported,
    permissionStatus,
    lastNotification,
    initialize,
  };
};

export default usePushNotifications;
