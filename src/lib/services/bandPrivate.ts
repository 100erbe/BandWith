/**
 * Band banking, tax and pricing data (migration 077).
 *
 * Only the band's active admins may see the pricing settings (rates, IBAN,
 * payment terms, signature), the rate columns, VAT number, legal details and
 * Stripe id. They come from bw_band_private(); the bands table itself is read
 * with BAND_PUBLIC_COLUMNS, so step 2 can revoke the rest.
 */
import { supabase } from '@/lib/supabase';

/** Columns every member may read: identity, branding and logistics. */
export const BAND_PUBLIC_COLUMNS =
  'id, name, logo_url, description, created_by, created_at, updated_at, slug, cover_url, location, website, social_links, settings, plan, genre, formed_date, standard_lineup_size, home_base_address, home_base_latitude, home_base_longitude, pricing_currency';

/** Columns returned by bw_band_private() to admins only. */
export const BAND_PRIVATE_COLUMNS = [
  'pricing_settings', 'pricing_rules', 'extra_services',
  'core_musician_fee', 'additional_musician_fee', 'ceremony_musician_fee', 'cocktail_musician_fee',
  'dj_hourly_rate', 'production_standard_fee', 'production_pro_fee', 'production_extra_location_fee',
  'travel_rate_per_km', 'default_payment_terms',
  'bank_account_holder', 'bank_iban', 'bank_bic_swift', 'bank_name',
  'tax_vat_id', 'legal_company_name', 'legal_address',
  'signature_url', 'signer_name', 'signer_role', 'contact_email', 'contact_phone',
  'stripe_customer_id',
] as const;

export interface BandPrivateRow {
  band_id: string;
  private: Record<string, unknown>;
}

/** Database before 077: read the columns directly, as before. */
const isMissingRpc = (err: { code?: string; message?: string } | null): boolean =>
  !!err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message || ''));

/** Private rows for the bands the caller administers (none for a member). */
export async function getBandPrivate(
  bandIds: string[],
): Promise<{ data: BandPrivateRow[]; error: Error | null }> {
  const ids = [...new Set(bandIds.filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.rpc('bw_band_private', { p_band_ids: ids });
  if (error && isMissingRpc(error)) {
    const legacy = await supabase
      .from('bands')
      .select(`id, ${BAND_PRIVATE_COLUMNS.join(', ')}`)
      .in('id', ids);
    if (legacy.error) return { data: [], error: new Error(legacy.error.message) };
    return {
      data: (legacy.data || []).map(({ id, ...rest }: any) => ({ band_id: id, private: rest })),
      error: null,
    };
  }
  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: (Array.isArray(data) ? data : []).map((r: any) => ({
      band_id: r.band_id,
      private: r.private && typeof r.private === 'object' ? r.private : {},
    })),
    error: null,
  };
}

/**
 * Adds the private fields to bands the caller administers. Other bands keep
 * only the public columns: any private field they carry is dropped.
 */
export function withBandPrivate<T extends { id: string }>(bands: T[], rows: BandPrivateRow[]): T[] {
  const byId = new Map(rows.map((r) => [r.band_id, r.private]));
  return bands.map((b) => {
    const clean = { ...b } as Record<string, unknown>;
    for (const col of BAND_PRIVATE_COLUMNS) delete clean[col];
    const priv = byId.get(b.id);
    return (priv ? { ...clean, ...priv } : clean) as T;
  });
}

/** Reads the private data for these bands and merges it in. */
export async function attachBandPrivate<T extends { id: string }>(bands: T[]): Promise<T[]> {
  if (bands.length === 0) return bands;
  const { data } = await getBandPrivate(bands.map((b) => b.id));
  return withBandPrivate(bands, data);
}
