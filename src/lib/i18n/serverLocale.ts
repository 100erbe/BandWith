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
  // The last value written, and the profile value it was written over: the
  // profile in memory isn't read again after the write, so until it changes
  // the server holds what we sent (switching back to the profile's old
  // language must still be written).
  const sent = useRef<{ userId: string; lang: string; over: string | null | undefined } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const last = sent.current;
    const serverHas = last && last.userId === userId && last.over === serverLang ? last.lang : serverLang;
    if (serverHas === locale) return;
    const entry = { userId, lang: locale, over: serverLang };
    sent.current = entry;
    void supabase
      .from('profiles')
      .update({ preferred_language: locale })
      .eq('id', userId)
      .then(({ error }) => {
        // Try again on the next render (back online, next launch).
        if (error && sent.current === entry) sent.current = null;
      });
  }, [userId, serverLang, locale]);
}
