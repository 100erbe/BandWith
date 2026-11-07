import { supabase } from '@/lib/supabase';

export interface CustomService {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  unit: 'flat' | 'per_person' | 'per_hour' | 'per_km';
  is_active: boolean;
}

export interface BandPricingSettings {
  band_id: string;
  currency: string;
  core_member_rate: number;
  session_musician_rate: number;
  core_members_count: number;
  cocktail_musician_fee: number;
  ceremony_musician_fee: number;
  dj_hourly_rate: number;
  production_standard_fee: number;
  production_pro_fee: number;
  production_extra_location_fee: number;
  travel_rate_per_km: number;
  band_origin_address: string;
  band_origin_lat?: number;
  band_origin_lng?: number;
  low_season_multiplier: number;
  mid_season_multiplier: number;
  peak_season_multiplier: number;
  margin_divisor: number;
  rounding_step: number;
  default_vat_rate: number;
  default_deposit_rate: number;
  custom_services: CustomService[];
  // Quote Branding & Sign-off
  band_logo_url?: string;
  signature_url?: string;
  signer_name?: string;
  signer_role?: string;
  // Contact & Legal Info
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  legal_company_name?: string;
  tax_vat_id?: string;
  legal_address?: string;
  // Payment Details
  bank_account_holder?: string;
  bank_iban?: string;
  bank_bic_swift?: string;
  bank_name?: string;
  default_payment_terms?: string;
  // Quote Defaults
  default_validity_days?: number;
  default_quote_disclaimer?: string;
}

export const DEFAULT_QUOTE_DISCLAIMER =
  'IMPORTANT: This quote is valid for {days} days from the date of issue. Pricing is valid exclusively for the event date indicated. Any modification to the date will require a new quote to guarantee availability and to update costs.';

export const DEFAULT_PAYMENT_TERMS =
  '{deposit}% initial deposit upon booking; {balance}% balance due before event';

export const DEFAULT_BAND_PRICING: BandPricingSettings = {
  band_id: 'default',
  currency: 'EUR',
  core_member_rate: 300,
  session_musician_rate: 250,
  core_members_count: 1,
  cocktail_musician_fee: 150,
  ceremony_musician_fee: 150,
  dj_hourly_rate: 100,
  production_standard_fee: 300,
  production_pro_fee: 600,
  production_extra_location_fee: 150,
  travel_rate_per_km: 0.15,
  band_origin_address: '',
  low_season_multiplier: 0.9,
  mid_season_multiplier: 1,
  peak_season_multiplier: 1.15,
  margin_divisor: 0.94,
  rounding_step: 10,
  default_vat_rate: 21,
  default_deposit_rate: 20,
  band_logo_url: '',
  signature_url: '',
  signer_name: '',
  signer_role: 'Musical Director and Musician',
  contact_email: '',
  contact_phone: '',
  website: '',
  legal_company_name: '',
  tax_vat_id: '',
  legal_address: '',
  bank_account_holder: '',
  bank_iban: '',
  bank_bic_swift: '',
  bank_name: '',
  default_payment_terms: '20% initial deposit upon booking; 80% balance due before event',
  default_validity_days: 30,
  default_quote_disclaimer: DEFAULT_QUOTE_DISCLAIMER,
  custom_services: [
    {
      id: 'srv-song-request',
      name: 'Custom Song Arrangement',
      category: 'performance',
      description: 'Learn & arrange a special request outside the repertoire',
      price: 120,
      unit: 'flat',
      is_active: true,
    },
    {
      id: 'srv-early-loadin',
      name: 'Early Load-In / Waiting Hour',
      category: 'logistics',
      description: 'Early setup & standby time before the event starts',
      price: 35,
      unit: 'per_person',
      is_active: true,
    },
    {
      id: 'srv-recording',
      name: 'Live Multitrack Recording',
      category: 'production',
      description: 'Multi-channel audio capture of the live performance',
      price: 250,
      unit: 'flat',
      is_active: false,
    },
  ],
};

const LEGACY_DUPLICATE_SERVICE_IDS = new Set([
  'srv-cocktail',
  'srv-ceremony',
  'srv-dj',
  'srv-extra-sound',
]);

const STORAGE_PREFIX = 'bandwith_pricing_settings_';

export async function getBandPricing(bandId: string): Promise<BandPricingSettings> {
  // 1. Try to fetch from Supabase if valid UUID
  if (bandId && bandId !== 'default') {
    try {
      const { data: band, error } = await supabase
        .from('bands')
        .select('*')
        .eq('id', bandId)
        .maybeSingle();

      if (!error && band) {
        const rules = band.pricing_rules || {};
        const storedServices: CustomService[] | undefined = band.extra_services;
        const cleanedServices = Array.isArray(storedServices)
          ? storedServices.filter((s) => !LEGACY_DUPLICATE_SERVICE_IDS.has(s.id))
          : [];

        const loadedSettings: BandPricingSettings = {
          band_id: band.id,
          currency: band.pricing_currency || DEFAULT_BAND_PRICING.currency,
          core_member_rate: Number(band.core_musician_fee ?? DEFAULT_BAND_PRICING.core_member_rate),
          session_musician_rate: Number(band.additional_musician_fee ?? DEFAULT_BAND_PRICING.session_musician_rate),
          core_members_count: Number(band.standard_lineup_size ?? DEFAULT_BAND_PRICING.core_members_count),
          cocktail_musician_fee: Number(band.cocktail_musician_fee ?? DEFAULT_BAND_PRICING.cocktail_musician_fee),
          ceremony_musician_fee: Number(band.ceremony_musician_fee ?? DEFAULT_BAND_PRICING.ceremony_musician_fee),
          dj_hourly_rate: Number(band.dj_hourly_rate ?? DEFAULT_BAND_PRICING.dj_hourly_rate),
          production_standard_fee: Number(band.production_standard_fee ?? DEFAULT_BAND_PRICING.production_standard_fee),
          production_pro_fee: Number(band.production_pro_fee ?? DEFAULT_BAND_PRICING.production_pro_fee),
          production_extra_location_fee: Number(band.production_extra_location_fee ?? DEFAULT_BAND_PRICING.production_extra_location_fee),
          travel_rate_per_km: Number(band.travel_rate_per_km ?? DEFAULT_BAND_PRICING.travel_rate_per_km),
          band_origin_address: band.home_base_address || '',
          band_origin_lat: band.home_base_latitude !== null ? Number(band.home_base_latitude) : undefined,
          band_origin_lng: band.home_base_longitude !== null ? Number(band.home_base_longitude) : undefined,
          low_season_multiplier: Number(rules.low_season_multiplier ?? DEFAULT_BAND_PRICING.low_season_multiplier),
          mid_season_multiplier: Number(rules.mid_season_multiplier ?? DEFAULT_BAND_PRICING.mid_season_multiplier),
          peak_season_multiplier: Number(rules.peak_season_multiplier ?? DEFAULT_BAND_PRICING.peak_season_multiplier),
          margin_divisor: Number(rules.margin_divisor ?? DEFAULT_BAND_PRICING.margin_divisor),
          rounding_step: Number(rules.rounding_step ?? DEFAULT_BAND_PRICING.rounding_step),
          default_vat_rate: Number(rules.default_vat_rate ?? DEFAULT_BAND_PRICING.default_vat_rate),
          default_deposit_rate: Number(rules.default_deposit_rate ?? DEFAULT_BAND_PRICING.default_deposit_rate),
          band_logo_url: band.logo_url || rules.band_logo_url || '',
          signature_url: band.signature_url || rules.signature_url || '',
          signer_name: band.signer_name || rules.signer_name || '',
          signer_role: band.signer_role ?? rules.signer_role ?? DEFAULT_BAND_PRICING.signer_role,
          contact_email: band.contact_email || rules.contact_email || '',
          contact_phone: band.contact_phone || rules.contact_phone || '',
          website: band.website || rules.website || '',
          legal_company_name: band.legal_company_name || rules.legal_company_name || '',
          tax_vat_id: band.tax_vat_id || rules.tax_vat_id || '',
          legal_address: band.legal_address || rules.legal_address || '',
          bank_account_holder: band.bank_account_holder || rules.bank_account_holder || '',
          bank_iban: band.bank_iban || rules.bank_iban || '',
          bank_bic_swift: band.bank_bic_swift || rules.bank_bic_swift || '',
          bank_name: band.bank_name || rules.bank_name || '',
          default_payment_terms:
            band.default_payment_terms ||
            rules.default_payment_terms ||
            DEFAULT_BAND_PRICING.default_payment_terms,
          default_validity_days: Number(
            rules.default_validity_days ?? DEFAULT_BAND_PRICING.default_validity_days
          ),
          default_quote_disclaimer:
            rules.default_quote_disclaimer || DEFAULT_BAND_PRICING.default_quote_disclaimer,
          custom_services: cleanedServices.length > 0 ? cleanedServices : DEFAULT_BAND_PRICING.custom_services,
        };

        // Cache locally for offline resiliency
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${bandId}`, JSON.stringify(loadedSettings));
        } catch (_) {}

        return loadedSettings;
      }
    } catch (err) {
      console.warn('[PricingService] Error fetching band pricing from database, falling back to cache:', err);
    }
  }

  // 2. Fallback to localStorage / default
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${bandId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const storedServices: CustomService[] | undefined = parsed.custom_services;
      const cleanedServices = Array.isArray(storedServices)
        ? storedServices.filter((s) => !LEGACY_DUPLICATE_SERVICE_IDS.has(s.id))
        : [];
      return {
        ...DEFAULT_BAND_PRICING,
        ...parsed,
        core_members_count:
          typeof parsed.core_members_count === 'number' && parsed.core_members_count > 0
            ? parsed.core_members_count
            : 1,
        custom_services:
          cleanedServices.length > 0 ? cleanedServices : DEFAULT_BAND_PRICING.custom_services,
      };
    }
  } catch (e) {
    console.warn('Error reading band pricing settings from storage:', e);
  }
  return { ...DEFAULT_BAND_PRICING, band_id: bandId };
}

export async function saveBandPricing(settings: BandPricingSettings): Promise<BandPricingSettings> {
  // Always update local cache
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${settings.band_id}`, JSON.stringify(settings));
  } catch (e) {
    console.warn('Error saving band pricing settings to storage:', e);
  }

  // Persist directly to Supabase bands table matching current band_id
  if (settings.band_id && settings.band_id !== 'default') {
    try {
      const { error } = await supabase
        .from('bands')
        .update({
          standard_lineup_size: settings.core_members_count,
          core_musician_fee: settings.core_member_rate,
          additional_musician_fee: settings.session_musician_rate,
          ceremony_musician_fee: settings.ceremony_musician_fee,
          cocktail_musician_fee: settings.cocktail_musician_fee,
          dj_hourly_rate: settings.dj_hourly_rate,
          production_standard_fee: settings.production_standard_fee,
          production_pro_fee: settings.production_pro_fee,
          production_extra_location_fee: settings.production_extra_location_fee,
          travel_rate_per_km: settings.travel_rate_per_km,
          home_base_address: settings.band_origin_address || '',
          home_base_latitude: typeof settings.band_origin_lat === 'number' ? settings.band_origin_lat : null,
          home_base_longitude: typeof settings.band_origin_lng === 'number' ? settings.band_origin_lng : null,
          pricing_currency: settings.currency || 'EUR',
          logo_url: settings.band_logo_url || null,
          pricing_rules: {
            low_season_multiplier: settings.low_season_multiplier,
            mid_season_multiplier: settings.mid_season_multiplier,
            peak_season_multiplier: settings.peak_season_multiplier,
            margin_divisor: settings.margin_divisor,
            rounding_step: settings.rounding_step,
            default_vat_rate: settings.default_vat_rate,
            default_deposit_rate: settings.default_deposit_rate,
            band_logo_url: settings.band_logo_url || '',
            signature_url: settings.signature_url || '',
            signer_name: settings.signer_name || '',
            signer_role: settings.signer_role || '',
            contact_email: settings.contact_email || '',
            contact_phone: settings.contact_phone || '',
            website: settings.website || '',
            legal_company_name: settings.legal_company_name || '',
            tax_vat_id: settings.tax_vat_id || '',
            legal_address: settings.legal_address || '',
            bank_account_holder: settings.bank_account_holder || '',
            bank_iban: settings.bank_iban || '',
            bank_bic_swift: settings.bank_bic_swift || '',
            bank_name: settings.bank_name || '',
            default_payment_terms: settings.default_payment_terms || '',
            default_validity_days: settings.default_validity_days ?? 30,
            default_quote_disclaimer: settings.default_quote_disclaimer || '',
          },
          extra_services: settings.custom_services,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.band_id);

      if (error) {
        console.error('[PricingService] Failed to persist band pricing to Supabase:', error);
      }
    } catch (err) {
      console.error('[PricingService] Exception saving band pricing to Supabase:', err);
    }
  }

  return settings;
}

/**
 * Resize/convert an uploaded image file to a clean Data URL, and try uploading to Supabase Storage.
 * Returns a reliable URL (Data URL for instant PDF canvas rendering or public storage URL).
 */
export async function uploadBandBrandingAsset(
  bandId: string,
  file: File,
  kind: 'logo' | 'signature'
): Promise<string> {
  // Always create a crisp, resized Data URL so client-side PDF rendering never suffers from CORS
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = kind === 'logo' ? 600 : 500;
        const maxH = kind === 'logo' ? 300 : 220;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(String(reader.result));
        }
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Also attempt background upload to Supabase storage if authenticated
  if (bandId && bandId !== 'default') {
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `bands/${bandId}/${kind}-${Date.now()}.${ext}`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    } catch (_) {
      // Ignore storage bucket errors — dataUrl is stored in pricing_rules / logo_url
    }
  }

  return dataUrl;
}

export function calculateSeasonality(
  dateStr: string,
  settings: BandPricingSettings
): { multiplier: number; seasonName: 'LOW' | 'MID' | 'PEAK' } {
  if (!dateStr) return { multiplier: 1, seasonName: 'MID' };
  const month = new Date(dateStr).getMonth();
  // Jan, Feb, Mar, Nov = Low
  if (month === 0 || month === 1 || month === 2 || month === 10) {
    return { multiplier: settings.low_season_multiplier, seasonName: 'LOW' };
  }
  // May, Jun, Sep, Oct = Peak
  if (month === 4 || month === 5 || month === 8 || month === 9) {
    return { multiplier: settings.peak_season_multiplier, seasonName: 'PEAK' };
  }
  return { multiplier: settings.mid_season_multiplier, seasonName: 'MID' };
}

export interface QuoteCalculationInput {
  musiciansCount: number;
  distanceKm: number;
  eventDate?: string;
  productionTier?: 'standard' | 'pro' | 'none';
  extraLocationsCount: number;
  cocktailMusicians: number;
  ceremonyMusicians: number;
  djHours: number;
  selectedCustomServices?: { serviceId: string; quantity: number }[];
  discountPercent: number;
}

export function calculateSmartQuote(input: QuoteCalculationInput, settings: BandPricingSettings) {
  const musiciansCount = Math.max(1, input.musiciansCount);
  const coreMusicians = Math.min(musiciansCount, settings.core_members_count);
  const sessionMusicians = Math.max(0, musiciansCount - settings.core_members_count);
  const coreMusiciansCost = coreMusicians * settings.core_member_rate;
  const sessionMusiciansCost = sessionMusicians * settings.session_musician_rate;
  const travelCost = input.distanceKm * settings.travel_rate_per_km * musiciansCount;
  const { multiplier: seasonMultiplier, seasonName } = calculateSeasonality(
    input.eventDate || '',
    settings
  );

  let productionCost = 0;
  if (input.productionTier === 'standard') {
    productionCost = settings.production_standard_fee;
  } else if (input.productionTier === 'pro') {
    productionCost = settings.production_pro_fee;
  }
  if (input.extraLocationsCount > 0) {
    productionCost += input.extraLocationsCount * settings.production_extra_location_fee;
  }

  const mainBandCost = (coreMusiciansCost + sessionMusiciansCost + travelCost) * seasonMultiplier + productionCost;
  const divisor = settings.margin_divisor > 0 ? settings.margin_divisor : 1;
  const rounding = settings.rounding_step > 0 ? settings.rounding_step : 10;
  const targetPrice = mainBandCost / divisor;
  const mainBandPrice = Math.ceil(targetPrice / rounding) * rounding;

  const cocktailPrice = input.cocktailMusicians > 0 ? input.cocktailMusicians * settings.cocktail_musician_fee : 0;
  const ceremonyPrice = input.ceremonyMusicians > 0 ? input.ceremonyMusicians * settings.ceremony_musician_fee : 0;
  const djPrice = input.djHours > 0 ? input.djHours * settings.dj_hourly_rate : 0;

  let customServicesTotal = 0;
  if (input.selectedCustomServices && input.selectedCustomServices.length > 0) {
    for (const item of input.selectedCustomServices) {
      const srv = settings.custom_services.find((s) => s.id === item.serviceId);
      if (srv && srv.is_active) {
        customServicesTotal += srv.price * (item.quantity || 1);
      }
    }
  }

  const subtotal = mainBandPrice + cocktailPrice + ceremonyPrice + djPrice + customServicesTotal;
  const discountAmount = input.discountPercent > 0 ? Math.round(subtotal * (input.discountPercent / 100)) : 0;
  const netTotal = subtotal - discountAmount;
  const vatRate = settings.default_vat_rate || 21;
  const vatAmount = Math.round(netTotal * (vatRate / 100) * 100) / 100;
  const totalWithVat = Math.round((netTotal + vatAmount) * 100) / 100;
  const depositRate = settings.default_deposit_rate || 20;
  const initialDeposit = Math.round(totalWithVat * (depositRate / 100) * 100) / 100;

  const estimatedMusiciansPayout = coreMusiciansCost + sessionMusiciansCost + cocktailPrice * 0.7 + ceremonyPrice * 0.7;
  const estimatedPettyCashMargin = Math.max(0, netTotal - estimatedMusiciansPayout - productionCost);

  return {
    coreMusicians,
    sessionMusicians,
    coreMusiciansCost,
    sessionMusiciansCost,
    travelCost: Math.round(travelCost * 100) / 100,
    seasonMultiplier,
    seasonName,
    productionCost,
    mainBandCost: Math.round(mainBandCost),
    mainBandPrice,
    cocktailPrice,
    ceremonyPrice,
    djPrice,
    customServicesTotal,
    subtotal,
    discountAmount,
    netTotal,
    vatAmount,
    totalWithVat,
    initialDeposit,
    estimatedMusiciansPayout,
    estimatedPettyCashMargin,
  };
}
