import { describe, it, expect } from 'vitest';
import { attentionItems, diffKitItems, isItemReady, kitItems, summarizeKit, validateKitName, type GearKitItemLink } from '../gearKits';
import type { InventoryItem } from '../services/inventory';

const item = (id: string, status: string, category = 'Other', quantity = 1): InventoryItem => ({
  id,
  band_id: 'b',
  name: `Item ${id}`,
  category,
  quantity,
  status,
  created_at: '2026-01-01',
});

const inv = new Map(
  [item('a', 'available'), item('b', 'in_use'), item('c', 'maintenance'), item('d', 'lost'), item('e', 'available', 'cases', 2)].map((i) => [i.id, i]),
);
const links: GearKitItemLink[] = [
  { kit_id: 'k1', inventory_id: 'c', position: 2 },
  { kit_id: 'k1', inventory_id: 'a', position: 0 },
  { kit_id: 'k1', inventory_id: 'b', position: 1 },
  { kit_id: 'k1', inventory_id: 'e', position: 3 },
  { kit_id: 'k1', inventory_id: 'gone', position: 4 },
  { kit_id: 'k2', inventory_id: 'd', position: 0 },
];

describe('gear kits', () => {
  it('counts in use as ready, maintenance and lost as not', () => {
    expect(isItemReady('available')).toBe(true);
    expect(isItemReady('in_use')).toBe(true);
    expect(isItemReady('maintenance')).toBe(false);
    expect(isItemReady('lost')).toBe(false);
  });

  it('lists a kit in order and skips deleted items', () => {
    expect(kitItems('k1', links, inv).map((i) => i.id)).toEqual(['a', 'b', 'c', 'e']);
  });

  it('summarizes ready, repair, cases and the next gig', () => {
    const uses = [
      { kit_id: 'k1', event_id: 'past' },
      { kit_id: 'k1', event_id: 'later' },
      { kit_id: 'k1', event_id: 'soon' },
      { kit_id: 'k2', event_id: 'other' },
    ];
    const gigs = [
      { id: 'past', title: 'Old', date: '2026-01-01' },
      { id: 'later', title: 'Later', date: '2026-12-20' },
      { id: 'soon', title: 'Soon', date: '2026-12-12' },
      { id: 'other', title: 'Other', date: '2026-12-01' },
    ];
    const s = summarizeKit('k1', links, inv, uses, gigs, '2026-11-13');
    expect(s).toMatchObject({ total: 4, ready: 3, repair: 1, lost: 0, inUse: 1, cases: 2 });
    expect(s.nextGig?.id).toBe('soon');
    expect(summarizeKit('k2', links, inv, uses, gigs, '2026-11-13')).toMatchObject({ total: 1, ready: 0, lost: 1, cases: 0 });
    expect(summarizeKit('none', links, inv).nextGig).toBeNull();
  });

  it('puts maintenance before lost in the attention list', () => {
    expect(attentionItems([item('x', 'lost'), item('y', 'available'), item('z', 'maintenance')]).map((i) => i.id)).toEqual(['z', 'x']);
  });

  it('validates the kit name', () => {
    expect(validateKitName('  Club   PA ')).toEqual({ name: 'Club PA', error: null });
    expect(validateKitName('   ').error).toBe('empty');
    expect(validateKitName('x'.repeat(81)).error).toBe('long');
  });

  it('diffs the item list', () => {
    expect(diffKitItems(['a', 'b', 'c'], ['c', 'd', 'a'])).toEqual({ add: ['d'], remove: ['b'] });
  });
});
