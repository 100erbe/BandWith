import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocale } from './index';

/**
 * Keeps profiles.preferred_language equal to the app's language, so texts the
 * server writes for this account (pushes to and about deputies, 088) are in
 * the language the person reads the app in. One write per change, none when
 * the profile already says so.
 */
export function useServerLocaleSync(userId: string | null | undefined, serverLang: string | null | undefined) {
  const locale = useLocale();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || serverLang === locale) return;
    const key = `${userId}:${locale}`;
    if (sent.current === key) return;
    sent.current = key;
    void supabase
      .from('profiles')
      .update({ preferred_language: locale })
      .eq('id', userId)
      .then(({ error }) => {
        // Try again on the next render (back online, next launch).
        if (error) sent.current = null;
      });
  }, [userId, serverLang, locale]);
}
