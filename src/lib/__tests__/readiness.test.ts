import { describe, it, expect } from 'vitest';
import { computeReadiness, type ReadinessInput } from '../readiness';

const ready: ReadinessInput = {
  timeSet: true,
  venueSet: true,
  lineup: [{ status: 'confirmed' }, { status: 'confirmed' }],
  setlistSongs: 12,
  tasks: [],
};

const keys = (input: ReadinessInput) => computeReadiness(input).items.map((i) => i.key);

describe('computeReadiness', () => {
  it('counts a fully prepared gig as ready', () => {
    const r = computeReadiness(ready);
    expect(keys(ready)).toEqual(['time', 'venue', 'lineup', 'setlist']);
    expect(r).toMatchObject({ done: 4, total: 4 });
  });

  it('flags a missing start time and venue', () => {
    const r = computeReadiness({ ...ready, timeSet: false, venueSet: false });
    expect(r.items.filter((i) => !i.done).map((i) => i.key)).toEqual(['time', 'venue']);
    expect(r.done).toBe(2);
  });

  it('needs every musician who has not declined to confirm', () => {
    const r = computeReadiness({ ...ready, lineup: [{ status: 'confirmed' }, { status: 'pending' }, { status: 'declined' }] });
    const lineup = r.items.find((i) => i.key === 'lineup')!;
    expect(lineup).toMatchObject({ done: false, count: { done: 1, total: 2 } });
  });

  it('treats an empty lineup as not ready', () => {
    const lineup = computeReadiness({ ...ready, lineup: [] }).items.find((i) => i.key === 'lineup')!;
    expect(lineup).toMatchObject({ done: false, count: { done: 0, total: 0 } });
    const allDeclined = computeReadiness({ ...ready, lineup: [{ status: 'declined' }] }).items.find((i) => i.key === 'lineup')!;
    expect(allDeclined.done).toBe(false);
  });

  it('needs at least one song in the setlist', () => {
    const setlist = computeReadiness({ ...ready, setlistSongs: 0 }).items.find((i) => i.key === 'setlist')!;
    expect(setlist).toMatchObject({ done: false, count: { done: 0, total: 0 } });
  });

  it('adds to-dos only when the gig has some', () => {
    const r = computeReadiness({ ...ready, tasks: [{ is_completed: true }, { is_completed: false }] });
    expect(r.items.find((i) => i.key === 'tasks')).toMatchObject({ done: false, count: { done: 1, total: 2 } });
    expect(r).toMatchObject({ done: 4, total: 5 });
    const allDone = computeReadiness({ ...ready, tasks: [{ is_completed: true }] });
    expect(allDone).toMatchObject({ done: 5, total: 5 });
  });

  it('adds the deposit only when one is due (admins pass it, members never do)', () => {
    expect(keys({ ...ready, deposit: { amount: 0, paid: false } })).not.toContain('deposit');
    const due = computeReadiness({ ...ready, deposit: { amount: 720, paid: false } });
    expect(due.items[due.items.length - 1]).toMatchObject({ key: 'deposit', done: false });
    expect(computeReadiness({ ...ready, deposit: { amount: 720, paid: true } })).toMatchObject({ done: 5, total: 5 });
  });

  it('lists the open items first in its "next" pick', () => {
    const r = computeReadiness({ ...ready, setlistSongs: 0, lineup: [{ status: 'pending' }] });
    expect(r.next?.key).toBe('lineup');
    expect(computeReadiness(ready).next).toBeNull();
  });
});
