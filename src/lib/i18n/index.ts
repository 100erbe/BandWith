/**
 * App language (Settings › Language): English, Italiano, Español, Français,
 * Deutsch, Português.
 *
 * The English text in the code is the key: `t('Notifications')` looks the
 * string up in the chosen language's dictionary and falls back to the
 * English it was given. So a screen that hasn't been translated yet, or a
 * string missing from a dictionary, shows exactly what it showed before.
 *
 * Placeholders use braces: `t('Version {version}', { version: '1.0.0' })`.
 *
 * The choice is per device (like the theme and the distance unit). Until it
 * is set, the app follows the device language when it is one of the six, and
 * English otherwise.
 */
import { useCallback, useSyncExternalStore } from 'react';
import it from './locales/it';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import pt from './locales/pt';

export type Locale = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt';
export type LocalePref = Locale | 'system';
export type Dictionary = Record<string, string>;
export type TranslateVars = Record<string, string | number>;

/** Languages as they are written in themselves (shown untranslated). */
export const LANGUAGES: { id: Locale; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'it', name: 'Italiano' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' },
  { id: 'pt', name: 'Português' },
];

export const DICTIONARIES: Record<Exclude<Locale, 'en'>, Dictionary> = { it, es, fr, de, pt };

const KEY = 'bw-locale-v1';
const CHANGED = 'bw:locale';

const isLocale = (v: unknown): v is Locale => LANGUAGES.some((l) => l.id === v);
const isPref = (v: unknown): v is LocalePref => v === 'system' || isLocale(v);

/** The first of the device's languages that the app speaks, else English. */
export const deviceLocale = (): Locale => {
  try {
    const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
    for (const l of langs) {
      const base = (l || '').toLowerCase().split(/[-_]/)[0];
      if (isLocale(base)) return base;
    }
  } catch {
    /* no navigator */
  }
  return 'en';
};

const readPref = (): LocalePref => {
  try {
    const v = localStorage.getItem(KEY);
    if (isPref(v)) return v;
  } catch {
    /* storage blocked */
  }
  return 'system';
};

let pref: LocalePref | null = null;
let locale: Locale | null = null;

export const getLocalePref = (): LocalePref => (pref ??= readPref());
export const getLocale = (): Locale => {
  if (locale) return locale;
  const p = getLocalePref();
  locale = p === 'system' ? deviceLocale() : p;
  return locale;
};

const applyDocumentLang = (l: Locale) => {
  try {
    document.documentElement.lang = l;
  } catch {
    /* no document */
  }
};

export const setLocalePref = (next: LocalePref) => {
  pref = next;
  locale = next === 'system' ? deviceLocale() : next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* best effort */
  }
  applyDocumentLang(locale);
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* no window */
  }
};

const interpolate = (text: string, vars?: TranslateVars) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;

/** Translates in the current language. In components use `useT()` so the screen updates when the language changes. */
export const t = (source: string, vars?: TranslateVars): string => {
  const l = getLocale();
  const text = l === 'en' ? source : DICTIONARIES[l][source] ?? source;
  return interpolate(text, vars);
};

/**
 * "a, b and c" in the current language. English keeps the app's style
 * (no comma before "and").
 */
export const formatList = (items: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string => {
  const l = getLocale();
  try {
    // Intl.ListFormat is ES2021; the project's TS lib target is older.
    const ListFormat = (Intl as unknown as { ListFormat: new (l: string, o: object) => { format: (i: string[]) => string } }).ListFormat;
    return new ListFormat(l === 'en' ? 'en-GB' : l, { style: 'long', type }).format(items);
  } catch {
    return items.join(', ');
  }
};

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  return () => window.removeEventListener(CHANGED, cb);
};

export const useLocale = (): Locale => useSyncExternalStore(subscribe, getLocale, () => 'en' as Locale);
export const useLocalePref = (): LocalePref => useSyncExternalStore(subscribe, getLocalePref, () => 'system' as LocalePref);

/** `const t = useT();` — same as `t()`, and re-renders the component when the language changes. */
export const useT = () => {
  const l = useLocale();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((source: string, vars?: TranslateVars) => t(source, vars), [l]);
};

// The page's lang attribute (screen readers, hyphenation) follows the choice from the start.
if (typeof document !== 'undefined') applyDocumentLang(getLocale());
