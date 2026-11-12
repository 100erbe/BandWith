import { supabase } from '../supabase';
import { t } from '@/lib/i18n';

/* ─────────────────────────────────────────────────────────────────────────
 * Gear / inventory (table `inventory`, migration 006).
 * Writes return their error and treat "0 rows touched" (RLS) as an error.
 * ───────────────────────────────────────────────────────────────────────── */

export type InventoryStatus = 'available' | 'in_use' | 'maintenance' | 'lost';

/** Figma order first (Instruments → Lighting), then the extra DB categories. */
export const INVENTORY_CATEGORIES = ['Instruments', 'Cables', 'Microphones', 'Stands', 'Lighting', 'Cases', 'Other'] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export interface InventoryItem {
  id: string;
  band_id: string;
  name: string;
  category: string;
  quantity: number;
  status: InventoryStatus | string;
  location?: string | null;
  notes?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface InventoryInput {
  name: string;
  category: string;
  quantity: number;
  status: InventoryStatus | string;
  location?: string;
  notes?: string;
  serialNumber?: string;
  purchaseDate?: string;
  /** Free text from the field; parsed to a number (blank → null). */
  purchasePrice?: string;
}

type Result<T> = { data: T | null; error: Error | null };

const noRowsMessage = () => t("This change wasn't saved: only band admins can manage the gear list.");

const asError = (err: unknown, fallback: string) => {
  const e = err as { message?: string } | null;
  return new Error(e?.message || fallback);
};

const blankToNull = (v?: string | null) => {
  const trimmed = (v ?? '').trim();
  return trimmed ? trimmed : null;
};

/** Matches a stored category to the canonical label (older rows may be lowercase). */
export const canonicalCategory = (category: string | null | undefined): string => {
  const hit = INVENTORY_CATEGORIES.find((c) => c.toLowerCase() === (category ?? '').toLowerCase());
  return hit ?? (category || 'Other');
};

export const parsePrice = (raw?: string): { value: number | null; error: string | null } => {
  const cleaned = (raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return { value: null, error: null };
  const v = Number(cleaned);
  if (!Number.isFinite(v) || v < 0) return { value: null, error: t('Enter a valid purchase price.') };
  return { value: Math.round(v * 100) / 100, error: null };
};

export const toInventoryRow = (input: InventoryInput): { row: Record<string, unknown> | null; error: string | null } => {
  const name = input.name.trim();
  if (!name) return { row: null, error: t('Give the item a name.') };
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 0) return { row: null, error: t('Quantity must be 0 or more.') };
  const price = parsePrice(input.purchasePrice);
  if (price.error) return { row: null, error: price.error };
  return {
    row: {
      name,
      category: input.category,
      quantity: qty,
      status: input.status,
      location: blankToNull(input.location),
      notes: blankToNull(input.notes),
      serial_number: blankToNull(input.serialNumber),
      purchase_date: blankToNull(input.purchaseDate),
      purchase_price: price.value,
    },
    error: null,
  };
};

export async function listInventory(bandId: string): Promise<Result<InventoryItem[]>> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('band_id', bandId)
    .order('name', { ascending: true });
  if (error) return { data: null, error: asError(error, t('Could not load the gear list.')) };
  return { data: (data || []) as InventoryItem[], error: null };
}

export async function createInventoryItem(bandId: string, input: InventoryInput): Promise<Result<InventoryItem>> {
  const { row, error: invalid } = toInventoryRow(input);
  if (!row) return { data: null, error: new Error(invalid || t('Check the item details.')) };
  const { data, error } = await supabase
    .from('inventory')
    .insert({ band_id: bandId, ...row })
    .select()
    .single();
  if (error) return { data: null, error: asError(error, t('Could not add the item.')) };
  if (!data) return { data: null, error: new Error(noRowsMessage()) };
  return { data: data as InventoryItem, error: null };
}

export async function updateInventoryItem(id: string, input: InventoryInput): Promise<Result<InventoryItem>> {
  const { row, error: invalid } = toInventoryRow(input);
  if (!row) return { data: null, error: new Error(invalid || t('Check the item details.')) };
  const { data, error } = await supabase.from('inventory').update(row).eq('id', id).select();
  if (error) return { data: null, error: asError(error, t('Could not save the item.')) };
  const updated = Array.isArray(data) ? data[0] : data;
  if (!updated) return { data: null, error: new Error(noRowsMessage()) };
  return { data: updated as InventoryItem, error: null };
}

export async function deleteInventoryItem(id: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.from('inventory').delete().eq('id', id).select('id');
  if (error) return { error: asError(error, t('Could not delete the item.')) };
  if (!data || (Array.isArray(data) && data.length === 0)) return { error: new Error(noRowsMessage()) };
  return { error: null };
}
