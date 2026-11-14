/**
 * Figma "Duo · Home" (open): the next gig is already shown on the trailing
 * page, next to the dashboard. It opens once per visit to Home, so a detail
 * the user closed stays closed.
 *
 * Only leaving Home starts a new visit. A two-pane layout that drops for a
 * moment does not: folding and unfolding, or iOS resizing the app while it is
 * in the background (app switcher snapshots), used to reopen the gig over the
 * screen the user had left open.
 */
export interface HomeAutoDetailInput {
  twoPane: boolean;
  onHome: boolean;
  /** A detail is already open. */
  hasSelected: boolean;
  /** Events are still loading. */
  loading: boolean;
  /** There is an upcoming gig to show. */
  hasNext: boolean;
}

export function homeAutoDetail(done: boolean, input: HomeAutoDetailInput): { done: boolean; open: boolean } {
  if (!input.onHome) return { done: false, open: false };
  if (done || !input.twoPane || input.hasSelected || input.loading || !input.hasNext) return { done, open: false };
  return { done: true, open: true };
}

/**
 * The upcoming event Home opens on its own: the first one from `today`
 * (the local YYYY-MM-DD, see todayLocal; a UTC date skips today's gig in the
 * evening in the Americas), not a draft or a quote.
 */
export function nextAutoDetailEvent<E extends { date: string; time?: string; status?: string }>(
  events: readonly E[],
  today: string,
): E | undefined {
  return [...events]
    .filter((e) => e.date >= today && e.status !== 'DRAFT' && e.status !== 'QUOTE')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
}
