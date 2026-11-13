/**
 * Language of documents sent to a client (quote PDF and message, contract /
 * rider PDF and message). It starts from the app language and can be changed
 * on the share screen; the choice is remembered per client on this device
 * (keyed by email, else name), so the next document for that client opens in
 * the same language. Nothing is stored on the server.
 */
import { getLocale, LANGUAGES, type Locale } from './index';

const KEY = 'bw-doc-lang-v1';

const isLocale = (v: unknown): v is Locale => LANGUAGES.some((l) => l.id === v);

const clientKey = (client?: string | null) => (client || '').trim().toLowerCase();

const readAll = (): Record<string, Locale> => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** The remembered language for this client, else the app language. */
export const docLanguageFor = (client?: string | null): Locale => {
  const key = clientKey(client);
  const saved = key ? readAll()[key] : undefined;
  return isLocale(saved) ? saved : getLocale();
};

export const rememberDocLanguage = (client: string | null | undefined, l: Locale) => {
  const key = clientKey(client);
  if (!key) return;
  try {
    const all = readAll();
    all[key] = l;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* best effort */
  }
};
