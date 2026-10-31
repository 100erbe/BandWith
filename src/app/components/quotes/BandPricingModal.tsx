import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Plus, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import {
  DEFAULT_BAND_PRICING,
  getBandPricing,
  saveBandPricing,
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

export const BandPricingModal: React.FC<BandPricingModalProps> = ({
  isOpen,
  onClose,
  bandId = 'default',
  onSaved,
}) => {
  const [settings, setSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);
  const [activeTab, setActiveTab] = useState<TabType>('rates');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New service form state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('custom');
  const [newServiceUnit, setNewServiceUnit] = useState<'flat' | 'per_person' | 'per_hour' | 'per_km'>('flat');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [showAddService, setShowAddService] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getBandPricing(bandId).then((res) => {
        setSettings(res);
      });
    }
  }, [isOpen, bandId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    await saveBandPricing(settings);
    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
    if (onSaved) onSaved(settings);
  };

  const handleReset = () => {
    if (confirm('Reset all pricing rates, seasonality, and services to recommended default values?')) {
      setSettings({ ...DEFAULT_BAND_PRICING, band_id: bandId });
    }
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

  const tabs: { id: TabType; label: string }[] = [
    { id: 'rates', label: 'Musician Rates' },
    { id: 'production', label: 'Production & Travel' },
    { id: 'services', label: `Custom Services (${settings.custom_services.length})` },
    { id: 'commercial', label: 'Taxes & Margins' },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[75] bg-background overflow-y-auto overflow-x-hidden flex flex-col"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      {/* Sticky Header */}
      <div
        className="px-4 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-md sticky top-0 z-30"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: '16px',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-[44px] h-[44px] rounded-full flex items-center justify-center border border-border bg-card shrink-0 active:scale-90 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-[24px] font-black text-foreground leading-none uppercase tracking-tight">
                PRICING & SERVICES
              </h1>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                BAND RATES & QUOTE LOGIC
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" /> Saved
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0',
                activeTab === tab.id
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="p-4 flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full pb-32">
        {activeTab === 'rates' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-[20px] bg-primary/5 border border-primary/20 text-xs text-foreground/80 leading-relaxed">
              Quotes automatically calculate the first{' '}
              <strong>{settings.core_members_count} musicians</strong> at the Core rate, and additional
              players at the Session rate.
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Core Member Base Rate
                  </span>
                  <span className="text-[11px] text-muted-foreground">Per person (main sets)</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                  <span className="text-sm font-bold text-muted-foreground">€</span>
                  <input
                    type="number"
                    value={settings.core_member_rate}
                    onChange={(e) =>
                      setSettings({ ...settings, core_member_rate: Number(e.target.value) })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Session Musician Rate
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Per additional guest / session musician
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                  <span className="text-sm font-bold text-muted-foreground">€</span>
                  <input
                    type="number"
                    value={settings.session_musician_rate}
                    onChange={(e) =>
                      setSettings({ ...settings, session_musician_rate: Number(e.target.value) })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Core Lineup Threshold
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Number of musicians covered by core rate
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-24">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.core_members_count}
                    onChange={(e) =>
                      setSettings({ ...settings, core_members_count: Number(e.target.value) })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Cocktail Set Fee (per musician)
                  </span>
                  <span className="text-[11px] text-muted-foreground">Added for cocktail set</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                  <span className="text-sm font-bold text-muted-foreground">€</span>
                  <input
                    type="number"
                    value={settings.cocktail_musician_fee}
                    onChange={(e) =>
                      setSettings({ ...settings, cocktail_musician_fee: Number(e.target.value) })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Ceremony Fee (per musician)
                  </span>
                  <span className="text-[11px] text-muted-foreground">Added for ceremony set</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                  <span className="text-sm font-bold text-muted-foreground">€</span>
                  <input
                    type="number"
                    value={settings.ceremony_musician_fee}
                    onChange={(e) =>
                      setSettings({ ...settings, ceremony_musician_fee: Number(e.target.value) })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    DJ Hourly Rate
                  </span>
                  <span className="text-[11px] text-muted-foreground">Per hour for party DJ</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                  <span className="text-sm font-bold text-muted-foreground">€</span>
                  <input
                    type="number"
                    value={settings.dj_hourly_rate}
                    onChange={(e) =>
                      setSettings({ ...settings, dj_hourly_rate: Number(e.target.value) })
                    }
                    className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'production' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 p-4 rounded-[22px] bg-card/90 border border-border">
              <span className="text-xs font-bold text-muted-foreground uppercase">
                Band Origin Location
              </span>
              <input
                type="text"
                value={settings.band_origin_address}
                onChange={(e) =>
                  setSettings({ ...settings, band_origin_address: e.target.value })
                }
                className="w-full font-bold bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none"
                placeholder="e.g. Benalmádena, Spain"
              />
              <span className="text-[11px] text-muted-foreground">
                Base for distance and travel expense calculation
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Travel Rate (per km / musician)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Multiplied by KM × band size
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                <span className="text-sm font-bold text-muted-foreground">€</span>
                <input
                  type="number"
                  step="0.01"
                  value={settings.travel_rate_per_km}
                  onChange={(e) =>
                    setSettings({ ...settings, travel_rate_per_km: Number(e.target.value) })
                  }
                  className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Standard Sound (≤150 guests)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  PA + Standard stage lights
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                <span className="text-sm font-bold text-muted-foreground">€</span>
                <input
                  type="number"
                  value={settings.production_standard_fee}
                  onChange={(e) =>
                    setSettings({ ...settings, production_standard_fee: Number(e.target.value) })
                  }
                  className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Pro Sound (≤250 guests)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Large line array + Pro lighting
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                <span className="text-sm font-bold text-muted-foreground">€</span>
                <input
                  type="number"
                  value={settings.production_pro_fee}
                  onChange={(e) =>
                    setSettings({ ...settings, production_pro_fee: Number(e.target.value) })
                  }
                  className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Extra Audio System
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Garden / secondary cocktail zone
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 w-32">
                <span className="text-sm font-bold text-muted-foreground">€</span>
                <input
                  type="number"
                  value={settings.production_extra_location_fee}
                  onChange={(e) =>
                    setSettings({ ...settings, production_extra_location_fee: Number(e.target.value) })
                  }
                  className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase">
                Available In Quote Wizard
              </span>
              <button
                type="button"
                onClick={() => setShowAddService(!showAddService)}
                className="px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Service
              </button>
            </div>

            <AnimatePresence>
              {showAddService && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddService}
                  className="p-4 rounded-[22px] bg-card border border-border flex flex-col gap-3 overflow-hidden shadow-sm"
                >
                  <span className="text-xs font-bold text-foreground uppercase">New Custom Service</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Service name (e.g. Saxophone Soloist)"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      required
                      className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
                    />
                    <div className="flex items-center gap-1 bg-background border border-border rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-muted-foreground">€</span>
                      <input
                        type="number"
                        placeholder="Price"
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(e.target.value)}
                        required
                        className="bg-transparent text-xs font-semibold text-foreground w-full focus:outline-none"
                      />
                    </div>
                    <select
                      value={newServiceCategory}
                      onChange={(e) => setNewServiceCategory(e.target.value)}
                      className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
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
                      className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
                    >
                      <option value="flat">Flat Price</option>
                      <option value="per_person">Per Musician</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_km">Per KM</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Brief description (optional)"
                    value={newServiceDesc}
                    onChange={(e) => setNewServiceDesc(e.target.value)}
                    className="bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddService(false)}
                      className="px-3 py-1.5 rounded-full border border-border text-xs font-bold text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                    >
                      Save Service
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2.5">
              {settings.custom_services.map((srv) => (
                <div
                  key={srv.id}
                  className="p-4 rounded-[22px] bg-card/90 border border-border flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleService(srv.id)}
                      className={cn(
                        'w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0',
                        srv.is_active
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border bg-muted/40 text-transparent'
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-bold truncate',
                            !srv.is_active && 'line-through text-muted-foreground'
                          )}
                        >
                          {srv.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                          {srv.category}
                        </span>
                      </div>
                      {srv.description && (
                        <span className="text-xs text-muted-foreground truncate">{srv.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      €{srv.price.toLocaleString()}
                      <span className="text-[10px] font-medium text-muted-foreground ml-1">
                        /{srv.unit.replace('_', ' ')}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(srv.id)}
                      className="text-muted-foreground/50 hover:text-destructive p-1 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'commercial' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Low Season Multiplier
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Jan, Feb, Mar, Nov (Default: 0.90×)
                </span>
              </div>
              <input
                type="number"
                step="0.05"
                value={settings.low_season_multiplier}
                onChange={(e) =>
                  setSettings({ ...settings, low_season_multiplier: Number(e.target.value) })
                }
                className="w-24 text-base font-bold bg-background border border-border rounded-xl px-3 py-1.5 text-foreground focus:outline-none text-right"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Peak Season Multiplier
                </span>
                <span className="text-[11px] text-muted-foreground">
                  May, Jun, Sep, Oct (Default: 1.20×)
                </span>
              </div>
              <input
                type="number"
                step="0.05"
                value={settings.peak_season_multiplier}
                onChange={(e) =>
                  setSettings({ ...settings, peak_season_multiplier: Number(e.target.value) })
                }
                className="w-24 text-base font-bold bg-background border border-border rounded-xl px-3 py-1.5 text-foreground focus:outline-none text-right"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Contingency Buffer (Margin Divisor)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  E.g., 0.94 creates a ~6% contingency fund
                </span>
              </div>
              <input
                type="number"
                step="0.01"
                value={settings.margin_divisor}
                onChange={(e) =>
                  setSettings({ ...settings, margin_divisor: Number(e.target.value) })
                }
                className="w-24 text-base font-bold bg-background border border-border rounded-xl px-3 py-1.5 text-foreground focus:outline-none text-right"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Default VAT Rate (%)
                </span>
                <span className="text-[11px] text-muted-foreground">Default: 21% (Spain / standard EU)</span>
              </div>
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl px-3 py-1.5 w-24">
                <input
                  type="number"
                  value={settings.default_vat_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, default_vat_rate: Number(e.target.value) })
                  }
                  className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                />
                <span className="text-xs font-bold text-muted-foreground">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-[22px] bg-card/90 border border-border">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Upfront Deposit (%)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Advance payment required (Default: 20%)
                </span>
              </div>
              <div className="flex items-center gap-1 bg-background border border-border rounded-xl px-3 py-1.5 w-24">
                <input
                  type="number"
                  value={settings.default_deposit_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, default_deposit_rate: Number(e.target.value) })
                  }
                  className="w-full text-base font-bold bg-transparent text-foreground focus:outline-none text-right"
                />
                <span className="text-xs font-bold text-muted-foreground">%</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Recommended Defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
