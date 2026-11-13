/**
 * Status lines for the asset tiles in the identity hub ("Repertoire · 92 ready",
 * "Gear · 1 in repair", "Contracts · 3 to sign", "To-do · 2 due this week").
 * Pure: counts in, lines out. Contracts are admin-only, so their counts are
 * only loaded for admins.
 */
import { parseLocalDate, toLocalDateString } from '@/lib/dates';

/** YYYY-MM-DD plus n calendar days (local). */
export const addDaysLocal = (day: string, n: number): string => {
  const d = parseLocalDate(day);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
};

export interface AssetStatusCounts {
  songsReady: number;
  songsLearning: number;
  gearRepair: number;
  gearMissing: number;
  contractsToSign: number;
  contractsDraft: number;
  tasksDue: number;
  tasksOverdue: number;
}

export const EMPTY_ASSET_STATUS: AssetStatusCounts = {
  songsReady: 0,
  songsLearning: 0,
  gearRepair: 0,
  gearMissing: 0,
  contractsToSign: 0,
  contractsDraft: 0,
  tasksDue: 0,
  tasksOverdue: 0,
};

export type AssetId = 'REPERTOIRE' | 'INVENTORY' | 'DOCUMENTS' | 'TEMPLATES';
/** One part of a status line: a message key, its count, and whether it needs attention. */
export interface StatusPart {
  key: 'ready' | 'allReady' | 'learning' | 'repair' | 'missing' | 'toSign' | 'drafts' | 'overdue' | 'due' | 'allGood' | 'nothingToSign' | 'nothingDue';
  count?: number;
  attention?: boolean;
}

/** The parts to show under each tile; an empty list shows nothing. */
export function assetStatusParts(
  c: AssetStatusCounts,
  totals: { repertoire: number; inventory: number; documents: number; templates: number },
): Record<AssetId, StatusPart[]> {
  const repertoire: StatusPart[] = [];
  if (c.songsReady > 0 && c.songsReady === totals.repertoire) repertoire.push({ key: 'allReady' });
  else if (c.songsReady > 0) repertoire.push({ key: 'ready', count: c.songsReady });
  if (c.songsLearning > 0) repertoire.push({ key: 'learning', count: c.songsLearning });

  const inventory: StatusPart[] = [];
  if (c.gearRepair > 0) inventory.push({ key: 'repair', count: c.gearRepair, attention: true });
  if (c.gearMissing > 0) inventory.push({ key: 'missing', count: c.gearMissing, attention: true });
  if (inventory.length === 0 && totals.inventory > 0) inventory.push({ key: 'allGood' });

  const documents: StatusPart[] = [];
  if (c.contractsToSign > 0) documents.push({ key: 'toSign', count: c.contractsToSign, attention: true });
  if (c.contractsDraft > 0) documents.push({ key: 'drafts', count: c.contractsDraft });
  if (documents.length === 0 && totals.documents > 0) documents.push({ key: 'nothingToSign' });

  const templates: StatusPart[] = [];
  if (c.tasksOverdue > 0) templates.push({ key: 'overdue', count: c.tasksOverdue, attention: true });
  if (c.tasksDue > 0) templates.push({ key: 'due', count: c.tasksDue });
  if (templates.length === 0 && totals.templates > 0) templates.push({ key: 'nothingDue' });

  return { REPERTOIRE: repertoire, INVENTORY: inventory, DOCUMENTS: documents, TEMPLATES: templates };
}

/**
 * Splits open tasks into overdue and due within the next 7 days. Only tasks of
 * events still to come (today or later) count: a past gig's leftovers aren't a to-do.
 */
export function countDueTasks(
  tasks: { due_date: string | null; event_date: string | null }[],
  today: string,
): { due: number; overdue: number } {
  const weekEnd = addDaysLocal(today, 7);
  let due = 0;
  let overdue = 0;
  for (const task of tasks) {
    const d = task.due_date?.slice(0, 10);
    const ev = task.event_date?.slice(0, 10);
    if (!d || !ev || ev < today) continue;
    if (d < today) overdue += 1;
    else if (d <= weekEnd) due += 1;
  }
  return { due, overdue };
}
