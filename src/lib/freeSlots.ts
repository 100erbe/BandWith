/**
 * Free-slot heatmap rules (bw_band_free_slots, migration 095) in TypeScript,
 * for the demo client and the tests. Pure: no Supabase import, so the demo
 * client can use it without an import cycle. See bandAvailability.ts.
 */

export interface FreeCount {
  free: number;
  total: number;
}

export interface FreeSlotRow extends FreeCount {
  /** YYYY-MM-DD */
  day: string;
  /** "HH:MM" for a slot row, null for a whole-day (or whole-window) row. */
  slotStart: string | null;
}

export interface FreeSlotQuery {
  bandId: string;
  /** YYYY-MM-DD, inclusive (at most 63 days). */
  from: string;
  to: string;
  /** Optional window "HH:MM"; an end at or before the start runs past midnight. */
  start?: string | null;
  end?: string | null;
  /** With a window: one row per slot of this many minutes (≥ 15). */
  slotMinutes?: number | null;
  /** The event being edited: its own lineup does not count as busy. */
  excludeEventId?: string | null;
}

// ─────────────────────────────── pure rules ───────────────────────────────

/** One commitment of a band member, from any of their calendars. */
export interface MemberCommitment {
  user_id: string;
  event_id?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  /** events.status */
  event_status?: string | null;
  /** event_members.status (null for a personal event). */
  answer?: string | null;
}

const NOT_BUSY_EVENT = new Set(['cancelled', 'canceled', 'quote', 'quoted']);
const NOT_BUSY_ANSWER = new Set(['declined', 'removed']);

const lower = (v?: string | null) => (v || '').trim().toLowerCase();

/** "21:30" / "21:30:00" → minutes; null when missing or invalid. */
export const toMinutes = (v?: string | null): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec((v || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
};

const fromMinutes = (m: number): string => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

/** [start, end) in minutes; an end at or before the start runs past midnight. */
export const windowSpan = (start?: string | null, end?: string | null): [number, number] | null => {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s == null || e == null) return null;
  return [s, e <= s ? e + 1440 : e];
};

const ymdAdd = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Same rules as bw_band_free_slots (095). */
export function freeSlotsFromRows(
  memberIds: string[],
  commitments: MemberCommitment[],
  q: Omit<FreeSlotQuery, 'bandId'>,
): FreeSlotRow[] {
  const members = Array.from(new Set(memberIds.filter(Boolean)));
  const total = members.length;
  const inBand = new Set(members);
  if (!q.from || !q.to || q.to < q.from) return [];

  const win = windowSpan(q.start, q.end);
  const step = q.slotMinutes && q.slotMinutes >= 15 ? q.slotMinutes : null;

  const busyRows = commitments
    .filter(c => inBand.has(c.user_id))
    .filter(c => c.event_date >= q.from && c.event_date <= q.to)
    .filter(c => !q.excludeEventId || c.event_id !== q.excludeEventId)
    .filter(c => !NOT_BUSY_EVENT.has(lower(c.event_status)))
    .filter(c => c.answer == null || !NOT_BUSY_ANSWER.has(lower(c.answer)))
    .map(c => {
      const s = toMinutes(c.start_time);
      let e = toMinutes(c.end_time);
      if (s != null) e = e == null ? s + 180 : e <= s ? e + 1440 : e;
      return { user: c.user_id, day: c.event_date, s, e };
    });

  const out: FreeSlotRow[] = [];
  for (let day = q.from, i = 0; day <= q.to && i < 64; day = ymdAdd(day, 1), i++) {
    const dayBusy = busyRows.filter(b => b.day === day);
    const slots: [number | null, number | null][] = [];
    if (win && step) for (let m = win[0]; m < win[1]; m += step) slots.push([m, Math.min(m + step, win[1])]);
    else slots.push(win ? [win[0], win[1]] : [null, null]);
    for (const [from, to] of slots) {
      const busy = new Set(
        dayBusy
          .filter(b => from == null || to == null || b.s == null || (b.s < to && from < (b.e as number)))
          .map(b => b.user),
      );
      out.push({ day, slotStart: from == null ? null : fromMinutes(from), free: total - busy.size, total });
    }
  }
  return out;
}

/** 0…4 heat level for a free count (0 = nobody free, 4 = everyone). */
export const heatLevel = (c: FreeCount | null | undefined): 0 | 1 | 2 | 3 | 4 => {
  if (!c || c.total <= 0) return 0;
  if (c.free >= c.total) return 4;
  const r = c.free / c.total;
  return r >= 0.75 ? 3 : r >= 0.5 ? 2 : r > 0 ? 1 : 0;
};
