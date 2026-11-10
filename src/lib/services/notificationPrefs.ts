import { supabase } from '@/lib/supabase';
import { getSafeUser } from '@/lib/supabase';

/**
 * Server-side notification preferences (profiles.notification_preferences).
 * The push dispatcher (migration 048) skips push when `push` is false.
 * `email` is stored but no server code reads it yet: the only emails sent
 * today are band invites an admin explicitly sends (send-email).
 */
export type NotificationPrefKey = 'push' | 'email';

const LOCAL_KEY: Record<NotificationPrefKey, string> = {
  push: 'bandwith_push_notifs',
  email: 'bandwith_email_notifs',
};

export const readLocalPref = (key: NotificationPrefKey): boolean => {
  try {
    return localStorage.getItem(LOCAL_KEY[key]) !== 'false';
  } catch {
    return true;
  }
};

const writeLocalPref = (key: NotificationPrefKey, value: boolean) => {
  try {
    localStorage.setItem(LOCAL_KEY[key], String(value));
  } catch {
    /* storage unavailable */
  }
};

export const loadNotificationPrefs = async (): Promise<Partial<Record<NotificationPrefKey, boolean>> | null> => {
  const { data: { user } } = await getSafeUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  const prefs = (data.notification_preferences || {}) as Record<string, unknown>;
  const out: Partial<Record<NotificationPrefKey, boolean>> = {};
  (['push', 'email'] as NotificationPrefKey[]).forEach((k) => {
    if (typeof prefs[k] === 'boolean') {
      out[k] = prefs[k] as boolean;
      writeLocalPref(k, prefs[k] as boolean);
    }
  });
  return out;
};

/**
 * Saves one or more preferences in a single profile update (so a master
 * toggle can't leave push and email half-saved). The local cache is only
 * updated once the server accepted the change.
 */
export const saveNotificationPrefs = async (
  values: Partial<Record<NotificationPrefKey, boolean>>
): Promise<{ error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not signed in');
    const { data: current, error: readError } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .maybeSingle();
    if (readError) throw readError;
    const merged = { ...((current?.notification_preferences as Record<string, unknown>) || {}), ...values };
    const { error } = await supabase.from('profiles').update({ notification_preferences: merged }).eq('id', user.id);
    if (error) throw error;
    (Object.keys(values) as NotificationPrefKey[]).forEach((k) => {
      const v = values[k];
      if (typeof v === 'boolean') writeLocalPref(k, v);
    });
    return { error: null };
  } catch (error: any) {
    return { error: error instanceof Error ? error : new Error(error?.message || 'Could not save notification settings') };
  }
};

export const saveNotificationPref = (key: NotificationPrefKey, value: boolean): Promise<{ error: Error | null }> =>
  saveNotificationPrefs({ [key]: value });
