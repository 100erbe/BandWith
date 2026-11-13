import { describe, it, expect } from 'vitest';
import { bandFilterCanCreate, bandFilterOptions, bandFilterShowsFees, bandToActivateForCreate, feeForViewer, filterByBand, matchesBandFilter, normalizeBandFilter } from '../bandFilter';

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

const events = [
  { id: 1, band_id: A, status: 'CONFIRMED' },
  { id: 2, band_id: B, status: 'REHEARSAL' },
  { id: 3, band_id: A, status: 'QUOTE' },
  { id: 4, band_id: null, status: 'CONFIRMED' },
  { id: 5, status: 'CONFIRMED' },
];

describe('matchesBandFilter', () => {
  it('lets everything through on all', () => {
    expect(matchesBandFilter(A, 'all')).toBe(true);
    expect(matchesBandFilter(null, 'all')).toBe(true);
  });
  it('keeps only items without a band on personal', () => {
    expect(matchesBandFilter(undefined, 'personal')).toBe(true);
    expect(matchesBandFilter(null, 'personal')).toBe(true);
    expect(matchesBandFilter(A, 'personal')).toBe(false);
  });
  it('keeps only the chosen band', () => {
    expect(matchesBandFilter(A, A)).toBe(true);
    expect(matchesBandFilter(B, A)).toBe(false);
    expect(matchesBandFilter(null, A)).toBe(false);
  });
});

describe('filterByBand', () => {
  it('returns the same array on all', () => {
    expect(filterByBand(events, 'all')).toBe(events);
  });
  it('keeps every kind of event of one band', () => {
    expect(filterByBand(events, A).map((e) => e.id)).toEqual([1, 3]);
    expect(filterByBand(events, B).map((e) => e.id)).toEqual([2]);
  });
  it('keeps personal events', () => {
    expect(filterByBand(events, 'personal').map((e) => e.id)).toEqual([4, 5]);
  });
  it('never adds items', () => {
    for (const f of ['all', 'personal', A, B, 'gone']) {
      const out = filterByBand(events, f);
      expect(out.every((e) => events.includes(e))).toBe(true);
    }
  });
  it('combines with another filter in either order', () => {
    const gigs = (list: typeof events) => list.filter((e) => e.status === 'CONFIRMED');
    expect(gigs(filterByBand(events, A))).toEqual(filterByBand(gigs(events), A));
    expect(gigs(filterByBand(events, A)).map((e) => e.id)).toEqual([1]);
  });
});

describe('bandFilterOptions', () => {
  it('is empty with fewer than two bands', () => {
    expect(bandFilterOptions([], true)).toEqual([]);
    expect(bandFilterOptions([{ id: A, name: 'Alpha' }], true)).toEqual([]);
    expect(bandFilterOptions([{ id: A, name: 'Alpha' }, { id: null, name: 'Broken' }], false)).toEqual([]);
  });
  it('lists all, each band, then personal when there are personal gigs', () => {
    const bands = [{ id: A, name: 'Alpha' }, { id: B, name: 'Beta' }];
    expect(bandFilterOptions(bands, false).map((o) => o.id)).toEqual(['all', A, B]);
    expect(bandFilterOptions(bands, true).map((o) => o.id)).toEqual(['all', A, B, 'personal']);
    expect(bandFilterOptions(bands, true)[1].name).toBe('Alpha');
  });
});

describe('normalizeBandFilter', () => {
  const options = bandFilterOptions([{ id: A, name: 'Alpha' }, { id: B, name: 'Beta' }], false);
  it('keeps an offered value', () => {
    expect(normalizeBandFilter(A, options)).toBe(A);
    expect(normalizeBandFilter('all', options)).toBe('all');
  });
  it('falls back to all for a band left or personal without personal gigs', () => {
    expect(normalizeBandFilter('cccccccc-0000-0000-0000-000000000003', options)).toBe('all');
    expect(normalizeBandFilter('personal', options)).toBe('all');
  });
  it('falls back to all when the filter is hidden (one band)', () => {
    expect(normalizeBandFilter(A, bandFilterOptions([{ id: A, name: 'Alpha' }], true))).toBe('all');
  });
});

describe('bandFilterShowsFees', () => {
  const adminOf = (id: string) => id === A;
  it('follows the active band on all', () => {
    expect(bandFilterShowsFees('all', adminOf, true)).toBe(true);
    expect(bandFilterShowsFees('all', adminOf, false)).toBe(false);
  });
  it('never shows fees on personal', () => {
    expect(bandFilterShowsFees('personal', adminOf, true)).toBe(false);
    expect(bandFilterShowsFees('personal', adminOf, false)).toBe(false);
  });
  it('shows fees for a band only to its admins', () => {
    expect(bandFilterShowsFees(A, adminOf, false)).toBe(true);
    expect(bandFilterShowsFees(B, adminOf, true)).toBe(false);
  });
});

describe('feeForViewer', () => {
  const adminOf = (id: string) => id === A;
  it('keeps fees of bands the user admins and personal gigs', () => {
    expect(feeForViewer(A, 1800, adminOf)).toBe(1800);
    expect(feeForViewer(null, 300, adminOf)).toBe(300);
  });
  it('drops fees of bands where the user is a member', () => {
    expect(feeForViewer(B, 900, adminOf)).toBeNull();
  });
  it('keeps a missing fee missing', () => {
    expect(feeForViewer(A, null, adminOf)).toBeNull();
  });
});

describe('bandFilterCanCreate', () => {
  const adminOf = (id: string) => id === A;
  it('follows the active band on all', () => {
    expect(bandFilterCanCreate('all', adminOf, true)).toBe(true);
    expect(bandFilterCanCreate('all', adminOf, false)).toBe(false);
  });
  it('lets only admins of the shown band create', () => {
    expect(bandFilterCanCreate(A, adminOf, false)).toBe(true);
    expect(bandFilterCanCreate(B, adminOf, true)).toBe(false);
  });
  it('never on personal', () => {
    expect(bandFilterCanCreate('personal', adminOf, true)).toBe(false);
  });
});

describe('bandToActivateForCreate', () => {
  it('keeps the active band on all and personal', () => {
    expect(bandToActivateForCreate('all', A)).toBeNull();
    expect(bandToActivateForCreate('personal', A)).toBeNull();
  });
  it('keeps the active band when it is the one shown', () => {
    expect(bandToActivateForCreate(A, A)).toBeNull();
  });
  it('switches to the shown band otherwise', () => {
    expect(bandToActivateForCreate(B, A)).toBe(B);
    expect(bandToActivateForCreate(B, null)).toBe(B);
  });
});
