import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSystemBack } from '@/lib/backStack';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  MapPin,
  Lock,
  Upload,
  Image,
  FileSignature,
  ChevronDown,
  X,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotText, Toggle } from '@/app/components/bw';
import { RailCover } from '@/lib/railActions';
import { HeaderAction, IconButton, Tag, Card } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector } from '@/app/components/bw/Form';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { useBand } from '@/lib/BandContext';
import { updateBand } from '@/lib/services/bands';
import { CURRENCIES, COUNTRY_TAX_PRESETS, currencySymbol as symbolFor, findCountryPreset, type CurrencyCode } from '@/lib/currency';
import type { PerformanceType } from '@/app/data/quotes';
import {
  DEFAULT_BAND_PRICING,
  DEFAULT_QUOTE_DISCLAIMER,
  bankRegionOf,
  type BankRegion,
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
import { ONLINE_DEPOSITS_ENABLED } from '@/lib/services/pricing';
import { t, useT, intlLocale } from '@/lib/i18n';
import { builtinText } from '@/lib/i18n/builtins';

export type PricingModalTabType = 'branding' | 'rates' | 'production' | 'services' | 'commercial';

interface BandPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId?: string;
  initialTab?: PricingModalTabType;
  onSaved?: (settings: BandPricingSettings) => void;
}

type TabType = PricingModalTabType;
const TAB_ORDER: TabType[] = ['rates', 'services', 'production', 'commercial', 'branding'];

import { formatDistance, fromUnit, ratePerKm, ratePerUnit, toUnit, unitSingular, useDistanceUnit, type DistanceUnit } from '@/lib/units';

const UNIT_LABELS: Record<CustomServiceUnit, string> = {
  flat: 'Flat Fee',
  per_person: 'Per Musician',
  per_hour: 'Per Hour',
  per_km: 'Per KM',
};
/** Service unit label in the chosen distance unit ("Per mile"). */
const unitLabel = (u: CustomServiceUnit, d: DistanceUnit) =>
  u === 'per_km'
    ? d === 'mi' ? t('Per mile') : t('Per km')
    : u === 'per_person' ? t('Per Musician') : u === 'per_hour' ? t('Per Hour') : t('Flat Fee');
/** Prices charged per distance are stored per km and shown per chosen unit. */
const shownPrice = (srv: { price: number; unit: CustomServiceUnit }, d: DistanceUnit) =>
  srv.unit === 'per_km' ? ratePerUnit(srv.price, d) : srv.price;

const categoryLabel = (c: CustomServiceCategory): string | undefined =>
  c === 'performance'
    ? t('Performance')
    : c === 'production'
      ? t('Production & AV')
      : c === 'logistics'
        ? t('Logistics')
        : c === 'custom'
          ? t('Custom Add-on')
          : undefined;

const inferPerformanceTypeFromCount = (count: number): PerformanceType => {
  if (count <= 1) return 'solo';
  if (count === 2) return 'duo';
  if (count === 3) return 'trio';
  return 'full_band';
};

/* ─────────────────────────────────────────────────────────────────────────
 * Local building blocks for the Figma "Pricing / Lineup & rates" frame.
 * Settings rows are cards (bg-card, r24, p16) with a Label/SM title and a
 * Body/SM hint; inputs are fully rounded pills on bg-field.
 * ───────────────────────────────────────────────────────────────────────── */

/** Section heading: Label/SM caps + optional Body/SM hint, optional action. */
const Section: React.FC<{ title: string; hint?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  hint,
  action,
  children,
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-end justify-between gap-3">
      <div className="flex flex-col gap-1 min-w-0">
        <h2 className="bw-label-sm text-muted-foreground">{title}</h2>
        {hint && <p className="bw-body-sm text-muted-foreground">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </section>
);

/** Setting card: label + hint on the left, a control on the right. */
const SettingRow: React.FC<{
  label: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ label, hint, children, onClick, className }) => (
  <div
    onClick={onClick}
    className={cn('flex items-center justify-between gap-4 p-4 rounded-[24px] bg-card text-foreground', onClick && 'cursor-pointer', className)}
  >
    <div className="flex flex-col gap-1 min-w-0">
      <span className="bw-label-sm text-foreground">{label}</span>
      {hint && <span className="bw-body-sm text-muted-foreground">{hint}</span>}
    </div>
    {children && <div className="shrink-0">{children}</div>}
  </div>
);

/** Card row with a Figma Toggle; the whole row toggles. */
const ToggleRow: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; checked: boolean; onToggle: () => void }> = ({
  label,
  hint,
  checked,
  onToggle,
}) => (
  <SettingRow label={label} hint={hint} onClick={onToggle}>
    <Toggle
      checked={checked}
      onCheckedChange={onToggle}
      onClick={(e) => e.stopPropagation()}
      aria-label={typeof label === 'string' ? label : undefined}
    />
  </SettingRow>
);

/** Numeric pill input with an optional prefix (currency / ±) and suffix (%, km, days). */
interface NumberPillProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** lg = 52pt full width (Figma Input) · md = 44pt compact (inside rows). */
  size?: 'lg' | 'md';
}
const NumberPill: React.FC<NumberPillProps> = ({ label, prefix, suffix, size = 'md', className, ...rest }) => (
  <label
    className={cn(
      'flex items-center gap-1.5 rounded-full bg-field border border-border px-4 text-foreground',
      'focus-within:border-2 focus-within:border-foreground transition-[border-color]',
      size === 'lg' ? 'h-[52px] w-full' : 'h-11 w-32',
      className,
    )}
  >
    <span className="sr-only">{label}</span>
    {prefix != null && <span className="bw-body-md text-muted-foreground shrink-0">{prefix}</span>}
    <input
      type="number"
      className={cn(
        'flex-1 min-w-0 w-full bg-transparent outline-none bw-body-lg tabular-nums',
        size === 'lg' ? 'text-left' : 'text-right',
      )}
      {...rest}
    />
    {suffix != null && <span className="bw-label-sm text-muted-foreground shrink-0">{suffix}</span>}
  </label>
);

/** Figma stepper: Outline "−", Value/MD number, Filled "+". */
const Stepper: React.FC<{ value: React.ReactNode; label: string; onDec: () => void; onInc: () => void }> = ({
  value,
  label,
  onDec,
  onInc,
}) => (
  <div className="flex items-center gap-3">
    <IconButton size="sm" label={t('Decrease {label}', { label })} icon={<Minus />} onClick={onDec} />
    <span className="bw-value-md min-w-8 text-center tabular-nums">{value}</span>
    <IconButton size="sm" variant="filled" label={t('Increase {label}', { label })} icon={<Plus />} onClick={onInc} />
  </div>
);

/** Figma segmented control: card track, selected option in inverse. */
const Segmented = <T extends string>({
  options,
  onSelect,
  label,
}: {
  options: { id: T; label: string; active: boolean }[];
  onSelect: (id: T) => void;
  label: string;
}) => (
  <div role="radiogroup" aria-label={label} className="flex gap-1 p-1 rounded-full bg-card">
    {options.map((opt) => (
      <button
        key={opt.id}
        type="button"
        role="radio"
        aria-checked={opt.active}
        onClick={() => onSelect(opt.id)}
        className={cn(
          'flex-1 min-w-0 min-h-11 px-2 py-2 rounded-full bw-button-sm leading-tight text-center transition-colors',
          opt.active ? 'bg-surface-inverse text-surface-inverse-foreground' : 'text-foreground',
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/** Round check used for "active in the quote wizard" (packages, services). */
const CheckDot: React.FC<{ checked: boolean; onClick: () => void; label: string }> = ({ checked, onClick, label }) => (
  <button type="button" role="checkbox" aria-checked={checked} aria-label={label} title={label} onClick={onClick} className="-m-2.5 p-2.5 shrink-0">
    <span
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
        checked ? 'bg-surface-inverse text-surface-inverse-foreground' : 'border-[1.5px] border-foreground/30 text-transparent',
      )}
    >
      <Check className="w-3.5 h-3.5" />
    </span>
  </button>
);

/** Native select styled as a pill. */
const SelectPill: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...rest }) => (
  <div className={cn('relative', className)}>
    <select
      className="w-full h-11 pl-4 pr-9 rounded-full bg-field border border-border bw-body-sm font-medium text-foreground outline-none focus:border-foreground appearance-none"
      {...rest}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
  </div>
);

export const BandPricingModal: React.FC<BandPricingModalProps> = ({
  isOpen,
  onClose,
  bandId = 'default',
  initialTab = 'rates',
  onSaved,
}) => {
  const t = useT();
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

  // The section the sheet opens on comes first (Band settings opens on
  // Branding & payment), then the others in their usual order. The order is
  // set when the sheet opens and stays put while you switch sections.
  const tabOrder = useMemo<TabType[]>(
    () => [initialTab, ...TAB_ORDER.filter((id) => id !== initialTab)],
    [initialTab],
  );

  // Keep the selected section in view: the strip scrolls sideways on narrow screens.
  const tabStripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const strip = tabStripRef.current;
    const idx = tabOrder.indexOf(activeTab);
    const el = strip?.children[idx] as HTMLElement | undefined;
    if (!strip || !el) return;
    const left = el.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    const target = idx === 0 ? 0 : Math.max(0, left - (strip.clientWidth - el.offsetWidth) / 2);
    strip.scrollTo({ left: target, behavior: 'auto' });
  }, [isOpen, activeTab, tabOrder]);

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

  const currencySymbol = symbolFor(settings.currency);
  const distanceUnit = useDistanceUnit();
  const countryPreset = findCountryPreset(settings.country);

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

  useSystemBack(isOpen, onClose);

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
        <div role="alertdialog" aria-modal="true" className="bg-card text-card-foreground p-6 rounded-[24px] max-w-sm w-full text-center flex flex-col items-center gap-4">
          <span className="w-10 h-10 rounded-full bg-foreground/[0.08] text-destructive flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="bw-h3 text-foreground">{t('Admin access required')}</h3>
            <p className="bw-body-sm text-muted-foreground">
              {t('Only band administrators can access and configure the financial and logistical formulas for this band.')}
            </p>
          </div>
          <PillButton variant="dark" size="md" onClick={onClose}>
            {t('Close')}
          </PillButton>
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
    // An open quote PDF preview re-renders with the new branding / bank details.
    window.dispatchEvent(new CustomEvent('bw:band-pricing-saved'));
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
      name: t('{count}-Piece Band', { count: nextCount }),
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
          ? toAdd.length === 1
            ? t('Added {count} {label} item', { count: toAdd.length, label })
            : t('Added {count} {label} items', { count: toAdd.length, label })
          : t('All {label} presets are already in your catalog', { label })
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
      price: newServiceUnit === 'per_km'
        ? ratePerKm(Math.max(0, parseFloat(newServicePrice) || 0), distanceUnit)
        : Math.max(0, parseFloat(newServicePrice) || 0),
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

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'rates', label: t('Lineup & rates') },
    { id: 'services', label: t('Sets & add-ons'), count: activeServicesCount },
    { id: 'production', label: t('Travel & sound') },
    { id: 'commercial', label: t('Rules & tax') },
    { id: 'branding', label: t('Branding & payment') },
  ];

  const sampleLabel =
    settings.pricing_mode === 'flat_packages'
      ? `${activeFullPackage?.name || t('Full band')} · ${sampleMusiciansCount === 1 ? t('{count} musician', { count: sampleMusiciansCount }) : t('{count} musicians', { count: sampleMusiciansCount })} · ${formatDistance(80, distanceUnit)}`
      : `${sampleMusiciansCount === 1 ? t('{count} musician', { count: sampleMusiciansCount }) : t('{count} musicians', { count: sampleMusiciansCount })} · ${formatDistance(80, distanceUnit)}`;
  const sampleNet = `${currencySymbol}${sampleQuote.netTotal.toLocaleString(intlLocale())}`;

  // Portaled above everything (z-130), so it also opens on top of a quote
  // detail / PDF sheet when reached from "Complete your band branding".
  return createPortal(
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-detail fixed inset-0 z-[130] bg-background text-foreground flex flex-col overflow-hidden"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      <div className="@container flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        {/* Header: kicker + close (Figma: Pricing / Lineup & rates) */}
        <header className="px-4 pb-4" style={{ paddingTop: 'calc(var(--wizard-header-pt, max(var(--safe-top), 44px)) + 8px)' }}>
          <div className="max-w-2xl mx-auto w-full flex items-start gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p className="bw-label-sm text-muted-foreground">{t('Universal quote engine')}</p>
              <h1 className="bw-display-lg text-foreground [overflow-wrap:anywhere]">{t('Pricing & services')}</h1>
            </div>
            <RailCover pane />
            <HeaderAction pane label={t('Close pricing')} icon={<X />} onClick={onClose} />
          </div>
        </header>

        {/* Live sample quote strip */}
        <div className="bg-surface-inverse text-surface-inverse-foreground px-4 py-3">
          <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="bw-label-sm">{t('Live sample quote')}</span>
              <span className="bw-body-sm truncate">{sampleLabel}</span>
              <span className="bw-label-xs opacity-60 [overflow-wrap:anywhere]">
                {t('Lineup')} {currencySymbol}
                {sampleQuote.coreMusiciansCost.toLocaleString(intlLocale())}
                {sampleQuote.bandMarkupCost > 0 ? ` + ${t('markup {amount}', { amount: `${currencySymbol}${sampleQuote.bandMarkupCost.toLocaleString(intlLocale())}` })}` : ''}
                {' · PA '}
                {sampleQuote.productionCost > 0 ? `${currencySymbol}${sampleQuote.productionCost.toLocaleString(intlLocale())}` : t('incl.')}
                {` · ${t('Travel')} `}
                {sampleQuote.travelCost > 0 ? `${currencySymbol}${sampleQuote.travelCost.toLocaleString(intlLocale())}` : t('incl.')}
              </span>
            </div>
            <div
              className="shrink-0 flex flex-col items-end gap-1 max-w-[55%]"
              style={{ '--dot-off': 'color-mix(in srgb, currentColor 18%, transparent)' } as React.CSSProperties}
            >
              <DotText text={sampleNet} size={28} showGrid label={t('Net {amount}', { amount: sampleNet })} />
              <span className="bw-label-xs opacity-60 whitespace-nowrap">
                {t('Incl. {rate}% VAT', { rate: settings.default_vat_rate })} {currencySymbol}
                {sampleQuote.totalWithVat.toLocaleString(intlLocale())}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4">
          <div ref={tabStripRef} role="group" aria-label={t('Pricing sections')} className="max-w-2xl mx-auto w-full flex gap-2 overflow-x-auto scrollbar-hide">
            {tabOrder.map((id) => tabs.find((x) => x.id === id)!).map((tab) => (
              <Selector key={tab.id} size="md" selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} count={tab.count}>
                {tab.label}
              </Selector>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="px-4 pt-4 pb-8 flex flex-col gap-6 max-w-2xl mx-auto w-full">
          {/* ═══ TAB 1: LINEUP & RATES ═══ */}
          {activeTab === 'rates' && (
            <div className="flex flex-col gap-6">
              <Section
                title={t('1. Base pricing model')}
                hint={
                  settings.pricing_mode === 'flat_packages'
                    ? t('Fixed flat prices for Solo, Duo, Trio, Full Band or custom acts.')
                    : t('Sum individual member fees or multiply lineup size by a standard rate.')
                }
              >
                <Segmented
                  label={t('Base pricing model')}
                  options={[
                    { id: 'per_musician', label: t('Per-musician rate'), active: settings.pricing_mode === 'per_musician' },
                    { id: 'flat_packages', label: t('Flat packages'), active: settings.pricing_mode === 'flat_packages' },
                  ]}
                  onSelect={(id) => setSettings({ ...settings, pricing_mode: id })}
                />
              </Section>

              {/* Mode A: per-musician rate */}
              {settings.pricing_mode === 'per_musician' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <span className="bw-label-sm text-muted-foreground">{t('Default fee per musician')}</span>
                    <NumberPill
                      size="lg"
                      label={t('Default fee per musician')}
                      prefix={currencySymbol}
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
                    />
                    <span className="bw-body-sm text-muted-foreground">{t('Used when no custom roster fee is set.')}</span>
                  </div>

                  <ToggleRow
                    label={t('Use individual member fees')}
                    hint={t('Taken from each roster profile when available')}
                    checked={settings.use_roster_member_fees}
                    onToggle={() =>
                      setSettings({
                        ...settings,
                        use_roster_member_fees: !settings.use_roster_member_fees,
                      })
                    }
                  />

                  <SettingRow label={t('Default lineup size')} hint={t('Members pre-selected on a new quote')}>
                    <Stepper
                      label={t('default lineup size')}
                      value={settings.core_members_count}
                      onDec={() =>
                        setSettings({
                          ...settings,
                          core_members_count: Math.max(1, settings.core_members_count - 1),
                        })
                      }
                      onInc={() =>
                        setSettings({
                          ...settings,
                          core_members_count: Math.min(15, settings.core_members_count + 1),
                        })
                      }
                    />
                  </SettingRow>

                  {/* Optional collapsible external / guest musician fee */}
                  <div className="rounded-[24px] bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsSubRateOpen(!isSubRateOpen)}
                      aria-expanded={isSubRateOpen}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bw-label-sm text-foreground">{t('External / guest musician fee')}</span>
                          <Tag variant={settings.enable_external_sub_rate ? 'solid' : 'subtle'}>
                            {settings.enable_external_sub_rate
                              ? `${currencySymbol}${settings.external_sub_rate ?? settings.session_musician_rate}`
                              : t('Optional')}
                          </Tag>
                        </div>
                        <span className="bw-body-sm text-muted-foreground">
                          {t('Different rate for session subs or extra horn/string guests beyond your default lineup')}
                        </span>
                      </div>
                      <ChevronDown className={cn('w-5 h-5 transition-transform shrink-0', isSubRateOpen && 'rotate-180')} />
                    </button>

                    <AnimatePresence initial={false}>
                      {isSubRateOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-3 border-t border-border flex items-center justify-between gap-3">
                            <label className="flex items-center gap-3 min-w-0 cursor-pointer">
                              <Toggle
                                checked={!!settings.enable_external_sub_rate}
                                onCheckedChange={() =>
                                  setSettings({
                                    ...settings,
                                    enable_external_sub_rate: !settings.enable_external_sub_rate,
                                  })
                                }
                                aria-label={t('Enable separate external / sub rate')}
                              />
                              <span className="bw-body-sm text-foreground">{t('Separate sub rate')}</span>
                            </label>
                            <NumberPill
                              label={t('External / sub musician rate')}
                              prefix={currencySymbol}
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
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Mode A: formation packages, compact (Figma). Same data/handlers as
                  flat mode; the flat price only applies in Flat packages mode. */}
              {settings.pricing_mode === 'per_musician' && (
                <Section
                  title={t('Formation packages')}
                  hint={t('Prices apply when the base pricing model is Flat packages.')}
                >
                  <ul className="rounded-[24px] bg-card divide-y divide-border">
                    {settings.lineup_packages.map((pkg) => (
                      <li
                        key={pkg.id}
                        className={cn('flex items-center gap-3 px-4 py-3 transition-opacity', !pkg.is_active && 'opacity-60')}
                      >
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <input
                            type="text"
                            value={builtinText(pkg.name)}
                            onChange={(e) => handleUpdatePackage(pkg.id, { name: e.target.value })}
                            placeholder={t('Formation name')}
                            aria-label={t('Formation name')}
                            className="w-full min-w-0 bg-transparent outline-none bw-label-md text-foreground placeholder:text-muted-foreground/60 border-b border-transparent focus:border-foreground"
                          />
                          <span className="bw-body-sm text-muted-foreground">
                            {pkg.musiciansCount === 1 ? t('{count} musician', { count: pkg.musiciansCount }) : t('{count} musicians', { count: pkg.musiciansCount })}
                          </span>
                        </div>
                        <NumberPill
                          label={t('{name} package price ({symbol})', { name: builtinText(pkg.name) || t('Formation'), symbol: currencySymbol.trim() })}
                          prefix={currencySymbol}
                          min="0"
                          className="w-28 shrink-0"
                          value={pkg.flatPrice}
                          onChange={(e) =>
                            handleUpdatePackage(pkg.id, {
                              flatPrice: Math.max(0, Number(e.target.value)),
                            })
                          }
                        />
                        {settings.lineup_packages.length > 1 && (
                          <IconButton
                            size="sm"
                            variant="ghost"
                            label={t('Remove {name}', { name: builtinText(pkg.name) || t('formation') })}
                            icon={<Trash2 />}
                            onClick={() => handleRemovePackage(pkg.id)}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                  <PillButton variant="outline" size="md" icon={<Plus className="w-4 h-4" />} onClick={handleAddFormationPackage}>
                    {t('Add package')}
                  </PillButton>
                </Section>
              )}

              {/* Mode B: flat lineup packages */}
              {settings.pricing_mode === 'flat_packages' && (
                <Section title={t('Formation packages')}>
                  <div className="grid grid-cols-1 @min-[520px]:grid-cols-2 gap-2">
                    {settings.lineup_packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={cn('p-4 rounded-[24px] bg-card flex flex-col gap-3 transition-opacity', !pkg.is_active && 'opacity-60')}
                      >
                        <div className="flex items-center gap-3">
                          <CheckDot
                            checked={pkg.is_active}
                            label={pkg.is_active ? t('Hide {name} in quotes', { name: builtinText(pkg.name) || t('formation') }) : t('Show {name} in quotes', { name: builtinText(pkg.name) || t('formation') })}
                            onClick={() => handleUpdatePackage(pkg.id, { is_active: !pkg.is_active })}
                          />
                          <input
                            type="text"
                            value={builtinText(pkg.name)}
                            onChange={(e) => handleUpdatePackage(pkg.id, { name: e.target.value })}
                            placeholder={t('Formation name')}
                            aria-label={t('Formation name')}
                            className="flex-1 min-w-0 bg-transparent outline-none bw-label-md text-foreground placeholder:text-muted-foreground/60 border-b border-transparent focus:border-foreground"
                          />
                          {settings.lineup_packages.length > 1 && (
                            <IconButton
                              size="sm"
                              variant="ghost"
                              label={t('Remove formation')}
                              icon={<Trash2 />}
                              onClick={() => handleRemovePackage(pkg.id)}
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <Stepper
                            label={t('musician count')}
                            value={pkg.musiciansCount}
                            onDec={() =>
                              handleUpdatePackage(pkg.id, {
                                musiciansCount: Math.max(1, pkg.musiciansCount - 1),
                              })
                            }
                            onInc={() =>
                              handleUpdatePackage(pkg.id, {
                                musiciansCount: Math.min(20, pkg.musiciansCount + 1),
                              })
                            }
                          />
                          <NumberPill
                            label={t('Flat package price ({symbol})', { symbol: currencySymbol.trim() })}
                            prefix={currencySymbol}
                            min="0"
                            value={pkg.flatPrice}
                            onChange={(e) =>
                              handleUpdatePackage(pkg.id, {
                                flatPrice: Math.max(0, Number(e.target.value)),
                              })
                            }
                          />
                        </div>
                        <span className="bw-body-sm text-muted-foreground">
                          {pkg.musiciansCount === 1 ? t('{count} musician', { count: pkg.musiciansCount }) : t('{count} musicians', { count: pkg.musiciansCount })}
                        </span>
                      </div>
                    ))}
                  </div>
                  <PillButton variant="outline" size="lg" icon={<Plus className="w-[18px] h-[18px]" />} onClick={handleAddFormationPackage}>
                    {t('Add package')}
                  </PillButton>
                </Section>
              )}

              {/* Band fund / agency markup */}
              <Section
                title={t('2. Band fund / agency markup')}
                hint={t('Optional fee on top of musician rates for band savings, gear wear or agency commission.')}
              >
                <Segmented
                  label={t('Band fund / agency markup')}
                  options={[
                    { id: 'none' as BandMarkupType, label: t('None'), active: settings.band_markup_type === 'none' },
                    { id: 'percent' as BandMarkupType, label: '+ %', active: settings.band_markup_type === 'percent' },
                    { id: 'fixed' as BandMarkupType, label: t('Fixed {symbol}', { symbol: currencySymbol.trim() }), active: settings.band_markup_type === 'fixed' },
                  ]}
                  onSelect={handleMarkupTypeChange}
                />
                {settings.band_markup_type !== 'none' && (
                  <SettingRow
                    label={settings.band_markup_type === 'fixed' ? t('Fixed band fund per gig') : t('Markup on lineup')}
                    hint={
                      settings.band_markup_type === 'fixed'
                        ? t('Adds {amount} to every quote base fee', { amount: `${currencySymbol}${settings.band_markup_value}` })
                        : t('Adds +{percent}% ({amount} on the sample quote)', { percent: settings.band_markup_value, amount: `${currencySymbol}${sampleQuote.bandMarkupCost.toLocaleString(intlLocale())}` })
                    }
                  >
                    <NumberPill
                      label={settings.band_markup_type === 'fixed' ? t('Fixed band fund') : t('Markup percentage')}
                      prefix={settings.band_markup_type === 'fixed' ? currencySymbol : undefined}
                      suffix={settings.band_markup_type === 'percent' ? '%' : undefined}
                      min="0"
                      max={settings.band_markup_type === 'percent' ? 90 : undefined}
                      value={settings.band_markup_value}
                      onChange={(e) => handleMarkupValueChange(Number(e.target.value))}
                    />
                  </SettingRow>
                )}
              </Section>
            </div>
          )}

          {/* ═══ TAB 2: SETS & ADD-ONS ═══ */}
          {activeTab === 'services' && (
            <div className="flex flex-col gap-6">
              <Section
                title={t('Sets & add-ons catalog')}
                hint={t('Active sets and extras appear as 1-tap chips in step 1 of the quote wizard.')}
                action={
                  <PillButton
                    size="sm"
                    variant="dark"
                    fullWidth={false}
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => setShowAddService(!showAddService)}
                    aria-expanded={showAddService}
                  >
                    {t('Add extra')}
                  </PillButton>
                }
              >
                {/* Quick-add presets */}
                <Card>
                  <span className="bw-label-sm text-muted-foreground">{t('Quick-add starter presets')}</span>
                  <div className="flex flex-wrap gap-2">
                    <PillButton
                      size="sm"
                      variant="outline"
                      fullWidth={false}
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => handleAppendPresetBundle(WEDDING_SERVICE_PRESETS, t('Wedding'))}
                    >
                      {t('Wedding sets')}
                    </PillButton>
                    <PillButton
                      size="sm"
                      variant="outline"
                      fullWidth={false}
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => handleAppendPresetBundle(CLUB_ROCK_SERVICE_PRESETS, t('Club / Show'))}
                    >
                      {t('Club / show extras')}
                    </PillButton>
                    <PillButton
                      size="sm"
                      variant="outline"
                      fullWidth={false}
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => handleAppendPresetBundle(CORPORATE_JAZZ_PRESETS, t('Corporate / AV'))}
                    >
                      {t('Corporate / AV')}
                    </PillButton>
                  </div>
                  {presetFeedback && (
                    <p role="status" className="bw-body-sm text-success inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      {presetFeedback}
                    </p>
                  )}
                </Card>

                {/* New custom add-on form */}
                <AnimatePresence>
                  {showAddService && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleAddService}
                      className="overflow-hidden"
                    >
                      <Card className="gap-4">
                        <h3 className="bw-h3">{t('New set or add-on')}</h3>
                        <PillField
                          label={t('Service name')}
                          placeholder={t('Ceremony duo, sax guest…')}
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          required
                        />
                        <PillField
                          label={t('Price')}
                          type="number"
                          min="0"
                          placeholder="0"
                          icon={<span className="bw-body-md text-muted-foreground">{currencySymbol}</span>}
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(e.target.value)}
                          required
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex flex-col gap-2 min-w-0">
                            <span className="bw-label-sm text-muted-foreground">{t('Category')}</span>
                            <SelectPill
                              value={newServiceCategory}
                              onChange={(e) => setNewServiceCategory(e.target.value as CustomServiceCategory)}
                            >
                              <option value="performance">{t('Performance')}</option>
                              <option value="production">{t('Production & AV')}</option>
                              <option value="logistics">{t('Logistics')}</option>
                              <option value="custom">{t('Custom Add-on')}</option>
                            </SelectPill>
                          </label>
                          <label className="flex flex-col gap-2 min-w-0">
                            <span className="bw-label-sm text-muted-foreground">{t('Unit')}</span>
                            <SelectPill value={newServiceUnit} onChange={(e) => setNewServiceUnit(e.target.value as CustomServiceUnit)}>
                              <option value="flat">{t('Flat Fee')}</option>
                              <option value="per_person">{t('Per Musician')}</option>
                              <option value="per_hour">{t('Per Hour')}</option>
                              <option value="per_km">{unitLabel('per_km', distanceUnit)}</option>
                            </SelectPill>
                          </label>
                        </div>
                        <PillField
                          label={t('Description (optional)')}
                          placeholder={t('Shown on the quote PDF')}
                          value={newServiceDesc}
                          onChange={(e) => setNewServiceDesc(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <PillButton type="button" size="md" variant="ghost" fullWidth={false} onClick={() => setShowAddService(false)}>
                            {t('Cancel')}
                          </PillButton>
                          <PillButton type="submit" size="md" variant="dark" fullWidth={false} icon={<Plus className="w-4 h-4" />}>
                            {t('Add to catalog')}
                          </PillButton>
                        </div>
                      </Card>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Inline editable service rows */}
                <div className="flex flex-col gap-2">
                  {settings.custom_services.map((srv) => (
                    <div
                      key={srv.id}
                      className={cn('p-4 rounded-[16px] bg-card flex flex-col gap-3 transition-opacity', !srv.is_active && 'opacity-60')}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <CheckDot
                          checked={srv.is_active}
                          label={srv.is_active ? t('Active in quote wizard') : t('Hidden in quote wizard')}
                          onClick={() => handleToggleService(srv.id)}
                        />
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <input
                            type="text"
                            value={builtinText(srv.name)}
                            aria-label={t('Service name')}
                            onChange={(e) => handleUpdateService(srv.id, { name: e.target.value })}
                            className={cn(
                              'w-full bg-transparent outline-none bw-body-lg text-foreground border-b border-transparent focus:border-foreground',
                              !srv.is_active && 'line-through text-muted-foreground',
                            )}
                          />
                          {srv.description && <span className="bw-body-sm text-muted-foreground truncate">{builtinText(srv.description)}</span>}
                        </div>
                        <Tag variant="subtle" className="mt-1.5">
                          {categoryLabel(srv.category) || srv.category}
                        </Tag>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <NumberPill
                          label={t('Service price')}
                          prefix={currencySymbol}
                          min="0"
                          className="w-28"
                          value={shownPrice(srv, distanceUnit)}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value));
                            handleUpdateService(srv.id, { price: srv.unit === 'per_km' ? ratePerKm(v, distanceUnit) : v });
                          }}
                        />
                        <SelectPill
                          value={srv.unit}
                          onChange={(e) => {
                            // Keep the number on screen when switching to or from a per-distance price.
                            const next = e.target.value as CustomServiceUnit;
                            const shown = shownPrice(srv, distanceUnit);
                            handleUpdateService(srv.id, { unit: next, price: next === 'per_km' ? ratePerKm(shown, distanceUnit) : shown });
                          }}
                          aria-label={t('Service pricing unit')}
                          className="flex-1 min-w-0 max-w-[160px]"
                        >
                          {(Object.keys(UNIT_LABELS) as CustomServiceUnit[]).map((u) => (
                            <option key={u} value={u}>
                              {unitLabel(u, distanceUnit)}
                            </option>
                          ))}
                        </SelectPill>
                        <IconButton size="sm" variant="ghost" label={t('Delete service')} icon={<Trash2 />} onClick={() => handleDeleteService(srv.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ═══ TAB 3: TRAVEL & SOUND ═══ */}
          {activeTab === 'production' && (
            <div className="flex flex-col gap-6">
              <Section title={t('1. Travel & mileage rules')} hint={t('Home base, free local radius and mileage calculation.')}>
                {/* Band home base */}
                <Card>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="bw-label-sm text-foreground">{t('Band home base')}</span>
                    {typeof settings.band_origin_lat === 'number' && typeof settings.band_origin_lng === 'number' && (
                      <Tag variant="solid">
                        {t('Coordinates set ({lat}°, {lng}°)', { lat: settings.band_origin_lat.toFixed(2), lng: settings.band_origin_lng.toFixed(2) })}
                      </Tag>
                    )}
                  </div>
                  <div className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border focus-within:border-2 focus-within:border-foreground">
                    <MapPin className="w-5 h-5 shrink-0 text-foreground" />
                    <div className="flex-1 min-w-0">
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
                        placeholder={t('City or rehearsal studio')}
                        className="border-0 pb-0 text-lg font-medium normal-case placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>
                </Card>

                {/* Default travel policy */}
                <Card>
                  <span className="bw-label-sm text-foreground">{t('Default travel policy')}</span>
                  <Segmented
                    label={t('Default travel policy')}
                    options={[
                      { id: 'included', label: t('Included in base'), active: !!settings.default_travel_included },
                      { id: 'separate', label: t('Separate fee'), active: !settings.default_travel_included },
                    ]}
                    onSelect={(id) =>
                      setSettings({
                        ...settings,
                        default_travel_included: id === 'included',
                        default_travel_mode: id === 'included' ? 'included' : 'separate',
                      })
                    }
                  />
                </Card>

                {/* Travel calculation mode */}
                <Card>
                  <div className="flex flex-col gap-1">
                    <span className="bw-label-sm text-foreground">{t('Travel calculation mode')}</span>
                    <span className="bw-body-sm text-muted-foreground">{t('Applied to round-trip distance beyond your free local radius')}</span>
                  </div>
                  <Segmented
                    label={t('Travel calculation mode')}
                    options={(
                      [
                        { id: 'per_vehicle', label: t('Per vehicle') },
                        { id: 'per_musician', label: t('Per musician') },
                        { id: 'flat_km', label: distanceUnit === 'mi' ? t('Flat per mile') : t('Flat per km') },
                      ] as { id: TravelCalcMode; label: string }[]
                    ).map((m) => ({ ...m, active: settings.travel_calc_mode === m.id }))}
                    onSelect={(id) => setSettings({ ...settings, travel_calc_mode: id })}
                  />
                  {settings.travel_calc_mode === 'per_vehicle' && (
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="bw-label-sm text-foreground">{t('Number of vehicles')}</span>
                        <span className="bw-body-sm text-muted-foreground">{t('Cars or vans travelling to the venue')}</span>
                      </div>
                      <Stepper
                        label={t('number of vehicles')}
                        value={settings.travel_vehicles_count || 1}
                        onDec={() =>
                          setSettings({
                            ...settings,
                            travel_vehicles_count: Math.max(1, (settings.travel_vehicles_count || 1) - 1),
                          })
                        }
                        onInc={() =>
                          setSettings({
                            ...settings,
                            travel_vehicles_count: Math.min(10, (settings.travel_vehicles_count || 1) + 1),
                          })
                        }
                      />
                    </div>
                  )}
                </Card>

                <div className="@container"><div className="grid grid-cols-1 @min-[520px]:grid-cols-2 gap-2">
                  <SettingRow label={t('Free local radius')} hint={distanceUnit === 'mi' ? t('One-way miles included at {amount}', { amount: `${currencySymbol}0` }) : t('One-way km included at {amount}', { amount: `${currencySymbol}0` })}>
                    <NumberPill
                      label={distanceUnit === 'mi' ? t('Free local radius in miles') : t('Free local radius in km')}
                      suffix={distanceUnit}
                      min="0"
                      className="w-28"
                      value={toUnit(settings.free_travel_radius_km, distanceUnit)}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          free_travel_radius_km: fromUnit(Math.max(0, Number(e.target.value)), distanceUnit),
                        })
                      }
                    />
                  </SettingRow>
                  <SettingRow label={distanceUnit === 'mi' ? t('Rate per mile') : t('Rate per km')} hint={t('Fuel & vehicle wear')}>
                    <NumberPill
                      label={distanceUnit === 'mi' ? t('Rate per mile') : t('Rate per km')}
                      prefix={currencySymbol}
                      step="0.05"
                      min="0"
                      className="w-28"
                      value={ratePerUnit(settings.travel_rate_per_km, distanceUnit)}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          travel_rate_per_km: ratePerKm(Math.max(0, Number(e.target.value)), distanceUnit),
                        })
                      }
                    />
                  </SettingRow>
                </div></div>

                <p className="p-4 rounded-[16px] bg-foreground/[0.08] bw-body-sm text-muted-foreground">
                  {t('Example: a')} <strong className="text-foreground">{formatDistance(80, distanceUnit)}</strong>{' '}
                  {t('one-way gig ({billable} billable beyond the {radius} free radius, ×2 round-trip) comes to', {
                    billable: formatDistance(Math.max(0, 80 - (settings.free_travel_radius_km || 0)), distanceUnit),
                    radius: formatDistance(settings.free_travel_radius_km || 0, distanceUnit),
                  })}{' '}
                  <strong className="text-foreground">
                    {currencySymbol}
                    {sampleTravel80Km}
                  </strong>
                  {` ${settings.default_travel_included ? t('(included in base by default).') : t('(billed separately by default).')}`}
                </p>
              </Section>

              <Section title={t('2. Sound & lighting packages')} hint={t('Default PA policy and production package prices.')}>
                <Card>
                  <span className="bw-label-sm text-foreground">{t('Default production policy')}</span>
                  <Segmented
                    label={t('Default production policy')}
                    options={(
                      [
                        { id: 'included', label: t('Included') },
                        { id: 'separate', label: t('Separate fee') },
                        { id: 'client_provided', label: t('Client / venue') },
                      ] as const
                    ).map((pol) => ({
                      id: pol.id,
                      label: pol.label,
                      active:
                        settings.default_production_mode === pol.id ||
                        (pol.id === 'client_provided' && settings.default_production_mode === 'none'),
                    }))}
                    onSelect={(id) =>
                      setSettings({
                        ...settings,
                        default_production_mode: id,
                        default_production_tier: id === 'client_provided' ? 'none' : 'standard',
                      })
                    }
                  />
                </Card>

                <SettingRow label={t('Standard PA & lighting (≤150 guests)')} hint={t('Compact PA system & basic stage wash lighting')}>
                  <NumberPill
                    label={t('Standard PA & lighting fee')}
                    prefix={currencySymbol}
                    min="0"
                    value={settings.production_standard_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        production_standard_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </SettingRow>
                <SettingRow label={t('Pro PA & full lighting (150–300+ guests)')} hint={t('High-output PA with subs, full light show & technician')}>
                  <NumberPill
                    label={t('Pro PA & full lighting fee')}
                    prefix={currencySymbol}
                    min="0"
                    value={settings.production_pro_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        production_pro_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </SettingRow>
                <SettingRow label={t('Extra zone sound fee')} hint={t('Independent speaker & wireless mic for a second area')}>
                  <NumberPill
                    label={t('Extra zone sound fee')}
                    prefix={currencySymbol}
                    min="0"
                    value={settings.production_extra_location_fee}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        production_extra_location_fee: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </SettingRow>
              </Section>
            </div>
          )}

          {/* ═══ TAB 4: RULES & TAX ═══ */}
          {activeTab === 'commercial' && (
            <div className="flex flex-col gap-6">
              <Section
                title={t('1. Country & currency')}
                hint={t('Where the band invoices from. Picking a country sets the currency and its standard VAT rate; you can still change both.')}
              >
                <div role="radiogroup" aria-label={t('Country')} className="flex flex-wrap gap-2">
                  {COUNTRY_TAX_PRESETS.map((c) => (
                    <Selector
                      key={c.code}
                      size="md"
                      selected={settings.country === c.code}
                      onClick={() =>
                        setSettings({
                          ...settings,
                          country: c.code,
                          currency: c.currency,
                          default_vat_rate: c.vatRate,
                        })
                      }
                    >
                      {c.name}
                    </Selector>
                  ))}
                  <Selector
                    size="md"
                    selected={!countryPreset}
                    onClick={() => setSettings({ ...settings, country: undefined })}
                  >
                    {t('Other')}
                  </Selector>
                </div>
                <Segmented
                  label={t('Currency')}
                  options={CURRENCIES.map((c) => ({
                    id: c.code as CurrencyCode,
                    label: `${c.code} ${c.symbol.trim() === c.code ? '' : c.symbol}`.trim(),
                    active: (settings.currency || 'EUR') === c.code,
                  }))}
                  onSelect={(code) => setSettings({ ...settings, currency: code })}
                />
                {countryPreset?.note && <p className="bw-body-sm text-muted-foreground">{countryPreset.note}</p>}
              </Section>

              <Section title={t('2. Seasonal pricing')} hint={t('Optional peak / off-peak adjustments based on the event month.')}>
                <ToggleRow
                  label={t('Enable seasonal pricing')}
                  hint={t('Apply peak & off-peak multipliers automatically when an event date is chosen')}
                  checked={!!settings.seasonal_pricing_enabled}
                  onToggle={() =>
                    setSettings({
                      ...settings,
                      seasonal_pricing_enabled: !settings.seasonal_pricing_enabled,
                    })
                  }
                />
                <AnimatePresence initial={false}>
                  {settings.seasonal_pricing_enabled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden flex flex-col gap-3"
                    >
                      <SettingRow label={t('Peak season markup')} hint={t('May, Jun, Sep & Oct (high-demand months)')}>
                        <NumberPill
                          label={t('Peak season markup percentage')}
                          prefix="+"
                          suffix="%"
                          min="0"
                          max="100"
                          step="5"
                          className="w-28"
                          value={peakSurgePercent}
                          onChange={(e) => {
                            const pct = Math.max(0, Math.min(100, Number(e.target.value)));
                            setSettings({
                              ...settings,
                              peak_season_multiplier: Number((1 + pct / 100).toFixed(2)),
                            });
                          }}
                        />
                      </SettingRow>
                      <SettingRow label={t('Off-peak season discount')} hint={t('Jan, Feb, Mar & Nov (off-peak incentive)')}>
                        <NumberPill
                          label={t('Off-peak season discount percentage')}
                          prefix="−"
                          suffix="%"
                          min="0"
                          max="50"
                          step="5"
                          className="w-28"
                          value={lowDiscountPercent}
                          onChange={(e) => {
                            const pct = Math.max(0, Math.min(50, Number(e.target.value)));
                            setSettings({
                              ...settings,
                              low_season_multiplier: Number((1 - pct / 100).toFixed(2)),
                            });
                          }}
                        />
                      </SettingRow>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>

              <Section title={t('3. Tax, deposit & validity')} hint={t('Default VAT rate, booking deposit and quote expiry window.')}>
                <SettingRow
                  label={countryPreset ? t('Default {tax} rate', { tax: countryPreset.taxLabel }) : t('Default tax / VAT rate')}
                  hint={
                    countryPreset && countryPreset.vatRate !== settings.default_vat_rate
                      ? t('Standard rate in {country} is {rate}%. Applied to the net total on client quotes', { country: countryPreset.name, rate: countryPreset.vatRate })
                      : t('Applied to the net total on client quotes. Live shows may qualify for a reduced rate: check with your accountant')
                  }
                >
                  <NumberPill
                    label={t('Default VAT rate')}
                    suffix="%"
                    min="0"
                    max="50"
                    step="0.1"
                    inputMode="decimal"
                    className="w-28"
                    value={settings.default_vat_rate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_vat_rate: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </SettingRow>
                <SettingRow label={t('Booking deposit')} hint={t('Advance required to lock in the event date')}>
                  <NumberPill
                    label={t('Booking deposit percentage')}
                    suffix="%"
                    min="0"
                    max="100"
                    step="5"
                    className="w-28"
                    value={settings.default_deposit_rate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_deposit_rate: Math.max(0, Math.min(100, Number(e.target.value))),
                      })
                    }
                  />
                </SettingRow>
                <SettingRow label={t('Default validity')} hint={t('Days a quote stays valid from the issue date')}>
                  <NumberPill
                    label={t('Default validity in days')}
                    suffix={t('days')}
                    min="1"
                    max="365"
                    className="w-32"
                    value={settings.default_validity_days ?? 30}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        default_validity_days: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </SettingRow>
              </Section>

              {/* Inline safe reset */}
              <div className="pt-2 border-t border-border">
                {!confirmingReset ? (
                  <PillButton
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    className="-ml-3 text-muted-foreground"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => setConfirmingReset(true)}
                  >
                    {t('Reset to recommended defaults')}
                  </PillButton>
                ) : (
                  <div className="flex items-center justify-between w-full gap-3 py-1 flex-wrap">
                    <span className="bw-body-sm font-medium text-destructive">{t('Reset all rates & services to defaults?')}</span>
                    <div className="flex items-center gap-2">
                      <PillButton size="sm" variant="ghost" fullWidth={false} onClick={() => setConfirmingReset(false)}>
                        {t('Cancel')}
                      </PillButton>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="h-9 px-4 rounded-full bg-destructive-solid text-white bw-button-sm active:scale-[0.97] transition-transform"
                      >
                        {t('Confirm reset')}
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
              <Section
                title={t('1. Band identity, logo & sign-off')}
                hint={t('Band name, tagline, logo and authorised signer shown in the app and on exported A4 quote PDFs.')}
              >
                <div className="grid grid-cols-1 @min-[520px]:grid-cols-2 gap-4">
                  <PillField label={t('Band name')} placeholder={t('Your band name')} value={bandName} onChange={(e) => setBandName(e.target.value)} />
                  <PillField
                    label={t('Band bio / tagline')}
                    placeholder={t('e.g. 5-piece soul & funk band')}
                    value={bandDescription}
                    onChange={(e) => setBandDescription(e.target.value)}
                  />
                </div>

                {/* Band logo */}
                <Card className="flex-row items-center gap-4 flex-wrap">
                  <div className="w-20 h-20 rounded-[16px] bg-field border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {settings.band_logo_url ? (
                      <img src={settings.band_logo_url} alt={t('Band logo')} className="w-full h-full object-contain p-2" />
                    ) : (
                      <Image className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-[160px] flex flex-col gap-1">
                    <span className="bw-label-sm text-foreground">{t('Band logo')}</span>
                    <span className="bw-body-sm text-muted-foreground">{t('PNG, JPG or SVG. Transparent or white background works best on A4 PDFs.')}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
                    <PillButton
                      size="sm"
                      variant="dark"
                      fullWidth={false}
                      loading={uploadingLogo}
                      icon={<Upload className="w-3.5 h-3.5" />}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {settings.band_logo_url ? t('Change logo') : t('Upload logo')}
                    </PillButton>
                    {settings.band_logo_url && (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        label={t('Remove logo')}
                        icon={<Trash2 />}
                        onClick={() => setSettings({ ...settings, band_logo_url: '' })}
                      />
                    )}
                  </div>
                </Card>

                <div className="grid grid-cols-1 @min-[520px]:grid-cols-2 gap-4">
                  <PillField
                    label={t('Signer full name')}
                    placeholder={t('Full name')}
                    value={settings.signer_name || ''}
                    onChange={(e) => setSettings({ ...settings, signer_name: e.target.value })}
                  />
                  <PillField
                    label={t('Signer role / title (optional)')}
                    placeholder={t('e.g. Bandleader')}
                    value={settings.signer_role || ''}
                    onChange={(e) => setSettings({ ...settings, signer_role: e.target.value })}
                  />
                </div>

                {/* Signature upload or draw pad */}
                <Card>
                  <div className="flex flex-col gap-1">
                    <span className="bw-label-sm text-foreground">{t('Authorised signature (optional)')}</span>
                    <span className="bw-body-sm text-muted-foreground">{t("Appears bottom-right of the quote PDF above the signer's name.")}</span>
                  </div>
                  <div className="flex gap-2">
                    <Selector size="md" selected={signatureMode === 'upload'} onClick={() => setSignatureMode('upload')}>
                      {t('Upload image')}
                    </Selector>
                    <Selector size="md" selected={signatureMode === 'draw'} onClick={() => setSignatureMode('draw')}>
                      {t('Draw signature')}
                    </Selector>
                  </div>

                  {signatureMode === 'upload' ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="h-16 min-w-[160px] flex-1 px-4 rounded-[16px] bg-white border border-border flex items-center justify-center overflow-hidden">
                        {settings.signature_url ? (
                          <img src={settings.signature_url} alt={t('Signature preview')} className="max-h-12 w-auto object-contain" />
                        ) : (
                          <span className="bw-body-sm text-black/40">{t('No signature uploaded')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input ref={sigInputRef} type="file" accept="image/*" onChange={handleSignatureFileChange} className="hidden" />
                        <PillButton
                          size="sm"
                          variant="outline"
                          fullWidth={false}
                          loading={uploadingSignature}
                          icon={<FileSignature className="w-3.5 h-3.5" />}
                          onClick={() => sigInputRef.current?.click()}
                        >
                          {settings.signature_url ? t('Replace') : t('Upload PNG')}
                        </PillButton>
                        {settings.signature_url && (
                          <IconButton
                            size="sm"
                            variant="ghost"
                            label={t('Remove signature')}
                            icon={<Trash2 />}
                            onClick={() => setSettings({ ...settings, signature_url: '' })}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="relative w-full h-32 rounded-[16px] bg-white border border-border overflow-hidden touch-none">
                        <canvas
                          ref={sigCanvasRef}
                          width={600}
                          height={180}
                          onMouseDown={(e) => startSigDraw(e.clientX, e.clientY)}
                          onMouseMove={(e) => moveSigDraw(e.clientX, e.clientY)}
                          onMouseUp={endSigDraw}
                          onMouseLeave={endSigDraw}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            if (touch) startSigDraw(touch.clientX, touch.clientY);
                          }}
                          onTouchMove={(e) => {
                            const touch = e.touches[0];
                            if (touch) moveSigDraw(touch.clientX, touch.clientY);
                          }}
                          onTouchEnd={endSigDraw}
                          className="w-full h-full cursor-crosshair"
                        />
                        <div className="pointer-events-none absolute bottom-2 left-3 right-3 border-b border-black/15 pb-1">
                          <span className="bw-label-xs text-black/30">{t('Sign above the line')}</span>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <PillButton size="sm" variant="ghost" fullWidth={false} onClick={clearSigCanvas}>
                          {t('Clear pad')}
                        </PillButton>
                      </div>
                    </div>
                  )}
                </Card>
              </Section>

              <Section title={t('2. Payment & bank account')} hint={t('Printed on quotes when bank details are enabled. Pick the format your bank uses.')}>
                {(() => {
                  const region = bankRegionOf(settings);
                  const setRegion = (r: BankRegion) => setSettings({ ...settings, bank_region: r });
                  return (
                    <>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Bank account format')}>
                        <Selector size="md" selected={region === 'eu'} onClick={() => setRegion('eu')}>
                          {t('Europe · IBAN')}
                        </Selector>
                        <Selector size="md" selected={region === 'us'} onClick={() => setRegion('us')}>
                          {t('USA · ABA routing')}
                        </Selector>
                        <Selector size="md" selected={region === 'other'} onClick={() => setRegion('other')}>
                          {t('Other · SWIFT')}
                        </Selector>
                      </div>
                      <div className="grid grid-cols-1 @min-[520px]:grid-cols-2 gap-4">
                        <PillField
                          label={t('Account holder')}
                          placeholder={t('Name on the bank account')}
                          autoComplete="off"
                          value={settings.bank_account_holder || ''}
                          onChange={(e) => setSettings({ ...settings, bank_account_holder: e.target.value })}
                        />
                        {region === 'eu' ? (
                          <PillField
                            label="IBAN"
                            placeholder={t('Starts with the country code (ES, IT, DE…)')}
                            autoComplete="off"
                            autoCapitalize="characters"
                            className="[&_input]:font-mono [&_input::placeholder]:font-sans"
                            value={settings.bank_iban || ''}
                            onChange={(e) => setSettings({ ...settings, bank_iban: e.target.value.toUpperCase() })}
                          />
                        ) : (
                          <PillField
                            label={t('Account number')}
                            placeholder={region === 'us' ? t('Checking or savings account') : t('Bank account number')}
                            autoComplete="off"
                            inputMode={region === 'us' ? 'numeric' : undefined}
                            className="[&_input]:font-mono [&_input::placeholder]:font-sans"
                            value={settings.bank_account_number || ''}
                            onChange={(e) => setSettings({ ...settings, bank_account_number: e.target.value })}
                          />
                        )}
                        {region === 'us' && (
                          <PillField
                            label={t('Routing number (ABA)')}
                            placeholder={t('9 digits')}
                            autoComplete="off"
                            inputMode="numeric"
                            maxLength={9}
                            className="[&_input]:font-mono [&_input::placeholder]:font-sans"
                            value={settings.bank_routing_number || ''}
                            onChange={(e) =>
                              setSettings({ ...settings, bank_routing_number: e.target.value.replace(/\D/g, '').slice(0, 9) })
                            }
                          />
                        )}
                        <PillField
                          label={region === 'eu' ? t('BIC (optional)') : region === 'us' ? t('SWIFT, for international wires (optional)') : 'SWIFT / BIC'}
                          placeholder={t('8 or 11 characters')}
                          autoComplete="off"
                          autoCapitalize="characters"
                          className="[&_input]:font-mono [&_input::placeholder]:font-sans"
                          value={settings.bank_bic_swift || ''}
                          onChange={(e) => setSettings({ ...settings, bank_bic_swift: e.target.value.toUpperCase() })}
                        />
                        <PillField
                          label={t('Bank name (optional)')}
                          placeholder={t('Your bank')}
                          value={settings.bank_name || ''}
                          onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                        />
                      </div>
                    </>
                  );
                })()}
                <PillField
                  label={t('Default payment terms')}
                  placeholder={t('e.g. Deposit on booking, balance on the event date')}
                  value={settings.default_payment_terms || ''}
                  onChange={(e) => setSettings({ ...settings, default_payment_terms: e.target.value })}
                />
                {/* Online deposits: in place, switched off for the alpha */}
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="bw-label-sm text-muted-foreground">{t('Online deposit links')}</span>
                    {!ONLINE_DEPOSITS_ENABLED && <Tag variant="subtle">{t('Coming soon')}</Tag>}
                  </div>
                  <div className="grid grid-cols-1 @min-[520px]:grid-cols-2 gap-4">
                    <PillField
                      label={t('Stripe payment link')}
                      placeholder="https://buy.stripe.com/…"
                      disabled={!ONLINE_DEPOSITS_ENABLED}
                      value={settings.stripe_payment_link || ''}
                      onChange={(e) => setSettings({ ...settings, stripe_payment_link: e.target.value })}
                    />
                    <PillField
                      label={t('PayPal link')}
                      placeholder="https://paypal.me/…"
                      disabled={!ONLINE_DEPOSITS_ENABLED}
                      value={settings.paypal_link || ''}
                      onChange={(e) => setSettings({ ...settings, paypal_link: e.target.value })}
                    />
                  </div>
                  {!ONLINE_DEPOSITS_ENABLED && (
                    <p className="bw-body-sm text-muted-foreground">
                      {t('Clients will pay the deposit by card or PayPal from the quote and its PDF. This turns on after the alpha.')}
                    </p>
                  )}
                </div>
              </Section>

              <Section title={t('3. Band contact & legal details')} hint={t('Contact details and optional fiscal information for agency or corporate quotes.')}>
                <div className="grid grid-cols-1 @min-[520px]:grid-cols-2 gap-4">
                  <PillField
                    label={t('Booking contact email')}
                    type="email"
                    placeholder="booking@yourband.com"
                    value={settings.contact_email || ''}
                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                  />
                  <PillField
                    label={t('Contact phone / WhatsApp')}
                    type="tel"
                    placeholder={t('Phone with country code')}
                    value={settings.contact_phone || ''}
                    onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                  />
                  <PillField
                    label={t('Website / portfolio (optional)')}
                    placeholder="yourband.com"
                    value={settings.website || ''}
                    onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                  />
                  <PillField
                    label={t('Legal / company name (optional)')}
                    placeholder={t('Registered company name')}
                    value={settings.legal_company_name || ''}
                    onChange={(e) => setSettings({ ...settings, legal_company_name: e.target.value })}
                  />
                  <PillField
                    label={t('Tax / VAT ID (optional)')}
                    placeholder={t('VAT number, EIN or tax ID')}
                    value={settings.tax_vat_id || ''}
                    onChange={(e) => setSettings({ ...settings, tax_vat_id: e.target.value })}
                  />
                  <PillField
                    label={t('Registered legal address (optional)')}
                    placeholder={t('Street, city, postcode, country')}
                    value={settings.legal_address || ''}
                    onChange={(e) => setSettings({ ...settings, legal_address: e.target.value })}
                  />
                </div>
              </Section>

              <Section
                title={t('4. Quote PDF disclaimer')}
                hint={t('Validity note printed beneath the event date on PDF quotes. Use {days} for the validity period.')}
                action={
                  <PillButton
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    className="-mr-3"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        default_quote_disclaimer: DEFAULT_QUOTE_DISCLAIMER,
                      })
                    }
                  >
                    {t('Reset text')}
                  </PillButton>
                }
              >
                <label className="flex flex-col gap-2">
                  <span className="sr-only">{t('Default quote disclaimer text')}</span>
                  <textarea
                    rows={4}
                    value={settings.default_quote_disclaimer || DEFAULT_QUOTE_DISCLAIMER}
                    onChange={(e) => setSettings({ ...settings, default_quote_disclaimer: e.target.value })}
                    className="w-full rounded-[24px] bg-field border border-border p-4 bw-body-sm text-foreground outline-none focus:border-foreground resize-none"
                  />
                </label>
              </Section>
            </div>
          )}
        </div>
      </div>

      {/* Save (Figma CTA) */}
      <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        <div className="max-w-2xl mx-auto w-full">
          <PillButton onClick={handleSave} loading={saving} icon={<Check className="w-[18px] h-[18px]" />}>
            {savedSuccess ? t('Saved') : t('Save changes')}
          </PillButton>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
};
