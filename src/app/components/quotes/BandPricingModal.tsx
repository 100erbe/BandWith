import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Plus, Minus, Trash2, RotateCcw, Sparkles, MapPin, Lock } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { useBand } from '@/lib/BandContext';
import {
  DEFAULT_BAND_PRICING,
  getBandPricing,
  saveBandPricing,
  calculateSmartQuote,
  type BandPricingSettings,
  type CustomService,
} from '@/lib/services/pricing';

interface BandPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId?: string;
  onSaved?: (settings: BandPricingSettings) => void;
}

type TabType = 'rates' | 'production' | 'services' | 'commercial';

const UNIT_LABELS: Record<CustomService['unit'], string> = {
  flat: 'Flat fee',
  per_person: 'Per musician',
  per_hour: 'Per hour',
  per_km: 'Per km',
};

const CATEGORY_LABELS: Record<string, string> = {
  performance: 'Performance',
  production: 'Production & AV',
  logistics: 'Logistics',
  custom: 'Custom Add-on',
};

export const BandPricingModal: React.FC<BandPricingModalProps> = ({
  isOpen,
  onClose,
  bandId = 'default',
  onSaved,
}) => {
  const { isAdmin, selectedBand } = useBand();
  const effectiveBandId = bandId !== 'default' ? bandId : (selectedBand?.id || 'default');

  const [settings, setSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);
  const [activeTab, setActiveTab] = useState<TabType>('rates');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // New service form state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('performance');
  const [newServiceUnit, setNewServiceUnit] = useState<'flat' | 'per_person' | 'per_hour' | 'per_km'>('flat');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [showAddService, setShowAddService] = useState(false);

  useEffect(() => {
    if (isOpen && effectiveBandId) {
      getBandPricing(effectiveBandId).then((res) => {
        setSettings(res);
      });
      setConfirmingReset(false);
    }
  }, [isOpen, effectiveBandId]);

  // Live quote preview calculation for standard core lineup, 50km travel, standard PA
  const sampleQuote = useMemo(() => {
    return calculateSmartQuote(
      {
        musiciansCount: settings.core_members_count,
        distanceKm: 50,
        productionTier: 'standard',
        extraLocationsCount: 0,
        cocktailMusicians: 0,
        ceremonyMusicians: 0,
        djHours: 0,
        discountPercent: 0,
      },
      settings
    );
  }, [settings]);

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[75] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card border border-border p-6 rounded-[20px] max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-foreground uppercase tracking-wide">Admin Access Required</h3>
            <p className="text-xs text-foreground/60 leading-relaxed">
              Only band administrators can access and configure the financial and logistical formulas for this band.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    const toSave = { ...settings, band_id: effectiveBandId };
    await saveBandPricing(toSave);
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    if (onSaved) onSaved(toSave);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_BAND_PRICING, band_id: effectiveBandId });
    setConfirmingReset(false);
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrice) return;
    const newSrv: CustomService = {
      id: `srv-${Date.now()}`,
      name: newServiceName.trim(),
      category: newServiceCategory,
      description: newServiceDesc.trim() || undefined,
      price: parseFloat(newServicePrice) || 0,
      unit: newServiceUnit,
      is_active: true,
    };
    setSettings({
      ...settings,
      custom_services: [...settings.custom_services, newSrv],
    });
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceDesc('');
    setShowAddService(false);
  };

  const handleDeleteService = (id: string) => {
    setSettings({
      ...settings,
      custom_services: settings.custom_services.filter((s) => s.id !== id),
    });
  };

  const handleToggleService = (id: string) => {
    setSettings({
      ...settings,
      custom_services: settings.custom_services.map((s) =>
        s.id === id ? { ...s, is_active: !s.is_active } : s
      ),
    });
  };

  // Human-readable percentage helpers for seasonal multipliers & margin
  const peakSurgePercent = Math.round((settings.peak_season_multiplier - 1) * 100);
  const lowDiscountPercent = Math.round((1 - settings.low_season_multiplier) * 100);
  const marginPercent = Math.round((1 - settings.margin_divisor) * 100);

  const activeServicesCount = settings.custom_services.filter((s) => s.is_active).length;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'rates', label: 'Musician Fees' },
    { id: 'production', label: 'Travel & Sound' },
    { id: 'services', label: `Extra Services (${activeServicesCount})` },
    { id: 'commercial', label: 'Quote Rules & Tax' },
  ];

  const coreCount = settings.core_members_count;
  const baseLineupTotal = coreCount * settings.core_member_rate;
  const sampleTravelTotal = Math.round(100 * settings.travel_rate_per_km * coreCount);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[75] bg-background text-foreground overflow-y-auto overflow-x-hidden flex flex-col"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      {/* Sticky Header */}
      <div
        className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
        style={{
          paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))',
          paddingBottom: '14px',
        }}
      >
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-[44px] h-[44px] rounded-full flex items-center justify-center border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 shrink-0 active:scale-90 transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                  QUOTE CALCULATOR SETUP
                </span>
                <h1 className="text-[22px] sm:text-[24px] font-black text-foreground leading-none uppercase tracking-tight mt-0.5">
                  PRICING & SERVICES
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs active:scale-95 transition-all disabled:opacity-50 shrink-0"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" /> Saved
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3.5 py-2 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full pb-32">
        {/* Live Quote Benchmark Card */}
        <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                LIVE QUOTE ESTIMATE ({coreCount} {coreCount === 1 ? 'MUSICIAN' : 'MUSICIANS'} · STANDARD PA · 50 KM)
              </span>
            </div>
            <span className="text-xs text-foreground/60">
              Lineup €{sampleQuote.coreMusiciansCost.toLocaleString()} + PA €{sampleQuote.productionCost.toLocaleString()} + Travel €{sampleQuote.travelCost.toLocaleString()}
            </span>
          </div>
          <div className="flex items-baseline gap-3 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-foreground/10">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                NET QUOTE
              </span>
              <span className="text-lg font-black text-foreground tabular-nums leading-tight">
                €{sampleQuote.netTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                INCL. {settings.default_vat_rate}% VAT
              </span>
              <span className="text-sm font-bold text-foreground/70 tabular-nums leading-tight">
                €{sampleQuote.totalWithVat.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ TAB 1: MUSICIAN FEES ═══ */}
        {activeTab === 'rates' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Main Show Lineup */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Main Show Lineup
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Define your standard band size and per-musician performance fees.
                </p>
              </div>

              {/* 1. Standard Lineup Size (First, because it governs the threshold!) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Standard Lineup Size
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Number of core musicians in your default band
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-background border border-foreground/15 rounded-[12px] p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        core_members_count: Math.max(1, settings.core_members_count - 1),
                      })
                    }
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground active:scale-90 transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-base font-black text-foreground tabular-nums">
                    {settings.core_members_count}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        core_members_count: Math.min(15, settings.core_members_count + 1),
                      })
                    }
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground active:scale-90 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 2. Core Musician Fee */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Core Musician Fee
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Per person for the main show ({coreCount === 1 ? 'first musician' : `first ${coreCount} musicians`})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.core_member_rate}
                    onChange={(e) =>
                      setSettings({ ...settings, core_member_rate: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>

              {/* 3. Additional Session Musician Fee */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Additional Musician Fee
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Per extra guest / session player beyond {coreCount} {coreCount === 1 ? 'musician' : 'musicians'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.session_musician_rate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        session_musician_rate: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>

              {/* Dynamic Rule Explanation Banner */}
              <div className="p-3.5 rounded-[12px] bg-primary/8 border border-primary/20 text-xs text-foreground/80 leading-relaxed">
                Quotes automatically calculate the{' '}
                <strong>
                  {coreCount === 1 ? 'first musician' : `first ${coreCount} musicians`}
                </strong>{' '}
                at the Core rate (<strong>€{baseLineupTotal.toLocaleString()}</strong> base lineup), and any additional players at{' '}
                <strong>€{settings.session_musician_rate}/player</strong>.
              </div>
            </div>

            {/* Group 2: Additional Performance Sets (Chronological Order) */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Optional Performance Sets
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Extra sets added when clients book music for earlier parts of the day or after-party.
                </p>
              </div>

              {/* Ceremony Set (Chronologically first in a wedding/event) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Ceremony Set Fee
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Per musician performing during the ceremony
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.ceremony_musician_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ceremony_musician_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>

              {/* Cocktail / Aperitif Set */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Cocktail / Reception Set Fee
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Per musician playing the welcome drinks / aperitif set
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.cocktail_musician_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cocktail_musician_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>

              {/* After-Party DJ Rate */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    After-Party DJ Rate
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Hourly rate for DJ service after the live band
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.dj_hourly_rate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dj_hourly_rate: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-[10px] font-bold text-foreground/40">/hr</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 2: TRAVEL & SOUND ═══ */}
        {activeTab === 'production' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Travel & Mileage */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Travel & Mileage
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Calculate transport costs automatically based on distance and band size.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 p-4 rounded-[16px] bg-card border border-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Band Home Base Location
                  </span>
                  {typeof settings.band_origin_lat === 'number' && typeof settings.band_origin_lng === 'number' && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-[6px] tracking-wider">
                      COORDINATES SET ({settings.band_origin_lat.toFixed(2)}°, {settings.band_origin_lng.toFixed(2)}°)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-background border border-foreground/15 rounded-[12px] px-3 py-1">
                  <MapPin className="w-4 h-4 text-foreground/40 shrink-0" />
                  <div className="flex-1">
                    <VenueAutocomplete
                      value={settings.band_origin_address}
                      onChange={(val) => setSettings({ ...settings, band_origin_address: val })}
                      onSelect={(place) => {
                        const formatted = place.fullAddress || [place.address, place.city, place.country].filter(Boolean).join(', ') || place.name;
                        setSettings({
                          ...settings,
                          band_origin_address: formatted,
                          band_origin_lat: place.latitude,
                          band_origin_lng: place.longitude,
                        });
                      }}
                      placeholder="e.g. Milan, Italy or Studio Address"
                      className="border-0 pb-0"
                    />
                  </div>
                </div>
                <span className="text-[11px] text-foreground/50">
                  Origin coordinates used by the Google Distance Matrix & quote logistics engine to compute mileage to gig venues.
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Travel Rate per KM
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Per km, per musician (covers fuel & vehicle wear)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.travel_rate_per_km}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        travel_rate_per_km: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-xs text-foreground/70">
                Example: A <strong>100 km</strong> trip with{' '}
                <strong>
                  {coreCount} {coreCount === 1 ? 'musician' : 'musicians'}
                </strong>{' '}
                adds <strong>€{sampleTravelTotal}</strong> to the quote (100 km × {coreCount} × €{settings.travel_rate_per_km}).
              </div>
            </div>

            {/* Group 2: Audio & Lighting Packages */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Sound & Lighting Packages
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Production tiers selectable depending on venue size and guest count.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Standard PA & Lighting (≤150 Guests)
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Compact PA system & basic stage wash lighting
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.production_standard_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        production_standard_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Pro PA & Full Lighting (150–300+ Guests)
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    High-output PA with subwoofers, full light show & technician
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.production_pro_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        production_pro_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Secondary Zone Sound System
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Independent speaker & wireless mic for garden or ceremony area
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">€</span>
                  <input
                    type="number"
                    min="0"
                    value={settings.production_extra_location_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        production_extra_location_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 3: EXTRA SERVICES ═══ */}
        {activeTab === 'services' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Custom Quote Add-Ons
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Toggle which extra services are available when building a quote.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddService(!showAddService)}
                className="px-3.5 py-2 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Extra
              </button>
            </div>

            <AnimatePresence>
              {showAddService && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddService}
                  className="p-4 rounded-[16px] bg-card border border-primary/30 flex flex-col gap-3 overflow-hidden shadow-xs"
                >
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    New Custom Add-On
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Service name (e.g. Saxophone Guest)"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      required
                      className="bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5 text-xs font-bold text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5">
                      <span className="text-xs font-bold text-foreground/40">€</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Price"
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(e.target.value)}
                        required
                        className="bg-transparent text-xs font-bold text-foreground w-full focus:outline-none"
                      />
                    </div>
                    <select
                      value={newServiceCategory}
                      onChange={(e) => setNewServiceCategory(e.target.value)}
                      className="bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                    >
                      <option value="performance">Performance</option>
                      <option value="production">Production & AV</option>
                      <option value="logistics">Logistics</option>
                      <option value="custom">Custom Add-on</option>
                    </select>
                    <select
                      value={newServiceUnit}
                      onChange={(e) =>
                        setNewServiceUnit(e.target.value as 'flat' | 'per_person' | 'per_hour' | 'per_km')
                      }
                      className="bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                    >
                      <option value="flat">Flat Fee</option>
                      <option value="per_person">Per Musician</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_km">Per KM</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Short description shown on quote (optional)"
                    value={newServiceDesc}
                    onChange={(e) => setNewServiceDesc(e.target.value)}
                    className="bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5 text-xs text-foreground placeholder:text-foreground/30 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddService(false)}
                      className="px-3.5 py-2 rounded-[12px] bg-foreground/5 hover:bg-foreground/10 text-xs font-bold uppercase tracking-wider text-foreground/70 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-[12px] bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-95 transition-opacity"
                    >
                      Add to List
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2.5">
              {settings.custom_services.map((srv) => (
                <div
                  key={srv.id}
                  className={cn(
                    'p-4 rounded-[16px] bg-card border transition-all flex items-center justify-between gap-3',
                    srv.is_active ? 'border-foreground/15' : 'border-foreground/5 opacity-60'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleService(srv.id)}
                      className={cn(
                        'w-6 h-6 rounded-[8px] flex items-center justify-center border transition-colors shrink-0',
                        srv.is_active
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-foreground/20 bg-foreground/5 text-transparent'
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'text-xs font-bold uppercase tracking-wide truncate',
                            !srv.is_active && 'line-through text-foreground/40'
                          )}
                        >
                          {srv.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[6px] bg-foreground/8 text-foreground/60 shrink-0">
                          {CATEGORY_LABELS[srv.category] || srv.category}
                        </span>
                      </div>
                      {srv.description && (
                        <span className="text-[11px] text-foreground/50 truncate">{srv.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-foreground tabular-nums">
                        €{srv.price.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-foreground/40">
                        {UNIT_LABELS[srv.unit]}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(srv.id)}
                      className="w-8 h-8 rounded-[8px] hover:bg-[var(--destructive)]/10 text-foreground/40 hover:text-[var(--destructive)] flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 4: QUOTE RULES & TAX ═══ */}
        {activeTab === 'commercial' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Seasonal Adjustments */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Seasonal Pricing Rules
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Automatically adjust quotes based on the event month.
                </p>
              </div>

              {/* Peak Season Markup (%) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Peak Season Markup
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    May, Jun, Sep & Oct (High demand months)
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                  <span className="text-xs font-bold text-primary">+</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={peakSurgePercent}
                    onChange={(e) => {
                      const pct = Math.max(0, Math.min(100, Number(e.target.value)));
                      setSettings({
                        ...settings,
                        peak_season_multiplier: Number((1 + pct / 100).toFixed(2)),
                      });
                    }}
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-xs font-bold text-foreground/40">%</span>
                </div>
              </div>

              {/* Low Season Discount (%) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Off-Peak Season Discount
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Jan, Feb, Mar & Nov (Winter incentive)
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                  <span className="text-xs font-bold text-foreground/40">−</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="5"
                    value={lowDiscountPercent}
                    onChange={(e) => {
                      const pct = Math.max(0, Math.min(50, Number(e.target.value)));
                      setSettings({
                        ...settings,
                        low_season_multiplier: Number((1 - pct / 100).toFixed(2)),
                      });
                    }}
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-xs font-bold text-foreground/40">%</span>
                </div>
              </div>
            </div>

            {/* Group 2: Margin, Tax & Deposit */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Band Margin, Tax & Deposit
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Set your band contingency buffer, local tax rate, and booking deposit.
                </p>
              </div>

              {/* Band Fund / Contingency Margin (%) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Band Fund / Margin Buffer
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Percentage retained for shared band expenses & gear wear
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    value={marginPercent}
                    onChange={(e) => {
                      const pct = Math.max(0, Math.min(50, Number(e.target.value)));
                      setSettings({
                        ...settings,
                        margin_divisor: Number((1 - pct / 100).toFixed(2)),
                      });
                    }}
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-xs font-bold text-foreground/40">%</span>
                </div>
              </div>

              {/* Default VAT Rate (%) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Default Tax / VAT Rate
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Applied to net total on client quotes
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={settings.default_vat_rate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_vat_rate: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-xs font-bold text-foreground/40">%</span>
                </div>
              </div>

              {/* Upfront Deposit (%) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Booking Deposit Required
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Upfront advance required to lock in the event date
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={settings.default_deposit_rate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_deposit_rate: Math.max(0, Math.min(100, Number(e.target.value))),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-xs font-bold text-foreground/40">%</span>
                </div>
              </div>
            </div>

            {/* Inline Safe Reset */}
            <div className="pt-2 flex items-center justify-between border-t border-foreground/10">
              {!confirmingReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="text-xs font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground flex items-center gap-1.5 py-2 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Recommended Defaults
                </button>
              ) : (
                <div className="flex items-center justify-between w-full gap-3 py-1">
                  <span className="text-xs font-bold text-[var(--destructive)] uppercase tracking-wide">
                    Reset all rates & services to defaults?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="px-3 py-1.5 rounded-[8px] bg-foreground/5 text-xs font-bold uppercase text-foreground/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 rounded-[8px] bg-[var(--destructive)] text-white text-xs font-bold uppercase"
                    >
                      Confirm Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
