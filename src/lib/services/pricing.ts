import { supabase } from '@/lib/supabase';
import { setActiveCurrency } from '@/lib/currency';
import type { PerformanceType } from '@/app/data/quotes';

export type PricingMode = 'per_musician' | 'flat_packages';
export type BandMarkupType = 'none' | 'percent' | 'fixed';
export type TravelCalcMode = 'per_vehicle' | 'per_musician' | 'flat_km';
export type LogisticsBillingMode = 'included' | 'separate' | 'client_provided';
export type ProductionBillingMode = 'included' | 'separate' | 'client_provided' | 'none';
export type CustomServiceCategory = 'performance' | 'production' | 'logistics' | 'custom';
export type CustomServiceUnit = 'flat' | 'per_person' | 'per_hour' | 'per_km';

export interface LineupPackagePreset {
  id: string;
  name: string;
  performanceType: PerformanceType;
  musiciansCount: number;
  flatPrice: number;
  description?: string;
  is_active: boolean;
}

export interface CustomService {
  id: string;
  name: string;
  category: CustomServiceCategory;
  description?: string;
  price: number;
  unit: CustomServiceUnit;
  default_duration_mins?: number;
  default_musicians?: number;
  is_active: boolean;
}

export interface BandPricingSettings {
  band_id: string;
  currency: 'EUR' | 'USD' | 'GBP' | 'CHF' | string;
  /** ISO country code the band invoices from (drives the default currency + VAT preset). */
  country?: string;

  // ── 1. Universal Lineup & Base Pricing ────────────────────────
  pricing_mode: PricingMode;
  base_musician_rate: number;
  use_roster_member_fees: boolean;
  enable_external_sub_rate?: boolean;
  external_sub_rate?: number;
  lineup_packages: LineupPackagePreset[];

  // Legacy fields kept in sync for backward compatibility
  core_members_count: number;
  core_member_rate: number;
  session_musician_rate: number;
  ceremony_musician_fee: number;
  cocktail_musician_fee: number;
  dj_hourly_rate: number;

  // ── 2. Band Fund / Agency Markup ──────────────────────────────
  band_markup_type: BandMarkupType;
  band_markup_value: number;
  margin_divisor: number; // Legacy sync: e.g. 0.85 for 15% margin

  // ── 3. Travel & Logistics ─────────────────────────────────────
  band_origin_address: string;
  band_origin_lat?: number;
  band_origin_lng?: number;
  travel_calc_mode: TravelCalcMode;
  travel_rate_per_km: number;
  travel_vehicles_count: number;
  free_travel_radius_km: number;
  default_travel_included: boolean;
  default_travel_mode: LogisticsBillingMode;

  // ── 4. Sound, Lighting & Production ───────────────────────────
  default_production_mode: ProductionBillingMode;
  default_production_tier: 'standard' | 'pro' | 'none';
  production_standard_fee: number;
  production_pro_fee: number;
  production_extra_location_fee: number;

  // ── 5. Unified Extra Sets & Add-On Services Catalog ───────────
  custom_services: CustomService[];

  // ── 6. Commercial Rules, Seasonality & Tax ────────────────────
  seasonal_pricing_enabled: boolean;
  peak_season_multiplier: number;
  low_season_multiplier: number;
  mid_season_multiplier?: number;
  rounding_step?: number;
  peak_months: number[];     // 1-12 (e.g. [5, 6, 9, 10])
  off_peak_months: number[]; // 1-12 (e.g. [1, 2, 3, 11])
  default_vat_rate: number;
  default_deposit_rate: number;
  default_validity_days: number;
  default_quote_disclaimer?: string;

  // ── 7. Branding, Sign-off & Bank Details (PDF) ────────────────
  band_logo_url?: string;
  signature_url?: string;
  signer_name?: string;
  signer_role?: string;
  bank_account_holder?: string;
  bank_iban?: string;
  bank_name?: string;
  bank_bic_swift?: string;
  default_payment_terms?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  legal_company_name?: string;
  tax_vat_id?: string;
  legal_address?: string;
}

export const DEFAULT_QUOTE_DISCLAIMER =
  'This quote is valid for {days} days from the issue date. Event date is officially reserved upon receipt of the booking deposit.';

// ── Default Lineup Formation Packages ───────────────────────────
export const DEFAULT_LINEUP_PACKAGES: LineupPackagePreset[] = [
  {
    id: 'pkg-solo',
    name: 'Solo',
    performanceType: 'solo',
    musiciansCount: 1,
    flatPrice: 350,
    description: 'Solo performance',
    is_active: true,
  },
  {
    id: 'pkg-duo',
    name: 'Duo',
    performanceType: 'duo',
    musiciansCount: 2,
    flatPrice: 650,
    description: 'Vocals + instrument duo',
    is_active: true,
  },
  {
    id: 'pkg-trio',
    name: 'Trio',
    performanceType: 'trio',
    musiciansCount: 3,
    flatPrice: 950,
    description: '3-piece compact lineup',
    is_active: true,
  },
  {
    id: 'pkg-full',
    name: 'Full Band',
    performanceType: 'full_band',
    musiciansCount: 5,
    flatPrice: 1600,
    description: 'Full live band show',
    is_active: true,
  },
];

// ── 1-Tap Genre / Band Type Service Preset Bundles ──────────────
export const WEDDING_SERVICE_PRESETS: CustomService[] = [
  {
    id: 'srv-ceremony',
    name: 'Ceremony Live Music',
    category: 'performance',
    description: 'Entrance, ceremony highlights & exit (30-45 mins)',
    price: 150,
    unit: 'per_person',
    default_duration_mins: 45,
    default_musicians: 2,
    is_active: true,
  },
  {
    id: 'srv-cocktail',
    name: 'Cocktail / Aperitif Set',
    category: 'performance',
    description: 'Welcome drinks acoustic/lounge set (60 mins)',
    price: 150,
    unit: 'per_person',
    default_duration_mins: 60,
    default_musicians: 3,
    is_active: true,
  },
  {
    id: 'srv-dinner',
    name: 'Dinner Background Set',
    category: 'performance',
    description: 'Soft background music during dinner',
    price: 400,
    unit: 'flat',
    default_duration_mins: 90,
    is_active: false,
  },
  {
    id: 'srv-afterparty-dj',
    name: 'After-Party DJ Set',
    category: 'performance',
    description: 'DJ music after the live band sets',
    price: 150,
    unit: 'per_hour',
    default_duration_mins: 120,
    is_active: true,
  },
  {
    id: 'srv-second-zone',
    name: 'Secondary Audio Zone',
    category: 'production',
    description: 'Extra speaker + wireless mic for outdoor/garden area',
    price: 180,
    unit: 'flat',
    is_active: true,
  },
];

export const CLUB_ROCK_SERVICE_PRESETS: CustomService[] = [
  {
    id: 'srv-extra-set',
    name: 'Extra 45m Live Set',
    category: 'performance',
    description: 'Additional 45-minute live performance set',
    price: 300,
    unit: 'flat',
    default_duration_mins: 45,
    is_active: true,
  },
  {
    id: 'srv-acoustic-opener',
    name: 'Acoustic Opening Set',
    category: 'performance',
    description: 'Warm-up acoustic set before main show',
    price: 250,
    unit: 'flat',
    default_duration_mins: 40,
    is_active: true,
  },
  {
    id: 'srv-sound-tech',
    name: 'Dedicated FOH Sound Engineer',
    category: 'production',
    description: 'Professional sound technician for the event',
    price: 250,
    unit: 'flat',
    is_active: true,
  },
  {
    id: 'srv-backline-share',
    name: 'Full Backline & Drum Kit Rental',
    category: 'production',
    description: 'Band provides full backline and drum kit',
    price: 200,
    unit: 'flat',
    is_active: true,
  },
];

export const CORPORATE_JAZZ_PRESETS: CustomService[] = [
  {
    id: 'srv-welcome-trio',
    name: 'Networking / Welcome Reception Set',
    category: 'performance',
    description: 'Elegant instrumental background set (60 mins)',
    price: 450,
    unit: 'flat',
    default_duration_mins: 60,
    is_active: true,
  },
  {
    id: 'srv-wireless-mics',
    name: 'Speech & Awards Wireless Mic Package',
    category: 'production',
    description: 'PA coverage + 2 wireless microphones for speeches',
    price: 150,
    unit: 'flat',
    is_active: true,
  },
  {
    id: 'srv-early-loadin',
    name: 'Early Load-In / Idle Waiting Time',
    category: 'logistics',
    description: 'Setup prior to corporate doors opening',
    price: 75,
    unit: 'per_hour',
    is_active: true,
  },
];

// Backward-compatible aliases
export const WEDDING_EVENT_PRESETS = WEDDING_SERVICE_PRESETS;
export const ORIGINAL_CLUB_PRESETS = CLUB_ROCK_SERVICE_PRESETS;
export const JAZZ_CORPORATE_PRESETS = CORPORATE_JAZZ_PRESETS;

export const DEFAULT_BAND_PRICING: BandPricingSettings = {
  band_id: 'default',
  currency: 'EUR',

  // Universal Lineup Pricing
  pricing_mode: 'per_musician',
  base_musician_rate: 250,
  use_roster_member_fees: true,
  enable_external_sub_rate: false,
  external_sub_rate: 200,
  lineup_packages: DEFAULT_LINEUP_PACKAGES,

  // Legacy fields synced
  core_members_count: 4,
  core_member_rate: 250,
  session_musician_rate: 200,
  ceremony_musician_fee: 150,
  cocktail_musician_fee: 150,
  dj_hourly_rate: 150,

  // Band Fund / Markup
  band_markup_type: 'none',
  band_markup_value: 0,
  margin_divisor: 1,

  // Travel & Logistics
  band_origin_address: '',
  travel_calc_mode: 'per_vehicle',
  travel_rate_per_km: 0.5,
  travel_vehicles_count: 1,
  free_travel_radius_km: 30,
  default_travel_included: false,
  default_travel_mode: 'separate',

  // Sound & Lighting
  default_production_mode: 'included',
  default_production_tier: 'standard',
  production_standard_fee: 300,
  production_pro_fee: 600,
  production_extra_location_fee: 180,

  // Unified Services Catalog
  custom_services: WEDDING_SERVICE_PRESETS,

  // Commercial Rules & Tax
  seasonal_pricing_enabled: false,
  peak_season_multiplier: 1.15,
  low_season_multiplier: 0.9,
  peak_months: [5, 6, 9, 10],
  off_peak_months: [1, 2, 3, 11],
  default_vat_rate: 21,
  default_deposit_rate: 30,
  default_validity_days: 30,
  default_quote_disclaimer: DEFAULT_QUOTE_DISCLAIMER,

  // Branding & Bank
  band_logo_url: '',
  signature_url: '',
  signer_name: '',
  signer_role: '',
  bank_account_holder: '',
  bank_iban: '',
  bank_name: '',
  bank_bic_swift: '',
  default_payment_terms: '30% deposit upon booking; 70% balance due on event date.',
};

const normalizeServiceCategory = (cat?: string): CustomServiceCategory => {
  if (cat === 'performance' || cat === 'production' || cat === 'logistics' || cat === 'custom') {
    return cat;
  }
  return 'custom';
};

/**
 * Ensures any previously saved band settings in Supabase/LocalStorage
 * automatically gain the new universal fields without losing existing values.
 */
export function normalizeBandPricingSettings(
  raw?: Partial<BandPricingSettings> | null,
  bandId = 'default'
): BandPricingSettings {
  const merged: BandPricingSettings = {
    ...DEFAULT_BAND_PRICING,
    ...(raw || {}),
    band_id: raw?.band_id || bandId,
  };

  // Sync base_musician_rate <-> core_member_rate (fallback to core_member_rate || 250)
  if (raw?.base_musician_rate !== undefined && raw.core_member_rate === undefined) {
    merged.core_member_rate = raw.base_musician_rate;
  } else if (raw?.base_musician_rate === undefined) {
    merged.base_musician_rate = raw?.core_member_rate || 250;
    merged.core_member_rate = merged.base_musician_rate;
  }

  // Sync external_sub_rate <-> session_musician_rate
  if (raw?.external_sub_rate !== undefined && raw.session_musician_rate === undefined) {
    merged.session_musician_rate = raw.external_sub_rate;
  } else if (raw?.external_sub_rate === undefined && raw?.session_musician_rate !== undefined) {
    merged.external_sub_rate = raw.session_musician_rate;
  }

  // Migrate legacy margin_divisor (< 1) to transparent band_markup_type
  if (
    raw?.band_markup_type === undefined &&
    typeof raw?.margin_divisor === 'number' &&
    raw.margin_divisor > 0 &&
    raw.margin_divisor < 1
  ) {
    merged.band_markup_type = 'percent';
    merged.band_markup_value = Math.round((1 - raw.margin_divisor) * 100);
  }

  // Keep legacy margin_divisor synced with band_markup_type
  if (merged.band_markup_type === 'percent' && merged.band_markup_value > 0) {
    merged.margin_divisor = Math.max(0.1, Number((1 - merged.band_markup_value / 100).toFixed(2)));
  } else {
    merged.margin_divisor = 1;
  }

  // Sync default_travel_included <-> default_travel_mode
  if (raw?.default_travel_included !== undefined && raw?.default_travel_mode === undefined) {
    merged.default_travel_mode = raw.default_travel_included ? 'included' : 'separate';
  } else if (raw?.default_travel_mode !== undefined && raw?.default_travel_included === undefined) {
    merged.default_travel_included = raw.default_travel_mode === 'included';
  } else {
    merged.default_travel_included = Boolean(merged.default_travel_included);
    if (merged.default_travel_included && merged.default_travel_mode === 'separate') {
      merged.default_travel_mode = 'included';
    } else if (!merged.default_travel_included && merged.default_travel_mode === 'included') {
      merged.default_travel_mode = 'separate';
    }
  }

  // Normalize lineup packages
  if (!Array.isArray(merged.lineup_packages) || merged.lineup_packages.length === 0) {
    merged.lineup_packages = DEFAULT_LINEUP_PACKAGES.map(p => ({ ...p }));
  }

  // Normalize custom_services & migrate legacy wedding fees if upgrading from pre-universal schema
  if (!Array.isArray(merged.custom_services)) {
    merged.custom_services = WEDDING_SERVICE_PRESETS.map(s => ({ ...s }));
  } else {
    merged.custom_services = merged.custom_services.map(s => ({
      ...s,
      category: normalizeServiceCategory(s.category),
    }));

    if (raw && raw.pricing_mode === undefined) {
      const existingIds = new Set(merged.custom_services.map(s => s.id));
      const migratedWeddingSets: CustomService[] = [];

      if (!existingIds.has('srv-ceremony') && (raw.ceremony_musician_fee ?? 0) > 0) {
        migratedWeddingSets.push({
          ...WEDDING_SERVICE_PRESETS[0],
          price: raw.ceremony_musician_fee!,
        });
      }
      if (!existingIds.has('srv-cocktail') && (raw.cocktail_musician_fee ?? 0) > 0) {
        migratedWeddingSets.push({
          ...WEDDING_SERVICE_PRESETS[1],
          price: raw.cocktail_musician_fee!,
        });
      }
      if (!existingIds.has('srv-afterparty-dj') && (raw.dj_hourly_rate ?? 0) > 0) {
        migratedWeddingSets.push({
          ...WEDDING_SERVICE_PRESETS[3],
          price: raw.dj_hourly_rate!,
        });
      }

      if (migratedWeddingSets.length > 0) {
        merged.custom_services = [...migratedWeddingSets, ...merged.custom_services];
      }
    }
  }

  return merged;
}

// ── Universal Calculation Helpers ───────────────────────────────

export function calculateTravelFeeFromSettings(
  oneWayDistanceKm: number,
  musiciansCount: number,
  settings: BandPricingSettings
): number {
  if (!oneWayDistanceKm || oneWayDistanceKm <= 0) return 0;
  const freeRadius = Math.max(0, settings.free_travel_radius_km ?? 0);
  const billableKm = Math.max(0, oneWayDistanceKm - freeRadius);
  if (billableKm <= 0) return 0;

  const rate = settings.travel_rate_per_km ?? 0.5;
  const roundtripKm = billableKm * 2;

  switch (settings.travel_calc_mode) {
    case 'per_musician':
      return Math.round(roundtripKm * rate * Math.max(1, musiciansCount));
    case 'flat_km':
      return Math.round(roundtripKm * rate);
    case 'per_vehicle':
    default: {
      const vehicles = Math.max(1, settings.travel_vehicles_count || 1);
      return Math.round(roundtripKm * rate * vehicles);
    }
  }
}

export function calculateLineupBaseFromSettings(params: {
  packageId?: string;
  performanceType?: PerformanceType;
  musiciansCount: number;
  rosterFeesSum?: number;
  eventMonth?: number; // 1-12
  settings: BandPricingSettings;
}): {
  rawLineupCost: number;
  bandMarkupAmount: number;
  seasonalAdjustmentAmount: number;
  totalLineupBase: number;
} {
  const { packageId, performanceType, musiciansCount, rosterFeesSum, eventMonth, settings } = params;

  let rawLineupCost = 0;

  if (settings.pricing_mode === 'flat_packages') {
    const activePkgs = (settings.lineup_packages || []).filter(p => p.is_active);
    const matchedPkg =
      (packageId ? activePkgs.find(p => p.id === packageId) : undefined) ||
      (performanceType ? activePkgs.find(p => p.performanceType === performanceType) : undefined) ||
      activePkgs.find(p => p.musiciansCount === musiciansCount) ||
      activePkgs[activePkgs.length - 1];

    rawLineupCost = matchedPkg
      ? matchedPkg.flatPrice
      : Math.max(1, musiciansCount) * (settings.base_musician_rate || settings.core_member_rate || 250);
  } else {
    if (settings.use_roster_member_fees && rosterFeesSum && rosterFeesSum > 0) {
      rawLineupCost = rosterFeesSum;
    } else {
      const rate = settings.base_musician_rate || settings.core_member_rate || 250;
      rawLineupCost = Math.max(1, musiciansCount) * rate;
    }
  }

  // Band Fund / Agency Markup
  let bandMarkupAmount = 0;
  if (settings.band_markup_type === 'fixed' && settings.band_markup_value > 0) {
    bandMarkupAmount = Math.round(settings.band_markup_value);
  } else if (settings.band_markup_type === 'percent' && settings.band_markup_value > 0) {
    bandMarkupAmount = Math.round(rawLineupCost * (settings.band_markup_value / 100));
  }

  const subtotalBeforeSeason = rawLineupCost + bandMarkupAmount;

  // Optional Seasonal Adjustment
  let seasonalAdjustmentAmount = 0;
  if (settings.seasonal_pricing_enabled && eventMonth) {
    if (settings.peak_months?.includes(eventMonth)) {
      seasonalAdjustmentAmount = Math.round(
        subtotalBeforeSeason * ((settings.peak_season_multiplier || 1) - 1)
      );
    } else if (settings.off_peak_months?.includes(eventMonth)) {
      seasonalAdjustmentAmount = -Math.round(
        subtotalBeforeSeason * (1 - (settings.low_season_multiplier || 1))
      );
    }
  }

  return {
    rawLineupCost,
    bandMarkupAmount,
    seasonalAdjustmentAmount,
    totalLineupBase: Math.max(0, subtotalBeforeSeason + seasonalAdjustmentAmount),
  };
}

export interface SmartQuoteInput {
  musiciansCount: number;
  performanceType?: PerformanceType;
  distanceKm: number;
  productionTier: 'standard' | 'pro' | 'none';
  extraLocationsCount?: number;
  cocktailMusicians?: number;
  ceremonyMusicians?: number;
  djHours?: number;
  discountPercent?: number;
  eventMonth?: number;
}

export interface SmartQuoteBreakdown {
  coreMusiciansCost: number;
  bandMarkupCost: number;
  seasonalAdjustmentCost: number;
  totalLineupBase: number;
  productionCost: number;
  travelCost: number;
  extrasCost: number;
  netTotal: number;
  vatAmount: number;
  totalWithVat: number;
}

export function calculateSmartQuote(
  input: SmartQuoteInput,
  settings: BandPricingSettings
): SmartQuoteBreakdown {
  const lineup = calculateLineupBaseFromSettings({
    performanceType: input.performanceType,
    musiciansCount: input.musiciansCount,
    eventMonth: input.eventMonth,
    settings,
  });

  const isProductionFree =
    settings.default_production_mode === 'included' ||
    settings.default_production_mode === 'client_provided' ||
    settings.default_production_mode === 'none' ||
    input.productionTier === 'none';

  const productionCost = isProductionFree
    ? 0
    : input.productionTier === 'pro'
      ? settings.production_pro_fee
      : settings.production_standard_fee;

  const extraZonesCost =
    (input.extraLocationsCount || 0) * (settings.production_extra_location_fee || 0);

  const isTravelFree =
    Boolean(settings.default_travel_included) ||
    settings.default_travel_mode === 'included' ||
    settings.default_travel_mode === 'client_provided';

  const travelCost = isTravelFree
    ? 0
    : calculateTravelFeeFromSettings(input.distanceKm, input.musiciansCount, settings);

  const ceremonyCost = (input.ceremonyMusicians || 0) * (settings.ceremony_musician_fee || 0);
  const cocktailCost = (input.cocktailMusicians || 0) * (settings.cocktail_musician_fee || 0);
  const djCost = (input.djHours || 0) * (settings.dj_hourly_rate || 0);
  const extrasCost = ceremonyCost + cocktailCost + djCost + extraZonesCost;

  const grossBeforeDiscount = lineup.totalLineupBase + productionCost + travelCost + extrasCost;
  const discountAmt =
    input.discountPercent && input.discountPercent > 0
      ? Math.round(grossBeforeDiscount * (input.discountPercent / 100))
      : 0;

  const netTotal = Math.max(0, grossBeforeDiscount - discountAmt);
  const vatAmount = Math.round(netTotal * ((settings.default_vat_rate || 0) / 100));
  const totalWithVat = netTotal + vatAmount;

  return {
    coreMusiciansCost: lineup.rawLineupCost,
    bandMarkupCost: lineup.bandMarkupAmount,
    seasonalAdjustmentCost: lineup.seasonalAdjustmentAmount,
    totalLineupBase: lineup.totalLineupBase,
    productionCost,
    travelCost,
    extrasCost,
    netTotal,
    vatAmount,
    totalWithVat,
  };
}

// ── Persistence Layer (Supabase + LocalStorage Fallback) ────────

const STORAGE_KEY_PREFIX = 'bandwith_pricing_settings_';

export async function getBandPricing(bandId: string): Promise<BandPricingSettings> {
  const effectiveId = bandId || 'default';
  const localKey = `${STORAGE_KEY_PREFIX}${effectiveId}`;

  try {
    if (effectiveId !== 'default') {
      const { data, error } = await supabase
        .from('bands')
        .select('pricing_settings')
        .eq('id', effectiveId)
        .maybeSingle();

      if (!error && data?.pricing_settings) {
        const normalized = normalizeBandPricingSettings(data.pricing_settings, effectiveId);
        localStorage.setItem(localKey, JSON.stringify(normalized));
        setActiveCurrency(normalized.currency, effectiveId);
        return normalized;
      }
    }
  } catch (err) {
    console.warn('[pricing] Supabase fetch fallback to localStorage:', err);
  }

  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const normalized = normalizeBandPricingSettings(JSON.parse(cached), effectiveId);
      setActiveCurrency(normalized.currency, effectiveId);
      return normalized;
    }
  } catch {
    // Ignore JSON parse errors
  }

  return normalizeBandPricingSettings(DEFAULT_BAND_PRICING, effectiveId);
}

export async function saveBandPricing(
  settings: BandPricingSettings
): Promise<BandPricingSettings> {
  const effectiveId = settings.band_id || 'default';
  const normalized = normalizeBandPricingSettings(settings, effectiveId);
  const localKey = `${STORAGE_KEY_PREFIX}${effectiveId}`;
  setActiveCurrency(normalized.currency, effectiveId);

  try {
    localStorage.setItem(localKey, JSON.stringify(normalized));
  } catch (err) {
    console.warn('[pricing] Failed to cache pricing in localStorage:', err);
  }

  try {
    if (effectiveId !== 'default') {
      await supabase
        .from('bands')
        .update({ pricing_settings: normalized })
        .eq('id', effectiveId);
    }
  } catch (err) {
    console.warn('[pricing] Failed to save pricing_settings to Supabase:', err);
  }

  return normalized;
}

const BRANDING_MAX_EDGE = 1200;
const BRANDING_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Re-encode a picked image as PNG (or JPEG if still too big), max 1200px.
 * Handles HEIC from the iPhone camera roll and keeps quote PDFs light.
 */
async function normalizeBrandingImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unsupported image'));
      el.src = url;
    });
    const scale = Math.min(1, BRANDING_MAX_EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const toBlob = (type: string, q?: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
    const png = await toBlob('image/png');
    if (png && png.size <= BRANDING_MAX_BYTES) return png;
    const jpeg = await toBlob('image/jpeg', 0.85);
    if (jpeg && jpeg.size <= BRANDING_MAX_BYTES) return jpeg;
    throw new Error('Image too large');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });

export async function uploadBandBrandingAsset(
  bandId: string,
  file: File,
  assetType: 'logo' | 'signature'
): Promise<string> {
  const image = await normalizeBrandingImage(file);
  const ext = image.type === 'image/jpeg' ? 'jpg' : 'png';

  if (bandId && bandId !== 'default') {
    try {
      const path = `${bandId}/${assetType}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('band-branding')
        .upload(path, image, { upsert: true, contentType: image.type });
      if (!error) {
        const { data } = supabase.storage.from('band-branding').getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
      } else {
        console.warn('[pricing] Branding upload failed, keeping it inline:', error.message);
      }
    } catch (err) {
      console.warn('[pricing] Branding upload failed, keeping it inline:', err);
    }
  }

  // Offline / demo / bucket missing: keep the (already downscaled) image inline.
  return blobToDataUrl(image);
}
