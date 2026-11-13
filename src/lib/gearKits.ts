/**
 * Gear kits: named sets of inventory items (migration 094). Pure helpers for
 * the kit cards, the kit detail and the gig's kit card: which items a kit
 * holds, how many are ready, what needs attention, the next gig it goes to.
 */
import { canonicalCategory, type InventoryItem } from '@/lib/services/inventory';

export interface GearKit {
  id: string;
  band_id: string;
  name: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface GearKitItemLink {
  kit_id: string;
  inventory_id: string;
  band_id?: string;
  position: number;
}

export interface EventGearKit {
  event_id: string;
  kit_id: string;
  band_id?: string;
  created_at?: string;
}

/** A gig a kit can be used for (the picker and the "next gig" line). */
export interface KitGig {
  id: string;
  title: string;
  /** YYYY-MM-DD, or '' when the date isn't set yet. */
  date: string;
}

/** Ready = goes on the gig as is: available or already out with a member. */
export const isItemReady = (status: string | null | undefined): boolean => status !== 'maintenance' && status !== 'lost';

/** The kit's items in kit order, skipping links to items no longer in the inventory. */
export function kitItems(kitId: string, links: GearKitItemLink[], inventoryById: Map<string, InventoryItem>): InventoryItem[] {
  return links
    .filter((l) => l.kit_id === kitId)
    .sort((a, b) => a.position - b.position)
    .map((l) => inventoryById.get(l.inventory_id))
    .filter((i): i is InventoryItem => !!i);
}

export interface KitSummary {
  items: InventoryItem[];
  total: number;
  ready: number;
  /** Items in maintenance (Figma "1 REPAIR"). */
  repair: number;
  lost: number;
  inUse: number;
  /** Items of the Cases category: what the kit packs into. */
  cases: number;
  /** The first gig, today or later, this kit is used for. */
  nextGig: KitGig | null;
}

export function summarizeKit(
  kitId: string,
  links: GearKitItemLink[],
  inventoryById: Map<string, InventoryItem>,
  uses: EventGearKit[] = [],
  gigs: KitGig[] = [],
  today = '',
): KitSummary {
  const items = kitItems(kitId, links, inventoryById);
  const count = (s: string) => items.filter((i) => i.status === s).length;
  const gigIds = new Set(uses.filter((u) => u.kit_id === kitId).map((u) => u.event_id));
  const nextGig =
    gigs
      .filter((g) => gigIds.has(g.id) && (!g.date || !today || g.date >= today))
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))[0] ?? null;
  return {
    items,
    total: items.length,
    ready: items.filter((i) => isItemReady(i.status)).length,
    repair: count('maintenance'),
    lost: count('lost'),
    inUse: count('in_use'),
    cases: items.filter((i) => canonicalCategory(i.category) === 'Cases').reduce((n, i) => n + Math.max(1, Number(i.quantity) || 0), 0),
    nextGig,
  };
}

/** Items that need a look before the gig: maintenance first, then lost. */
export const attentionItems = (items: InventoryItem[]): InventoryItem[] =>
  [...items.filter((i) => i.status === 'maintenance'), ...items.filter((i) => i.status === 'lost')];

/** Trimmed name, or an error key when it can't be saved. */
export function validateKitName(raw: string): { name: string; error: 'empty' | 'long' | null } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { name, error: 'empty' };
  if (name.length > 80) return { name, error: 'long' };
  return { name, error: null };
}

/** What to add and remove so a kit holds exactly `next` (order kept from `next`). */
export function diffKitItems(prev: string[], next: string[]): { add: string[]; remove: string[] } {
  const before = new Set(prev);
  const after = new Set(next);
  return { add: next.filter((id) => !before.has(id)), remove: prev.filter((id) => !after.has(id)) };
}
