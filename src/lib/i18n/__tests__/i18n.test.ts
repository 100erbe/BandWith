/**
 * Every English string passed to t() in files that use the i18n module has a
 * translation in all five dictionaries, with the same {placeholders}.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DICTIONARIES, t, setLocalePref, getLocale, formatList, LANGUAGES } from '../index';

// Every source file, as text (Vite's glob import; no Node APIs needed).
const SOURCES = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const CALL = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
const unescape = (s: string) => s.replace(/\\(.)/g, '$1');
// t('Free', { context: 'day' }) needs its own "Free|day" entry.
const CONTEXT_CALL = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,\s*\{\s*context:\s*'(\w+)'/g;

const usedKeys = (() => {
  const keys = new Map<string, string>();
  for (const [file, text] of Object.entries(SOURCES)) {
    if (!text.includes("from '@/lib/i18n'") && !text.includes('from "@/lib/i18n"')) continue;
    for (const m of text.matchAll(CALL)) {
      const key = unescape(m[1] ?? m[2]);
      if (!keys.has(key)) keys.set(key, file);
    }
    for (const m of text.matchAll(CONTEXT_CALL)) {
      const key = `${unescape(m[1] ?? m[2])}|${m[3]}`;
      if (!keys.has(key)) keys.set(key, file);
    }
  }
  return keys;
})();

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n dictionaries', () => {
  it('finds the translated screens', () => {
    expect(usedKeys.size).toBeGreaterThan(50);
  });

  for (const [locale, dict] of Object.entries(DICTIONARIES)) {
    it(`${locale}: every string used in the app is translated`, () => {
      const missing = [...usedKeys].filter(([k]) => !dict[k]).map(([k, f]) => `${f}: ${k}`);
      expect(missing).toEqual([]);
    });

    it(`${locale}: placeholders match the English`, () => {
      const wrong = Object.entries(dict)
        .filter(([k, v]) => placeholders(k).join() !== placeholders(v).join())
        .map(([k]) => k);
      expect(wrong).toEqual([]);
    });
  }
});

describe('t()', () => {
  beforeEach(() => setLocalePref('en'));

  it('shows the English when the language is English', () => {
    expect(t('Notifications')).toBe('Notifications');
  });

  it('translates and fills placeholders', () => {
    setLocalePref('it');
    expect(getLocale()).toBe('it');
    expect(t('Notifications')).toBe('Notifiche');
    expect(t('Version {version}', { version: '1.0.0' })).toBe('Versione 1.0.0');
  });

  it('picks the entry for a context, falling back to the plain one', () => {
    expect(t('Free', { context: 'day' })).toBe('Free');
    setLocalePref('it');
    expect(t('Free')).toBe('Gratis');
    expect(t('Free', { context: 'day' })).toBe('Libero');
    expect(t('Notifications', { context: 'nothing-here' })).toBe('Notifiche');
  });

  it('falls back to the English for strings not translated yet', () => {
    setLocalePref('de');
    expect(t('A screen nobody translated yet')).toBe('A screen nobody translated yet');
  });

  it('remembers the choice on this device', () => {
    setLocalePref('fr');
    expect(localStorage.getItem('bw-locale-v1')).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('lists names the way each language does', () => {
    expect(formatList(['A', 'B', 'C'])).toBe('A, B and C');
    setLocalePref('it');
    expect(formatList(['A', 'B', 'C'])).toBe('A, B e C');
  });

  it('offers the six languages by their own names', () => {
    expect(LANGUAGES.map((l) => l.name)).toEqual(['English', 'Italiano', 'Español', 'Français', 'Deutsch', 'Português']);
  });
});
