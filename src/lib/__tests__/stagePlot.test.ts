import { describe, expect, it } from 'vitest';
import { asStageData, channelLabel, isStageEmpty, moveInput, moveItem, stageSize, starterStage, toStageRow, LIMITS } from '../stagePlot';

describe('stagePlot', () => {
  it('sanitises bad rows instead of failing', () => {
    expect(asStageData(null)).toEqual(asStageData(undefined));
    const d = asStageData({
      plots: [{ id: 'p', name: 'Full band', items: [{ id: 'a', kind: 'player', code: 'DR', x: 5, y: -1 }, { kind: 'nope' }] }, 'junk'],
      inputs: [{ source: 'Kick', mic: 'Beta 52' }, { source: 'Bass', mic: 'DI' }, 42],
      band_brings: ['PA', '', 3],
      venue_provides: 'power',
      venue_agreed: true,
    } as any);
    expect(d.plots).toHaveLength(1);
    const item = d.plots[0].items[0];
    expect(item.x).toBeLessThanOrEqual(1);
    expect(item.y).toBeGreaterThanOrEqual(0);
    expect(d.inputs.map((c) => c.kind)).toEqual(['mic', 'di']);
    expect(d.inputs.every((c) => !!c.id)).toBe(true);
    expect(d.bandBrings).toEqual(['PA']);
    expect(d.venueProvides).toEqual([]);
    expect(d.venueAgreed).toBe(true);
  });

  it('caps the lists', () => {
    const inputs = Array.from({ length: LIMITS.inputs + 10 }, (_, i) => ({ source: `In ${i}`, mic: 'SM58' }));
    expect(asStageData({ plots: [], inputs, band_brings: [], venue_provides: [] }).inputs).toHaveLength(LIMITS.inputs);
  });

  it('round-trips through the database row', () => {
    const d = starterStage([{ name: 'Marta Conti', instrument: 'Drums' }, { name: 'Leo M.', instrument: 'Vocals' }]);
    expect(asStageData(toStageRow(d) as any)).toEqual(d);
  });

  it('builds a starter plot and inputs from the lineup', () => {
    const d = starterStage([
      { name: 'Marta Conti', instrument: 'Drums' },
      { name: 'Jonah Reyes', instrument: 'Bass' },
      { name: 'Leo M.', instrument: 'Vocals · Band leader' },
    ]);
    expect(d.plots).toHaveLength(1);
    const codes = d.plots[0].items.filter((i) => i.kind === 'player').map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['DR', 'BS', 'VX']));
    expect(d.plots[0].items.find((i) => i.code === 'VX')?.lead).toBe(true);
    expect(d.inputs[0]).toMatchObject({ source: 'Kick', who: 'Marta' });
    expect(d.inputs.some((c) => c.source === 'Bass' && c.kind === 'di' && c.who === 'Jonah')).toBe(true);
    expect(isStageEmpty(d)).toBe(false);
    expect(isStageEmpty(asStageData(null))).toBe(true);
  });

  it('moves channels and items', () => {
    const d = asStageData({ plots: [], inputs: [{ source: 'A', mic: 'x' }, { source: 'B', mic: 'x' }, { source: 'C', mic: 'x' }], band_brings: [], venue_provides: [] });
    expect(moveInput(d.inputs, 0, 2).map((c) => c.source)).toEqual(['B', 'C', 'A']);
    expect(moveInput(d.inputs, 0, 9)).toBe(d.inputs);
    const plot = { id: 'p', name: 'x', items: [{ id: 'i', kind: 'wedge' as const, x: 0.5, y: 0.5 }] };
    const moved = moveItem(plot, 'i', 2, -3).items[0];
    expect(moved.x).toBeLessThanOrEqual(1);
    expect(moved.y).toBeGreaterThanOrEqual(0);
  });

  it('formats labels', () => {
    expect(channelLabel(0)).toBe('01');
    expect(channelLabel(12)).toBe('13');
    expect(stageSize({ id: 'p', name: 'x', widthM: 6, depthM: 4.5, items: [] })).toBe('6 × 4.5 m');
    expect(stageSize({ id: 'p', name: 'x', items: [] })).toBe('');
  });
});
