import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { t } from '@/lib/i18n';

/* ─────────────────────────────────────────────────────────────────────────
 * Event tasks (table `rehearsal_tasks`, migration 008: despite the name it
 * holds the to-dos of any event, gigs included). Only the columns every
 * deployed schema has are read and written.
 * ───────────────────────────────────────────────────────────────────────── */

export interface EventTask {
  id: string;
  event_id: string;
  title: string;
  is_completed: boolean;
  due_date: string | null;
  assigned_to: string | null;
  notes: string | null;
}

/** A task as the create/edit forms hold it. `id` = already saved. */
export interface EventTaskDraft {
  id?: string;
  title: string;
  /** Days before (<0) / after (>0) the event, from a template. */
  dueOffset?: number;
  assignedTo?: string | null;
  notes?: string | null;
}

const COLUMNS = 'id, event_id, title, is_completed, due_date, assigned_to, notes';

const asError = (err: unknown, fallback: string) => {
  const e = err as { message?: string } | null;
  return new Error(e?.message || fallback);
};

/** Event date (YYYY-MM-DD) shifted by `offset` days; null when unknown. */
export const dueDateFor = (eventDate: string | null | undefined, offset: number | undefined): string | null => {
  if (!eventDate || offset == null || !Number.isFinite(offset)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Math.round(offset)));
  return d.toISOString().slice(0, 10);
};

const normalize = (row: any): EventTask => ({
  id: row.id,
  event_id: row.event_id,
  title: row.title ?? '',
  is_completed: !!row.is_completed,
  due_date: row.due_date ? String(row.due_date).slice(0, 10) : null,
  assigned_to: row.assigned_to ?? null,
  notes: row.notes ?? null,
});

export async function listEventTasks(eventId: string): Promise<{ data: EventTask[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('rehearsal_tasks')
    .select(COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) return { data: [], error: asError(error, t('Could not load the tasks.')) };
  return { data: (data || []).map(normalize), error: null };
}

/**
 * Makes the event's saved tasks match the form: removes the ones taken out
 * (`originalIds` not in `drafts`), renames the kept ones, adds the new ones.
 * Blank titles are ignored.
 */
export async function syncEventTasks(
  eventId: string,
  drafts: EventTaskDraft[],
  eventDate: string | null | undefined,
  originalIds: string[] = [],
): Promise<{ error: Error | null }> {
  const clean = drafts
    .map((t) => ({ ...t, title: (t.title || '').trim() }))
    .filter((t) => t.title);
  const keptIds = new Set(clean.filter((t) => t.id).map((t) => t.id as string));
  const removed = originalIds.filter((id) => !keptIds.has(id));

  if (removed.length > 0) {
    const { error } = await supabase.from('rehearsal_tasks').delete().in('id', removed);
    if (error) return { error: asError(error, t('Could not remove the tasks.')) };
  }
  for (const task of clean.filter((x) => x.id)) {
    const { error } = await supabase.from('rehearsal_tasks').update({ title: task.title }).eq('id', task.id as string);
    if (error) return { error: asError(error, t('Could not update the tasks.')) };
  }
  const added = clean.filter((t) => !t.id);
  if (added.length > 0) {
    const { error } = await supabase.from('rehearsal_tasks').insert(
      added.map((t) => ({
        event_id: eventId,
        title: t.title,
        is_completed: false,
        due_date: dueDateFor(eventDate, t.dueOffset),
        assigned_to: t.assignedTo || null,
        notes: t.notes?.trim() || null,
      })),
    );
    if (error) return { error: asError(error, t('Could not save the tasks.')) };
  }
  return { error: null };
}

export async function setEventTaskDone(id: string, done: boolean): Promise<{ error: Error | null }> {
  const { data, error } = await supabase
    .from('rehearsal_tasks')
    .update({ is_completed: done })
    .eq('id', id)
    .select('id');
  if (error) return { error: asError(error, t('Could not update the task.')) };
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { error: new Error(t("This change wasn't saved: you can't edit this event's tasks.")) };
  }
  return { error: null };
}

/** Tasks of one event, with an optimistic done/undone toggle. */
export function useEventTasks(eventId: string | null | undefined) {
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!eventId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    const res = await listEventTasks(eventId);
    setTasks(res.data);
    setError(res.error ? res.error.message : null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    if (!eventId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    listEventTasks(eventId).then((res) => {
      if (cancelled) return;
      setTasks(res.data);
      setError(res.error ? res.error.message : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const toggle = useCallback(async (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const next = !current.is_completed;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: next } : t)));
    const res = await setEventTaskDone(id, next);
    if (res.error) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: !next } : t)));
      setError(res.error.message);
    } else {
      setError(null);
    }
  }, [tasks]);

  return { tasks, loading, error, toggle, reload };
}
