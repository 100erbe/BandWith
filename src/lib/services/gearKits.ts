import { supabase } from '../supabase';
import { t } from '@/lib/i18n';
import { todayLocal } from '@/lib/dates';
import { diffKitItems, validateKitName, type EventGearKit, type GearKit, type GearKitItemLink, type KitGig } from '@/lib/gearKits';
import type { InventoryItem } from './inventory';

/* ─────────────────────────────────────────────────────────────────────────
 * Gear kits (tables gear_kits, gear_kit_items, event_gear_kits; migration
 * 094). Band members read, admins write. Writes return their error and treat
 * "0 rows touched" (RLS) as an error, like the inventory service.
 * ───────────────────────────────────────────────────────────────────────── */

type Result<T> = { data: T | null; error: Error | null };

const KIT_COLUMNS = 'id, band_id, name, notes, created_by, created_at, updated_at';
const LINK_COLUMNS = 'kit_id, inventory_id, band_id, position';
const USE_COLUMNS = 'event_id, kit_id, band_id, created_at';

const adminOnly = () => t('Only band admins can change gear kits.');

const asError = (err: unknown, fallback: string) => {
  const e = err as { message?: string } | null;
  return new Error(e?.message || fallback);
};

const nameError = (raw: string): Error | null => {
  const { error } = validateKitName(raw);
  if (error === 'empty') return new Error(t('Give the kit a name.'));
  if (error === 'long') return new Error(t('Keep the kit name under 80 characters.'));
  return null;
};

export interface BandKits {
  kits: GearKit[];
  links: GearKitItemLink[];
  uses: EventGearKit[];
}

/** Every kit of a band, with its item links and the gigs it's used for. */
export async function listBandKits(bandId: string): Promise<Result<BandKits>> {
  const [kits, links, uses] = await Promise.all([
    supabase.from('gear_kits').select(KIT_COLUMNS).eq('band_id', bandId).order('name', { ascending: true }),
    supabase.from('gear_kit_items').select(LINK_COLUMNS).eq('band_id', bandId).order('position', { ascending: true }),
    supabase.from('event_gear_kits').select(USE_COLUMNS).eq('band_id', bandId),
  ]);
  const error = kits.error || links.error || uses.error;
  if (error) return { data: null, error: asError(error, t('Could not load the gear kits.')) };
  return {
    data: {
      kits: (kits.data || []) as GearKit[],
      links: (links.data || []) as GearKitItemLink[],
      uses: (uses.data || []) as EventGearKit[],
    },
    error: null,
  };
}

/** The band's gigs from today on, for "Use for a gig" and the next-gig line. */
export async function listKitGigs(bandId: string): Promise<Result<KitGig[]>> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, event_date, date, event_type, status')
    .eq('band_id', bandId)
    .order('event_date', { ascending: true });
  if (error) return { data: null, error: asError(error, t('Could not load your gigs.')) };
  const today = todayLocal();
  const gigs = ((data || []) as { id: string; title: string | null; event_date: string | null; date?: string | null; event_type: string | null; status: string | null }[])
    .filter((e) => e.event_type !== 'rehearsal' && e.status !== 'cancelled')
    .map((e) => ({ id: e.id, title: e.title || t('Untitled'), date: String(e.event_date || e.date || '').slice(0, 10) }))
    .filter((g) => !g.date || g.date >= today)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  return { data: gigs, error: null };
}

async function insertLinks(kitId: string, bandId: string, itemIds: string[], from = 0): Promise<Error | null> {
  if (itemIds.length === 0) return null;
  const rows = itemIds.map((inventory_id, i) => ({ kit_id: kitId, inventory_id, band_id: bandId, position: from + i }));
  const { data, error } = await supabase.from('gear_kit_items').insert(rows).select('kit_id');
  if (error) return asError(error, t('Could not save the kit items.'));
  if (!data || (Array.isArray(data) && data.length === 0)) return new Error(adminOnly());
  return null;
}

export async function createKit(bandId: string, name: string, notes: string, itemIds: string[]): Promise<Result<GearKit>> {
  const invalid = nameError(name);
  if (invalid) return { data: null, error: invalid };
  const { data, error } = await supabase
    .from('gear_kits')
    .insert({ band_id: bandId, name: validateKitName(name).name, notes: notes.trim() || null })
    .select(KIT_COLUMNS)
    .single();
  if (error) return { data: null, error: asError(error, t('Could not create the kit.')) };
  if (!data) return { data: null, error: new Error(adminOnly()) };
  const kit = data as GearKit;
  const linkError = await insertLinks(kit.id, bandId, itemIds);
  if (linkError) return { data: kit, error: linkError };
  return { data: kit, error: null };
}

/** Saves the name, notes and item list (adds and removes only what changed, then renumbers). */
export async function updateKit(kit: GearKit, name: string, notes: string, prevItemIds: string[], itemIds: string[]): Promise<Result<GearKit>> {
  const invalid = nameError(name);
  if (invalid) return { data: null, error: invalid };
  const { data, error } = await supabase
    .from('gear_kits')
    .update({ name: validateKitName(name).name, notes: notes.trim() || null })
    .eq('id', kit.id)
    .select(KIT_COLUMNS);
  if (error) return { data: null, error: asError(error, t('Could not save the kit.')) };
  const updated = (Array.isArray(data) ? data[0] : data) as GearKit | undefined;
  if (!updated) return { data: null, error: new Error(adminOnly()) };

  const { add, remove } = diffKitItems(prevItemIds, itemIds);
  if (remove.length > 0) {
    const { error: delError } = await supabase.from('gear_kit_items').delete().eq('kit_id', kit.id).in('inventory_id', remove);
    if (delError) return { data: updated, error: asError(delError, t('Could not save the kit items.')) };
  }
  const addError = await insertLinks(kit.id, kit.band_id, add, itemIds.length);
  if (addError) return { data: updated, error: addError };
  // Keep the order the admin sees.
  const moved = itemIds.map((id, position) => ({ id, position })).filter(({ id }, i) => prevItemIds.indexOf(id) !== i || add.includes(id));
  for (const { id, position } of moved) {
    const { error: posError } = await supabase.from('gear_kit_items').update({ position }).eq('kit_id', kit.id).eq('inventory_id', id);
    if (posError) return { data: updated, error: asError(posError, t('Could not save the kit items.')) };
  }
  return { data: updated, error: null };
}

export async function deleteKit(kitId: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.from('gear_kits').delete().eq('id', kitId).select('id');
  if (error) return { error: asError(error, t('Could not delete the kit.')) };
  if (!data || (Array.isArray(data) && data.length === 0)) return { error: new Error(adminOnly()) };
  return { error: null };
}

/** Links a kit to a gig: its items go with the band on that date. */
export async function addKitToGig(kitId: string, eventId: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.from('event_gear_kits').insert({ kit_id: kitId, event_id: eventId }).select('event_id');
  if (error) {
    // Already linked: nothing to do.
    if ((error as { code?: string }).code === '23505') return { error: null };
    return { error: asError(error, t('Could not add the kit to the gig.')) };
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return { error: new Error(adminOnly()) };
  return { error: null };
}

export async function removeKitFromGig(kitId: string, eventId: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.from('event_gear_kits').delete().eq('kit_id', kitId).eq('event_id', eventId).select('event_id');
  if (error) return { error: asError(error, t('Could not remove the kit from the gig.')) };
  if (!data || (Array.isArray(data) && data.length === 0)) return { error: new Error(adminOnly()) };
  return { error: null };
}

export interface GigKits extends BandKits {
  inventory: InventoryItem[];
}

/** A gig's kits with their items, for the gig's Gear kit card. */
export async function loadGigKits(eventId: string, bandId: string): Promise<Result<GigKits>> {
  const [uses, kits, links, inventory] = await Promise.all([
    supabase.from('event_gear_kits').select(USE_COLUMNS).eq('event_id', eventId),
    supabase.from('gear_kits').select(KIT_COLUMNS).eq('band_id', bandId).order('name', { ascending: true }),
    supabase.from('gear_kit_items').select(LINK_COLUMNS).eq('band_id', bandId).order('position', { ascending: true }),
    supabase.from('inventory').select('*').eq('band_id', bandId),
  ]);
  const error = uses.error || kits.error || links.error || inventory.error;
  if (error) return { data: null, error: asError(error, t('Could not load the gear kits.')) };
  return {
    data: {
      uses: (uses.data || []) as EventGearKit[],
      kits: (kits.data || []) as GearKit[],
      links: (links.data || []) as GearKitItemLink[],
      inventory: (inventory.data || []) as InventoryItem[],
    },
    error: null,
  };
}
