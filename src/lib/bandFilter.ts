/**
 * Calendar band filter, for people in more than one band.
 *
 * The value is 'all' (every band: the default), 'personal' (own gigs with no
 * band) or a band id. It only narrows what the calendar already shows: the
 * events it starts from are the ones this user may see, so picking a band
 * never reveals anything more.
 */

export type BandFilter = 'all' | 'personal' | (string & {});

export const ALL_BANDS: BandFilter = 'all';
export const PERSONAL: BandFilter = 'personal';

export interface BandFilterOption {
  id: BandFilter;
  /** Band name; empty for 'all' and 'personal' (the caller labels them). */
  name: string;
}

/** The filter shows only to people in at least this many bands. */
export const MIN_BANDS_FOR_FILTER = 2;

/** Does an item of `bandId` (none = personal) pass `filter`? */
export function matchesBandFilter(bandId: string | null | undefined, filter: BandFilter): boolean {
  if (filter === ALL_BANDS) return true;
  if (filter === PERSONAL) return !bandId;
  return bandId === filter;
}

/** `items` that pass `filter` (same array when nothing is filtered). */
export function filterByBand<T extends { band_id?: string | null }>(items: T[], filter: BandFilter): T[] {
  if (filter === ALL_BANDS) return items;
  return items.filter((e) => matchesBandFilter(e.band_id, filter));
}

/**
 * The pills to show: All, each band, then Personal when the user has personal
 * gigs. None at all for fewer than two bands.
 */
export function bandFilterOptions(
  bands: ReadonlyArray<{ id?: string | null; name?: string | null }>,
  hasPersonal: boolean,
): BandFilterOption[] {
  const real = bands.filter((b): b is { id: string; name?: string | null } => !!b.id);
  if (real.length < MIN_BANDS_FOR_FILTER) return [];
  return [
    { id: ALL_BANDS, name: '' },
    ...real.map((b) => ({ id: b.id as BandFilter, name: b.name || '' })),
    ...(hasPersonal ? [{ id: PERSONAL, name: '' }] : []),
  ];
}

/**
 * Back to 'all' when the chosen value is no longer offered (the user left the
 * band, is down to one band, or has no personal gigs left), so a hidden filter
 * never hides events.
 */
export function normalizeBandFilter(filter: BandFilter, options: ReadonlyArray<BandFilterOption>): BandFilter {
  if (filter === ALL_BANDS) return filter;
  return options.some((o) => o.id === filter) ? filter : ALL_BANDS;
}
