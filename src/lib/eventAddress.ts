/**
 * Event address helpers.
 *
 * events.venue_address stores the full line ("Via Mazzini 12, Milano") and
 * events.venue_city the city on its own. The gig form edits the two apart and
 * joins them again on save, so the address field must start without the city:
 * otherwise every edit appended it once more ("…, Milano, Milano").
 */

/** The street part of a saved address: drops a trailing ", <city>". */
export function addressWithoutCity(address?: string | null, city?: string | null): string {
  const full = (address || '').trim();
  const c = (city || '').trim();
  if (!full || !c) return full;
  const parts = full.split(',').map((p) => p.trim());
  while (parts.length > 1 && parts[parts.length - 1].toLocaleLowerCase() === c.toLocaleLowerCase()) parts.pop();
  return parts.join(', ');
}
