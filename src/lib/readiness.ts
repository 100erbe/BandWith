/**
 * Show readiness (Figma "Phone · Next", "iPad · 03"): what is settled for a
 * gig and what is still to do. One function for the gig screen and Home, so
 * both show the same count.
 *
 * Only data the viewer may read goes in: the deposit is the band's money, so
 * admins pass it and members never do.
 */

export type ReadinessKey = 'time' | 'venue' | 'lineup' | 'setlist' | 'tasks' | 'deposit';

export interface ReadinessItem {
  key: ReadinessKey;
  done: boolean;
  /** For lineup, setlist and to-dos: how many of how many. */
  count?: { done: number; total: number };
}

export interface ReadinessInput {
  /** The gig has a real start time (not a default). */
  timeSet: boolean;
  /** The gig has a venue (not "TBD"). */
  venueSet: boolean;
  /** Event members with their RSVP status. */
  lineup: { status?: string | null }[];
  setlistSongs: number;
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

export function computeReadiness(input: ReadinessInput): Readiness {
  const active = input.lineup.filter((m) => (m.status || '').toLowerCase() !== 'declined');
  const confirmed = active.filter((m) => (m.status || '').toLowerCase() === 'confirmed').length;
  const tasksDone = input.tasks.filter((task) => task.is_completed).length;

  const items: ReadinessItem[] = [
    { key: 'time', done: input.timeSet },
    { key: 'venue', done: input.venueSet },
    { key: 'lineup', done: active.length > 0 && confirmed === active.length, count: { done: confirmed, total: active.length } },
    { key: 'setlist', done: input.setlistSongs > 0, count: { done: input.setlistSongs, total: input.setlistSongs } },
  ];
  if (input.tasks.length > 0) {
    items.push({ key: 'tasks', done: tasksDone === input.tasks.length, count: { done: tasksDone, total: input.tasks.length } });
  }
  if (input.deposit && input.deposit.amount > 0) {
    items.push({ key: 'deposit', done: input.deposit.paid });
  }

  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, next: items.find((i) => !i.done) ?? null };
}
