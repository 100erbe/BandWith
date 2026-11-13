/**
 * "Lineup so far" (Figma "Phone · Next / Notifications / Gig invitation",
 * "Duo · Next / Chat – event context"): who else is on a gig and whether they
 * answered. Names, instruments and status only: never a fee.
 */

export type LineupStatus = 'in' | 'maybe' | 'pending' | 'out';

export interface LineupRow {
  user_id: string;
  status?: string | null;
  /** event_members.role: the part on this gig ("Vocals"), or admin/member. */
  role?: string | null;
}

export interface LineupRosterEntry {
  name: string;
  instrument?: string | null;
}

export interface LineupPerson {
  userId: string;
  name: string;
  initials: string;
  instrument: string | null;
  status: LineupStatus;
  isViewer: boolean;
}

export interface LineupSummary {
  /** Everyone on the gig, viewer included, in answer order (in → maybe → pending → out). */
  people: LineupPerson[];
  /** Everyone but the viewer. */
  others: LineupPerson[];
  total: number;
  counts: Record<LineupStatus, number>;
}

const STATUS: Record<string, LineupStatus> = {
  confirmed: 'in',
  accepted: 'in',
  maybe: 'maybe',
  pending: 'pending',
  invited: 'pending',
  declined: 'out',
};

const ORDER: LineupStatus[] = ['in', 'maybe', 'pending', 'out'];

export const lineupStatus = (raw: string | null | undefined): LineupStatus => STATUS[(raw || '').toLowerCase()] ?? 'pending';

export const lineupInitials = (name: string): string => {
  const parts = name.replace(/[^\p{L}\p{N}\s.-]/gu, '').trim().split(/[\s.-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export function lineupSoFar(input: {
  rows: LineupRow[];
  roster: Map<string, LineupRosterEntry>;
  /** Names for people not on the roster (left the band, looked up in profiles). */
  extraNames?: Map<string, string>;
  viewerId?: string | null;
  unknownName: string;
}): LineupSummary {
  const seen = new Set<string>();
  const people: LineupPerson[] = [];
  for (const row of input.rows) {
    if (!row.user_id || seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    const info = input.roster.get(row.user_id);
    const name = info?.name || input.extraNames?.get(row.user_id) || input.unknownName;
    const role = (row.role || '').trim();
    const instrument = (role && !['admin', 'member'].includes(role.toLowerCase()) ? role : '') || info?.instrument || null;
    people.push({
      userId: row.user_id,
      name,
      initials: lineupInitials(name),
      instrument,
      status: lineupStatus(row.status),
      isViewer: !!input.viewerId && row.user_id === input.viewerId,
    });
  }
  // Stable: answer order first, then the order the band added them.
  const indexed = people.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => ORDER.indexOf(a.p.status) - ORDER.indexOf(b.p.status) || a.i - b.i);
  const sorted = indexed.map((x) => x.p);
  const counts: Record<LineupStatus, number> = { in: 0, maybe: 0, pending: 0, out: 0 };
  for (const p of sorted) counts[p.status] += 1;
  return { people: sorted, others: sorted.filter((p) => !p.isViewer), total: sorted.length, counts };
}
