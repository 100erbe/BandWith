import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Plus, Minus, Trash2,
  Mail, Phone, MapPin, ChevronUp, ChevronDown, ArrowLeft, ArrowRight,
  Plane, Hotel, UtensilsCrossed, Volume2, Guitar,
  Heart, Wine, Utensils, Zap, Sparkles, Moon,
  Check, AlertCircle,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { WizardAccentRail, getEventAccentColor } from '@/app/components/ui/WizardAccentRail';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { TimePicker } from '@/app/components/ui/TimePicker';
import {
  Quote,
  QuoteEventType,
  PerformanceType,
  CancellationPolicy,
  PaymentMethod,
  QuoteMusician,
  QuoteCustomItem,
  VAT_RATES,
  BAND_MEMBERS,
  MUSIC_GENRES,
  generateQuoteNumber,
  calculateVAT,
  calculateQuoteTotals,
  getDefaultQuote,
} from '@/app/data/quotes';
import { useBand } from '@/lib/BandContext';
import { getBandPricing, DEFAULT_BAND_PRICING, type BandPricingSettings } from '@/lib/services/pricing';

const STEPS = [
  { id: 'client-date', title: 'CLIENT & DATE', subtitle: 'BUILD YOUR QUOTE' },
  { id: 'event-type', title: 'EVENT TYPE', subtitle: 'CLICK TO SELECT' },
  { id: 'performance', title: 'PERFORMANCE', subtitle: 'BUILD YOUR BAND' },
  { id: 'moments', title: 'MUSICAL MOMENTS', subtitle: 'BUILD YOUR QUOTE' },
  { id: 'billing', title: 'BILLING & VAT', subtitle: 'TAX CALCULATION' },
  { id: 'summary', title: 'SUMMARY', subtitle: 'REVIEW & SEND' },
];

const EVENT_TYPES: { value: QuoteEventType; label: string }[] = [
  { value: 'wedding', label: 'WEDDING' },
  { value: 'corporate', label: 'CORPORATE' },
  { value: 'private', label: 'PRIVATE' },
  { value: 'festival', label: 'FESTIVAL' },
  { value: 'club', label: 'CLUB' },
  { value: 'other', label: 'CUSTOM' },
];

interface MusicalMoment {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  basePrice: number;
  defaultMusicians: number;
  defaultDuration: number;
  instruments: string[];
  selected: boolean;
  customized: boolean;
  customPrice?: number;
  customMusicians?: number;
  customDuration?: number;
  customInstruments?: string[];
}

export const MOMENT_DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 180, 240];

const DEFAULT_MUSICAL_MOMENTS: MusicalMoment[] = [
  { id: 'ceremony', name: 'CEREMONY', description: 'ENTRANCE, CEREMONY, EXIT', icon: Heart, basePrice: 1200, defaultMusicians: 3, defaultDuration: 30, instruments: ['Vocals', 'Guitar', 'Keys'], selected: false, customized: false },
  { id: 'cocktail', name: 'COCKTAIL HOUR', description: 'BACKGROUND MUSIC', icon: Wine, basePrice: 500, defaultMusicians: 3, defaultDuration: 60, instruments: ['Vocals', 'Guitar', 'Keys'], selected: false, customized: false },
  { id: 'dinner', name: 'DINNER', description: 'ELEGANT BACKGROUND', icon: Utensils, basePrice: 600, defaultMusicians: 4, defaultDuration: 90, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys'], selected: false, customized: false },
  { id: 'party', name: 'PARTY / DANCING', description: 'HIGH ENERGY SETS', icon: Zap, basePrice: 1200, defaultMusicians: 5, defaultDuration: 120, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys', 'Drums'], selected: false, customized: false },
  { id: 'first-dance', name: 'FIRST DANCE', description: 'SPECIAL MOMENT', icon: Sparkles, basePrice: 200, defaultMusicians: 2, defaultDuration: 15, instruments: ['Vocals', 'Guitar'], selected: false, customized: false },
  { id: 'afterparty', name: 'AFTER PARTY', description: 'LATE NIGHT', icon: Moon, basePrice: 800, defaultMusicians: 4, defaultDuration: 90, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys'], selected: false, customized: false },
];

const COUNTRY_PHONE_CODES = [
  { code: 'IT', prefix: '+39', name: 'Italy' },
  { code: 'DE', prefix: '+49', name: 'Germany' },
  { code: 'FR', prefix: '+33', name: 'France' },
  { code: 'ES', prefix: '+34', name: 'Spain' },
  { code: 'GB', prefix: '+44', name: 'UK' },
  { code: 'US', prefix: '+1', name: 'USA' },
  { code: 'CH', prefix: '+41', name: 'Switzerland' },
  { code: 'AT', prefix: '+43', name: 'Austria' },
  { code: 'NL', prefix: '+31', name: 'Netherlands' },
  { code: 'BE', prefix: '+32', name: 'Belgium' },
];

const PERFORMANCE_TYPES: { value: PerformanceType; label: string }[] = [
  { value: 'full_band', label: 'FULL BAND' },
  { value: 'duo', label: 'DUO' },
  { value: 'trio', label: 'TRIO' },
  { value: 'solo', label: 'SOLO' },
  { value: 'dj_set', label: 'DJ SET' },
  { value: 'acoustic', label: 'ACOUSTIC' },
];

const VALIDITY_OPTIONS = [
  { value: 7, label: '7 DAYS' },
  { value: 14, label: '14 DAYS' },
  { value: 30, label: '30 DAYS' },
  { value: 60, label: '60 DAYS' },
  { value: 90, label: '90 DAYS' },
];

const DEPOSIT_OPTIONS = [
  { value: 20, label: '20%' },
  { value: 30, label: '30%' },
  { value: 50, label: '50%' },
];

const QuoteField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={cn('flex flex-col gap-1', className)}>
    <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/60">{label}</span>
    {children}
    <div className="h-px bg-foreground/15 mt-1" />
  </div>
);

// --- Interactive Step Indicator for Quotes ---
const InteractiveQuoteStepIndicator: React.FC<{
  current: number;
  total: number;
  steps: { id: string; title: string; subtitle: string }[];
  maxAccessibleStep: number;
  onSelectStep: (step: number) => void;
  activeColor?: string;
  inactiveColor?: string;
}> = ({ current, total, steps, maxAccessibleStep, onSelectStep, activeColor, inactiveColor }) => (
  <div className="flex items-center gap-1.5 w-full">
    {Array.from({ length: total }).map((_, i) => {
      const isCurrent = i === current;
      const isAccessible = i <= maxAccessibleStep;
      return (
        <button
          key={i}
          type="button"
          onClick={() => isAccessible && onSelectStep(i)}
          disabled={!isAccessible}
          aria-label={`Step ${i + 1}: ${steps[i]?.title || ''}`}
          className={cn(
            'group flex-1 py-1 flex flex-col items-center justify-center transition-all',
            isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-35'
          )}
        >
          <div
            className={cn(
              'h-1.5 w-full rounded-full transition-all duration-300',
              isCurrent ? 'h-2' : 'group-hover:opacity-80'
            )}
            style={{
              backgroundColor: isCurrent
                ? (activeColor || 'var(--foreground)')
                : isAccessible
                  ? (activeColor || 'var(--foreground)')
                  : (inactiveColor || 'var(--border)'),
              opacity: isCurrent ? 1 : isAccessible ? 0.4 : 0.15,
            }}
          />
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                'text-[9px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap',
                isCurrent ? 'text-foreground' : 'text-foreground/40 group-hover:text-foreground/70'
              )}
            >
              0{i + 1}
            </span>
          </div>
        </button>
      );
    })}
  </div>
);

// --- Accordion Card for Editing Quotes ---
const QuoteAccordionCard: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  stepNumber: string;
  title: string;
  summary: string;
  hasWarning?: boolean;
  warningLabel?: string;
  children: React.ReactNode;
}> = ({ isOpen, onToggle, stepNumber, title, summary, hasWarning, warningLabel = 'NEEDS ATTENTION', children }) => {
  return (
    <div className={cn(
      'rounded-[16px] border transition-all overflow-hidden',
      hasWarning
        ? 'border-[var(--warning)]/50 bg-[var(--warning)]/5'
        : isOpen
          ? 'border-foreground/20 bg-foreground/[0.02]'
          : 'border-foreground/10 bg-transparent hover:border-foreground/15'
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex flex-col gap-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{stepNumber}</span>
            <span className="text-[15px] font-bold uppercase text-foreground">{title}</span>
            {hasWarning && (
              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--warning)]/15 text-[var(--warning)] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {warningLabel}
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold uppercase text-foreground/45 truncate">
            {summary}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 w-8 h-8 rounded-full border border-foreground/10 flex items-center justify-center text-foreground/60"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-foreground/10">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const calcMusicianAutoFee = (
  musicianId: string,
  currentSelectedIds: string[],
  settings: BandPricingSettings,
  musiciansList: QuoteMusician[]
): number => {
  const member = musiciansList.find((m) => m.id === musicianId || m.userId === musicianId);
  if (member?.fee && member.fee > 0) {
    return member.fee;
  }
  const idx = currentSelectedIds.includes(musicianId)
    ? currentSelectedIds.indexOf(musicianId)
    : currentSelectedIds.length;
  const isCore = idx < (settings.core_members_count ?? 1);
  const rate = isCore ? settings.core_member_rate : settings.session_musician_rate;
  return rate || (isCore ? 300 : 250);
};

export interface QuoteBandMember {
  id: string;
  name: string;
  role: string;
  initials?: string;
  fee?: string;
  user_id?: string;
}

// === Fee Row Component ===
const FeeRow: React.FC<{
  label: string;
  tag: string;
  included: boolean;
  onToggle: () => void;
  fee?: number;
  onFeeChange?: (value: number) => void;
  currencySymbol?: string;
}> = ({ label, tag, included, onToggle, fee, onFeeChange, currencySymbol = '€' }) => (
  <div className="flex flex-col gap-2">
    <button type="button" onClick={onToggle} className="flex items-start justify-between gap-5 w-full text-left">
      <div className="flex flex-col gap-1 flex-1">
        <div className="px-2.5 py-1 rounded-[6px] bg-foreground/10 text-[12px] font-bold text-foreground/50 uppercase self-start">
          {tag}
        </div>
        <span className={cn(
          'text-[20px] font-bold uppercase',
          !included ? 'text-foreground' : 'text-foreground/30'
        )}>
          {label}
        </span>
      </div>
      <DotCheckbox
        checked={!included}
        activeColor="var(--accent-quote)"
        inactiveColor="var(--border)"
      />
    </button>
    {!included && onFeeChange && (
      <div className="flex items-center gap-2 pl-2">
        <span className="text-foreground/50 font-bold text-sm">{currencySymbol}</span>
        <input
          type="number"
          value={fee || ''}
          onChange={(e) => onFeeChange(parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="bg-foreground/10 rounded-[8px] px-3 py-2 text-[16px] font-bold text-foreground focus:outline-none w-32"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
  </div>
);

interface QuoteCreationWizardProps {
  onClose: () => void;
  onCreate: (quote: Partial<Quote>) => void;
  initialEventId?: string;
  initialEventTitle?: string;
  initialClientName?: string;
  initialData?: Partial<Quote>;
  bandMembers?: QuoteBandMember[];
}

export const QuoteCreationWizard: React.FC<QuoteCreationWizardProps> = ({
  onClose,
  onCreate,
  initialClientName,
  initialData,
  bandMembers,
}) => {
  const { selectedBand } = useBand();
  const [pricingSettings, setPricingSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);
  const [step, setStep] = useState(0);
  const defaults = getDefaultQuote();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currencySymbol = useMemo(() => {
    if (pricingSettings.currency === 'USD') return '$';
    if (pricingSettings.currency === 'GBP') return '£';
    return '€';
  }, [pricingSettings.currency]);

  const availableMusicians = useMemo<QuoteMusician[]>(() => {
    if (bandMembers && bandMembers.length > 0) {
      return bandMembers.map((m) => ({
        id: m.id,
        userId: m.user_id,
        name: m.name,
        instrument: m.role || 'Member',
        fee: m.fee && parseFloat(m.fee) > 0 ? parseFloat(m.fee) : undefined,
        isExternal: false,
        isAvailable: true,
      }));
    }
    if (selectedBand?.members && selectedBand.members.length > 0) {
      return selectedBand.members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        name: m.profile?.full_name || m.profile?.email?.split('@')[0] || 'Member',
        instrument: m.role || m.instrument || 'Member',
        fee: m.default_fee && Number(m.default_fee) > 0 ? Number(m.default_fee) : undefined,
        isExternal: false,
        isAvailable: true,
      }));
    }
    return BAND_MEMBERS;
  }, [bandMembers, selectedBand?.members]);

  const getAutoFeeForMusician = useCallback(
    (
      musicianId: string,
      currentSelectedIds: string[],
      settings: BandPricingSettings = pricingSettings,
      musicianObj?: QuoteMusician
    ): number => {
      const list = musicianObj ? [...availableMusicians, musicianObj] : availableMusicians;
      return calcMusicianAutoFee(musicianId, currentSelectedIds, settings, list);
    },
    [availableMusicians, pricingSettings]
  );

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  const isEditing = Boolean(initialData?.id || initialData?.quoteNumber);
  const [maxStepVisited, setMaxStepVisited] = useState(0);

  useEffect(() => {
    if (step > maxStepVisited) {
      setMaxStepVisited(step);
    }
  }, [step, maxStepVisited]);

  const [expandedEditSections, setExpandedEditSections] = useState<Record<string, boolean>>({
    client_event: true,
    lineup_moments: true,
    pricing_billing: false,
    terms_notes: false,
  });

  const toggleEditSection = (key: string) => {
    setExpandedEditSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allSectionsExpanded = useMemo(
    () => Object.values(expandedEditSections).every(Boolean),
    [expandedEditSections]
  );

  const toggleAllSections = () => {
    const next = !allSectionsExpanded;
    setExpandedEditSections({
      client_event: next,
      lineup_moments: next,
      pricing_billing: next,
      terms_notes: next,
    });
  };

  // === FORM STATE ===
  const [clientName, setClientName] = useState(initialData?.clientName || initialClientName || '');
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '');
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '');
  const [phoneCountry, setPhoneCountry] = useState('US');
  const [clientCompany, setClientCompany] = useState(initialData?.clientCompany || '');
  const [eventName, setEventName] = useState(initialData?.eventName || initialData?.eventTitle || '');
  const [eventType, setEventType] = useState<QuoteEventType>(initialData?.eventType || 'wedding');

  const activeAccentColor = useMemo(() => getEventAccentColor(eventType, 'quote'), [eventType]);
  const [eventDate, setEventDate] = useState(initialData?.eventDate || '');
  const [eventTimeStart, setEventTimeStart] = useState(initialData?.eventTimeStart || '');
  const [eventTimeEnd, setEventTimeEnd] = useState(initialData?.eventTimeEnd || '');
  const [guestCount, setGuestCount] = useState<number | undefined>(initialData?.guestCount);
  const [venueName, setVenueName] = useState(initialData?.venueName || '');
  const [venueAddress, setVenueAddress] = useState(initialData?.venueAddress || '');
  const [venueCity, setVenueCity] = useState(initialData?.venueCity || '');
  const [venueCountry, setVenueCountry] = useState(initialData?.venueCountry || 'IT');
  const [indoorOutdoor, setIndoorOutdoor] = useState<'indoor' | 'outdoor'>(initialData?.indoorOutdoor || 'indoor');
  const [musicalMoments, setMusicalMoments] = useState<MusicalMoment[]>(DEFAULT_MUSICAL_MOMENTS);
  const [expandedMoment, setExpandedMoment] = useState<string | null>(null);
  const [performanceType, setPerformanceType] = useState<PerformanceType>(initialData?.performanceType || 'full_band');
  const [setDuration, setSetDuration] = useState(initialData?.setDuration || 120);
  const [numberOfSets, setNumberOfSets] = useState(initialData?.numberOfSets || 2);
  const [breakDuration, setBreakDuration] = useState(initialData?.breakDuration || 15);
  const [selectedMusicians, setSelectedMusicians] = useState<QuoteMusician[]>(initialData?.musicians?.filter(m => !m.isExternal) || []);
  const [externalMusicians, setExternalMusicians] = useState<QuoteMusician[]>(initialData?.musicians?.filter(m => m.isExternal) || []);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialData?.genres || []);
  const [specialRequests, setSpecialRequests] = useState(initialData?.specialRequests || '');
  const [billingCountry, setBillingCountry] = useState(initialData?.billingCountry || 'IT');
  const [vatNumber, setVatNumber] = useState(initialData?.vatNumber || '');
  const [fiscalCode, setFiscalCode] = useState(initialData?.fiscalCode || '');
  const [vatExempt, setVatExempt] = useState(initialData?.vatExempt || false);
  const [reverseCharge, setReverseCharge] = useState(initialData?.reverseCharge || false);
  const [baseFee, setBaseFee] = useState(initialData?.baseFee || 0);
  const [travelIncluded, setTravelIncluded] = useState(initialData?.travelIncluded !== undefined ? initialData.travelIncluded : true);
  const [travelFee, setTravelFee] = useState(initialData?.travelFee || 0);
  const [accommodationNeeded, setAccommodationNeeded] = useState(initialData?.accommodationNeeded || false);
  const [accommodationFee, setAccommodationFee] = useState(initialData?.accommodationFee || 0);
  const [mealsIncluded, setMealsIncluded] = useState(initialData?.mealsIncluded !== undefined ? initialData.mealsIncluded : true);
  const [mealsFee, setMealsFee] = useState(initialData?.mealsFee || 0);
  const [soundIncluded, setSoundIncluded] = useState(initialData?.soundIncluded !== undefined ? initialData.soundIncluded : true);
  const [soundFee, setSoundFee] = useState(initialData?.soundFee || 0);
  const [lightsIncluded, setLightsIncluded] = useState(initialData?.lightsIncluded !== undefined ? initialData.lightsIncluded : true);
  const [lightsFee, setLightsFee] = useState(initialData?.lightsFee || 0);
  const [backlineIncluded, setBacklineIncluded] = useState(initialData?.backlineIncluded !== undefined ? initialData.backlineIncluded : true);
  const [backlineFee, setBacklineFee] = useState(initialData?.backlineFee || 0);
  const [customItems, setCustomItems] = useState<QuoteCustomItem[]>(initialData?.customItems || []);
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>(initialData?.discountType || 'none');
  const [discountValue, setDiscountValue] = useState(initialData?.discountValue || 0);
  const [discountReason, setDiscountReason] = useState(initialData?.discountReason || '');
  const [validityDays, setValidityDays] = useState(30);
  const [depositRequired, setDepositRequired] = useState(initialData?.depositRequired !== undefined ? initialData.depositRequired : true);
  const [depositPercentage, setDepositPercentage] = useState(initialData?.depositPercentage || 30);
  const [depositDueDate, setDepositDueDate] = useState(initialData?.depositDueDate || 'on_acceptance');
  const [balanceDueDate, setBalanceDueDate] = useState(initialData?.balanceDueDate || '7_days_after');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialData?.paymentMethods || ['bank_transfer']);
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(initialData?.cancellationPolicy || 'moderate');
  const [cancellationTerms, setCancellationTerms] = useState(initialData?.cancellationTerms || '');
  const [clientNotes, setClientNotes] = useState(initialData?.clientNotes || '');
  const [internalNotes, setInternalNotes] = useState(initialData?.internalNotes || '');

  // Load Band Pricing Settings and initialize base fee / deposit percentage
  const hasInitializedPricingRef = useRef(false);

  useEffect(() => {
    if (!selectedBand?.id) return;
    let isCancelled = false;

    getBandPricing(selectedBand.id).then((settings) => {
      if (isCancelled) return;
      setPricingSettings(settings);

      // Adjust moment default base prices according to band rates if not manually customized
      setMusicalMoments((prev) =>
        prev.map((m) => {
          if (m.customized) return m;
          if (m.id === 'ceremony') {
            return { ...m, basePrice: (settings.ceremony_musician_fee || 150) * m.defaultMusicians };
          }
          if (m.id === 'cocktail') {
            return { ...m, basePrice: (settings.cocktail_musician_fee || 150) * m.defaultMusicians };
          }
          return m;
        })
      );

      // Auto-populate selected musicians and base fee on first load if not provided in initialData
      if (!hasInitializedPricingRef.current && !initialData?.baseFee && (!initialData?.musicians || initialData.musicians.length === 0)) {
        hasInitializedPricingRef.current = true;
        if (availableMusicians.length > 0) {
          const firstMusician = availableMusicians[0];
          const autoFee = calcMusicianAutoFee(firstMusician.id, [], settings, availableMusicians);
          const initialList = [{ ...firstMusician, fee: autoFee }];
          setSelectedMusicians(initialList);
          setBaseFee(autoFee);
        } else {
          const calculatedBase = (settings.core_members_count ?? 1) * (settings.core_member_rate || 300);
          setBaseFee(calculatedBase);
        }
      }

      if (settings.default_deposit_rate) {
        setDepositPercentage(settings.default_deposit_rate);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedBand?.id]);

  // === Calculated Values ===
  const vatRate = useMemo(() => {
    return calculateVAT(billingCountry, 'IT', !!vatNumber, !!clientCompany, vatExempt, reverseCharge);
  }, [billingCountry, vatNumber, clientCompany, vatExempt, reverseCharge]);

  const totals = useMemo(() => {
    return calculateQuoteTotals(baseFee, travelIncluded ? 0 : travelFee, accommodationNeeded ? accommodationFee : 0, mealsIncluded ? 0 : mealsFee, soundIncluded ? 0 : soundFee, lightsIncluded ? 0 : lightsFee, backlineIncluded ? 0 : backlineFee, customItems, discountType, discountValue, vatRate, vatExempt, reverseCharge);
  }, [baseFee, travelIncluded, travelFee, accommodationNeeded, accommodationFee, mealsIncluded, mealsFee, soundIncluded, soundFee, lightsIncluded, lightsFee, backlineIncluded, backlineFee, customItems, discountType, discountValue, vatRate, vatExempt, reverseCharge]);

  const validUntilDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + validityDays);
    return date.toISOString().split('T')[0];
  }, [validityDays]);

  const allMusicians = useMemo(() => [...selectedMusicians, ...externalMusicians], [selectedMusicians, externalMusicians]);

  const musiciansTotal = useMemo(() => {
    return selectedMusicians.reduce((sum, m) => sum + (m.fee || 0), 0);
  }, [selectedMusicians]);

  const selectedMomentsTotal = useMemo(() =>
    musicalMoments.filter(m => m.selected).reduce((sum, m) => sum + (m.customPrice ?? m.basePrice), 0)
  , [musicalMoments]);

  // === HANDLERS ===
  const handleNext = () => { if (step < STEPS.length - 1) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const handleCreate = (sendImmediately = false) => {
    const quoteData: Partial<Quote> = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      quoteNumber: initialData?.quoteNumber || generateQuoteNumber(),
      status: sendImmediately ? 'SENT' : (initialData?.status || 'DRAFT'),
      clientName, clientEmail, clientPhone: clientPhone || undefined, clientCompany: clientCompany || undefined,
      eventName, eventType, eventDate, eventTimeStart, eventTimeEnd: eventTimeEnd || undefined, guestCount,
      venueName: venueName || undefined, venueAddress: venueAddress || undefined, venueCity, venueCountry, indoorOutdoor,
      performanceType, setDuration, numberOfSets, breakDuration,
      musicians: allMusicians, genres: selectedGenres, specialRequests: specialRequests || undefined,
      billingCountry, vatNumber: vatNumber || undefined, fiscalCode: fiscalCode || undefined, vatRate, vatExempt, reverseCharge,
      currency: pricingSettings.currency || 'EUR', baseFee, travelIncluded, travelFee: travelIncluded ? 0 : travelFee,
      accommodationNeeded, accommodationFee: accommodationNeeded ? accommodationFee : 0,
      mealsIncluded, mealsFee: mealsIncluded ? 0 : mealsFee, soundIncluded, soundFee: soundIncluded ? 0 : soundFee,
      lightsIncluded, lightsFee: lightsIncluded ? 0 : lightsFee, backlineIncluded, backlineFee: backlineIncluded ? 0 : backlineFee,
      customItems, discountType, discountValue, discountReason: discountReason || undefined,
      ...totals, validUntil: validUntilDate, depositRequired, depositPercentage, depositDueDate, balanceDueDate,
      paymentMethods, cancellationPolicy, cancellationTerms: cancellationTerms || undefined,
      clientNotes: clientNotes || undefined, internalNotes: internalNotes || undefined,
      sentAt: sendImmediately ? new Date().toISOString() : initialData?.sentAt,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventTitle: eventName,
    };
    onCreate(quoteData);
  };

  const selectPresetLineup = (type: PerformanceType) => {
    setPerformanceType(type);
    const countMap: Record<PerformanceType, number> = {
      solo: 1,
      duo: 2,
      trio: 3,
      full_band: availableMusicians.length || 4,
      dj_set: 1,
      acoustic: 2,
    };
    const count = Math.min(countMap[type] || 1, availableMusicians.length);
    const target = availableMusicians.slice(0, count);
    const targetIds = target.map((m) => m.id);
    const updated = target.map((m, idx) => {
      const fee = getAutoFeeForMusician(m.id, targetIds.slice(0, idx), pricingSettings, m);
      return { ...m, fee };
    });
    setSelectedMusicians(updated);
    const total = updated.reduce((sum, m) => sum + (m.fee || 0), 0);
    setBaseFee(total);
  };

  const toggleMusician = (musician: QuoteMusician) => {
    const isSelected = selectedMusicians.some((m) => m.id === musician.id);
    let updated: QuoteMusician[];
    if (isSelected) {
      updated = selectedMusicians.filter((m) => m.id !== musician.id);
    } else {
      const currentIds = selectedMusicians.map((m) => m.id);
      const autoFee = getAutoFeeForMusician(musician.id, currentIds, pricingSettings, musician);
      updated = [...selectedMusicians, { ...musician, fee: autoFee }];
    }
    setSelectedMusicians(updated);
    const total = updated.reduce((sum, m) => sum + (m.fee || 0), 0);
    setBaseFee(total);
  };

  const updateMusicianFee = (musicianId: string, fee: number) => {
    setSelectedMusicians((prev) => {
      const updated = prev.map((m) => (m.id === musicianId ? { ...m, fee } : m));
      const total = updated.reduce((sum, m) => sum + (m.fee || 0), 0);
      setBaseFee(total);
      return updated;
    });
  };

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) setSelectedGenres(selectedGenres.filter(g => g !== genre));
    else setSelectedGenres([...selectedGenres, genre]);
  };

  const togglePaymentMethod = (method: PaymentMethod) => {
    if (paymentMethods.includes(method)) setPaymentMethods(paymentMethods.filter(m => m !== method));
    else setPaymentMethods([...paymentMethods, method]);
  };

  const toggleMoment = (momentId: string) => setMusicalMoments(prev => prev.map(m => m.id === momentId ? { ...m, selected: !m.selected } : m));
  const updateMoment = (momentId: string, updates: Partial<MusicalMoment>) => setMusicalMoments(prev => prev.map(m => m.id === momentId ? { ...m, ...updates, customized: true } : m));

  const canProceed = () => {
    switch (step) {
      case 0: return clientName.trim() && clientEmail.trim() && eventDate && eventTimeStart;
      case 1: return eventType;
      case 2: return selectedMusicians.length > 0;
      case 3: return musicalMoments.some(m => m.selected);
      case 4: return baseFee > 0 && paymentMethods.length > 0;
      case 5: return true;
      default: return false;
    }
  };

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return STEPS.length - 1;
    let max = 0;
    if (clientName.trim() && eventDate) max = 1;
    if (max >= 1 && eventType) max = 2;
    if (max >= 2 && selectedMusicians.length > 0) max = 3;
    if (max >= 3 && musicalMoments.some((m) => m.selected)) max = 4;
    if (max >= 4 && baseFee > 0 && paymentMethods.length > 0) max = 5;
    return Math.max(max, maxStepVisited);
  }, [isEditing, clientName, eventDate, eventType, selectedMusicians.length, musicalMoments, baseFee, paymentMethods.length, maxStepVisited]);

  const canSaveDraft = useMemo(() => {
    return Boolean(clientName.trim() && eventDate);
  }, [clientName, eventDate]);

  const phonePrefix = COUNTRY_PHONE_CODES.find(c => c.code === phoneCountry)?.prefix || '+1';

  // === STEP INDICATOR ===
  const StepIndicators = () => (
    <div className="flex gap-1 items-center justify-center">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-[10px] transition-all',
            i === step ? 'w-4 bg-foreground' : 'w-2 bg-foreground/20'
          )}
        />
      ))}
    </div>
  );

  // Field component is defined outside the render (QuoteField) to prevent re-mounts

  // === TAG PILL ===
  const TagPill: React.FC<{ children: React.ReactNode; active?: boolean }> = ({ children, active }) => (
    <div className={cn(
      'px-2.5 py-1 rounded-[6px] text-[12px] font-bold uppercase',
      active ? 'bg-foreground text-background' : 'bg-foreground/10 text-foreground/70'
    )}>
      {children}
    </div>
  );

  // ═══════════════════════════════════
  // STEP 01: CLIENT & DATE
  // ═══════════════════════════════════
  const renderClientDateStep = () => (
    <div className="flex flex-col gap-10">
      <QuoteField label="CLIENT NAME">
        <input
          type="text"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="EG. PAOLO ROSSI"
          className="w-full bg-transparent text-[24px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
          autoFocus
        />
      </QuoteField>

      <QuoteField label="EMAIL">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-foreground/40 shrink-0" />
          <input
            type="email"
            value={clientEmail}
            onChange={e => setClientEmail(e.target.value)}
            placeholder="EMAIL@EXAMPLE.COM"
            className="w-full bg-transparent text-[24px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
          />
        </div>
      </QuoteField>

      <div className="grid grid-cols-2 gap-5">
        <QuoteField label="COUNTRY">
          <select
            value={phoneCountry}
            onChange={e => setPhoneCountry(e.target.value)}
            className="w-full bg-transparent text-[24px] font-bold text-foreground focus:outline-none appearance-none uppercase"
          >
            {COUNTRY_PHONE_CODES.map(c => (
              <option key={c.code} value={c.code} className="text-black">{c.code} {c.prefix}</option>
            ))}
          </select>
        </QuoteField>
        <QuoteField label="PHONE NUMBER">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-foreground/40 shrink-0" />
            <input
              type="tel"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="123-123-1234"
              className="w-full bg-transparent text-[24px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none"
            />
          </div>
        </QuoteField>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <QuoteField label="DATE">
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full bg-transparent text-[24px] font-bold text-foreground focus:outline-none uppercase"
          />
        </QuoteField>
        <QuoteField label="START">
          <TimePicker
            value={eventTimeStart}
            onChange={setEventTimeStart}
            textSize="text-[24px]"
            showIcon
            className="text-foreground focus-within:text-foreground"
          />
        </QuoteField>
      </div>

      <QuoteField label="VENUE">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-foreground/40 shrink-0" />
          <VenueAutocomplete
            value={venueName}
            onChange={setVenueName}
            onSelect={place => {
              setVenueName(place.name);
              if (place.address) setVenueAddress(place.address);
              if (place.city) setVenueCity(place.city);
              if (place.country) {
                const foundCode = Object.keys(VAT_RATES).find(code => 
                  code.toUpperCase() === place.country?.toUpperCase() || 
                  VAT_RATES[code].name.toLowerCase() === place.country?.toLowerCase()
                );
                if (foundCode) setVenueCountry(foundCode);
              }
            }}
            placeholder="VILLA REGINA"
            className="w-full bg-transparent text-[24px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase border-0 pb-0"
          />
        </div>
      </QuoteField>

      <div className="grid grid-cols-2 gap-5">
        <QuoteField label="CITY">
          <input
            type="text"
            value={venueCity}
            onChange={e => setVenueCity(e.target.value)}
            placeholder="CITY"
            className="w-full bg-transparent text-[20px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
          />
        </QuoteField>
        <QuoteField label="COUNTRY">
          <select
            value={venueCountry}
            onChange={e => setVenueCountry(e.target.value)}
            className="w-full bg-transparent text-[20px] font-bold text-foreground focus:outline-none appearance-none uppercase"
          >
            {Object.keys(VAT_RATES).map(code => (
              <option key={code} value={code} className="text-black">{VAT_RATES[code].name.toUpperCase()}</option>
            ))}
          </select>
        </QuoteField>
      </div>

      {(venueCity || venueAddress) && (
        <div className="flex flex-wrap gap-2">
          {[venueAddress, venueCity, VAT_RATES[venueCountry]?.name].filter(Boolean).map((tag, i) => (
            <div key={i} className="px-3 py-1.5 rounded-[6px] bg-foreground/10 text-[12px] font-bold text-foreground/60 uppercase">
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════
  // STEP 02: EVENT TYPE
  // ═══════════════════════════════════
  const renderEventTypeStep = () => (
    <div className="flex flex-col gap-10">
      {EVENT_TYPES.map(type => {
        const isSelected = eventType === type.value;
        return (
          <button
            key={type.value}
            onClick={() => setEventType(type.value)}
            className="flex items-start justify-between gap-5 w-full text-left"
          >
            <div className="flex flex-col gap-1 flex-1">
              <TagPill>{type.value.toUpperCase()}</TagPill>
              <span className={cn(
                'text-[32px] font-bold uppercase leading-tight transition-colors',
                isSelected ? 'text-foreground' : 'text-foreground/30'
              )}>
                {type.label}
              </span>
            </div>
            <DotRadio
              selected={isSelected}
              activeColor="var(--accent-quote)"
              inactiveColor="var(--border)"
            />
          </button>
        );
      })}
    </div>
  );

  // ═══════════════════════════════════
  // STEP 03: PERFORMANCE
  // ═══════════════════════════════════
  const renderPerformanceStep = () => (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">LINEUP PRESETS</span>
        <div className="flex flex-wrap gap-2">
          {PERFORMANCE_TYPES.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => selectPresetLineup(type.value)}
              className={cn(
                'px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all',
                performanceType === type.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-foreground/10" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">
            BAND MEMBERS ({selectedMusicians.length}/{availableMusicians.length})
          </span>
          {musiciansTotal > 0 && (
            <span className="text-[13px] font-bold text-foreground">
              {currencySymbol}{musiciansTotal}
            </span>
          )}
        </div>

        <div className="flex flex-col">
          {availableMusicians.map((member) => {
            const selectedMusician = selectedMusicians.find(m => m.id === member.id || (m.userId && m.userId === member.userId));
            const isSelected = !!selectedMusician;
            const selectedIdx = isSelected
              ? selectedMusicians.findIndex(m => m.id === member.id || (m.userId && m.userId === member.userId))
              : -1;
            const isCore = selectedIdx >= 0 ? selectedIdx < (pricingSettings.core_members_count ?? 1) : false;
            const autoFee = getAutoFeeForMusician(member.id, selectedMusicians.map(m => m.id), pricingSettings, member);

            return (
              <div
                key={member.id}
                className="flex flex-col py-3 border-b last:border-0 border-foreground/10"
              >
                <div className="flex items-center gap-4 w-full">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0',
                    isSelected ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/40 border-foreground/20'
                  )}>
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-foreground/10 text-foreground/60">
                        {member.instrument}
                      </span>
                      {isSelected && (
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                          isCore ? 'bg-purple-600 text-white' : 'bg-foreground/15 text-foreground'
                        )}>
                          {isCore ? 'CORE' : 'SESSION'}
                        </span>
                      )}
                    </div>
                    <p className={cn('text-[16px] font-bold uppercase mt-1', isSelected ? 'text-foreground' : 'text-foreground/40')}>
                      {member.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMusician(member)}
                    className="shrink-0"
                  >
                    <DotCheckbox
                      checked={isSelected}
                      activeColor="var(--accent-quote)"
                      inactiveColor="var(--border)"
                    />
                  </button>
                </div>

                {/* Inline Musician Fee input */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-14 pt-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground/50 font-bold text-xs uppercase">Musician Fee:</span>
                        <span className="text-foreground/60 font-bold text-sm">{currencySymbol}</span>
                        <input
                          type="number"
                          value={selectedMusician?.fee ?? ''}
                          onChange={(e) => updateMusicianFee(member.id, parseFloat(e.target.value) || 0)}
                          placeholder={String(autoFee)}
                          className="bg-transparent font-bold text-sm border-b border-foreground/20 focus:border-foreground text-foreground focus:outline-none w-24 pb-0.5"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-foreground/10" />

      <div className="flex flex-col gap-4">
        <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">GENRES</span>
        <div className="flex flex-wrap gap-2">
          {MUSIC_GENRES.map(genre => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={cn(
                'px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all',
                selectedGenres.includes(genre)
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40'
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════
  // STEP 04: MUSICAL MOMENTS
  // ═══════════════════════════════════
  const renderMomentsStep = () => (
    <div className="flex flex-col gap-6">
      {musicalMoments.map(moment => {
        const isExpanded = expandedMoment === moment.id;
        const price = moment.customPrice ?? moment.basePrice;
        const musicians = moment.customMusicians ?? moment.defaultMusicians;
        const duration = moment.customDuration ?? moment.defaultDuration;
        const isSelected = moment.selected;

        return (
          <div key={moment.id} className="flex flex-col gap-0">
            <button
              onClick={() => toggleMoment(moment.id)}
              className="flex items-start justify-between gap-5 w-full text-left"
            >
              <div className="flex flex-col gap-1 flex-1">
                <TagPill active={isSelected}>{currencySymbol}{price}</TagPill>
                <span className={cn(
                  'text-[24px] font-bold uppercase leading-tight',
                  isSelected ? 'text-foreground' : 'text-foreground/30'
                )}>
                  {moment.name}
                </span>
                <span className={cn(
                  'text-[12px] font-bold uppercase',
                  isSelected ? 'text-foreground/60' : 'text-foreground/30'
                )}>
                  {moment.description}
                </span>
              </div>
              <DotCheckbox
                checked={isSelected}
                activeColor="var(--accent-quote)"
                inactiveColor="var(--border)"
              />
            </button>

            {isSelected && (
              <div className="mt-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold uppercase text-foreground/50">MUSICIANS</span>
                    {musicians > selectedMusicians.length && selectedMusicians.length > 0 && (
                      <span className="text-[10px] font-bold text-orange-400 mt-1">
                        Exceeds band size ({selectedMusicians.length})
                      </span>
                    )}
                  </div>
                  <span className="text-[32px] font-bold text-foreground">{musicians}</span>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateMoment(moment.id, { customMusicians: Math.max(1, musicians - 1) }); }}
                    className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateMoment(moment.id, { customMusicians: Math.min(10, musicians + 1) }); }}
                    className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedMoment(isExpanded ? null : moment.id); }}
                    className="flex items-center gap-2 text-foreground/50 text-[12px] font-bold uppercase mt-1"
                  >
                    CUSTOMIZE
                    <ChevronUp className={cn('w-4 h-4 transition-transform', !isExpanded && 'rotate-180')} />
                  </button>
                )}

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-5 pt-3 border-t border-foreground/15">
                        <div className="flex flex-col gap-3">
                          <span className="text-[12px] font-bold uppercase text-foreground/50">PERFORMANCE TYPE</span>
                          <div className="flex flex-wrap gap-2">
                            {PERFORMANCE_TYPES.map(type => (
                              <button
                                key={type.value}
                                onClick={(e) => { e.stopPropagation(); setPerformanceType(type.value); }}
                                className={cn(
                                  'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all',
                                  performanceType === type.value
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'bg-transparent text-foreground/60 border-foreground/20'
                                )}
                              >
                                {type.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <QuoteField label="PRICE">
                            <div className="flex items-center gap-1">
                              <span className="text-foreground/40 font-bold">{currencySymbol}</span>
                              <input
                                type="number"
                                value={price}
                                onChange={e => updateMoment(moment.id, { customPrice: parseInt(e.target.value) || 0 })}
                                onClick={e => e.stopPropagation()}
                                className="w-full bg-transparent text-[24px] font-bold text-foreground focus:outline-none"
                              />
                            </div>
                          </QuoteField>
                          <QuoteField label="DURATION">
                            <select
                              value={duration}
                              onChange={e => updateMoment(moment.id, { customDuration: parseInt(e.target.value) || 15 })}
                              onClick={e => e.stopPropagation()}
                              className="w-full bg-transparent text-[24px] font-bold text-foreground focus:outline-none appearance-none cursor-pointer"
                            >
                              {MOMENT_DURATION_OPTIONS.map(m => (
                                <option key={m} value={m} className="text-black bg-white text-base">
                                  {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''} (${m} min)` : `${m} min`}
                                </option>
                              ))}
                            </select>
                          </QuoteField>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="h-px bg-foreground/10 mt-6" />
          </div>
        );
      })}

      <div className="h-24" />
    </div>
  );

  // ═══════════════════════════════════
  // STEP 05: BILLING & VAT
  // ═══════════════════════════════════
  const renderBillingStep = () => (
    <div className="flex flex-col gap-8">
      {/* Performance Fee */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <TagPill active>PERFORMANCE FEE</TagPill>
          <div className="flex items-center gap-1">
            <span className="text-foreground/40 text-[32px] font-bold">{currencySymbol}</span>
            <input
              type="number"
              value={baseFee || ''}
              onChange={e => setBaseFee(parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-transparent text-[42px] font-bold text-foreground placeholder:text-foreground/20 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {musiciansTotal > 0 && baseFee !== musiciansTotal && (
              <button
                type="button"
                onClick={() => setBaseFee(musiciansTotal)}
                className="text-[11px] font-bold text-foreground/50 underline decoration-foreground/20 hover:text-foreground transition-colors"
              >
                Use lineup total ({currencySymbol}{musiciansTotal})
              </button>
            )}
            {selectedMomentsTotal > 0 && baseFee !== selectedMomentsTotal && (
              <button
                type="button"
                onClick={() => setBaseFee(selectedMomentsTotal)}
                className="text-[11px] font-bold text-foreground/50 underline decoration-foreground/20 hover:text-foreground transition-colors"
              >
                Use moments total ({currencySymbol}{selectedMomentsTotal})
              </button>
            )}
          </div>
        </div>
        <DotCheckbox checked={baseFee > 0} activeColor="var(--accent-quote)" inactiveColor="var(--border)" />
      </div>

      <div className="h-px bg-foreground/10" />

      {/* Additional Fees */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold uppercase text-foreground/50">ADDITIONAL FEES</span>
        <span className="text-[24px] font-bold uppercase text-foreground">EXTRA</span>
      </div>

      <FeeRow label="TRAVEL" tag="TRAVEL & LOGISTICS" included={travelIncluded} onToggle={() => setTravelIncluded(!travelIncluded)} fee={travelFee} onFeeChange={setTravelFee} currencySymbol={currencySymbol} />
      <FeeRow label="ACCOMMODATION" tag="TRAVEL & LOGISTICS" included={!accommodationNeeded} onToggle={() => setAccommodationNeeded(!accommodationNeeded)} fee={accommodationFee} onFeeChange={setAccommodationFee} currencySymbol={currencySymbol} />
      <FeeRow label="MEALS" tag="TRAVEL & LOGISTICS" included={mealsIncluded} onToggle={() => setMealsIncluded(!mealsIncluded)} fee={mealsFee} onFeeChange={setMealsFee} currencySymbol={currencySymbol} />
      <FeeRow label="EQUIPMENT" tag="TECHNICAL" included={soundIncluded && lightsIncluded && backlineIncluded} onToggle={() => { setSoundIncluded(!soundIncluded); setLightsIncluded(!lightsIncluded); setBacklineIncluded(!backlineIncluded); }} fee={soundFee + lightsFee + backlineFee} onFeeChange={(v) => { setSoundFee(v); setLightsFee(0); setBacklineFee(0); }} currencySymbol={currencySymbol} />

      {/* Custom Fee Items */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-foreground/50">CUSTOM FEES</span>
        {customItems.map((item, i) => (
          <div key={item.id || i} className="flex items-center gap-3">
            <input
              type="text"
              value={item.name}
              onChange={(e) => setCustomItems(prev => prev.map((ci, idx) => idx === i ? { ...ci, name: e.target.value } : ci))}
              placeholder="Fee name..."
              className="flex-1 bg-foreground/10 rounded-[8px] px-3 py-2 text-[14px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none"
            />
            <div className="flex items-center gap-1">
              <span className="text-foreground/50 font-bold text-sm">{currencySymbol}</span>
              <input
                type="number"
                value={item.amount || ''}
                onChange={(e) => setCustomItems(prev => prev.map((ci, idx) => idx === i ? { ...ci, amount: parseFloat(e.target.value) || 0 } : ci))}
                placeholder="0"
                className="bg-foreground/10 rounded-[8px] px-3 py-2 text-[14px] font-bold text-foreground focus:outline-none w-24"
              />
            </div>
            <button
              onClick={() => setCustomItems(prev => prev.filter((_, idx) => idx !== i))}
              className="text-foreground/30 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {pricingSettings.custom_services?.filter(s => s.is_active).length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[11px] font-bold uppercase text-foreground/50">POPULAR EXTRAS</span>
            <div className="flex flex-wrap gap-1.5">
              {pricingSettings.custom_services.filter(s => s.is_active).map(service => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setCustomItems(prev => [
                      ...prev,
                      {
                        id: `srv-${Date.now()}-${service.id}`,
                        name: service.name,
                        description: service.name,
                        amount: service.price,
                        quantity: 1,
                      }
                    ]);
                  }}
                  className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold uppercase border border-foreground/15 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 transition-colors"
                >
                  + {service.name} ({currencySymbol}{service.price})
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => setCustomItems(prev => [...prev, { id: `custom-${Date.now()}`, description: '', amount: 0, quantity: 1 }])}
          className="flex items-center gap-2 text-[12px] font-bold text-foreground/40 uppercase hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Custom Fee
        </button>
      </div>

      <div className="h-px bg-foreground/10" />

      {/* Tax Options */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-foreground/50">TAX OPTIONS</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setVatExempt(!vatExempt)}
            className={cn('px-3 py-1.5 rounded-[6px] text-[12px] font-bold uppercase border transition-all',
              vatExempt ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
            )}
          >
            VAT EXEMPT
          </button>
          <button
            onClick={() => setReverseCharge(!reverseCharge)}
            className={cn('px-3 py-1.5 rounded-[6px] text-[12px] font-bold uppercase border transition-all',
              reverseCharge ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
            )}
          >
            REVERSE CHARGE
          </button>
        </div>
      </div>

      {/* Quote Validity */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-foreground/50">QUOTE VALIDITY</span>
        <div className="flex flex-wrap gap-2">
          {VALIDITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setValidityDays(opt.value)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                validityDays === opt.value ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deposit */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-foreground/50">DEPOSIT REQUIRED</span>
        <div className="flex flex-wrap gap-2">
          {DEPOSIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDepositPercentage(opt.value)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                depositPercentage === opt.value ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-foreground/50">PAYMENT METHODS</span>
        <div className="flex flex-wrap gap-2">
          {(['bank_transfer', 'credit_card', 'paypal', 'cash'] as PaymentMethod[]).map(method => (
            <button
              key={method}
              onClick={() => togglePaymentMethod(method)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                paymentMethods.includes(method) ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
              )}
            >
              {method.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Cancellation Policy */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-foreground/50">CANCELLATION POLICY</span>
        <div className="flex flex-wrap gap-2">
          {(['flexible', 'moderate', 'strict'] as CancellationPolicy[]).map(policy => (
            <button
              key={policy}
              onClick={() => setCancellationPolicy(policy)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                cancellationPolicy === policy ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
              )}
            >
              {policy}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-foreground/50">NOTES</span>
        <textarea
          value={clientNotes}
          onChange={e => setClientNotes(e.target.value)}
          placeholder="ANY NOTES TO INCLUDE IN THE QUOTE..."
          rows={3}
          className="w-full bg-transparent border border-foreground/20 rounded-[10px] p-4 text-foreground text-[14px] font-bold placeholder:text-foreground/30 focus:outline-none focus:border-foreground/50 resize-none uppercase"
        />
      </div>
    </div>
  );

  // ═══════════════════════════════════
  // STEP 06: SUMMARY
  // ═══════════════════════════════════
  const renderSummaryStep = () => {
    const dateParts = eventDate ? eventDate.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()];
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const dayNum = dateParts[2];
    const yearNum = dateParts[0];
    const selectedMomentCount = musicalMoments.filter(m => m.selected).length;

    return (
      <div className="flex flex-col gap-8">
        {/* Event Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <TagPill active>QUOTE</TagPill>
            <TagPill active>{eventType.toUpperCase()}</TagPill>
          </div>
          <h2 className="text-[32px] font-bold text-foreground uppercase leading-tight">
            {eventName || 'UNTITLED EVENT'}
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-foreground/60" />
              <span className="text-[14px] font-bold text-foreground uppercase">{venueName || venueCity || 'TBD'}</span>
            </div>
            <div className="px-3 py-1.5 rounded-[6px] bg-foreground/10 text-[12px] font-bold text-foreground/60 uppercase">
              START - {eventTimeStart || 'TBD'}
            </div>
          </div>
        </div>

        <div className="h-px bg-foreground/10" />

        {/* Year & Date */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-foreground/50 uppercase">YEAR</span>
            <span className="text-[42px] font-bold text-foreground leading-none">{yearNum}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-foreground/50 uppercase">DATE</span>
            <span className="text-[42px] font-bold text-foreground leading-none">{monthName} {dayNum}</span>
          </div>
        </div>

        <div className="h-px bg-foreground/10" />

        {/* Client & Pricing */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-foreground/50 uppercase">CLIENT</span>
            <span className="text-[32px] font-bold text-foreground uppercase leading-tight">{clientName || 'TBD'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-foreground/50 uppercase">PRICING & FINANCE</span>
            <span className="text-[32px] font-bold text-foreground leading-tight">
              {currencySymbol}{totals.total >= 1000 ? `${(totals.total / 1000).toFixed(1)}K` : totals.total}
            </span>
            <span className="text-[14px] font-bold text-foreground/50 uppercase">DP{depositPercentage}%</span>
          </div>
        </div>

        <div className="h-px bg-foreground/10" />

        {/* Guests */}
        {guestCount && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold text-foreground/50 uppercase">GUESTS</span>
              <span className="text-[42px] font-bold text-foreground leading-none">{guestCount}</span>
            </div>
            <div className="h-px bg-foreground/10" />
          </>
        )}

        {/* Moments & Members */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-foreground/50 uppercase">MUSIC MOMENTS</span>
            <span className="text-[32px] font-bold text-foreground leading-none">{selectedMomentCount}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-foreground/50 uppercase">MEMBERS</span>
            <span className="text-[32px] font-bold text-foreground leading-none">{allMusicians.length}</span>
          </div>
        </div>
      </div>
    );
  };

  // === RENDER STEP ===
  const renderStep = () => {
    switch (step) {
      case 0: return renderClientDateStep();
      case 1: return renderEventTypeStep();
      case 2: return renderPerformanceStep();
      case 3: return renderMomentsStep();
      case 4: return renderBillingStep();
      case 5: return renderSummaryStep();
      default: return null;
    }
  };

  // ═══════════════════════════════════
  // ACCORDION EDIT VIEW (FOR isEditing === true)
  // ═══════════════════════════════════
  const renderEditAccordionView = () => {
    const card1Warning = !clientName.trim() || !eventDate || !clientEmail.trim();
    const card2Warning = selectedMusicians.length === 0;
    const card3Warning = baseFee <= 0;
    const card4Warning = paymentMethods.length === 0;

    return (
      <div className="flex flex-col gap-4">
        {/* Accordion Card 1: Client & Event */}
        <QuoteAccordionCard
          isOpen={!!expandedEditSections.client_event}
          onToggle={() => toggleEditSection('client_event')}
          stepNumber="01"
          title="CLIENT & EVENT DETAILS"
          summary={`${clientName || 'NO CLIENT'} • ${eventType.toUpperCase()} • ${eventDate || 'NO DATE'}${eventTimeStart ? ` @ ${eventTimeStart}` : ''}`}
          hasWarning={card1Warning}
          warningLabel={!clientName.trim() ? 'MISSING CLIENT NAME' : !eventDate ? 'MISSING DATE' : 'MISSING EMAIL'}
        >
          <div className="flex flex-col gap-6 pt-3">
            {/* Event Type Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/60">EVENT TYPE</span>
              <div className="grid grid-cols-3 gap-2">
                {EVENT_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setEventType(type.value)}
                    className={cn(
                      'px-3 py-2 rounded-[8px] text-[12px] font-bold uppercase border transition-all text-center',
                      eventType === type.value
                        ? 'bg-foreground text-background border-foreground shadow-sm'
                        : 'bg-foreground/5 text-foreground/70 border-foreground/15 hover:border-foreground/30'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Event Name */}
            <QuoteField label="EVENT NAME">
              <input
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="EG. SMITH WEDDING / TECH SUMMIT"
                className="w-full bg-transparent text-[20px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
              />
            </QuoteField>

            {/* Client Name & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuoteField label="CLIENT NAME">
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="EG. PAOLO ROSSI"
                  className="w-full bg-transparent text-[20px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
                />
              </QuoteField>
              <QuoteField label="COMPANY (OPTIONAL)">
                <input
                  type="text"
                  value={clientCompany}
                  onChange={e => setClientCompany(e.target.value)}
                  placeholder="EG. ACME CORP"
                  className="w-full bg-transparent text-[20px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
                />
              </QuoteField>
            </div>

            {/* Client Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuoteField label="EMAIL">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-foreground/40 shrink-0" />
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="EMAIL@EXAMPLE.COM"
                    className="w-full bg-transparent text-[18px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
                  />
                </div>
              </QuoteField>
              <QuoteField label="PHONE">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-foreground/40 shrink-0" />
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="123-123-1234"
                    className="w-full bg-transparent text-[18px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none"
                  />
                </div>
              </QuoteField>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <QuoteField label="DATE">
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full bg-transparent text-[18px] font-bold text-foreground focus:outline-none uppercase"
                />
              </QuoteField>
              <QuoteField label="START TIME">
                <TimePicker
                  value={eventTimeStart}
                  onChange={setEventTimeStart}
                  textSize="text-[18px]"
                  showIcon
                  className="text-foreground focus-within:text-foreground"
                />
              </QuoteField>
              <QuoteField label="END TIME (OPTIONAL)">
                <TimePicker
                  value={eventTimeEnd}
                  onChange={setEventTimeEnd}
                  allowEmpty
                  textSize="text-[18px]"
                  showIcon
                  className="text-foreground focus-within:text-foreground"
                />
              </QuoteField>
            </div>

            {/* Guest Count */}
            <QuoteField label="GUEST COUNT (OPTIONAL)">
              <input
                type="number"
                value={guestCount || ''}
                onChange={e => setGuestCount(parseInt(e.target.value) || undefined)}
                placeholder="EG. 120"
                className="w-full bg-transparent text-[18px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none"
              />
            </QuoteField>

            {/* Venue & Location */}
            <QuoteField label="VENUE NAME">
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-foreground/40 shrink-0" />
                <VenueAutocomplete
                  value={venueName}
                  onChange={setVenueName}
                  onSelect={place => {
                    setVenueName(place.name);
                    if (place.address) setVenueAddress(place.address);
                    if (place.city) setVenueCity(place.city);
                    if (place.country) {
                      const foundCode = Object.keys(VAT_RATES).find(code => 
                        code.toUpperCase() === place.country?.toUpperCase() || 
                        VAT_RATES[code].name.toLowerCase() === place.country?.toLowerCase()
                      );
                      if (foundCode) setVenueCountry(foundCode);
                    }
                  }}
                  placeholder="VILLA REGINA"
                  className="w-full bg-transparent text-[18px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase border-0 pb-0"
                />
              </div>
            </QuoteField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuoteField label="CITY">
                <input
                  type="text"
                  value={venueCity}
                  onChange={e => setVenueCity(e.target.value)}
                  placeholder="CITY"
                  className="w-full bg-transparent text-[18px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
                />
              </QuoteField>
              <QuoteField label="COUNTRY">
                <select
                  value={venueCountry}
                  onChange={e => setVenueCountry(e.target.value)}
                  className="w-full bg-transparent text-[18px] font-bold text-foreground focus:outline-none appearance-none uppercase"
                >
                  {Object.keys(VAT_RATES).map(code => (
                    <option key={code} value={code} className="text-black">{VAT_RATES[code].name.toUpperCase()}</option>
                  ))}
                </select>
              </QuoteField>
            </div>
          </div>
        </QuoteAccordionCard>

        {/* Accordion Card 2: Band & Moments */}
        <QuoteAccordionCard
          isOpen={!!expandedEditSections.lineup_moments}
          onToggle={() => toggleEditSection('lineup_moments')}
          stepNumber="02"
          title="BAND & MUSICAL MOMENTS"
          summary={`${selectedMusicians.length} MUSICIANS • ${musicalMoments.filter(m => m.selected).length} MOMENTS SELECTED`}
          hasWarning={card2Warning}
          warningLabel="NO MUSICIANS"
        >
          <div className="flex flex-col gap-6 pt-3">
            {/* Lineup Presets */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">LINEUP PRESETS</span>
              <div className="flex flex-wrap gap-2">
                {PERFORMANCE_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => selectPresetLineup(type.value)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase border transition-all',
                      performanceType === type.value
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Musicians List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">
                  BAND MEMBERS ({selectedMusicians.length}/{availableMusicians.length})
                </span>
                {musiciansTotal > 0 && (
                  <span className="text-[13px] font-bold text-foreground">
                    TOTAL: {currencySymbol}{musiciansTotal}
                  </span>
                )}
              </div>

              <div className="flex flex-col divide-y divide-foreground/10 border border-foreground/10 rounded-[12px] overflow-hidden px-3">
                {availableMusicians.map((member) => {
                  const selectedMusician = selectedMusicians.find(m => m.id === member.id || (m.userId && m.userId === member.userId));
                  const isSelected = !!selectedMusician;
                  const selectedIdx = isSelected
                    ? selectedMusicians.findIndex(m => m.id === member.id || (m.userId && m.userId === member.userId))
                    : -1;
                  const isCore = selectedIdx >= 0 ? selectedIdx < (pricingSettings.core_members_count ?? 1) : false;
                  const autoFee = getAutoFeeForMusician(member.id, selectedMusicians.map(m => m.id), pricingSettings, member);

                  return (
                    <div key={member.id} className="py-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-3 w-full">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
                          isSelected ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/40 border-foreground/20'
                        )}>
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold uppercase truncate">{member.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-foreground/10 text-foreground/60">
                              {member.instrument}
                            </span>
                            {isSelected && (
                              <span className={cn(
                                'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                                isCore ? 'bg-purple-600 text-white' : 'bg-foreground/15 text-foreground'
                              )}>
                                {isCore ? 'CORE' : 'SESSION'}
                              </span>
                            )}
                          </div>
                        </div>
                        <button type="button" onClick={() => toggleMusician(member)} className="shrink-0">
                          <DotCheckbox checked={isSelected} activeColor="var(--accent-quote)" inactiveColor="var(--border)" />
                        </button>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-2 pl-11 text-xs">
                          <span className="text-foreground/50 font-bold uppercase">Fee:</span>
                          <span className="text-foreground/60 font-bold">{currencySymbol}</span>
                          <input
                            type="number"
                            value={selectedMusician?.fee ?? ''}
                            onChange={(e) => updateMusicianFee(member.id, parseFloat(e.target.value) || 0)}
                            placeholder={String(autoFee)}
                            className="bg-foreground/5 rounded px-2 py-0.5 font-bold text-sm text-foreground focus:outline-none w-20 border border-foreground/15"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Musical Moments */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">
                  MUSICAL MOMENTS ({musicalMoments.filter(m => m.selected).length}/{musicalMoments.length})
                </span>
                {selectedMomentsTotal > 0 && (
                  <span className="text-[13px] font-bold text-foreground">
                    TOTAL: {currencySymbol}{selectedMomentsTotal}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {musicalMoments.map((moment) => {
                  const isExpanded = expandedMoment === moment.id;
                  const price = moment.customPrice ?? moment.basePrice;
                  const musicians = moment.customMusicians ?? moment.defaultMusicians;
                  const duration = moment.customDuration ?? moment.defaultDuration;
                  const isSelected = moment.selected;

                  return (
                    <div key={moment.id} className="border border-foreground/10 rounded-[12px] p-3 flex flex-col gap-2 bg-foreground/[0.01]">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleMoment(moment.id)}
                          className="flex items-center gap-3 flex-1 text-left min-w-0"
                        >
                          <DotCheckbox checked={isSelected} activeColor="var(--accent-quote)" inactiveColor="var(--border)" />
                          <div className="flex flex-col min-w-0">
                            <span className={cn('text-[14px] font-bold uppercase truncate', isSelected ? 'text-foreground' : 'text-foreground/50')}>
                              {moment.name}
                            </span>
                            <span className="text-[11px] font-bold text-foreground/40 uppercase">
                              {currencySymbol}{price} • {musicians} MUSICIANS • {duration} MIN
                            </span>
                          </div>
                        </button>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => setExpandedMoment(isExpanded ? null : moment.id)}
                            className="px-2 py-1 rounded text-[10px] font-bold uppercase border border-foreground/20 text-foreground/60 hover:text-foreground"
                          >
                            {isExpanded ? 'CLOSE' : 'EDIT'}
                          </button>
                        )}
                      </div>

                      {isSelected && isExpanded && (
                        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-foreground/10">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-foreground/50 block mb-1">PRICE ({currencySymbol})</span>
                            <input
                              type="number"
                              value={price}
                              onChange={e => updateMoment(moment.id, { customPrice: parseInt(e.target.value) || 0 })}
                              className="w-full bg-foreground/5 border border-foreground/15 rounded px-2 py-1 text-[13px] font-bold text-foreground focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-foreground/50 block mb-1">MUSICIANS</span>
                            <input
                              type="number"
                              value={musicians}
                              onChange={e => updateMoment(moment.id, { customMusicians: parseInt(e.target.value) || 1 })}
                              className="w-full bg-foreground/5 border border-foreground/15 rounded px-2 py-1 text-[13px] font-bold text-foreground focus:outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-foreground/50 block mb-1">DURATION</span>
                            <select
                              value={duration}
                              onChange={e => updateMoment(moment.id, { customDuration: parseInt(e.target.value) || 15 })}
                              className="w-full bg-foreground/5 border border-foreground/15 rounded px-2 py-1 text-[13px] font-bold text-foreground focus:outline-none appearance-none cursor-pointer"
                            >
                              {MOMENT_DURATION_OPTIONS.map(m => (
                                <option key={m} value={m} className="text-black bg-white">
                                  {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''} (${m} min)` : `${m} min`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Genres */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">GENRES</span>
              <div className="flex flex-wrap gap-1.5">
                {MUSIC_GENRES.map(genre => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-[11px] font-bold uppercase border transition-all',
                      selectedGenres.includes(genre)
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-transparent text-foreground/70 border-foreground/20 hover:border-foreground/40'
                    )}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Requests */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">SPECIAL REQUESTS / SETLIST NOTES</span>
              <textarea
                value={specialRequests}
                onChange={e => setSpecialRequests(e.target.value)}
                placeholder="ANY SPECIAL MUSICAL REQUESTS OR MOMENTS..."
                rows={2}
                className="w-full bg-transparent border border-foreground/20 rounded-[10px] p-3 text-foreground text-[13px] font-bold placeholder:text-foreground/30 focus:outline-none uppercase"
              />
            </div>
          </div>
        </QuoteAccordionCard>

        {/* Accordion Card 3: Pricing, Expenses & Taxes */}
        <QuoteAccordionCard
          isOpen={!!expandedEditSections.pricing_billing}
          onToggle={() => toggleEditSection('pricing_billing')}
          stepNumber="03"
          title="PRICING, EXPENSES & TAXES"
          summary={`${currencySymbol}${totals.total.toLocaleString()} TOTAL (${currencySymbol}${baseFee.toLocaleString()} BASE)`}
          hasWarning={card3Warning}
          warningLabel="BASE FEE REQUIRED"
        >
          <div className="flex flex-col gap-6 pt-3">
            {/* Performance Base Fee */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[12px] font-bold uppercase tracking-wide text-foreground/50">BASE PERFORMANCE FEE</span>
                <div className="flex items-center gap-1">
                  <span className="text-foreground/40 text-[28px] font-bold">{currencySymbol}</span>
                  <input
                    type="number"
                    value={baseFee || ''}
                    onChange={e => setBaseFee(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-transparent text-[36px] font-bold text-foreground placeholder:text-foreground/20 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {musiciansTotal > 0 && baseFee !== musiciansTotal && (
                    <button
                      type="button"
                      onClick={() => setBaseFee(musiciansTotal)}
                      className="text-[11px] font-bold text-foreground/50 underline decoration-foreground/20 hover:text-foreground transition-colors"
                    >
                      Use lineup total ({currencySymbol}{musiciansTotal})
                    </button>
                  )}
                  {selectedMomentsTotal > 0 && baseFee !== selectedMomentsTotal && (
                    <button
                      type="button"
                      onClick={() => setBaseFee(selectedMomentsTotal)}
                      className="text-[11px] font-bold text-foreground/50 underline decoration-foreground/20 hover:text-foreground transition-colors"
                    >
                      Use moments total ({currencySymbol}{selectedMomentsTotal})
                    </button>
                  )}
                </div>
              </div>
              <DotCheckbox checked={baseFee > 0} activeColor="var(--accent-quote)" inactiveColor="var(--border)" />
            </div>

            <div className="h-px bg-foreground/10" />

            {/* Additional Fees */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase text-foreground/50">ADDITIONAL FEES & EXPENSES</span>
              <FeeRow label="TRAVEL" tag="TRAVEL & LOGISTICS" included={travelIncluded} onToggle={() => setTravelIncluded(!travelIncluded)} fee={travelFee} onFeeChange={setTravelFee} currencySymbol={currencySymbol} />
              <FeeRow label="ACCOMMODATION" tag="TRAVEL & LOGISTICS" included={!accommodationNeeded} onToggle={() => setAccommodationNeeded(!accommodationNeeded)} fee={accommodationFee} onFeeChange={setAccommodationFee} currencySymbol={currencySymbol} />
              <FeeRow label="MEALS" tag="TRAVEL & LOGISTICS" included={mealsIncluded} onToggle={() => setMealsIncluded(!mealsIncluded)} fee={mealsFee} onFeeChange={setMealsFee} currencySymbol={currencySymbol} />
              <FeeRow label="EQUIPMENT" tag="TECHNICAL" included={soundIncluded && lightsIncluded && backlineIncluded} onToggle={() => { setSoundIncluded(!soundIncluded); setLightsIncluded(!lightsIncluded); setBacklineIncluded(!backlineIncluded); }} fee={soundFee + lightsFee + backlineFee} onFeeChange={(v) => { setSoundFee(v); setLightsFee(0); setBacklineFee(0); }} currencySymbol={currencySymbol} />
            </div>

            {/* Custom Fees */}
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold uppercase text-foreground/50">CUSTOM FEES</span>
              {customItems.map((item, i) => (
                <div key={item.id || i} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={item.name || item.description}
                    onChange={(e) => setCustomItems(prev => prev.map((ci, idx) => idx === i ? { ...ci, name: e.target.value, description: e.target.value } : ci))}
                    placeholder="Fee name..."
                    className="flex-1 bg-foreground/10 rounded-[8px] px-3 py-2 text-[13px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-foreground/50 font-bold text-sm">{currencySymbol}</span>
                    <input
                      type="number"
                      value={item.amount || ''}
                      onChange={(e) => setCustomItems(prev => prev.map((ci, idx) => idx === i ? { ...ci, amount: parseFloat(e.target.value) || 0 } : ci))}
                      placeholder="0"
                      className="bg-foreground/10 rounded-[8px] px-3 py-2 text-[13px] font-bold text-foreground focus:outline-none w-24"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomItems(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-foreground/30 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCustomItems(prev => [...prev, { id: `custom-${Date.now()}`, description: '', amount: 0, quantity: 1 }])}
                className="flex items-center gap-2 text-[12px] font-bold text-foreground/50 uppercase hover:text-foreground transition-colors self-start"
              >
                <Plus className="w-4 h-4" /> Add Custom Fee
              </button>
            </div>

            <div className="h-px bg-foreground/10" />

            {/* Tax & VAT */}
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold uppercase text-foreground/50">TAX & VAT</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVatExempt(!vatExempt)}
                  className={cn('px-3 py-1.5 rounded-[6px] text-[12px] font-bold uppercase border transition-all',
                    vatExempt ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
                  )}
                >
                  VAT EXEMPT
                </button>
                <button
                  type="button"
                  onClick={() => setReverseCharge(!reverseCharge)}
                  className={cn('px-3 py-1.5 rounded-[6px] text-[12px] font-bold uppercase border transition-all',
                    reverseCharge ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
                  )}
                >
                  REVERSE CHARGE
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-1">
                <QuoteField label="BILLING COUNTRY">
                  <select
                    value={billingCountry}
                    onChange={e => setBillingCountry(e.target.value)}
                    className="w-full bg-transparent text-[16px] font-bold text-foreground focus:outline-none appearance-none uppercase"
                  >
                    {Object.keys(VAT_RATES).map(code => (
                      <option key={code} value={code} className="text-black">{VAT_RATES[code].name.toUpperCase()}</option>
                    ))}
                  </select>
                </QuoteField>
                <QuoteField label="VAT / FISCAL NUMBER">
                  <input
                    type="text"
                    value={vatNumber}
                    onChange={e => setVatNumber(e.target.value)}
                    placeholder="OPTIONAL"
                    className="w-full bg-transparent text-[16px] font-bold text-foreground placeholder:text-foreground/30 focus:outline-none uppercase"
                  />
                </QuoteField>
              </div>
            </div>

            {/* Live Totals Bar */}
            <div className="rounded-[12px] bg-foreground/5 border border-foreground/10 p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase text-foreground/50">SUBTOTAL + TAX</span>
                <span className="text-[12px] font-bold text-foreground/70">{currencySymbol}{totals.subtotal.toLocaleString()} + {currencySymbol}{totals.vatAmount.toFixed(0)} ({vatRate}%)</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase text-foreground/50 block">ESTIMATED TOTAL</span>
                <span className="text-[24px] font-black text-foreground">{currencySymbol}{totals.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </QuoteAccordionCard>

        {/* Accordion Card 4: Terms, Deposit & Notes */}
        <QuoteAccordionCard
          isOpen={!!expandedEditSections.terms_notes}
          onToggle={() => toggleEditSection('terms_notes')}
          stepNumber="04"
          title="TERMS, DEPOSIT & NOTES"
          summary={`DP ${depositPercentage}% • ${paymentMethods.length} METHODS • ${cancellationPolicy.toUpperCase()}`}
          hasWarning={card4Warning}
          warningLabel="SELECT PAYMENT METHOD"
        >
          <div className="flex flex-col gap-6 pt-3">
            {/* Validity */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase text-foreground/50">QUOTE VALIDITY</span>
              <div className="flex flex-wrap gap-2">
                {VALIDITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setValidityDays(opt.value)}
                    className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                      validityDays === opt.value ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase text-foreground/50">DEPOSIT PERCENTAGE</span>
              <div className="flex flex-wrap gap-2">
                {DEPOSIT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDepositPercentage(opt.value)}
                    className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                      depositPercentage === opt.value ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Methods */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase text-foreground/50">PAYMENT METHODS</span>
              <div className="flex flex-wrap gap-2">
                {(['bank_transfer', 'credit_card', 'paypal', 'cash'] as PaymentMethod[]).map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => togglePaymentMethod(method)}
                    className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                      paymentMethods.includes(method) ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
                    )}
                  >
                    {method.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Cancellation Policy */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase text-foreground/50">CANCELLATION POLICY</span>
              <div className="flex flex-wrap gap-2">
                {(['flexible', 'moderate', 'strict'] as CancellationPolicy[]).map(policy => (
                  <button
                    key={policy}
                    type="button"
                    onClick={() => setCancellationPolicy(policy)}
                    className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                      cancellationPolicy === policy ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/50 border-foreground/20'
                    )}
                  >
                    {policy}
                  </button>
                ))}
              </div>
            </div>

            {/* Client Notes */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase text-foreground/50">CLIENT NOTES (VISIBLE ON QUOTE)</span>
              <textarea
                value={clientNotes}
                onChange={e => setClientNotes(e.target.value)}
                placeholder="ANY NOTES TO INCLUDE IN THE QUOTE..."
                rows={2}
                className="w-full bg-transparent border border-foreground/20 rounded-[10px] p-3 text-foreground text-[13px] font-bold placeholder:text-foreground/30 focus:outline-none uppercase"
              />
            </div>

            {/* Internal Notes */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase text-foreground/50">INTERNAL BAND NOTES (PRIVATE)</span>
              <textarea
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                placeholder="PRIVATE BAND NOTES..."
                rows={2}
                className="w-full bg-transparent border border-foreground/20 rounded-[10px] p-3 text-foreground text-[13px] font-bold placeholder:text-foreground/30 focus:outline-none uppercase"
              />
            </div>
          </div>
        </QuoteAccordionCard>
      </div>
    );
  };

  // === MAIN RENDER (EDIT ACCORDION MODE) ===
  if (isEditing) {
    return (
      <motion.div
        data-modal-open="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <WizardAccentRail color={activeAccentColor} />

        {/* Header */}
        <div className="px-5 pt-6 pb-4 flex flex-col gap-2 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: activeAccentColor, color: 'var(--accent-quote-fg)' }}
                  className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                >
                  {initialData?.quoteNumber || 'EDIT QUOTE'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/40">
                  ALL-IN-ONE ACCORDION
                </span>
              </div>
              <h2 className="text-[28px] font-black text-foreground uppercase leading-none truncate max-w-[280px]">
                {eventName || clientName || 'EDIT QUOTE'}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleAllSections}
                className="px-3 py-1.5 rounded-full border border-foreground/20 text-[11px] font-bold uppercase tracking-wider text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                {allSectionsExpanded ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Accordion Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 min-h-0">
          {renderEditAccordionView()}
        </div>

        {/* Sticky Footer for Edit */}
        <div className="px-5 pt-4 pb-8 shrink-0 bg-background/95 backdrop-blur-md border-t border-foreground/15 rounded-t-[26px] shadow-[0px_-4px_20px_rgba(0,0,0,0.15)] flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">TOTAL ESTIMATE</span>
              <span className="text-[12px] font-bold text-foreground/60">{currencySymbol}{totals.subtotal.toLocaleString()} + {currencySymbol}{totals.vatAmount.toFixed(0)} VAT</span>
            </div>
            <span className="text-[28px] font-black text-foreground">{currencySymbol}{totals.total.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="bg-foreground/10 hover:bg-foreground/15 rounded-[12px] py-3.5 flex items-center justify-center transition-colors"
            >
              <span className="text-[14px] font-bold text-foreground uppercase">CANCEL</span>
            </button>
            <button
              type="button"
              onClick={() => handleCreate(false)}
              className="bg-foreground/15 hover:bg-foreground/20 rounded-[12px] py-3.5 flex items-center justify-center transition-colors"
            >
              <span className="text-[14px] font-bold text-foreground uppercase">SAVE CHANGES</span>
            </button>
            <button
              type="button"
              onClick={() => handleCreate(true)}
              style={{ backgroundColor: activeAccentColor, color: 'var(--accent-quote-fg)' }}
              className="rounded-[12px] py-3.5 flex items-center justify-center gap-1.5 font-bold shadow-lg shadow-black/20 hover:opacity-95 transition-opacity"
            >
              <span className="text-[14px] font-bold uppercase">SEND</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // === MAIN RENDER (WIZARD MODE) ===
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <WizardAccentRail color={activeAccentColor} />

      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex flex-col gap-3 shrink-0 relative z-20">
        <InteractiveQuoteStepIndicator
          current={step}
          total={STEPS.length}
          steps={STEPS}
          maxAccessibleStep={maxAccessibleStep}
          onSelectStep={(targetStep) => setStep(targetStep)}
          activeColor={activeAccentColor}
        />
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-foreground/50 uppercase">
              STEP {String(step + 1).padStart(2, '0')} • {STEPS[step].subtitle}
            </span>
            <h2 className="text-[32px] font-bold text-foreground uppercase leading-none">
              {STEPS[step].title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canSaveDraft && step < STEPS.length - 1 && (
              <button
                type="button"
                onClick={() => handleCreate(false)}
                style={{ borderColor: activeAccentColor, color: activeAccentColor }}
                className="px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider hover:bg-foreground/5 transition-all flex items-center gap-1.5 shrink-0"
                title="Save current progress as a draft quote"
              >
                <Zap className="w-3.5 h-3.5" />
                SAVE DRAFT
              </button>
            )}
            <button
              onClick={onClose}
              className="w-[46px] h-[46px] rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div
        className="px-4 pt-5 pb-[30px] shrink-0 relative z-20 bg-background/95 backdrop-blur-md border-t border-foreground/15 rounded-t-[26px] shadow-[0px_-4px_20px_rgba(0,0,0,0.15)]"
      >
        {step === STEPS.length - 1 ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleCreate(false)}
                className="bg-foreground/10 hover:bg-foreground/15 rounded-[10px] py-4 flex items-center justify-center gap-2 transition-colors"
              >
                <span className="text-[16px] font-bold text-foreground uppercase">SAVE DRAFT</span>
              </button>
              <button
                onClick={() => handleCreate(true)}
                style={{ backgroundColor: activeAccentColor, color: 'var(--accent-quote-fg)' }}
                className="rounded-[10px] py-4 flex items-center justify-center gap-2 font-bold shadow-lg shadow-black/20 hover:opacity-95 transition-opacity"
              >
                <span className="text-[16px] font-bold uppercase">SEND QUOTE</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-[12px] font-bold text-[var(--destructive)] uppercase text-center py-2 hover:opacity-80 transition-opacity"
            >
              DISCARD
            </button>
          </div>
        ) : step === 4 ? (
          /* Billing step footer with total */
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold text-foreground/60 uppercase">TOTAL + TAXES</span>
              <span className="text-[12px] font-bold text-foreground/40">{currencySymbol}{totals.subtotal}+{totals.vatAmount.toFixed(0)}</span>
              <span className="text-[32px] font-bold text-foreground">{currencySymbol}{totals.total.toFixed(0)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleBack}
                className="bg-foreground/10 hover:bg-foreground/15 rounded-[10px] py-4 flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" />
                <span className="text-[16px] font-bold text-foreground uppercase">BACK</span>
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                style={{
                  backgroundColor: canProceed() ? activeAccentColor : undefined,
                  color: canProceed() ? 'var(--accent-quote-fg)' : undefined,
                }}
                className={cn(
                  'rounded-[10px] py-4 flex items-center justify-center gap-2 transition-all font-bold text-[16px]',
                  canProceed() ? 'shadow-lg shadow-black/20 hover:opacity-95' : 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
                )}
              >
                <span className="uppercase">NEXT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {canSaveDraft && (
              <button
                type="button"
                onClick={() => handleCreate(false)}
                className="text-[12px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground text-center py-1 transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-[var(--accent-quote)]" />
                Save as Draft (Complete later)
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {step === 2 && selectedMusicians.length > 0 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-bold uppercase text-foreground/60">LINEUP TOTAL</span>
                <span className="text-[28px] font-bold text-foreground">{currencySymbol}{musiciansTotal}</span>
              </div>
            )}
            {step === 3 && musicalMoments.some(m => m.selected) && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-bold uppercase text-foreground/60">PARTIAL</span>
                <span className="text-[28px] font-bold text-foreground">{currencySymbol}{selectedMomentsTotal}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {step > 0 ? (
                <button
                  onClick={handleBack}
                  className="bg-foreground/10 hover:bg-foreground/15 rounded-[10px] py-4 flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-foreground" />
                  <span className="text-[16px] font-bold text-foreground uppercase">BACK</span>
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="bg-foreground/10 hover:bg-foreground/15 rounded-[10px] py-4 flex items-center justify-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                  <span className="text-[16px] font-bold text-foreground uppercase">CANCEL</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (step === 3 && baseFee === 0 && selectedMomentsTotal > 0) {
                    setBaseFee(selectedMomentsTotal);
                  }
                  handleNext();
                }}
                disabled={!canProceed()}
                style={{
                  backgroundColor: canProceed() ? activeAccentColor : undefined,
                  color: canProceed() ? 'var(--accent-quote-fg)' : undefined,
                }}
                className={cn(
                  'rounded-[10px] py-4 flex items-center justify-center gap-2 transition-all font-bold text-[16px]',
                  canProceed() ? 'shadow-lg shadow-black/20 hover:opacity-95' : 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
                )}
              >
                <span className="uppercase">NEXT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {canSaveDraft && (
              <button
                type="button"
                onClick={() => handleCreate(false)}
                className="text-[12px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground text-center py-1 transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-[var(--accent-quote)]" />
                Save as Draft (Complete later)
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
