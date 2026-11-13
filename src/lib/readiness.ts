/**
 * Show readiness (Figma "Phone · Next", "iPad · 03"): what is settled for a
 * gig and what is still to do. One function for the gig screen and Home, so
 * both show the same count.
 *
 * Only data the viewer may read goes in: the deposit is the band's money, so
 * admins pass it and members never do.
 */

export type ReadinessKey = 'time' | 'venue' | 'setlist' | 'lyrics' | 'rider' | 'contract' | 'lineup' | 'tasks' | 'deposit';

export interface ReadinessItem {
  key: ReadinessKey;
  done: boolean;
  /** For lineup, setlist, lyrics and to-dos: how many of how many. */
  count?: { done: number; total: number };
  /** Rider: its version and where it stands. Contract: signed or not. */
  state?: 'none' | 'draft' | 'sent' | 'seen' | 'unsigned' | 'signed';
  version?: number;
}

export interface ReadinessInput {
  /** The gig has a real start time (not a default). */
  timeSet: boolean;
  /** The gig has a venue (not "TBD"). */
  venueSet: boolean;
  /** Event members with their RSVP status. */
  lineup: { status?: string | null }[];
  setlistSongs: number;
  /** Setlist songs with lyrics or a chord chart (only counted with a setlist). */
  lyricsCovered?: number;
  /**
   * The gig's rider (bw_event_rider, members may read it): null when there is
   * none yet. Leave it out where it isn't known (no band, older database).
   */
  rider?: { version: number; sent: boolean; seen: boolean } | null;
  /** Admins only: the gig's contract, null when there is none. */
  contract?: { signed: boolean } | null;
  tasks: { is_completed: boolean }[];
  /** Admins only. Counts only when a deposit is due. */
  deposit?: { amount: number; paid: boolean };
}

export interface Readiness {
  items: ReadinessItem[];
  done: number;
  total: number;
  /** The first item still to do, or null when the gig is ready. */
  next: ReadinessItem | null;
}

/** A song counts as covered with lyrics or a chord chart (iReal import). */
export const hasLyricsOrChart = (lyrics?: string | null, chart?: unknown): boolean =>
  !!(lyrics && lyrics.trim()) || (!!chart && typeof chart === 'object' && Array.isArray((chart as { sections?: unknown }).sections));

const NEXT_ORDER: ReadinessKey[] = ['time', 'venue', 'lineup', 'setlist', 'contract', 'deposit', 'rider', 'lyrics', 'tasks'];

export function computeReadiness(input: ReadinessInput): Readiness {
  const active = input.lineup.filter((m) => (m.status || '').toLowerCase() !== 'declined');
  const confirmed = active.filter((m) => (m.status || '').toLowerCase() === 'confirmed').length;
  const tasksDone = input.tasks.filter((task) => task.is_completed).length;

  // Time and venue show on the gig's header: they only count while missing.
  const items: ReadinessItem[] = [];
  if (!input.timeSet) items.push({ key: 'time', done: false });
  if (!input.venueSet) items.push({ key: 'venue', done: false });
  items.push({ key: 'setlist', done: input.setlistSongs > 0, count: { done: input.setlistSongs, total: input.setlistSongs } });
  if (input.setlistSongs > 0 && input.lyricsCovered !== undefined) {
    const covered = Math.min(input.lyricsCovered, input.setlistSongs);
    items.push({ key: 'lyrics', done: covered === input.setlistSongs, count: { done: covered, total: input.setlistSongs } });
  }
  if (input.rider !== undefined) {
    const r = input.rider;
    items.push({
      key: 'rider',
      done: !!r?.seen,
      state: !r ? 'none' : r.seen ? 'seen' : r.sent ? 'sent' : 'draft',
      ...(r ? { version: r.version } : {}),
    });
  }
  if (input.contract !== undefined) {
    items.push({ key: 'contract', done: !!input.contract?.signed, state: !input.contract ? 'none' : input.contract.signed ? 'signed' : 'unsigned' });
  }
  items.push({ key: 'lineup', done: active.length > 0 && confirmed === active.length, count: { done: confirmed, total: active.length } });
  if (input.tasks.length > 0) {
    items.push({ key: 'tasks', done: tasksDone === input.tasks.length, count: { done: tasksDone, total: input.tasks.length } });
  }
  if (input.deposit && input.deposit.amount > 0) {
    items.push({ key: 'deposit', done: input.deposit.paid });
  }

  const done = items.filter((i) => i.done).length;
  // Listed in the design's order; the next step goes by urgency.
  const next = NEXT_ORDER.map((k) => items.find((i) => i.key === k && !i.done)).find(Boolean) ?? null;
  return { items, done, total: items.length, next };
}
