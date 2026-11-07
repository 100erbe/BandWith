import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  Sparkles,
  MapPin,
  Lock,
  Upload,
  Image,
  FileSignature,
  ChevronDown,
  Loader2,
  Users,
  Layers,
  Truck,
  Volume2,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { useBand } from '@/lib/BandContext';
import { updateBand } from '@/lib/services/bands';
import type { PerformanceType } from '@/app/data/quotes';
import {
  DEFAULT_BAND_PRICING,
  DEFAULT_QUOTE_DISCLAIMER,
  WEDDING_SERVICE_PRESETS,
  CLUB_ROCK_SERVICE_PRESETS,
  CORPORATE_JAZZ_PRESETS,
  getBandPricing,
  saveBandPricing,
  uploadBandBrandingAsset,
  calculateSmartQuote,
  calculateTravelFeeFromSettings,
  type BandPricingSettings,
  type CustomService,
  type CustomServiceCategory,
  type CustomServiceUnit,
  type LineupPackagePreset,
  type TravelCalcMode,
  type BandMarkupType,
} from '@/lib/services/pricing';

export type PricingModalTabType = 'branding' | 'rates' | 'production' | 'services' | 'commercial';

interface BandPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId?: string;
  initialTab?: PricingModalTabType;
  onSaved?: (settings: BandPricingSettings) => void;
}

type TabType = PricingModalTabType;

const UNIT_LABELS: Record<CustomServiceUnit, string> = {
  flat: 'Flat Fee',
  per_person: 'Per Musician',
  per_hour: 'Per Hour',
  per_km: 'Per KM',
};

const CATEGORY_LABELS: Record<CustomServiceCategory, string> = {
  performance: 'Performance',
  production: 'Production & AV',
  logistics: 'Logistics',
  custom: 'Custom Add-on',
};

const inferPerformanceTypeFromCount = (count: number): PerformanceType => {
  if (count <= 1) return 'solo';
  if (count === 2) return 'duo';
  if (count === 3) return 'trio';
  return 'full_band';
};

export const BandPricingModal: React.FC<BandPricingModalProps> = ({
  isOpen,
  onClose,
  bandId = 'default',
  initialTab = 'rates',
  onSaved,
}) => {
  const { isAdmin, selectedBand, refreshBands } = useBand();
  const effectiveBandId = bandId !== 'default' ? bandId : (selectedBand?.id || 'default');

  const [settings, setSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);
  const [bandName, setBandName] = useState(selectedBand?.name || '');
  const [bandDescription, setBandDescription] = useState(selectedBand?.description || '');
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);
  const [isSubRateOpen, setIsSubRateOpen] = useState(false);

  // Branding & Signature state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'upload' | 'draw'>('upload');
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const sigInputRef = useRef<HTMLInputElement | null>(null);

  // New service form state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<CustomServiceCategory>('performance');
  const [newServiceUnit, setNewServiceUnit] = useState<CustomServiceUnit>('flat');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [showAddService, setShowAddService] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && effectiveBandId) {
      setBandName(selectedBand?.name || '');
      setBandDescription(selectedBand?.description || '');
      getBandPricing(effectiveBandId).then((res) => {
        setSettings({
          ...res,
          band_logo_url: res.band_logo_url || selectedBand?.logo_url || '',
          band_origin_address: res.band_origin_address || selectedBand?.home_base_address || '',
        });
        setIsSubRateOpen(Boolean(res.enable_external_sub_rate));
      });
      setConfirmingReset(false);
    }
  }, [isOpen, effectiveBandId, selectedBand?.name, selectedBand?.description, selectedBand?.logo_url, selectedBand?.home_base_address]);

  const currencySymbol = useMemo(() => {
    if (settings.currency === 'USD') return '$';
    if (settings.currency === 'GBP') return '£';
    if (settings.currency === 'CHF') return 'CHF ';
    return '€';
  }, [settings.currency]);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadBandBrandingAsset(effectiveBandId, file, 'logo');
      setSettings((prev) => ({ ...prev, band_logo_url: url }));
    } catch (err) {
      console.error('Logo upload failed:', err);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSignatureFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSignature(true);
    try {
      const url = await uploadBandBrandingAsset(effectiveBandId, file, 'signature');
      setSettings((prev) => ({ ...prev, signature_url: url }));
    } catch (err) {
      console.error('Signature upload failed:', err);
    } finally {
      setUploadingSignature(false);
      e.target.value = '';
    }
  };

  const getCanvasPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startSigDraw = (clientX: number, clientY: number) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(canvas, clientX, clientY);
    setIsDrawingSig(true);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const moveSigDraw = (clientX: number, clientY: number) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(canvas, clientX, clientY);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const endSigDraw = () => {
    if (!isDrawingSig) return;
    setIsDrawingSig(false);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSettings((prev) => ({ ...prev, signature_url: dataUrl }));
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSettings((prev) => ({ ...prev, signature_url: '' }));
  };

  const activeFullPackage = useMemo(() => {
    const active = (settings.lineup_packages || []).filter((p) => p.is_active);
    return (
      active.find((p) => p.performanceType === 'full_band') ||
      active[active.length - 1] ||
      settings.lineup_packages?.[0]
    );
  }, [settings.lineup_packages]);

  const sampleMusiciansCount =
    settings.pricing_mode === 'flat_packages'
      ? activeFullPackage?.musiciansCount || settings.core_members_count || 4
      : settings.core_members_count || 4;

  // Live quote benchmark calculation (80 km one-way trip, standard PA)
  const sampleQuote = useMemo(() => {
    return calculateSmartQuote(
      {
        musiciansCount: sampleMusiciansCount,
        performanceType:
          settings.pricing_mode === 'flat_packages'
            ? activeFullPackage?.performanceType || 'full_band'
            : 'full_band',
        distanceKm: 80,
        productionTier:
          settings.default_production_mode === 'client_provided' ||
          settings.default_production_mode === 'none'
            ? 'none'
            : 'standard',
      },
      settings
    );
  }, [settings, sampleMusiciansCount, activeFullPackage]);

  const sampleTravel80Km = useMemo(() => {
    return calculateTravelFeeFromSettings(80, sampleMusiciansCount, settings);
  }, [settings, sampleMusiciansCount]);

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[75] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card border border-border p-6 rounded-[20px] max-w-sm w-full text-center flex flex-col items-center gap-4 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
              Admin Access Required
            </h3>
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
    const saved = await saveBandPricing({ ...settings, band_id: effectiveBandId });
    setSettings(saved);
    if (effectiveBandId && effectiveBandId !== 'default') {
      try {
        await updateBand(effectiveBandId, {
          name: bandName.trim() || selectedBand?.name || 'My Band',
          description: bandDescription.trim() || undefined,
          logo_url: saved.band_logo_url || undefined,
          home_base_address: saved.band_origin_address || undefined,
        });
        await refreshBands();
      } catch (err) {
        console.warn('[BandPricingModal] Failed to sync band details:', err);
      }
    }
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    if (onSaved) onSaved(saved);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_BAND_PRICING, band_id: effectiveBandId });
    setConfirmingReset(false);
  };

  // ── Lineup Package Handlers ───────────────────────────────────
  const handleUpdatePackage = (id: string, patch: Partial<LineupPackagePreset>) => {
    setSettings((prev) => ({
      ...prev,
      lineup_packages: prev.lineup_packages.map((pkg) => {
        if (pkg.id !== id) return pkg;
        const nextCount = patch.musiciansCount ?? pkg.musiciansCount;
        return {
          ...pkg,
          ...patch,
          performanceType:
            patch.performanceType ??
            (patch.musiciansCount !== undefined
              ? inferPerformanceTypeFromCount(nextCount)
              : pkg.performanceType),
        };
      }),
    }));
  };

  const handleAddFormationPackage = () => {
    const nextCount =
      (settings.lineup_packages[settings.lineup_packages.length - 1]?.musiciansCount || 4) + 1;
    const newPkg: LineupPackagePreset = {
      id: `pkg-${Date.now()}`,
      name: `${nextCount}-Piece Band`,
      performanceType: inferPerformanceTypeFromCount(nextCount),
      musiciansCount: nextCount,
      flatPrice: nextCount * (settings.base_musician_rate || 250),
      is_active: true,
    };
    setSettings((prev) => ({
      ...prev,
      lineup_packages: [...prev.lineup_packages, newPkg],
    }));
  };

  const handleRemovePackage = (id: string) => {
    if (settings.lineup_packages.length <= 1) return;
    setSettings((prev) => ({
      ...prev,
      lineup_packages: prev.lineup_packages.filter((p) => p.id !== id),
    }));
  };

  // ──Markup Handler ─────────────────────────────────────────────
  const handleMarkupTypeChange = (type: BandMarkupType) => {
    const nextVal =
      type === 'none'
        ? 0
        : settings.band_markup_value > 0
          ? settings.band_markup_value
          : type === 'percent'
            ? 15
            : 150;
    const nextDivisor =
      type === 'percent' && nextVal > 0
        ? Math.max(0.1, Number((1 - nextVal / 100).toFixed(2)))
        : 1;
    setSettings((prev) => ({
      ...prev,
      band_markup_type: type,
      band_markup_value: nextVal,
      margin_divisor: nextDivisor,
    }));
  };

  const handleMarkupValueChange = (val: number) => {
    const clamped =
      settings.band_markup_type === 'percent' ? Math.max(0, Math.min(90, val)) : Math.max(0, val);
    const nextDivisor =
      settings.band_markup_type === 'percent' && clamped > 0
        ? Math.max(0.1, Number((1 - clamped / 100).toFixed(2)))
        : 1;
    setSettings((prev) => ({
      ...prev,
      band_markup_value: clamped,
      margin_divisor: nextDivisor,
    }));
  };

  // ── Unified Services Catalog Handlers ─────────────────────────
  const handleAppendPresetBundle = (presets: CustomService[], label: string) => {
    setSettings((prev) => {
      const existingNames = new Set(
        prev.custom_services.map((s) => s.name.trim().toLowerCase())
      );
      const existingIds = new Set(prev.custom_services.map((s) => s.id));
      const toAdd = presets
        .filter(
          (p) => !existingIds.has(p.id) && !existingNames.has(p.name.trim().toLowerCase())
        )
        .map((p) => ({ ...p, is_active: true }));

      setPresetFeedback(
        toAdd.length > 0
          ? `Added ${toAdd.length} ${label} ${toAdd.length === 1 ? 'item' : 'items'}`
          : `All ${label} presets are already in your catalog`
      );
      setTimeout(() => setPresetFeedback(null), 2600);

      if (toAdd.length === 0) return prev;
      return {
        ...prev,
        custom_services: [...prev.custom_services, ...toAdd],
      };
    });
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    const newSrv: CustomService = {
      id: `srv-${Date.now()}`,
      name: newServiceName.trim(),
      category: newServiceCategory,
      description: newServiceDesc.trim() || undefined,
      price: Math.max(0, parseFloat(newServicePrice) || 0),
      unit: newServiceUnit,
      is_active: true,
    };
    setSettings((prev) => ({
      ...prev,
      custom_services: [...prev.custom_services, newSrv],
    }));
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceDesc('');
    setShowAddService(false);
  };

  const handleUpdateService = (id: string, patch: Partial<CustomService>) => {
    setSettings((prev) => ({
      ...prev,
      custom_services: prev.custom_services.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    }));
  };

  const handleDeleteService = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      custom_services: prev.custom_services.filter((s) => s.id !== id),
    }));
  };

  const handleToggleService = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      custom_services: prev.custom_services.map((s) =>
        s.id === id ? { ...s, is_active: !s.is_active } : s
      ),
    }));
  };

  // Seasonal percentages
  const peakSurgePercent = Math.round(((settings.peak_season_multiplier || 1) - 1) * 100);
  const lowDiscountPercent = Math.round((1 - (settings.low_season_multiplier || 1)) * 100);

  const activeServicesCount = settings.custom_services.filter((s) => s.is_active).length;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'rates', label: 'Lineup & Rates' },
    { id: 'services', label: `Sets & Add-Ons (${activeServicesCount})` },
    { id: 'production', label: 'Travel & Sound' },
    { id: 'commercial', label: 'Rules & Tax' },
    { id: 'branding', label: 'Branding & Payment' },
  ];

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
                  UNIVERSAL QUOTE ENGINE
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
                LIVE SAMPLE QUOTE (
                {settings.pricing_mode === 'flat_packages'
                  ? `${activeFullPackage?.name || 'Full Band'} · ${sampleMusiciansCount}p`
                  : `${sampleMusiciansCount} ${sampleMusiciansCount === 1 ? 'MUSICIAN' : 'MUSICIANS'}`}{' '}
                · 80 KM)
              </span>
            </div>
            <span className="text-xs text-foreground/60">
              Lineup {currencySymbol}
              {sampleQuote.coreMusiciansCost.toLocaleString()}
              {sampleQuote.bandMarkupCost > 0
                ? ` + Markup ${currencySymbol}${sampleQuote.bandMarkupCost.toLocaleString()}`
                : ''}{' '}
              + PA{' '}
              {sampleQuote.productionCost > 0
                ? `${currencySymbol}${sampleQuote.productionCost.toLocaleString()}`
                : 'Incl.'}{' '}
              + Travel{' '}
              {sampleQuote.travelCost > 0
                ? `${currencySymbol}${sampleQuote.travelCost.toLocaleString()}`
                : 'Incl.'}
            </span>
          </div>
          <div className="flex items-baseline gap-3 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-foreground/10">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                NET QUOTE
              </span>
              <span className="text-lg font-black text-foreground tabular-nums leading-tight">
                {currencySymbol}
                {sampleQuote.netTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                INCL. {settings.default_vat_rate}% VAT
              </span>
              <span className="text-sm font-bold text-foreground/70 tabular-nums leading-tight">
                {currencySymbol}
                {sampleQuote.totalWithVat.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ TAB 1: LINEUP & RATES ═══ */}
        {activeTab === 'rates' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Pricing Model Selector */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Base Pricing Model
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Choose whether quotes scale per musician or use fixed lineup formation packages.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, pricing_mode: 'per_musician' })}
                  className={cn(
                    'p-4 rounded-[16px] border text-left transition-all flex items-start gap-3',
                    settings.pricing_mode === 'per_musician'
                      ? 'bg-primary/10 border-primary shadow-2xs'
                      : 'bg-card border-foreground/10 hover:border-foreground/25'
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0',
                      settings.pricing_mode === 'per_musician'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/8 text-foreground/60'
                    )}
                  >
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                      Per-Musician Rate
                    </span>
                    <span className="text-[11px] text-foreground/55 leading-snug">
                      Sum individual member fees or multiply lineup size by a standard rate.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, pricing_mode: 'flat_packages' })}
                  className={cn(
                    'p-4 rounded-[16px] border text-left transition-all flex items-start gap-3',
                    settings.pricing_mode === 'flat_packages'
                      ? 'bg-primary/10 border-primary shadow-2xs'
                      : 'bg-card border-foreground/10 hover:border-foreground/25'
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0',
                      settings.pricing_mode === 'flat_packages'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/8 text-foreground/60'
                    )}
                  >
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                      Flat Lineup Packages
                    </span>
                    <span className="text-[11px] text-foreground/55 leading-snug">
                      Set fixed flat prices for Solo, Duo, Trio, Full Band or custom acts.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mode A: Per-Musician Rate Controls */}
            {settings.pricing_mode === 'per_musician' && (
              <div className="flex flex-col gap-3">
                {/* Standard Musician Fee */}
                <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Standard Musician Fee ({currencySymbol.trim()})
                    </span>
                    <span className="text-[11px] text-foreground/50">
                      Default performance fee per band member when no custom roster fee is set
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                    <span className="text-sm font-bold text-foreground/40">{currencySymbol}</span>
                    <input
                      type="number"
                      min="0"
                      value={settings.base_musician_rate}
                      onChange={(e) => {
                        const rate = Math.max(0, Number(e.target.value));
                        setSettings({
                          ...settings,
                          base_musician_rate: rate,
                          core_member_rate: rate,
                        });
                      }}
                      className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                    />
                  </div>
                </div>

                {/* Toggle: Use Individual Member Fees from Roster */}
                <div
                  onClick={() =>
                    setSettings({
                      ...settings,
                      use_roster_member_fees: !settings.use_roster_member_fees,
                    })
                  }
                  className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4 cursor-pointer hover:border-foreground/20 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Use Individual Member Fees from Roster
                    </span>
                    <span className="text-[11px] text-foreground/50">
                      Automatically apply each musician&apos;s personal default fee when available
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.use_roster_member_fees}
                    className={cn(
                      'w-12 h-7 rounded-full p-1 transition-colors shrink-0 flex items-center',
                      settings.use_roster_member_fees ? 'bg-primary justify-end' : 'bg-foreground/15 justify-start'
                    )}
                  >
                    <span className="w-5 h-5 rounded-full bg-background shadow-xs block" />
                  </button>
                </div>

                {/* Default Lineup Size */}
                <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Default Lineup Size
                    </span>
                    <span className="text-[11px] text-foreground/50">
                      Number of band members pre-selected when starting a new quote
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

                {/* Optional Collapsible External / Guest Musician Fee */}
                <div className="rounded-[16px] bg-card border border-foreground/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsSubRateOpen(!isSubRateOpen)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-foreground/[0.02] transition-colors"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                          External / Guest Musician Fee
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-[6px] bg-foreground/8 text-foreground/50">
                          {settings.enable_external_sub_rate
                            ? `${currencySymbol}${settings.external_sub_rate ?? settings.session_musician_rate}`
                            : 'Optional'}
                        </span>
                      </div>
                      <span className="text-[11px] text-foreground/50">
                        Different rate for session subs or extra horn/string guests beyond your default lineup
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-foreground/50 transition-transform shrink-0',
                        isSubRateOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isSubRateOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-foreground/10"
                      >
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background/40">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <button
                              type="button"
                              onClick={() =>
                                setSettings({
                                  ...settings,
                                  enable_external_sub_rate: !settings.enable_external_sub_rate,
                                })
                              }
                              className={cn(
                                'w-5 h-5 rounded-[6px] border flex items-center justify-center transition-colors',
                                settings.enable_external_sub_rate
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-foreground/25 bg-background text-transparent'
                              )}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                              Enable Separate External / Sub Rate
                            </span>
                          </label>

                          <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                            <span className="text-sm font-bold text-foreground/40">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={settings.external_sub_rate ?? settings.session_musician_rate}
                              onChange={(e) => {
                                const rate = Math.max(0, Number(e.target.value));
                                setSettings({
                                  ...settings,
                                  enable_external_sub_rate: true,
                                  external_sub_rate: rate,
                                  session_musician_rate: rate,
                                });
                              }}
                              className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Mode B: Flat Lineup Packages */}
            {settings.pricing_mode === 'flat_packages' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">
                    Formation Packages
                  </span>
                  <button
                    type="button"
                    onClick={handleAddFormationPackage}
                    className="px-3 py-1.5 rounded-[10px] bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Formation
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {settings.lineup_packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={cn(
                        'p-4 rounded-[16px] bg-card border flex flex-col gap-3 transition-all',
                        pkg.is_active ? 'border-foreground/15' : 'border-foreground/5 opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePackage(pkg.id, { is_active: !pkg.is_active })
                            }
                            className={cn(
                              'w-5 h-5 rounded-[6px] flex items-center justify-center border shrink-0 transition-colors',
                              pkg.is_active
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-foreground/20 bg-foreground/5 text-transparent'
                            )}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) =>
                              handleUpdatePackage(pkg.id, { name: e.target.value })
                            }
                            placeholder="Formation Name"
                            className="w-full text-sm font-black uppercase tracking-tight bg-transparent border-b border-transparent focus:border-primary text-foreground focus:outline-none truncate"
                          />
                        </div>

                        {settings.lineup_packages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePackage(pkg.id)}
                            className="p-1.5 rounded-[8px] text-foreground/40 hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors"
                            title="Remove Formation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                            Musician Count
                          </label>
                          <div className="flex items-center justify-between bg-background border border-foreground/15 rounded-[10px] p-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdatePackage(pkg.id, {
                                  musiciansCount: Math.max(1, pkg.musiciansCount - 1),
                                })
                              }
                              className="w-7 h-7 rounded-[6px] flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-black tabular-nums text-foreground">
                              {pkg.musiciansCount}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdatePackage(pkg.id, {
                                  musiciansCount: Math.min(20, pkg.musiciansCount + 1),
                                })
                              }
                              className="w-7 h-7 rounded-[6px] flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                            Flat Package Price ({currencySymbol.trim()})
                          </label>
                          <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[10px] px-2.5 py-1.5 h-[38px]">
                            <span className="text-xs font-bold text-foreground/40">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={pkg.flatPrice}
                              onChange={(e) =>
                                handleUpdatePackage(pkg.id, {
                                  flatPrice: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="w-full text-sm font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Group 2: Band Fund / Agency Markup */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Band Fund / Agency Markup
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Optional fee added on top of musician rates for shared band savings, gear wear, or agency commission.
                </p>
              </div>

              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'none', label: 'None' },
                      { id: 'fixed', label: `+ Fixed ${currencySymbol.trim()}` },
                      { id: 'percent', label: '+ Percentage %' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleMarkupTypeChange(opt.id)}
                      className={cn(
                        'py-2.5 px-3 rounded-[10px] text-xs font-bold uppercase tracking-wider border transition-all',
                        settings.band_markup_type === opt.id
                          ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                          : 'bg-background text-foreground/60 border-foreground/15 hover:text-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {settings.band_markup_type !== 'none' && (
                  <div className="flex items-center justify-between pt-2 border-t border-foreground/10 gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        {settings.band_markup_type === 'fixed'
                          ? 'Fixed Band Fund per Gig'
                          : 'Markup Percentage on Lineup'}
                      </span>
                      <span className="text-[11px] text-foreground/50">
                        {settings.band_markup_type === 'fixed'
                          ? `Adds ${currencySymbol}${settings.band_markup_value} automatically to every quote base fee`
                          : `Adds +${settings.band_markup_value}% (${currencySymbol}${sampleQuote.bandMarkupCost.toLocaleString()} on sample quote)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                      {settings.band_markup_type === 'fixed' && (
                        <span className="text-sm font-bold text-foreground/40">
                          {currencySymbol}
                        </span>
                      )}
                      <input
                        type="number"
                        min="0"
                        max={settings.band_markup_type === 'percent' ? 90 : undefined}
                        value={settings.band_markup_value}
                        onChange={(e) => handleMarkupValueChange(Number(e.target.value))}
                        className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                      />
                      {settings.band_markup_type === 'percent' && (
                        <span className="text-sm font-bold text-foreground/40">%</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 2: SETS & ADD-ONS ═══ */}
        {activeTab === 'services' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1 gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Unified Sets & Add-Ons Catalog
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Active sets and extras appear as 1-tap chips in Step 1 of the Quote Wizard.
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

            {/* Quick-Add Preset Bar */}
            <div className="p-3.5 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                Quick-Add Starter Presets
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAppendPresetBundle(WEDDING_SERVICE_PRESETS, 'Wedding')}
                  className="px-3 py-1.5 rounded-[10px] bg-foreground/6 hover:bg-foreground/12 border border-foreground/10 text-xs font-bold text-foreground transition-all active:scale-95"
                >
                  + Wedding Sets
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAppendPresetBundle(CLUB_ROCK_SERVICE_PRESETS, 'Club / Show')
                  }
                  className="px-3 py-1.5 rounded-[10px] bg-foreground/6 hover:bg-foreground/12 border border-foreground/10 text-xs font-bold text-foreground transition-all active:scale-95"
                >
                  + Club / Show Extras
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAppendPresetBundle(CORPORATE_JAZZ_PRESETS, 'Corporate / AV')
                  }
                  className="px-3 py-1.5 rounded-[10px] bg-foreground/6 hover:bg-foreground/12 border border-foreground/10 text-xs font-bold text-foreground transition-all active:scale-95"
                >
                  + Corporate / AV
                </button>
              </div>
              {presetFeedback && (
                <span className="text-[11px] font-bold text-primary">{presetFeedback}</span>
              )}
            </div>

            {/* New Custom Add-On Form */}
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
                    New Custom Set or Add-On
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Service name (e.g. Ceremony Duo, Sax Guest)"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      required
                      className="bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5 text-xs font-bold text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5">
                      <span className="text-xs font-bold text-foreground/40">{currencySymbol}</span>
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
                      onChange={(e) =>
                        setNewServiceCategory(e.target.value as CustomServiceCategory)
                      }
                      className="bg-background border border-foreground/15 rounded-[12px] px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
                    >
                      <option value="performance">Performance</option>
                      <option value="production">Production & AV</option>
                      <option value="logistics">Logistics</option>
                      <option value="custom">Custom Add-on</option>
                    </select>
                    <select
                      value={newServiceUnit}
                      onChange={(e) => setNewServiceUnit(e.target.value as CustomServiceUnit)}
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
                    placeholder="Short description shown on quote PDF (optional)"
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
                      Add to Catalog
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Inline Editable Service Rows */}
            <div className="flex flex-col gap-2.5">
              {settings.custom_services.map((srv) => (
                <div
                  key={srv.id}
                  className={cn(
                    'p-3.5 sm:p-4 rounded-[16px] bg-card border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                    srv.is_active ? 'border-foreground/15' : 'border-foreground/5 opacity-60'
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleService(srv.id)}
                      className={cn(
                        'w-6 h-6 rounded-[8px] flex items-center justify-center border transition-colors shrink-0 mt-0.5 sm:mt-0',
                        srv.is_active
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-foreground/20 bg-foreground/5 text-transparent'
                      )}
                      title={srv.is_active ? 'Active in Quote Wizard' : 'Hidden in Quote Wizard'}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={srv.name}
                          onChange={(e) =>
                            handleUpdateService(srv.id, { name: e.target.value })
                          }
                          className={cn(
                            'w-full text-xs sm:text-sm font-bold bg-transparent border-b border-transparent focus:border-primary text-foreground focus:outline-none truncate',
                            !srv.is_active && 'line-through text-foreground/40'
                          )}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[6px] bg-foreground/8 text-foreground/60 shrink-0 hidden sm:inline-block">
                          {CATEGORY_LABELS[srv.category] || srv.category}
                        </span>
                      </div>
                      {srv.description && (
                        <span className="text-[11px] text-foreground/50 truncate">
                          {srv.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0 pl-9 sm:pl-0">
                    <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[10px] px-2.5 py-1.5 w-24">
                      <span className="text-xs font-bold text-foreground/40">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={srv.price}
                        onChange={(e) =>
                          handleUpdateService(srv.id, {
                            price: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-full text-xs font-black bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                      />
                    </div>

                    <select
                      value={srv.unit}
                      onChange={(e) =>
                        handleUpdateService(srv.id, {
                          unit: e.target.value as CustomServiceUnit,
                        })
                      }
                      aria-label="Service pricing unit"
                      className="bg-background border border-foreground/15 rounded-[10px] px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:border-primary"
                    >
                      {(Object.keys(UNIT_LABELS) as CustomServiceUnit[]).map((u) => (
                        <option key={u} value={u}>
                          {UNIT_LABELS[u]}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteService(srv.id)}
                      className="w-8 h-8 rounded-[8px] hover:bg-[var(--destructive)]/10 text-foreground/40 hover:text-[var(--destructive)] flex items-center justify-center transition-colors shrink-0"
                      title="Delete Service"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TAB 3: TRAVEL & SOUND ═══ */}
        {activeTab === 'production' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Travel & Mileage */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    1. Travel & Mileage Rules
                  </h2>
                </div>
                <p className="text-[11px] text-foreground/50">
                  Configure home base, local free radius, and vehicle/mileage calculation.
                </p>
              </div>

              {/* Band Home Base Location */}
              <div className="flex flex-col gap-2.5 p-4 rounded-[16px] bg-card border border-foreground/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Band Home Base Location
                  </span>
                  {typeof settings.band_origin_lat === 'number' &&
                    typeof settings.band_origin_lng === 'number' && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-[6px] tracking-wider">
                        COORDINATES SET ({settings.band_origin_lat.toFixed(2)}°,{' '}
                        {settings.band_origin_lng.toFixed(2)}°)
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
                        const formatted =
                          place.fullAddress ||
                          [place.address, place.city, place.country].filter(Boolean).join(', ') ||
                          place.name;
                        setSettings({
                          ...settings,
                          band_origin_address: formatted,
                          band_origin_lat: place.latitude,
                          band_origin_lng: place.longitude,
                        });
                      }}
                      placeholder="e.g. Milan, Italy or Rehearsal Studio"
                      className="border-0 pb-0"
                    />
                  </div>
                </div>
              </div>

              {/* Default Travel Policy */}
              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-2.5">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Default Travel Policy
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        default_travel_included: true,
                        default_travel_mode: 'included',
                      })
                    }
                    className={cn(
                      'py-2.5 px-3 rounded-[10px] text-xs font-bold uppercase tracking-wider border transition-all',
                      settings.default_travel_included
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground/60 border-foreground/15 hover:text-foreground'
                    )}
                  >
                    Included in Base
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        default_travel_included: false,
                        default_travel_mode: 'separate',
                      })
                    }
                    className={cn(
                      'py-2.5 px-3 rounded-[10px] text-xs font-bold uppercase tracking-wider border transition-all',
                      !settings.default_travel_included
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground/60 border-foreground/15 hover:text-foreground'
                    )}
                  >
                    Separate Fee
                  </button>
                </div>
              </div>

              {/* Travel Calculation Mode */}
              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Travel Calculation Mode
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Applied to round-trip distance beyond your free local radius
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'per_vehicle', label: 'Per Vehicle' },
                      { id: 'per_musician', label: 'Per Musician' },
                      { id: 'flat_km', label: 'Flat per KM' },
                    ] as { id: TravelCalcMode; label: string }[]
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSettings({ ...settings, travel_calc_mode: mode.id })}
                      className={cn(
                        'py-2.5 px-2 rounded-[10px] text-xs font-bold uppercase tracking-wider border transition-all',
                        settings.travel_calc_mode === mode.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground/60 border-foreground/15 hover:text-foreground'
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {settings.travel_calc_mode === 'per_vehicle' && (
                  <div className="flex items-center justify-between pt-2 border-t border-foreground/10 gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        Number of Vehicles
                      </span>
                      <span className="text-[11px] text-foreground/50">
                        Cars or vans traveling to the venue
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-background border border-foreground/15 rounded-[12px] p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            travel_vehicles_count: Math.max(
                              1,
                              (settings.travel_vehicles_count || 1) - 1
                            ),
                          })
                        }
                        className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-base font-black text-foreground tabular-nums">
                        {settings.travel_vehicles_count || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            travel_vehicles_count: Math.min(
                              10,
                              (settings.travel_vehicles_count || 1) + 1
                            ),
                          })
                        }
                        className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Free Local Radius & Rate per KM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Free Local Radius
                    </span>
                    <span className="text-[11px] text-foreground/50">
                      One-way km included at €0
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                    <input
                      type="number"
                      min="0"
                      value={settings.free_travel_radius_km}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          free_travel_radius_km: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                    />
                    <span className="text-[10px] font-bold text-foreground/40 uppercase">km</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Rate per KM
                    </span>
                    <span className="text-[11px] text-foreground/50">
                      Fuel & vehicle wear rate
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                    <span className="text-sm font-bold text-foreground/40">{currencySymbol}</span>
                    <input
                      type="number"
                      step="0.05"
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
              </div>

              <div className="p-3.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-xs text-foreground/70 leading-relaxed">
                Example: An <strong>80 km</strong> one-way gig ({Math.max(0, 80 - (settings.free_travel_radius_km || 0))} km billable beyond {settings.free_travel_radius_km || 0} km free radius, ×2 round-trip) calculates to{' '}
                <strong>
                  {currencySymbol}
                  {sampleTravel80Km}
                </strong>
                {settings.default_travel_included ? ' (included in base by default).' : ' (billed separately by default).'}
              </div>
            </div>

            {/* Group 2: Sound & Lighting Packages */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    2. Sound & Lighting Packages
                  </h2>
                </div>
                <p className="text-[11px] text-foreground/50">
                  Set your default PA policy and production package prices.
                </p>
              </div>

              {/* Default Production Policy */}
              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-2.5">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Default Production Policy
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'included', label: 'Included' },
                      { id: 'separate', label: 'Separate Fee' },
                      { id: 'client_provided', label: 'Client/Venue Provides' },
                    ] as const
                  ).map((pol) => {
                    const isActive =
                      settings.default_production_mode === pol.id ||
                      (pol.id === 'client_provided' &&
                        settings.default_production_mode === 'none');
                    return (
                      <button
                        key={pol.id}
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            default_production_mode: pol.id,
                            default_production_tier:
                              pol.id === 'client_provided' ? 'none' : 'standard',
                          })
                        }
                        className={cn(
                          'py-2.5 px-3 rounded-[10px] text-xs font-bold uppercase tracking-wider border transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground/60 border-foreground/15 hover:text-foreground'
                        )}
                      >
                        {pol.label}
                      </button>
                    );
                  })}
                </div>
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
                  <span className="text-sm font-bold text-foreground/40">{currencySymbol}</span>
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
                  <span className="text-sm font-bold text-foreground/40">{currencySymbol}</span>
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
                    Extra Zone Sound Fee
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Independent speaker & wireless mic for a second area
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-32 shrink-0">
                  <span className="text-sm font-bold text-foreground/40">{currencySymbol}</span>
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

        {/* ═══ TAB 4: RULES & TAX ═══ */}
        {activeTab === 'commercial' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Optional Seasonal Pricing */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Seasonal Pricing
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Optional peak / off-peak rate adjustments based on event month.
                </p>
              </div>

              {/* Enable Seasonal Pricing Toggle */}
              <div
                onClick={() =>
                  setSettings({
                    ...settings,
                    seasonal_pricing_enabled: !settings.seasonal_pricing_enabled,
                  })
                }
                className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4 cursor-pointer hover:border-foreground/20 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Enable Seasonal Pricing
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Apply Peak & Off-Peak multipliers automatically when an event date is chosen
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.seasonal_pricing_enabled}
                  className={cn(
                    'w-12 h-7 rounded-full p-1 transition-colors shrink-0 flex items-center',
                    settings.seasonal_pricing_enabled
                      ? 'bg-primary justify-end'
                      : 'bg-foreground/15 justify-start'
                  )}
                >
                  <span className="w-5 h-5 rounded-full bg-background shadow-xs block" />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {settings.seasonal_pricing_enabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden flex flex-col gap-3"
                  >
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

                    {/* Off-Peak Season Discount (%) */}
                    <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                          Off-Peak Season Discount
                        </span>
                        <span className="text-[11px] text-foreground/50">
                          Jan, Feb, Mar & Nov (Off-peak incentive)
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Group 2: Tax, Deposit & Validity */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Tax, Deposit & Validity
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Default VAT rate, booking deposit, and quote expiration window.
                </p>
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

              {/* Default Quote Validity (Days) */}
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Default Validity Days
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Number of days a quote remains valid from issue date
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-foreground/15 rounded-[12px] px-3 py-2 w-28 shrink-0">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.default_validity_days ?? 30}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_validity_days: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-[10px] font-bold text-foreground/40 uppercase">days</span>
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

        {/* ═══ TAB 5: BRANDING, SIGNATURE & PAYMENT DETAILS ═══ */}
        {activeTab === 'branding' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Band Identity, Logo & Official Sign-Off */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Band Identity, Logo & Quote Sign-Off
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Update your band name, tagline, logo, and authorized signer shown across the app and on exported A4 Quote PDFs.
                </p>
              </div>

              {/* Band Name & Bio / Tagline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    Band Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. The Midnight Quartet"
                    value={bandName}
                    onChange={(e) => setBandName(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-background border border-foreground/10 text-sm font-bold text-foreground focus:outline-none focus:border-foreground/30 transition-colors"
                  />
                </div>
                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    Band Bio / Tagline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5-Piece Soul & Funk Collective"
                    value={bandDescription}
                    onChange={(e) => setBandDescription(e.target.value)}
                    className="w-full h-10 px-3 rounded-[10px] bg-background border border-foreground/10 text-sm font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-colors"
                  />
                </div>
              </div>

              {/* Band Logo Upload Card */}
              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-[14px] bg-background border border-foreground/15 flex items-center justify-center overflow-hidden shrink-0">
                    {settings.band_logo_url ? (
                      <img
                        src={settings.band_logo_url}
                        alt="Band Logo"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <Image className="w-7 h-7 text-foreground/30" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      Band Logo
                    </span>
                    <span className="text-[11px] text-foreground/50 max-w-xs">
                      High-resolution PNG, JPG or SVG (transparent or white background recommended for A4 PDF headers).
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="px-3.5 py-2 rounded-[10px] bg-foreground text-background text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:opacity-90 transition-all"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {settings.band_logo_url ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {settings.band_logo_url && (
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, band_logo_url: '' })}
                      className="p-2 rounded-[10px] bg-foreground/5 hover:bg-destructive/10 text-foreground/60 hover:text-destructive transition-colors"
                      title="Remove Logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Signer Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    Signer Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gabriel Rodriguez"
                    value={settings.signer_name || ''}
                    onChange={(e) => setSettings({ ...settings, signer_name: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      Signer Role / Title
                    </label>
                    <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Musical Director / Bandleader"
                    value={settings.signer_role || ''}
                    onChange={(e) => setSettings({ ...settings, signer_role: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Signature Upload or Draw Pad */}
              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                        Authorized Signature
                      </span>
                      <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                    </div>
                    <span className="text-[11px] text-foreground/50">
                      Appears at the bottom-right of your quote PDF above the signer&apos;s name.
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-background border border-foreground/15 rounded-[10px] p-1">
                    <button
                      type="button"
                      onClick={() => setSignatureMode('upload')}
                      className={cn(
                        'px-2.5 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider transition-all',
                        signatureMode === 'upload'
                          ? 'bg-foreground text-background'
                          : 'text-foreground/60 hover:text-foreground'
                      )}
                    >
                      Upload Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignatureMode('draw')}
                      className={cn(
                        'px-2.5 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider transition-all',
                        signatureMode === 'draw'
                          ? 'bg-foreground text-background'
                          : 'text-foreground/60 hover:text-foreground'
                      )}
                    >
                      Draw Signature
                    </button>
                  </div>
                </div>

                {signatureMode === 'upload' ? (
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="h-16 min-w-[160px] px-4 rounded-[12px] bg-white border border-foreground/15 flex items-center justify-center overflow-hidden">
                      {settings.signature_url ? (
                        <img
                          src={settings.signature_url}
                          alt="Signature Preview"
                          className="max-h-12 w-auto object-contain"
                        />
                      ) : (
                        <span className="text-[11px] font-medium text-black/40 italic">
                          No signature uploaded
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={sigInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => sigInputRef.current?.click()}
                        disabled={uploadingSignature}
                        className="px-3.5 py-2 rounded-[10px] bg-foreground/10 hover:bg-foreground hover:text-background text-foreground text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                        {settings.signature_url ? 'Replace' : 'Upload PNG'}
                      </button>
                      {settings.signature_url && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, signature_url: '' })}
                          className="p-2 rounded-[10px] bg-foreground/5 hover:bg-destructive/10 text-foreground/60 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full h-32 rounded-[12px] bg-white border border-foreground/20 overflow-hidden touch-none">
                      <canvas
                        ref={sigCanvasRef}
                        width={600}
                        height={180}
                        onMouseDown={(e) => startSigDraw(e.clientX, e.clientY)}
                        onMouseMove={(e) => moveSigDraw(e.clientX, e.clientY)}
                        onMouseUp={endSigDraw}
                        onMouseLeave={endSigDraw}
                        onTouchStart={(e) => {
                          const t = e.touches[0];
                          if (t) startSigDraw(t.clientX, t.clientY);
                        }}
                        onTouchMove={(e) => {
                          const t = e.touches[0];
                          if (t) moveSigDraw(t.clientX, t.clientY);
                        }}
                        onTouchEnd={endSigDraw}
                        className="w-full h-full cursor-crosshair"
                      />
                      <div className="pointer-events-none absolute bottom-2 left-3 right-3 border-b border-black/15 flex justify-between items-center pb-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-black/30">
                          Sign above line
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={clearSigCanvas}
                        className="px-3 py-1.5 rounded-[8px] bg-foreground/5 hover:bg-foreground/10 text-xs font-bold uppercase tracking-wider text-foreground/70"
                      >
                        Clear Pad
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Group 2: Bank & Payment Details */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Payment & Bank Transfer Details
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Bank coordinates and payment terms printed on quotes when payment details are enabled.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    Account Holder / Beneficiary
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Luxe Music Production S.L."
                    value={settings.bank_account_holder || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, bank_account_holder: e.target.value })
                    }
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    IBAN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IT60 X054 2811 1010 0000 0123 456"
                    value={settings.bank_iban || ''}
                    onChange={(e) => setSettings({ ...settings, bank_iban: e.target.value })}
                    className="w-full text-sm font-bold font-mono bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      Bank Name
                    </label>
                    <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Intesa Sanpaolo / Revolut Business"
                    value={settings.bank_name || ''}
                    onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      BIC / SWIFT Code
                    </label>
                    <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. BCITITMM"
                    value={settings.bank_bic_swift || ''}
                    onChange={(e) => setSettings({ ...settings, bank_bic_swift: e.target.value })}
                    className="w-full text-sm font-bold font-mono bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                  Default Payment Terms Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. 30% deposit upon booking; 70% balance due on event date"
                  value={settings.default_payment_terms || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, default_payment_terms: e.target.value })
                  }
                  className="w-full text-sm font-medium bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Group 3: Contact & Legal Info */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  3. Band Contact & Legal Details
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Contact details and optional fiscal information for agency or corporate quotes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    Booking Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="booking@yourband.com"
                    value={settings.contact_email || ''}
                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    Contact Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="+39 333 123 4567"
                    value={settings.contact_phone || ''}
                    onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      Website / Portfolio URL
                    </label>
                    <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="www.yourband.com"
                    value={settings.website || ''}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      Legal / Company Name
                    </label>
                    <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Luxe Live Entertainment S.r.l."
                    value={settings.legal_company_name || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, legal_company_name: e.target.value })
                    }
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      Tax / VAT ID (P.IVA / CIF)
                    </label>
                    <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. IT12345678901"
                    value={settings.tax_vat_id || ''}
                    onChange={(e) => setSettings({ ...settings, tax_vat_id: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      Registered Legal Address
                    </label>
                    <span className="text-[10px] font-medium text-foreground/40">(optional)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Street, City, Postal Code, Country"
                    value={settings.legal_address || ''}
                    onChange={(e) => setSettings({ ...settings, legal_address: e.target.value })}
                    className="w-full text-sm font-bold bg-background border border-foreground/15 rounded-[10px] px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Group 4: Quote Disclaimer Default */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  4. Quote PDF Disclaimer Text
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Legal validity note printed beneath the Event Date on your PDF quotes.
                </p>
              </div>

              <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    Default Quote Disclaimer Text (use &#123;days&#125; for dynamic validity)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        default_quote_disclaimer: DEFAULT_QUOTE_DISCLAIMER,
                      })
                    }
                    className="text-[10px] font-bold uppercase text-primary hover:underline"
                  >
                    Reset Text
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={settings.default_quote_disclaimer || DEFAULT_QUOTE_DISCLAIMER}
                  onChange={(e) =>
                    setSettings({ ...settings, default_quote_disclaimer: e.target.value })
                  }
                  className="w-full text-xs font-medium leading-relaxed bg-background border border-foreground/15 rounded-[10px] p-3 text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
