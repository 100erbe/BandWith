import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Unfinished "New gig" wizards saved as drafts, so closing the wizard never
 * loses what was typed. The dashboard lists them (desaturated) and a tap
 * reopens the wizard where it was left. Quotes have their own drafts in the
 * database (status DRAFT).
 *
 * Drafts are kept on the device (localStorage, works offline) and synced to
 * the `event_drafts` table (migration 069), so they follow the user to their
 * other devices. Without that table the drafts simply stay on the device.
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
  /** Uploaded to event_drafts at least once (so missing there = deleted elsewhere). */
  synced?: boolean;
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

// ── Cloud sync (event_drafts) ─────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The table isn't there yet (migration 069 not applied): stay local. */
let remoteMissing = false;
const isMissingTable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /event_drafts/.test(e.message || '') && /exist|schema cache/i.test(e.message || ''));

const toRow = (d: EventDraft) => ({
  id: d.id,
  user_id: d.userId,
  band_id: d.bandId && UUID.test(d.bandId) ? d.bandId : null,
  title: (d.title || '').slice(0, 200),
  event_date: d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
  venue: d.venue ? d.venue.slice(0, 200) : null,
  event_type: d.eventType ? String(d.eventType).slice(0, 40) : null,
  state: d.state,
  saved_at: d.savedAt,
});

const markSynced = (id: string, savedAt: string) => {
  const all = readAll();
  const i = all.findIndex((d) => d.id === id && d.savedAt === savedAt);
  if (i < 0 || all[i].synced) return;
  all[i] = { ...all[i], synced: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* best effort */
  }
};

async function pushRemote(d: EventDraft): Promise<void> {
  if (remoteMissing || !UUID.test(d.userId)) return;
  try {
    const { error } = await supabase.from('event_drafts').upsert(toRow(d), { onConflict: 'id' });
    if (isMissingTable(error)) remoteMissing = true;
    else if (!error) markSynced(d.id, d.savedAt);
  } catch {
    /* offline: synced on the next refresh */
  }
}

/** True when the cloud copy is gone (or there is no cloud table). */
async function deleteRemote(id: string): Promise<boolean> {
  if (remoteMissing) return true;
  try {
    const { error } = await supabase.from('event_drafts').delete().eq('id', id);
    if (isMissingTable(error)) remoteMissing = true;
    return !error || remoteMissing;
  } catch {
    return false; // offline: retried on the next sync
  }
}

/** Ids deleted while offline, removed from the cloud on the next sync. */
const TOMB = 'bw-event-drafts-deleted-v1';
const readTomb = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(TOMB) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const writeTomb = (ids: string[]) => {
  try {
    localStorage.setItem(TOMB, JSON.stringify(ids.slice(-100)));
  } catch {
    /* best effort */
  }
};

/** Merge this user's cloud drafts with the device's (newest wins). */
const inFlight = new Map<string, Promise<void>>();
export function syncEventDrafts(userId: string | null | undefined): Promise<void> {
  if (!userId || remoteMissing || !UUID.test(userId)) return Promise.resolve();
  // Several screens ask at once (home, calendar, templates): one request.
  const running = inFlight.get(userId);
  if (running) return running;
  const p = runSync(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

async function runSync(userId: string): Promise<void> {
  try {
    const pending: string[] = [];
    for (const id of readTomb()) if (!(await deleteRemote(id))) pending.push(id);
    writeTomb(pending);
    const { data, error } = await supabase
      .from('event_drafts')
      .select('id, user_id, band_id, title, event_date, venue, event_type, state, saved_at')
      .eq('user_id', userId);
    if (error) {
      if (isMissingTable(error)) remoteMissing = true;
      return;
    }
    const remote = new Map<string, EventDraft>();
    for (const r of data || []) {
      remote.set(r.id, {
        id: r.id,
        userId: r.user_id,
        bandId: r.band_id,
        title: r.title || '',
        date: r.event_date || undefined,
        venue: r.venue || undefined,
        eventType: r.event_type,
        savedAt: r.saved_at,
        state: (r.state as Record<string, unknown>) || {},
        synced: true,
      });
    }
    const local = readAll();
    const merged: EventDraft[] = local.filter((d) => d.userId !== userId);
    const toUpload: EventDraft[] = [];
    for (const d of local.filter((x) => x.userId === userId)) {
      const r = remote.get(d.id);
      if (!r) {
        // Uploaded before and gone from the cloud: deleted on another device.
        if (d.synced) continue;
        merged.push(d);
        toUpload.push(d);
      } else if (new Date(r.savedAt).getTime() >= new Date(d.savedAt).getTime()) {
        merged.push(r);
        remote.delete(d.id);
      } else {
        merged.push(d);
        toUpload.push(d);
        remote.delete(d.id);
      }
    }
    merged.push(...remote.values());
    merged.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    writeAll(merged);
    for (const d of toUpload) await pushRemote(d);
  } catch {
    /* offline: keep what the device has */
  }
}

export function saveEventDraft(draft: Omit<EventDraft, 'savedAt' | 'synced'>): EventDraft {
  const saved: EventDraft = { ...draft, savedAt: new Date().toISOString() };
  writeAll([saved, ...readAll().filter((d) => d.id !== draft.id)]);
  void pushRemote(saved);
  return saved;
}

export function deleteEventDraft(id: string | null | undefined): void {
  if (!id) return;
  const all = readAll();
  const had = all.find((d) => d.id === id);
  if (!had) return;
  writeAll(all.filter((d) => d.id !== id));
  if (had.synced || !remoteMissing) {
    writeTomb([...readTomb().filter((x) => x !== id), id]);
    void deleteRemote(id).then((ok) => {
      if (ok) writeTomb(readTomb().filter((x) => x !== id));
    });
  }
}

/** Drafts of this user (and band, when given), kept in sync across the app. */
export function useEventDrafts(userId: string | null | undefined, bandId?: string | null): EventDraft[] {
  const [drafts, setDrafts] = useState<EventDraft[]>(() => listEventDrafts(userId, bandId));
  useEffect(() => {
    const refresh = () => setDrafts(listEventDrafts(userId, bandId));
    refresh();
    // Pull drafts saved on the user's other devices.
    void syncEventDrafts(userId);
    // Coming back to the app (or the tab) pulls again, so a draft saved on
    // another device shows up without reopening the screen.
    let last = Date.now();
    const pull = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 5000) return;
      last = Date.now();
      void syncEventDrafts(userId);
    };
    window.addEventListener(CHANGED, refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', pull);
    window.addEventListener('focus', pull);
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', pull);
      window.removeEventListener('focus', pull);
    };
  }, [userId, bandId]);
  return drafts;
}
