import { describe, it, expect } from 'vitest';
import { homeAutoDetail, type HomeAutoDetailInput } from '../homeAutoDetail';

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
