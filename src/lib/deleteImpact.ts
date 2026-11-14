/**
 * What a delete in the repertoire takes with it, in words for the confirm
 * sheet: a song leaves every setlist that has it (upcoming gigs included)
 * and its uploaded files; a setlist leaves the gigs that use it.
 */
import { dateName, formatList, t } from './i18n';

export interface ImpactGig {
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
}

const gigLabel = (g: ImpactGig) => {
  const [y, m, d] = g.date.split('-').map(Number);
  const day = y && m && d ? dateName(new Date(y, m - 1, d), { day: 'numeric', month: 'short' }) : '';
  return day ? `${g.title} (${day})` : g.title;
};

const MAX_NAMED = 5;
const named = (items: string[]) =>
  items.length > MAX_NAMED
    ? formatList([...items.slice(0, MAX_NAMED), t('{count} more', { count: items.length - MAX_NAMED })])
    : formatList(items);

/**
 * `usage` null: it couldn't be looked up (offline), so the text says it
 * leaves every setlist without naming them.
 */
export function songDeleteText(usage: { setlists: string[]; gigs: ImpactGig[] } | null, hasFiles: boolean): string {
  const parts: string[] = [];
  if (!usage) parts.push(t('It is also removed from every setlist that has it.'));
  else {
    if (usage.setlists.length === 1) parts.push(t('It is removed from the setlist {name}.', { name: usage.setlists[0] }));
    else if (usage.setlists.length > 1) parts.push(t('It is removed from {count} setlists: {names}.', { count: usage.setlists.length, names: named(usage.setlists) }));
    if (usage.gigs.length) parts.push(t('Upcoming gigs that play it: {gigs}.', { gigs: named(usage.gigs.map(gigLabel)) }));
  }
  if (hasFiles) parts.push(t('Its uploaded recording and chart are deleted for good.'));
  parts.push(t('This can’t be undone.'));
  return parts.join(' ');
}

export function setlistDeleteText(gigs: ImpactGig[] | null): string {
  const parts: string[] = [];
  if (gigs === null) parts.push(t('Gigs that use it lose their setlist.'));
  else if (gigs.length) parts.push(t('These upcoming gigs lose their setlist: {gigs}.', { gigs: named(gigs.map(gigLabel)) }));
  parts.push(t('The songs stay in your library.'));
  parts.push(t('This can’t be undone.'));
  return parts.join(' ');
}
