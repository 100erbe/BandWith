import { useEffect, useState } from 'react';

/**
 * Unfinished "New gig" wizards saved as drafts on this device (localStorage),
 * so closing the wizard never loses what was typed. The dashboard lists them
 * (desaturated) and a tap reopens the wizard where it was left. Quotes have
 * their own drafts in the database (status DRAFT).
 */

export interface EventDraft {
  id: string;
  userId: string;
  bandId: string | null;
  /** What the dashboard row shows. */
  title: string;
  date?: string;
  venue?: string;
  eventType?: string | null;
  savedAt: string;
  /** The wizard's form state (CreateEventModal), restored as-is. */
  state: Record<string, unknown>;
}

const KEY = 'bw-event-drafts-v1';
const CHANGED = 'bw:drafts-changed';

const readAll = (): EventDraft[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeAll = (list: EventDraft[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* storage full or blocked: drafts are best effort */
  }
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* no window (tests) */
  }
};

export const newDraftId = () => `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function listEventDrafts(userId: string | null | undefined, bandId?: string | null): EventDraft[] {
  if (!userId) return [];
  return readAll()
    .filter((d) => d.userId === userId && (bandId === undefined || (d.bandId ?? null) === (bandId ?? null)))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function saveEventDraft(draft: Omit<EventDraft, 'savedAt'>): EventDraft {
  const saved: EventDraft = { ...draft, savedAt: new Date().toISOString() };
  writeAll([saved, ...readAll().filter((d) => d.id !== draft.id)]);
  return saved;
}

export function deleteEventDraft(id: string | null | undefined): void {
  if (!id) return;
  const all = readAll();
  if (!all.some((d) => d.id === id)) return;
  writeAll(all.filter((d) => d.id !== id));
}

/** Drafts of this user (and band, when given), kept in sync across the app. */
export function useEventDrafts(userId: string | null | undefined, bandId?: string | null): EventDraft[] {
  const [drafts, setDrafts] = useState<EventDraft[]>(() => listEventDrafts(userId, bandId));
  useEffect(() => {
    const refresh = () => setDrafts(listEventDrafts(userId, bandId));
    refresh();
    window.addEventListener(CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [userId, bandId]);
  return drafts;
}
