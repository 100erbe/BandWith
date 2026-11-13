/**
 * Free-slot heatmap (Figma "Next": "Free-slot heatmap from band calendars,
 * e.g. 5/5 free"). The database counts, per day or per time slot, how many
 * active members of a band have nothing else in any of their calendars
 * (bw_band_free_slots, migration 095). Only counts come back: never who is
 * busy or why.
 *
 * freeSlotsFromRows() is the same rule in TypeScript, for the demo client and
 * the tests; keep the two in step.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { windowSpan, type FreeCount, type FreeSlotQuery, type FreeSlotRow } from '@/lib/freeSlots';

export * from '@/lib/freeSlots';


// ─────────────────────────────── fetching ───────────────────────────────

const hhmm = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 5) : null);

const cache = new Map<string, { at: number; rows: FreeSlotRow[] }>();
const inflight = new Map<string, Promise<FreeSlotRow[]>>();
const TTL_MS = 60_000;

const keyOf = (q: FreeSlotQuery) =>
  [q.bandId, q.from, q.to, q.start || '', q.end || '', q.slotMinutes || '', q.excludeEventId || ''].join('|');

/** Forget cached counts (after saving an event, so the next picker is fresh). */
export const clearFreeSlotCache = () => cache.clear();

export async function fetchBandFreeSlots(q: FreeSlotQuery): Promise<FreeSlotRow[]> {
  const key = keyOf(q);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const win = windowSpan(q.start, q.end);
    const { data, error } = await supabase.rpc('bw_band_free_slots', {
      p_band_id: q.bandId,
      p_from: q.from,
      p_to: q.to,
      p_start: win ? q.start : null,
      p_end: win ? q.end : null,
      p_slot_minutes: win ? q.slotMinutes ?? null : null,
      p_exclude_event: q.excludeEventId ?? null,
    });
    if (error) throw error;
    const rows: FreeSlotRow[] = (Array.isArray(data) ? data : []).map((r: any) => ({
      day: String(r.day).slice(0, 10),
      slotStart: hhmm(r.slot_start),
      free: Number(r.free_count) || 0,
      total: Number(r.total_count) || 0,
    }));
    cache.set(key, { at: Date.now(), rows });
    return rows;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * Free counts per day for a band, or null while loading / without a band /
 * when the band has a single member (nothing useful to show).
 * Pass `enabled: false` to skip fetching (e.g. while a sheet is closed).
 */
export function useBandFreeDays(
  q: Partial<FreeSlotQuery> & { enabled?: boolean },
): Map<string, FreeCount> | null {
  const { bandId, from, to, start, end, excludeEventId, enabled = true } = q;
  const [rows, setRows] = useState<FreeSlotRow[] | null>(null);
  const win = windowSpan(start, end);
  const key = bandId && from && to ? keyOf({ bandId, from, to, start: win ? start : null, end: win ? end : null, excludeEventId }) : '';

  useEffect(() => {
    if (!enabled || !key || !bandId || !from || !to) return;
    let alive = true;
    fetchBandFreeSlots({ bandId, from, to, start: win ? start : null, end: win ? end : null, excludeEventId })
      .then(r => alive && setRows(r))
      .catch(() => alive && setRows(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return useMemo(() => {
    if (!rows || !rows.length || rows[0].total < 2) return null;
    const map = new Map<string, FreeCount>();
    rows.forEach(r => {
      if (r.slotStart == null || win) map.set(r.day, { free: r.free, total: r.total });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
}

/** Slot counts for one day (hour bars), or null while loading. */
export function useBandFreeSlots(
  q: Partial<FreeSlotQuery> & { enabled?: boolean },
): FreeSlotRow[] | null {
  const { bandId, from, to, start, end, slotMinutes, excludeEventId, enabled = true } = q;
  const [rows, setRows] = useState<FreeSlotRow[] | null>(null);
  const ok = !!(bandId && from && to && windowSpan(start, end));
  const key = ok ? keyOf({ bandId: bandId!, from: from!, to: to!, start, end, slotMinutes, excludeEventId }) : '';
  useEffect(() => {
    if (!enabled || !key) return;
    let alive = true;
    fetchBandFreeSlots({ bandId: bandId!, from: from!, to: to!, start, end, slotMinutes, excludeEventId })
      .then(r => alive && setRows(r))
      .catch(() => alive && setRows(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return key && rows && rows.length && rows[0].total >= 2 ? rows : null;
}


/** A candidate slot (poll option, composer slot). */
export interface CandidateSlot {
  date: string;
  start?: string | null;
  end?: string | null;
}

export const slotKey = (s: CandidateSlot) => `${s.date}|${(s.start || '').slice(0, 5)}|${(s.end || '').slice(0, 5)}`;

/** Free counts for a list of candidate slots, keyed by slotKey(). */
export function useCandidateFreeCounts(
  bandId: string | null | undefined,
  slots: CandidateSlot[],
  enabled = true,
): Map<string, FreeCount> {
  const [map, setMap] = useState<Map<string, FreeCount>>(() => new Map());
  const sig = slots.map(slotKey).sort().join(',');
  useEffect(() => {
    if (!enabled || !bandId || !slots.length) {
      setMap(new Map());
      return;
    }
    let alive = true;
    // One request per distinct window, over the dates that use it.
    const groups = new Map<string, CandidateSlot[]>();
    slots.forEach(s => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return;
      const w = `${(s.start || '').slice(0, 5)}|${(s.end || '').slice(0, 5)}`;
      groups.set(w, [...(groups.get(w) || []), s]);
    });
    Promise.all(
      Array.from(groups.values()).map(async list => {
        const dates = list.map(s => s.date).sort();
        const from = dates[0];
        const to = dates[dates.length - 1];
        if ((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000 > 62) return [];
        const win = windowSpan(list[0].start, list[0].end);
        const rows = await fetchBandFreeSlots({
          bandId,
          from,
          to,
          start: win ? list[0].start!.slice(0, 5) : null,
          end: win ? list[0].end!.slice(0, 5) : null,
        });
        return list.map(s => {
          const r = rows.find(x => x.day === s.date);
          return [slotKey(s), r && r.total >= 2 ? { free: r.free, total: r.total } : null] as const;
        });
      }),
    )
      .then(parts => {
        if (!alive) return;
        const next = new Map<string, FreeCount>();
        parts.flat().forEach(([k, v]) => v && next.set(k, v));
        setMap(next);
      })
      .catch(() => alive && setMap(new Map()));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandId, sig, enabled]);
  return map;
}
