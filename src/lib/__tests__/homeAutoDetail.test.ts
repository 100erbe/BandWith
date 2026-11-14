import { describe, it, expect, vi, afterEach } from 'vitest';
import { homeAutoDetail, nextAutoDetailEvent, type HomeAutoDetailInput } from '../homeAutoDetail';
import { todayLocal } from '../dates';

const base: HomeAutoDetailInput = { twoPane: true, onHome: true, hasSelected: false, loading: false, hasNext: true };

/** Runs a sequence of renders, as the effect sees them, and records each `open`. */
function run(steps: Partial<HomeAutoDetailInput>[]): boolean[] {
  let done = false;
  return steps.map((s) => {
    const r = homeAutoDetail(done, { ...base, ...s });
    done = r.done;
    return r.open;
  });
}

describe('homeAutoDetail', () => {
  it('opens the next gig once on Home in two panes', () => {
    expect(run([{}, {}])).toEqual([true, false]);
  });

  it('waits for the events and for an upcoming gig', () => {
    expect(run([{ loading: true }, { hasNext: false }, {}])).toEqual([false, false, true]);
  });

  it('does not replace a detail that is already open', () => {
    expect(run([{ hasSelected: true }])).toEqual([false]);
  });

  it('keeps a closed detail closed when the app comes back from the background', () => {
    // Opened, closed by the user, then iOS resizes the hidden app (snapshots)
    // and the two-pane layout drops for a moment.
    expect(run([{}, { hasSelected: true }, {}, { twoPane: false }, {}])).toEqual([true, false, false, false, false]);
  });

  it('keeps it closed across a fold and unfold on Home', () => {
    expect(run([{}, { twoPane: false }, { twoPane: true }])).toEqual([true, false, false]);
  });

  it('opens again on the next visit to Home', () => {
    expect(run([{}, { onHome: false }, {}])).toEqual([true, false, true]);
  });

  it('opens when the device unfolds on Home for the first time', () => {
    expect(run([{ twoPane: false }, { twoPane: true }])).toEqual([false, true]);
  });
});

describe('nextAutoDetailEvent', () => {
  afterEach(() => vi.useRealTimers());

  const events = [
    { date: '2026-11-12', time: '21:00', status: 'CONFIRMED', id: 'yesterday' },
    { date: '2026-11-14', time: '20:00', status: 'CONFIRMED', id: 'tomorrow' },
    { date: '2026-11-13', time: '21:00', status: 'CONFIRMED', id: 'tonight' },
    { date: '2026-11-13', time: '18:00', status: 'QUOTE', id: 'quote' },
    { date: '2026-11-13', time: '17:00', status: 'DRAFT', id: 'draft' },
  ];

  it("opens tonight's gig in the evening (local day, not UTC)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 23, 30)); // 23:30 local, already the 14th in UTC west of Greenwich
    expect(todayLocal()).toBe('2026-11-13');
    expect(nextAutoDetailEvent(events, todayLocal())?.id).toBe('tonight');
  });

  it("does not open yesterday's gig just after midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 0, 30));
    expect(nextAutoDetailEvent(events, todayLocal())?.id).toBe('tomorrow');
  });
});
