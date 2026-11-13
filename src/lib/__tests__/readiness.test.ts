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
    expect(keys(ready)).toEqual(['setlist', 'lineup']);
    expect(r).toMatchObject({ done: 2, total: 2 });
  });

  it('flags a missing start time and venue', () => {
    const r = computeReadiness({ ...ready, timeSet: false, venueSet: false });
    expect(r.items.filter((i) => !i.done).map((i) => i.key)).toEqual(['time', 'venue']);
    expect(r).toMatchObject({ done: 2, total: 4 });
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
    expect(r).toMatchObject({ done: 2, total: 3 });
    const allDone = computeReadiness({ ...ready, tasks: [{ is_completed: true }] });
    expect(allDone).toMatchObject({ done: 3, total: 3 });
  });

  it('adds the deposit only when one is due (admins pass it, members never do)', () => {
    expect(keys({ ...ready, deposit: { amount: 0, paid: false } })).not.toContain('deposit');
    const due = computeReadiness({ ...ready, deposit: { amount: 720, paid: false } });
    expect(due.items[due.items.length - 1]).toMatchObject({ key: 'deposit', done: false });
    expect(computeReadiness({ ...ready, deposit: { amount: 720, paid: true } })).toMatchObject({ done: 3, total: 3 });
  });

  it('lists the open items first in its "next" pick', () => {
    const r = computeReadiness({ ...ready, setlistSongs: 0, lineup: [{ status: 'pending' }] });
    expect(r.next?.key).toBe('lineup');
    expect(computeReadiness(ready).next).toBeNull();
  });

  it('counts lyrics & charts only with a setlist', () => {
    expect(keys({ ...ready, setlistSongs: 0, lyricsCovered: 0 })).not.toContain('lyrics');
    const r = computeReadiness({ ...ready, lyricsCovered: 10 });
    expect(r.items.find((i) => i.key === 'lyrics')).toMatchObject({ done: false, count: { done: 10, total: 12 } });
    expect(computeReadiness({ ...ready, lyricsCovered: 12 }).items.find((i) => i.key === 'lyrics')?.done).toBe(true);
  });

  it('needs the rider seen by the venue', () => {
    expect(keys(ready)).not.toContain('rider');
    expect(computeReadiness({ ...ready, rider: null }).items.find((i) => i.key === 'rider')).toMatchObject({ done: false, state: 'none' });
    expect(computeReadiness({ ...ready, rider: { version: 3, sent: true, seen: false } }).items.find((i) => i.key === 'rider')).toMatchObject({
      done: false,
      state: 'sent',
      version: 3,
    });
    expect(computeReadiness({ ...ready, rider: { version: 3, sent: true, seen: true } }).items.find((i) => i.key === 'rider')?.done).toBe(true);
  });

  it('adds the contract only when passed (admins)', () => {
    expect(keys(ready)).not.toContain('contract');
    expect(computeReadiness({ ...ready, contract: null }).items.find((i) => i.key === 'contract')).toMatchObject({ done: false, state: 'none' });
    expect(computeReadiness({ ...ready, contract: { signed: true } }).items.find((i) => i.key === 'contract')).toMatchObject({ done: true, state: 'signed' });
  });

  it('keeps the design order: setlist, lyrics, rider, contract, lineup, deposit', () => {
    const k = keys({ ...ready, lyricsCovered: 12, rider: null, contract: null, deposit: { amount: 720, paid: false } });
    expect(k).toEqual(['setlist', 'lyrics', 'rider', 'contract', 'lineup', 'deposit']);
  });
});
