import { supabase } from '@/lib/supabase';
import { getSafeUser } from '@/lib/supabase';

/**
 * Server-side notification preferences (profiles.notification_preferences).
 * The push dispatcher (migration 048) skips push when `push` is false.
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

export const saveNotificationPref = async (key: NotificationPrefKey, value: boolean): Promise<{ error: Error | null }> => {
  writeLocalPref(key, value);
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not signed in');
    const { data: current } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .maybeSingle();
    const merged = { ...((current?.notification_preferences as Record<string, unknown>) || {}), [key]: value };
    const { error } = await supabase.from('profiles').update({ notification_preferences: merged }).eq('id', user.id);
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    return { error };
  }
};
