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
  Wallet,
  Mail,
  Phone,
  Globe,
  FileText,
  Edit3,
  Loader2,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { useBand } from '@/lib/BandContext';
import {
  DEFAULT_BAND_PRICING,
  DEFAULT_QUOTE_DISCLAIMER,
  getBandPricing,
  saveBandPricing,
  uploadBandBrandingAsset,
  calculateSmartQuote,
  type BandPricingSettings,
  type CustomService,
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
  initialTab = 'rates',
  onSaved,
}) => {
  const { isAdmin, selectedBand } = useBand();
  const effectiveBandId = bandId !== 'default' ? bandId : (selectedBand?.id || 'default');

  const [settings, setSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

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
  const [newServiceCategory, setNewServiceCategory] = useState('performance');
  const [newServiceUnit, setNewServiceUnit] = useState<'flat' | 'per_person' | 'per_hour' | 'per_km'>('flat');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [showAddService, setShowAddService] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && effectiveBandId) {
      getBandPricing(effectiveBandId).then((res) => {
        setSettings(res);
      });
      setConfirmingReset(false);
    }
  }, [isOpen, effectiveBandId]);

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

  const getCanvasPoint = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ) => {
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
    { id: 'branding', label: 'Branding & Payment' },
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

        {/* ═══ TAB 0: BRANDING, SIGNATURE & PAYMENT DETAILS ═══ */}
        {activeTab === 'branding' && (
          <div className="flex flex-col gap-6">
            {/* Group 1: Band Logo & Official Sign-Off */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Band Logo & Quote Sign-Off
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Displayed on the top-right header and bottom signature block of your exported A4 Quote PDFs.
                </p>
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
                    placeholder="e.g. Musical Director and Musician"
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
                  placeholder="e.g. 20% initial deposit upon booking; 80% balance due before event"
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

            {/* Group 4: Quote Document Defaults */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  4. Quote Validity & Disclaimer Defaults
                </h2>
                <p className="text-[11px] text-foreground/50">
                  Default validity period and legal note printed beneath the Event Date on your PDF quotes.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[16px] bg-card border border-foreground/10 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Default Quote Validity (Days)
                  </span>
                  <span className="text-[11px] text-foreground/50">
                    Number of days a quote remains valid from the issue date
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
