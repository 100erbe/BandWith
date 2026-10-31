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
  low_season_multiplier: number;
  mid_season_multiplier: number;
  peak_season_multiplier: number;
  margin_divisor: number;
  rounding_step: number;
  default_vat_rate: number;
  default_deposit_rate: number;
  custom_services: CustomService[];
}

export const DEFAULT_BAND_PRICING: BandPricingSettings = {
  band_id: 'default',
  currency: 'EUR',
  core_member_rate: 300,
  session_musician_rate: 250,
  core_members_count: 4,
  cocktail_musician_fee: 150,
  ceremony_musician_fee: 150,
  dj_hourly_rate: 100,
  production_standard_fee: 300,
  production_pro_fee: 600,
  production_extra_location_fee: 150,
  travel_rate_per_km: 0.15,
  band_origin_address: '',
  low_season_multiplier: 1,
  mid_season_multiplier: 1,
  peak_season_multiplier: 1.15,
  margin_divisor: 1,
  rounding_step: 10,
  default_vat_rate: 21,
  default_deposit_rate: 20,
  custom_services: [
    {
      id: 'srv-cocktail',
      name: 'Cocktail Set',
      category: 'performance',
      description: 'Acoustic background music set for reception',
      price: 150,
      unit: 'per_person',
      is_active: true,
    },
    {
      id: 'srv-ceremony',
      name: 'Ceremony Performance',
      category: 'performance',
      description: 'Live entrance, vows & exit customized music',
      price: 150,
      unit: 'per_person',
      is_active: true,
    },
    {
      id: 'srv-dj',
      name: 'DJ Service',
      category: 'performance',
      description: 'DJ after-party set with sound & lighting',
      price: 100,
      unit: 'per_hour',
      is_active: true,
    },
    {
      id: 'srv-extra-sound',
      name: 'Secondary PA System',
      category: 'production',
      description: 'Independent sound system for garden or second room',
      price: 150,
      unit: 'flat',
      is_active: true,
    },
    {
      id: 'srv-recording',
      name: 'Live Multitrack Recording',
      category: 'custom',
      description: 'Audio multitrack capture of the performance',
      price: 250,
      unit: 'flat',
      is_active: false,
    },
  ],
};

const STORAGE_PREFIX = 'bandwith_pricing_settings_';

export async function getBandPricing(bandId: string): Promise<BandPricingSettings> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${bandId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_BAND_PRICING,
        ...parsed,
        custom_services: parsed.custom_services || DEFAULT_BAND_PRICING.custom_services,
      };
    }
  } catch (e) {
    console.warn('Error reading band pricing settings from storage:', e);
  }
  return { ...DEFAULT_BAND_PRICING, band_id: bandId };
}

export async function saveBandPricing(settings: BandPricingSettings): Promise<BandPricingSettings> {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${settings.band_id}`, JSON.stringify(settings));
  } catch (e) {
    console.warn('Error saving band pricing settings to storage:', e);
  }
  return settings;
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
