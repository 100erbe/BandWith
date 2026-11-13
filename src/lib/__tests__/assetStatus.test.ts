import { describe, it, expect } from 'vitest';
import { assetStatusParts, countDueTasks, EMPTY_ASSET_STATUS } from '../assetStatus';

const totals = { repertoire: 40, inventory: 5, documents: 3, templates: 2 };

describe('assetStatusParts', () => {
  it('shows what needs attention first', () => {
    const parts = assetStatusParts(
      { ...EMPTY_ASSET_STATUS, songsReady: 92, songsLearning: 4, gearRepair: 1, contractsToSign: 3, contractsDraft: 1, tasksDue: 2, tasksOverdue: 1 },
      totals,
    );
    expect(parts.REPERTOIRE).toEqual([{ key: 'ready', count: 92 }, { key: 'learning', count: 4 }]);
    expect(parts.INVENTORY).toEqual([{ key: 'repair', count: 1, attention: true }]);
    expect(parts.DOCUMENTS).toEqual([{ key: 'toSign', count: 3, attention: true }, { key: 'drafts', count: 1 }]);
    expect(parts.TEMPLATES).toEqual([{ key: 'overdue', count: 1, attention: true }, { key: 'due', count: 2 }]);
  });

  it('says all is fine when there is something and nothing is pending', () => {
    const parts = assetStatusParts(EMPTY_ASSET_STATUS, totals);
    expect(parts.REPERTOIRE).toEqual([]);
    expect(assetStatusParts({ ...EMPTY_ASSET_STATUS, songsReady: 40 }, totals).REPERTOIRE).toEqual([{ key: 'allReady' }]);
    expect(parts.INVENTORY).toEqual([{ key: 'allGood' }]);
    expect(parts.DOCUMENTS).toEqual([{ key: 'nothingToSign' }]);
    expect(parts.TEMPLATES).toEqual([{ key: 'nothingDue' }]);
  });

  it('shows nothing for empty libraries', () => {
    const parts = assetStatusParts(EMPTY_ASSET_STATUS, { repertoire: 0, inventory: 0, documents: 0, templates: 0 });
    expect(Object.values(parts).every((p) => p.length === 0)).toBe(true);
  });
});

describe('countDueTasks', () => {
  it('counts overdue and due this week for upcoming events only', () => {
    const today = '2026-12-30';
    expect(
      countDueTasks(
        [
          { due_date: '2026-12-28', event_date: '2027-01-10' }, // overdue
          { due_date: '2026-12-30', event_date: '2027-01-10' }, // due today
          { due_date: '2027-01-06', event_date: '2027-01-10' }, // day 7, across the new year
          { due_date: '2027-01-07', event_date: '2027-01-10' }, // later
          { due_date: '2026-12-20', event_date: '2026-12-29' }, // past gig
          { due_date: null, event_date: '2027-01-10' },
        ],
        today,
      ),
    ).toEqual({ due: 2, overdue: 1 });
  });
});
