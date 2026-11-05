import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Plane,
  Hotel,
  UtensilsCrossed,
  Volume2,
  Guitar,
  Heart,
  Wine,
  Utensils,
  Zap,
  Sparkles,
  Moon,
  Check,
  AlertCircle,
  Briefcase,
  Users,
  Mic2,
  Sliders,
  Music,
  Calendar,
  Clock,
  Edit3,
  CheckSquare,
  Layers,
  Euro,
  type LucideIcon,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { WizardAccentRail, getEventAccentColor } from '@/app/components/ui/WizardAccentRail';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { DatePicker } from '@/app/components/ui/DatePicker';
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
import { calculateTravelDistance } from '@/lib/services/location';

export interface QuoteBandMember {
  id: string;
  name: string;
  role: string;
  initials?: string;
  fee?: string;
  user_id?: string;
}

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
  {
    id: 'ceremony',
    name: 'CEREMONY',
    description: 'ENTRANCE, CEREMONY, EXIT',
    icon: Heart,
    basePrice: 1200,
    defaultMusicians: 3,
    defaultDuration: 30,
    instruments: ['Vocals', 'Guitar', 'Keys'],
    selected: false,
    customized: false,
  },
  {
    id: 'cocktail',
    name: 'COCKTAIL HOUR',
    description: 'BACKGROUND MUSIC',
    icon: Wine,
    basePrice: 500,
    defaultMusicians: 3,
    defaultDuration: 60,
    instruments: ['Vocals', 'Guitar', 'Keys'],
    selected: false,
    customized: false,
  },
  {
    id: 'dinner',
    name: 'DINNER',
    description: 'ELEGANT BACKGROUND',
    icon: Utensils,
    basePrice: 600,
    defaultMusicians: 4,
    defaultDuration: 90,
    instruments: ['Vocals', 'Guitar', 'Bass', 'Keys'],
    selected: false,
    customized: false,
  },
  {
    id: 'party',
    name: 'PARTY / DANCING',
    description: 'HIGH ENERGY SETS',
    icon: Zap,
    basePrice: 1200,
    defaultMusicians: 5,
    defaultDuration: 120,
    instruments: ['Vocals', 'Guitar', 'Bass', 'Keys', 'Drums'],
    selected: false,
    customized: false,
  },
  {
    id: 'first-dance',
    name: 'FIRST DANCE',
    description: 'SPECIAL MOMENT',
    icon: Sparkles,
    basePrice: 200,
    defaultMusicians: 2,
    defaultDuration: 15,
    instruments: ['Vocals', 'Guitar'],
    selected: false,
    customized: false,
  },
  {
    id: 'afterparty',
    name: 'AFTER PARTY',
    description: 'LATE NIGHT',
    icon: Moon,
    basePrice: 800,
    defaultMusicians: 4,
    defaultDuration: 90,
    instruments: ['Vocals', 'Guitar', 'Bass', 'Keys'],
    selected: false,
    customized: false,
  },
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

const STEPS = [
  { id: 'basics', title: 'EVENT & LINEUP' },
  { id: 'datetime', title: 'DATE & VENUE' },
  { id: 'review', title: 'REVIEW & CONFIRM' },
];

const EVENT_TYPE_OPTIONS: {
  value: QuoteEventType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'wedding', label: 'Wedding', subtitle: 'Ceremony, dinner & party', icon: Sparkles },
  { value: 'corporate', label: 'Corporate', subtitle: 'Company gala & summits', icon: Briefcase },
  { value: 'private', label: 'Private Party', subtitle: 'Birthdays & celebrations', icon: Users },
  { value: 'festival', label: 'Festival', subtitle: 'Open-air & main stages', icon: Music },
  { value: 'club', label: 'Club / Pub', subtitle: 'Live music & night venue', icon: Mic2 },
  { value: 'other', label: 'Other', subtitle: 'Tailored event setup', icon: Sliders },
];

const calcMusicianAutoFee = (
  musicianId: string,
  currentSelectedIds: string[],
  settings: BandPricingSettings,
  musiciansList: QuoteMusician[]
): number => {
  const member = musiciansList.find(m => m.id === musicianId || m.userId === musicianId);
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

// --- Interactive Step Indicator ---
const InteractiveQuoteStepIndicator: React.FC<{
  current: number;
  total: number;
  steps: { id: string; title: string }[];
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
                ? activeColor || 'var(--wizard-accent)'
                : isAccessible
                  ? activeColor || 'var(--wizard-accent)'
                  : inactiveColor || 'var(--border)',
              opacity: isCurrent ? 1 : isAccessible ? 0.4 : 0.15,
            }}
          />
          <div className="flex items-center gap-1 mt-1">
            <span
              className={cn(
                'text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap',
                isCurrent ? 'text-[var(--fg)]' : 'text-muted-foreground group-hover:text-[var(--fg)]'
              )}
            >
              STEP 0{i + 1}
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
    <div
      className={cn(
        'rounded-2xl border transition-all overflow-hidden',
        hasWarning
          ? 'border-[var(--warning)]/50 bg-[var(--warning)]/5'
          : isOpen
            ? 'border-border/60 bg-card/60'
            : 'border-border/40 bg-card hover:border-border/60'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {stepNumber}
            </span>
            <span className="text-base font-bold uppercase text-[var(--fg)]">{title}</span>
            {hasWarning && (
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-[var(--warning)]/15 text-[var(--warning)] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {warningLabel}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold uppercase text-muted-foreground truncate">
            {summary}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 w-8 h-8 rounded-full border border-border/40 flex items-center justify-center text-muted-foreground"
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
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-border/30 flex flex-col gap-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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

  const currencySymbol = useMemo(() => {
    if (pricingSettings.currency === 'USD') return '$';
    if (pricingSettings.currency === 'GBP') return '£';
    return '€';
  }, [pricingSettings.currency]);

  const availableMusicians = useMemo<QuoteMusician[]>(() => {
    if (bandMembers && bandMembers.length > 0) {
      return bandMembers.map(m => ({
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
      return selectedBand.members.map(m => ({
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

  const isEditing = Boolean(initialData?.id || initialData?.quoteNumber);

  // Accordion state for Edit mode
  const [expandedEditSections, setExpandedEditSections] = useState<Record<string, boolean>>({
    client_event: true,
    date_venue: false,
    lineup_moments: false,
    pricing_billing: false,
    terms_notes: false,
  });

  const toggleEditSection = (key: string) => {
    setExpandedEditSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Review step collapsibles in creation mode (all closed by default)
  const [isReviewMomentsExpanded, setIsReviewMomentsExpanded] = useState(false);
  const [isReviewBillingExpanded, setIsReviewBillingExpanded] = useState(false);
  const [isReviewTermsExpanded, setIsReviewTermsExpanded] = useState(false);

  // Lineup bar expansion in Step 1
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);

  // === FORM STATE ===
  const [clientName, setClientName] = useState(initialData?.clientName || initialClientName || '');
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '');
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '');
  const [phoneCountry, setPhoneCountry] = useState('IT');
  const [clientCompany, setClientCompany] = useState(initialData?.clientCompany || '');
  const [eventName, setEventName] = useState(initialData?.eventName || initialData?.eventTitle || '');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(Boolean(initialData?.eventName || initialData?.eventTitle));

  // Event type starts unselected unless initialData is provided
  const [eventType, setEventType] = useState<QuoteEventType | null>(initialData?.eventType || null);

  const activeAccentColor = useMemo(() => getEventAccentColor(eventType, 'quote'), [eventType]);

  const [eventDate, setEventDate] = useState(
    initialData?.eventDate || new Date().toISOString().split('T')[0]
  );
  const [eventTimeStart, setEventTimeStart] = useState(initialData?.eventTimeStart || '20:00');
  const [eventTimeEnd, setEventTimeEnd] = useState(initialData?.eventTimeEnd || '23:30');
  const [guestCount, setGuestCount] = useState<number | undefined>(initialData?.guestCount);
  const [venueName, setVenueName] = useState(initialData?.venueName || '');
  const [venueAddress, setVenueAddress] = useState(initialData?.venueAddress || '');
  const [venueCity, setVenueCity] = useState(initialData?.venueCity || '');
  const [venueCountry, setVenueCountry] = useState(initialData?.venueCountry || 'IT');
  const [indoorOutdoor, setIndoorOutdoor] = useState<'indoor' | 'outdoor'>(
    initialData?.indoorOutdoor || 'indoor'
  );

  const [musicalMoments, setMusicalMoments] = useState<MusicalMoment[]>(DEFAULT_MUSICAL_MOMENTS);
  const [performanceType, setPerformanceType] = useState<PerformanceType>(
    initialData?.performanceType || 'full_band'
  );
  const [setDuration, setSetDuration] = useState(initialData?.setDuration || 120);
  const [numberOfSets, setNumberOfSets] = useState(initialData?.numberOfSets || 2);
  const [breakDuration, setBreakDuration] = useState(initialData?.breakDuration || 15);

  const [selectedMusicians, setSelectedMusicians] = useState<QuoteMusician[]>(
    initialData?.musicians?.filter(m => !m.isExternal) || []
  );
  const [externalMusicians, setExternalMusicians] = useState<QuoteMusician[]>(
    initialData?.musicians?.filter(m => m.isExternal) || []
  );
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialData?.genres || []);
  const [specialRequests, setSpecialRequests] = useState(initialData?.specialRequests || '');

  // Billing & VAT
  const [billingCountry, setBillingCountry] = useState(initialData?.billingCountry || 'IT');
  const [vatNumber, setVatNumber] = useState(initialData?.vatNumber || '');
  const [fiscalCode, setFiscalCode] = useState(initialData?.fiscalCode || '');
  const [vatExempt, setVatExempt] = useState(initialData?.vatExempt || false);
  const [reverseCharge, setReverseCharge] = useState(initialData?.reverseCharge || false);
  const [baseFee, setBaseFee] = useState(initialData?.baseFee || 0);
  const [travelIncluded, setTravelIncluded] = useState(
    initialData?.travelIncluded !== undefined ? initialData.travelIncluded : true
  );
  const [travelFee, setTravelFee] = useState(initialData?.travelFee || 0);
  const [travelDistanceKm, setTravelDistanceKm] = useState<number | undefined>(
    initialData?.travelDistanceKm
  );
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  const [accommodationNeeded, setAccommodationNeeded] = useState(
    initialData?.accommodationNeeded || false
  );
  const [accommodationFee, setAccommodationFee] = useState(initialData?.accommodationFee || 0);
  const [mealsIncluded, setMealsIncluded] = useState(
    initialData?.mealsIncluded !== undefined ? initialData.mealsIncluded : true
  );
  const [mealsFee, setMealsFee] = useState(initialData?.mealsFee || 0);
  const [soundIncluded, setSoundIncluded] = useState(
    initialData?.soundIncluded !== undefined ? initialData.soundIncluded : true
  );
  const [soundFee, setSoundFee] = useState(initialData?.soundFee || 0);
  const [lightsIncluded, setLightsIncluded] = useState(
    initialData?.lightsIncluded !== undefined ? initialData.lightsIncluded : true
  );
  const [lightsFee, setLightsFee] = useState(initialData?.lightsFee || 0);
  const [backlineIncluded, setBacklineIncluded] = useState(
    initialData?.backlineIncluded !== undefined ? initialData.backlineIncluded : true
  );
  const [backlineFee, setBacklineFee] = useState(initialData?.backlineFee || 0);
  const [customItems, setCustomItems] = useState<QuoteCustomItem[]>(initialData?.customItems || []);
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>(
    initialData?.discountType || 'none'
  );
  const [discountValue, setDiscountValue] = useState(initialData?.discountValue || 0);
  const [discountReason, setDiscountReason] = useState(initialData?.discountReason || '');
  const [validityDays, setValidityDays] = useState(30);
  const [depositRequired, setDepositRequired] = useState(
    initialData?.depositRequired !== undefined ? initialData.depositRequired : true
  );
  const [depositPercentage, setDepositPercentage] = useState(initialData?.depositPercentage || 30);
  const [depositDueDate, setDepositDueDate] = useState(
    initialData?.depositDueDate || 'on_acceptance'
  );
  const [balanceDueDate, setBalanceDueDate] = useState(
    initialData?.balanceDueDate || '7_days_after'
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    initialData?.paymentMethods || ['bank_transfer']
  );
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(
    initialData?.cancellationPolicy || 'moderate'
  );
  const [cancellationTerms, setCancellationTerms] = useState(initialData?.cancellationTerms || '');
  const [clientNotes, setClientNotes] = useState(initialData?.clientNotes || '');
  const [internalNotes, setInternalNotes] = useState(initialData?.internalNotes || '');

  // Load Pricing Settings
  const hasInitializedPricingRef = useRef(false);

  useEffect(() => {
    if (!selectedBand?.id) return;
    let isCancelled = false;

    getBandPricing(selectedBand.id).then(settings => {
      if (isCancelled) return;
      setPricingSettings(settings);

      setMusicalMoments(prev =>
        prev.map(m => {
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

      if (
        !hasInitializedPricingRef.current &&
        !initialData?.baseFee &&
        (!initialData?.musicians || initialData.musicians.length === 0)
      ) {
        hasInitializedPricingRef.current = true;
        if (availableMusicians.length > 0) {
          const firstMusician = availableMusicians[0];
          const autoFee = calcMusicianAutoFee(firstMusician.id, [], settings, availableMusicians);
          const initialList = [{ ...firstMusician, fee: autoFee }];
          setSelectedMusicians(initialList);
          setBaseFee(autoFee);
        } else {
          const calculatedBase =
            (settings.core_members_count ?? 1) * (settings.core_member_rate || 300);
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
  }, [selectedBand?.id, availableMusicians, initialData?.baseFee, initialData?.musicians]);

  // Travel calculation
  const handleCalculateDistance = async (venueLoc: string) => {
    const originAddress = pricingSettings.band_origin_address || (selectedBand as any)?.location || (selectedBand as any)?.address;
    if (!venueLoc || !originAddress) return;
    setIsCalculatingDistance(true);
    try {
      const origin = typeof originAddress === 'string' ? { address: originAddress } : originAddress;
      const distResult = await calculateTravelDistance(origin, { address: venueLoc });
      if (distResult != null) {
        setTravelDistanceKm(distResult.distanceKm);
        const ratePerKm = pricingSettings.travel_rate_per_km || 0.5;
        const autoTravelFee = Math.round(distResult.distanceKm * 2 * ratePerKm);
        setTravelFee(autoTravelFee);
        setTravelIncluded(false);
      }
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Totals
  const vatRate = useMemo(() => {
    return calculateVAT(
      billingCountry,
      'IT',
      Boolean(vatNumber),
      Boolean(clientCompany),
      vatExempt,
      reverseCharge
    );
  }, [billingCountry, vatNumber, clientCompany, vatExempt, reverseCharge]);

  const allMusicians = useMemo(
    () => [...selectedMusicians, ...externalMusicians],
    [selectedMusicians, externalMusicians]
  );

  const musiciansTotal = useMemo(() => {
    return selectedMusicians.reduce((sum, m) => sum + (m.fee || 0), 0);
  }, [selectedMusicians]);

  const selectedMomentsTotal = useMemo(
    () =>
      musicalMoments
        .filter(m => m.selected)
        .reduce((sum, m) => sum + (m.customPrice ?? m.basePrice), 0),
    [musicalMoments]
  );

  const customItemsTotal = useMemo(
    () => customItems.reduce((sum, item) => sum + (item.price ?? item.amount ?? 0) * item.quantity, 0),
    [customItems]
  );

  const totals = useMemo(() => {
    const effectiveBase =
      baseFee > 0
        ? baseFee
        : selectedMomentsTotal > 0
          ? selectedMomentsTotal
          : musiciansTotal > 0
            ? musiciansTotal
            : 0;
    return calculateQuoteTotals(
      effectiveBase,
      travelIncluded ? 0 : travelFee,
      accommodationNeeded ? accommodationFee : 0,
      mealsIncluded ? 0 : mealsFee,
      soundIncluded ? 0 : soundFee,
      lightsIncluded ? 0 : lightsFee,
      backlineIncluded ? 0 : backlineFee,
      customItems,
      discountType,
      discountValue,
      vatRate,
      vatExempt,
      reverseCharge
    );
  }, [
    baseFee,
    selectedMomentsTotal,
    musiciansTotal,
    travelIncluded,
    travelFee,
    accommodationNeeded,
    accommodationFee,
    mealsIncluded,
    mealsFee,
    soundIncluded,
    soundFee,
    lightsIncluded,
    lightsFee,
    backlineIncluded,
    backlineFee,
    customItems,
    discountType,
    discountValue,
    vatRate,
    vatExempt,
    reverseCharge,
  ]);

  const validUntilDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + validityDays);
    return date.toISOString().split('T')[0];
  }, [validityDays]);

  const calculatedDurationBadge = useMemo(() => {
    if (!eventTimeStart || !eventTimeEnd) return `${setDuration}m`;
    const [sh, sm] = eventTimeStart.split(':').map(Number);
    const [eh, em] = eventTimeEnd.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return `${setDuration}m`;
    let totalMinutes = eh * 60 + em - (sh * 60 + sm);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    if (totalMinutes === 0) return `${setDuration}m`;
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }, [eventTimeStart, eventTimeEnd, setDuration]);

  const formattedDateStr = useMemo(() => {
    if (!eventDate) return 'DATE TBD';
    const d = new Date(eventDate + 'T00:00:00');
    if (isNaN(d.getTime())) return eventDate;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [eventDate]);

  const getEffectiveTitle = useCallback(() => {
    if (eventName.trim()) return eventName.trim();
    if (clientName.trim()) {
      return eventType
        ? `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} - ${clientName.trim()}`
        : `Quote - ${clientName.trim()}`;
    }
    return eventType
      ? `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Quote`
      : 'New Quote';
  }, [eventName, clientName, eventType]);

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return STEPS.length - 1;
    if (!eventType) return 0;
    if (!eventDate) return 1;
    return STEPS.length - 1;
  }, [isEditing, eventType, eventDate]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return eventType !== null;
      case 1:
        return Boolean(eventDate);
      case 2:
        return true;
      default:
        return true;
    }
  }, [step, eventType, eventDate]);

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleCreate(true);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
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
    const targetIds = target.map(m => m.id);
    const updated = target.map((m, idx) => {
      const fee = getAutoFeeForMusician(m.id, targetIds.slice(0, idx), pricingSettings, m);
      return { ...m, fee };
    });
    setSelectedMusicians(updated);
    const total = updated.reduce((sum, m) => sum + (m.fee || 0), 0);
    setBaseFee(total);
  };

  const toggleMusician = (musician: QuoteMusician) => {
    const isSelected = selectedMusicians.some(m => m.id === musician.id);
    let updated: QuoteMusician[];
    if (isSelected) {
      updated = selectedMusicians.filter(m => m.id !== musician.id);
    } else {
      const currentIds = selectedMusicians.map(m => m.id);
      const autoFee = getAutoFeeForMusician(musician.id, currentIds, pricingSettings, musician);
      updated = [...selectedMusicians, { ...musician, fee: autoFee }];
    }
    setSelectedMusicians(updated);
    const total = updated.reduce((sum, m) => sum + (m.fee || 0), 0);
    setBaseFee(total);
  };

  const updateMusicianFee = (musicianId: string, fee: number) => {
    setSelectedMusicians(prev => {
      const updated = prev.map(m => (m.id === musicianId ? { ...m, fee } : m));
      const total = updated.reduce((sum, m) => sum + (m.fee || 0), 0);
      setBaseFee(total);
      return updated;
    });
  };

  const toggleMoment = (momentId: string) => {
    setMusicalMoments(prev =>
      prev.map(m => (m.id === momentId ? { ...m, selected: !m.selected } : m))
    );
  };

  const updateMoment = (momentId: string, updates: Partial<MusicalMoment>) => {
    setMusicalMoments(prev =>
      prev.map(m => (m.id === momentId ? { ...m, ...updates, customized: true } : m))
    );
  };

  const handleCreate = (sendImmediately = true) => {
    const finalEventName = getEffectiveTitle();
    const finalClientName = clientName.trim() || 'Client';

    const quoteData: Partial<Quote> = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      quoteNumber: initialData?.quoteNumber || generateQuoteNumber(),
      status: sendImmediately ? 'SENT' : (initialData?.status || 'DRAFT'),
      clientName: finalClientName,
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientCompany: clientCompany.trim() || undefined,
      eventName: finalEventName,
      eventType: (eventType || 'other') as QuoteEventType,
      eventDate: eventDate || new Date().toISOString().split('T')[0],
      eventTimeStart: eventTimeStart || '20:00',
      eventTimeEnd: eventTimeEnd || undefined,
      guestCount,
      venueName: venueName || 'TBD',
      venueAddress: venueAddress || undefined,
      venueCity: venueCity || undefined,
      venueCountry,
      indoorOutdoor,
      performanceType,
      setDuration,
      numberOfSets,
      breakDuration,
      musicians: allMusicians,
      genres: selectedGenres,
      specialRequests: specialRequests || undefined,
      billingCountry,
      vatNumber: vatNumber || undefined,
      fiscalCode: fiscalCode || undefined,
      vatRate,
      vatExempt,
      reverseCharge,
      currency: pricingSettings.currency || 'EUR',
      baseFee:
        baseFee > 0
          ? baseFee
          : musiciansTotal > 0
            ? musiciansTotal
            : selectedMomentsTotal > 0
              ? selectedMomentsTotal
              : 1000,
      travelIncluded,
      travelFee: travelIncluded ? 0 : travelFee,
      travelDistanceKm,
      accommodationNeeded,
      accommodationFee: accommodationNeeded ? accommodationFee : 0,
      mealsIncluded,
      mealsFee: mealsIncluded ? 0 : mealsFee,
      soundIncluded,
      soundFee: soundIncluded ? 0 : soundFee,
      lightsIncluded,
      lightsFee: lightsIncluded ? 0 : lightsFee,
      backlineIncluded,
      backlineFee: backlineIncluded ? 0 : backlineFee,
      customItems,
      discountType,
      discountValue,
      discountReason: discountReason || undefined,
      ...totals,
      validUntil: validUntilDate,
      depositRequired,
      depositPercentage,
      depositDueDate,
      balanceDueDate,
      paymentMethods,
      cancellationPolicy,
      cancellationTerms: cancellationTerms || undefined,
      clientNotes: clientNotes || undefined,
      internalNotes: internalNotes || undefined,
      sentAt: sendImmediately ? new Date().toISOString() : initialData?.sentAt,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventTitle: finalEventName,
    };
    onCreate(quoteData);
  };

  // ── STEP 01: EVENT & LINEUP ─────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Client & Occasion Inputs (2-Column) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            EVENT TITLE <span className="text-xs font-normal text-muted-foreground/60 lowercase">(optional)</span>
          </label>
          <input
            type="text"
            value={eventName}
            onChange={e => {
              setEventName(e.target.value);
              setTitleManuallyEdited(true);
            }}
            placeholder={getEffectiveTitle()}
            className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            CLIENT NAME <span className="text-xs font-normal text-muted-foreground/60 lowercase">(optional)</span>
          </label>
          <input
            type="text"
            value={clientName}
            onChange={e => {
              const val = e.target.value;
              setClientName(val);
              if (!titleManuallyEdited) {
                const typeLabel = eventType ? eventType.charAt(0).toUpperCase() + eventType.slice(1) : 'Wedding';
                const title = val ? `${typeLabel} - ${val}` : '';
                setEventName(title);
              }
            }}
            placeholder="e.g. Paolo Rossi"
            className="w-full bg-transparent border-b border-border/40 pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Event Type Grid (Compact 2-Column with Lucide icons) */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2.5">
          EVENT TYPE
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {EVENT_TYPE_OPTIONS.map(opt => {
            const isSelected = eventType === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setEventType(opt.value);
                  if (!titleManuallyEdited) {
                    const typeLabel = opt.value.charAt(0).toUpperCase() + opt.value.slice(1);
                    const title = clientName ? `${typeLabel} - ${clientName}` : '';
                    setEventName(title);
                  }
                }}
                className={cn(
                  'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2',
                  isSelected
                    ? 'bg-[var(--wizard-accent)]/10 border-[var(--wizard-accent)] shadow-xs'
                    : 'bg-card/60 border-border/40 hover:border-border hover:bg-card'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isSelected ? 'bg-[var(--wizard-accent)] text-white' : 'bg-muted/60 text-muted-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[var(--fg)] leading-tight">{opt.label}</div>
                    <div className="text-xs text-muted-foreground truncate leading-snug mt-0.5">{opt.subtitle}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contact Details (2-Column) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            CLIENT EMAIL <span className="text-xs font-normal text-muted-foreground/60 lowercase">(optional)</span>
          </label>
          <div className="relative">
            <input
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full bg-transparent border-b border-border/40 pb-2 pl-7 text-sm font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
            />
            <Mail className="w-4 h-4 text-muted-foreground absolute left-0 bottom-3" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            CLIENT PHONE <span className="text-xs font-normal text-muted-foreground/60 lowercase">(optional)</span>
          </label>
          <div className="relative">
            <input
              type="tel"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="+39 333 1234567"
              className="w-full bg-transparent border-b border-border/40 pb-2 pl-7 text-sm font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
            />
            <Phone className="w-4 h-4 text-muted-foreground absolute left-0 bottom-3" />
          </div>
        </div>
      </div>

      {/* Collapsible Lineup & Pay Summary Bar */}
      <div className="space-y-3 pt-1">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              LINEUP PRESETS
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {selectedMusicians.length} of {availableMusicians.length} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'SOLO', type: 'solo' as PerformanceType },
              { label: 'DUO', type: 'duo' as PerformanceType },
              { label: 'TRIO', type: 'trio' as PerformanceType },
              { label: 'FULL BAND', type: 'full_band' as PerformanceType },
            ].map(preset => {
              const isPresetActive = performanceType === preset.type;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => selectPresetLineup(preset.type)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                    isPresetActive
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-xs'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Interactive Summary Card */}
        <div className="bg-card border border-border/40 rounded-xl p-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
              {selectedMusicians.slice(0, 5).map(m => (
                <div
                  key={m.id}
                  className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center border-2 border-card bg-foreground text-background"
                  title={m.name}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
              ))}
              {selectedMusicians.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center border-2 border-card">
                  +{selectedMusicians.length - 5}
                </div>
              )}
            </div>

            <div className="min-w-0 flex flex-col">
              <span className="text-sm font-semibold text-[var(--fg)] truncate">
                {selectedMusicians.length} of {availableMusicians.length} Musicians
              </span>
              {musiciansTotal > 0 && (
                <span className="text-xs font-bold text-[var(--wizard-accent)]">
                  {currencySymbol}{musiciansTotal} lineup fee
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRosterExpanded(!isRosterExpanded)}
            className="text-xs font-bold text-[var(--wizard-accent)] hover:opacity-80 flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
          >
            <span>{isRosterExpanded ? 'Done' : 'Customize'}</span>
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', isRosterExpanded && 'rotate-180')}
            />
          </button>
        </div>

        {/* Expanded 1-Column Musician Checklist with inline fees */}
        <AnimatePresence>
          {isRosterExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-3 pt-1"
            >
              <div className="divide-y divide-border/30 border-y border-border/30">
                {availableMusicians.map(musician => {
                  const isSelected = selectedMusicians.some(m => m.id === musician.id);
                  const currentMusician = selectedMusicians.find(m => m.id === musician.id);

                  return (
                    <div
                      key={musician.id}
                      className="flex items-center justify-between py-2.5 px-2 hover:bg-card/60 transition-colors rounded-lg"
                    >
                      <div
                        onClick={() => toggleMusician(musician)}
                        className="flex items-center gap-3 min-w-0 flex-1 pr-3 cursor-pointer"
                      >
                        <DotCheckbox
                          checked={isSelected}
                          activeColor="var(--wizard-accent)"
                          inactiveColor="var(--border)"
                        />
                        <div className="min-w-0">
                          <span
                            className={cn(
                              'text-sm font-medium truncate block leading-normal',
                              isSelected ? 'text-[var(--fg)] font-semibold' : 'text-muted-foreground'
                            )}
                          >
                            {musician.name}
                          </span>
                          <span className="text-xs text-muted-foreground uppercase tracking-wider block leading-normal">
                            {musician.instrument || 'Musician'}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-xs font-bold text-muted-foreground">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            value={currentMusician?.fee || ''}
                            onChange={e =>
                              updateMusicianFee(musician.id, parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-20 bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-2 py-1 text-right text-xs font-bold text-[var(--fg)] placeholder:text-muted-foreground/40 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ── STEP 02: DATE & VENUE ───────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Unified Venue Input */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
          VENUE / LOCATION
        </label>
        <div className="relative">
          <VenueAutocomplete
            value={venueName}
            onChange={val => setVenueName(val)}
            onSelect={place => {
              setVenueName(place.name);
              if (place.address) setVenueAddress(place.address);
              if (place.city) setVenueCity(place.city);
              if (place.country) setVenueCountry(place.country);
              handleCalculateDistance(place.name || place.city || '');
            }}
            placeholder="Search venue or location..."
            className="w-full bg-transparent border-b border-border/40 focus:border-[var(--wizard-accent)] pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:outline-none transition-colors pl-7"
          />
          <MapPin className="w-4 h-4 text-muted-foreground absolute left-0 bottom-3" />
        </div>

        {/* Quick-select chips */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {['TBD', 'Main Stage', 'Private Venue'].map(loc => (
            <button
              key={loc}
              type="button"
              onClick={() => {
                setVenueName(loc);
                if (loc !== 'TBD') handleCalculateDistance(loc);
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border',
                venueName === loc
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              {loc}
            </button>
          ))}
          {travelDistanceKm != null && travelDistanceKm > 0 && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted text-muted-foreground border border-border/40">
              {travelDistanceKm} km away {isCalculatingDistance && '...'}
            </span>
          )}
        </div>
      </div>

      {/* Date & Time Group */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
            EVENT DATE
          </label>
          <DatePicker
            value={eventDate}
            onChange={d => setEventDate(d)}
            accentColor={activeAccentColor}
            placeholder="Select event date..."
          />
        </div>

        {/* 2-Column Start Time and End Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
              START TIME
            </label>
            <TimePicker
              value={eventTimeStart}
              onChange={val => setEventTimeStart(val)}
              textSize="text-base"
              showIcon
              className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                END TIME
              </label>
              <span className="text-xs font-bold text-[var(--wizard-accent)]">
                {calculatedDurationBadge}
              </span>
            </div>
            <TimePicker
              value={eventTimeEnd}
              onChange={val => setEventTimeEnd(val)}
              textSize="text-base"
              showIcon
              className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 03: REVIEW & CONFIRM ───────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Unified Summary Card */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/40 space-y-4 shadow-2xs">
        {/* Badges & Title */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--wizard-accent)]/15 text-[var(--wizard-accent)]">
              QUOTE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
              {eventType ? eventType.toUpperCase() : 'EVENT'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
              {indoorOutdoor.toUpperCase()}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-muted-foreground">
              {currencySymbol}{totals.total.toLocaleString()} TOTAL
            </span>
          </div>
          <h3 className="text-xl font-bold text-[var(--fg)] tracking-tight">
            {getEffectiveTitle()}
          </h3>
          <span className="text-xs text-muted-foreground font-semibold block mt-0.5 uppercase">
            Client: {clientName.trim() || 'Client TBD'}
            {clientEmail ? ` • ${clientEmail}` : ''}
            {clientPhone ? ` • ${clientPhone}` : ''}
          </span>
        </div>

        {/* Date, Time, Duration */}
        <div className="flex items-start gap-3 text-sm text-[var(--fg)]">
          <Calendar className="w-4 h-4 text-[var(--wizard-accent)] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold block leading-normal">
              {eventDate ? formattedDateStr : 'Date TBD'}
            </span>
            <span className="text-xs text-muted-foreground font-medium block leading-normal">
              {eventTimeStart || '20:00'} – {eventTimeEnd || '23:30'} ({calculatedDurationBadge})
            </span>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-start gap-3 text-sm text-[var(--fg)]">
          <MapPin className="w-4 h-4 text-[var(--wizard-accent)] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold block truncate leading-normal">
              {venueName || 'Venue TBD'}
              {venueCity ? ` • ${venueCity}` : ''}
            </span>
          </div>
        </div>

        {/* Confirmed Musicians Avatar Stack */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-4 h-4 text-[var(--wizard-accent)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--fg)] truncate">
              {selectedMusicians.length} Musicians Selected
            </span>
          </div>
          <div className="flex -space-x-1.5 overflow-hidden shrink-0 ml-2">
            {selectedMusicians.slice(0, 6).map(m => (
              <div
                key={m.id}
                className="w-6 h-6 rounded-full bg-muted border-2 border-card text-xs font-bold flex items-center justify-center text-muted-foreground"
                title={m.name}
              >
                {m.name.slice(0, 2).toUpperCase()}
              </div>
            ))}
            {selectedMusicians.length > 6 && (
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-card text-xs font-bold flex items-center justify-center text-muted-foreground">
                +{selectedMusicians.length - 6}
              </div>
            )}
          </div>
        </div>

        {/* Jump Actions */}
        <div className="pt-3 border-t border-border/30 flex items-center justify-between text-xs font-bold text-[var(--wizard-accent)]">
          <button
            type="button"
            onClick={() => setStep(0)}
            className="hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Event & Lineup</span>
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Date & Venue</span>
          </button>
        </div>
      </div>

      {/* Accordion 1: Musical Moments & Add-ons (Optional) */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsReviewMomentsExpanded(!isReviewMomentsExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--fg)]">
                  Musical Moments & Add-ons
                </span>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Optional
                </span>
              </div>
              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                {musicalMoments.filter(m => m.selected).length} Moments • {customItems.length} Extras
                {selectedMomentsTotal > 0 ? ` • ${currencySymbol}${selectedMomentsTotal}` : ''}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              isReviewMomentsExpanded && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {isReviewMomentsExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {musicalMoments.map(moment => {
                  const Icon = moment.icon;
                  const price = moment.customPrice ?? moment.basePrice;
                  return (
                    <div
                      key={moment.id}
                      onClick={() => toggleMoment(moment.id)}
                      className={cn(
                        'p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer',
                        moment.selected
                          ? 'bg-[var(--wizard-accent)]/10 border-[var(--wizard-accent)] text-[var(--fg)]'
                          : 'bg-card border-border/40 text-muted-foreground hover:text-[var(--fg)]'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <DotCheckbox
                          checked={moment.selected}
                          activeColor="var(--wizard-accent)"
                          inactiveColor="var(--border)"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold uppercase truncate block text-[var(--fg)]">
                            {moment.name}
                          </span>
                          <span className="text-xs text-muted-foreground block truncate">
                            {moment.description}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold shrink-0 text-[var(--fg)]">
                        {currencySymbol}{price}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Add custom service item */}
              <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-muted-foreground">
                  Custom Add-ons
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCustomItems(prev => [
                      ...prev,
                      {
                        id: `item-${Date.now()}`,
                        name: 'Custom Service',
                        amount: 150,
                        price: 150,
                        quantity: 1,
                        taxable: true,
                      },
                    ])
                  }
                  className="text-xs font-bold text-[var(--wizard-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {customItems.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={item.name}
                    onChange={e =>
                      setCustomItems(prev =>
                        prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it))
                      )
                    }
                    className="flex-1 bg-card border border-border/40 rounded-lg px-2.5 py-1.5 text-xs text-[var(--fg)] focus:outline-none"
                    placeholder="Item name..."
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground font-bold">{currencySymbol}</span>
                    <input
                      type="number"
                      value={item.price ?? item.amount ?? 0}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setCustomItems(prev =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, price: val, amount: val } : it
                          )
                        );
                      }}
                      className="w-20 bg-card border border-border/40 rounded-lg px-2 py-1.5 text-right text-xs text-[var(--fg)] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomItems(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-muted-foreground hover:text-[var(--danger)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Accordion 2: Billing, VAT & Deposit (Optional) */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsReviewBillingExpanded(!isReviewBillingExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <Euro className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--fg)]">Billing, VAT & Deposit</span>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Optional
                </span>
              </div>
              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                Subtotal: {currencySymbol}{totals.subtotal.toLocaleString()} • VAT: {vatRate}% • Deposit: {depositPercentage}%
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              isReviewBillingExpanded && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {isReviewBillingExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 space-y-4 overflow-hidden"
            >
              {/* Base Fee Override */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    BASE FEE OVERRIDE
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Current: {currencySymbol}{baseFee}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-muted-foreground">{currencySymbol}</span>
                  <input
                    type="number"
                    value={baseFee || ''}
                    onChange={e => setBaseFee(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-24 bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-2.5 py-1.5 text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Deposit Percentage Pills */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  DEPOSIT REQUIRED
                </label>
                <div className="flex gap-2">
                  {[20, 30, 50].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDepositPercentage(pct)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center',
                        depositPercentage === pct
                          ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                          : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                      )}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Validity Days */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  QUOTE VALIDITY
                </label>
                <select
                  value={validityDays}
                  onChange={e => setValidityDays(parseInt(e.target.value) || 30)}
                  className="w-full bg-card border border-border/40 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--fg)] focus:outline-none cursor-pointer"
                >
                  {[7, 14, 30, 60, 90].map(days => (
                    <option key={days} value={days} className="bg-card text-[var(--fg)]">
                      {days} Days (until {validUntilDate})
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Accordion 3: Terms, Payment & Notes (Optional) */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsReviewTermsExpanded(!isReviewTermsExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--fg)]">Terms, Payment & Notes</span>
                <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Optional
                </span>
              </div>
              <span className="text-xs text-muted-foreground block truncate mt-0.5">
                {cancellationPolicy.toUpperCase()} • {paymentMethods.join(', ').toUpperCase()} •{' '}
                {clientNotes ? 'Notes added' : 'No notes'}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              isReviewTermsExpanded && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {isReviewTermsExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 space-y-4 overflow-hidden"
            >
              {/* Payment Methods */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  PAYMENT METHODS
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'bank_transfer', label: 'Bank Transfer' },
                    { id: 'credit_card', label: 'Credit Card' },
                    { id: 'cash', label: 'Cash' },
                    { id: 'paypal', label: 'PayPal' },
                  ].map(m => {
                    const isChecked = paymentMethods.includes(m.id as PaymentMethod);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setPaymentMethods(paymentMethods.filter(p => p !== m.id));
                          } else {
                            setPaymentMethods([...paymentMethods, m.id as PaymentMethod]);
                          }
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                          isChecked
                            ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                            : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cancellation Policy */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  CANCELLATION POLICY
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['flexible', 'moderate', 'strict'] as CancellationPolicy[]).map(pol => (
                    <button
                      key={pol}
                      type="button"
                      onClick={() => setCancellationPolicy(pol)}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer text-center',
                        cancellationPolicy === pol
                          ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                          : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                      )}
                    >
                      {pol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client Notes */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  CLIENT MESSAGE / NOTES
                </label>
                <textarea
                  value={clientNotes}
                  onChange={e => setClientNotes(e.target.value)}
                  placeholder="Notes or conditions visible on the quote document..."
                  rows={3}
                  className="w-full bg-background border border-border/40 focus:border-[var(--wizard-accent)] rounded-xl p-3 text-sm text-[var(--fg)] placeholder:text-muted-foreground focus:outline-none resize-none transition-colors"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ── ACCORDION EDIT VIEW (FOR isEditing === true) ─────────────
  const renderEditAccordionView = () => (
    <div className="flex flex-col gap-5">
      {/* Section 1: Client & Occasion */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.client_event)}
        onToggle={() => toggleEditSection('client_event')}
        stepNumber="01"
        title="CLIENT & OCCASION"
        summary={`${clientName || 'NO CLIENT'} • ${(eventType || 'event').toUpperCase()} • ${indoorOutdoor.toUpperCase()}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {EVENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEventType(value)}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-bold uppercase flex items-center gap-2 transition-all cursor-pointer',
                  eventType === value
                    ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                    : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                CLIENT NAME
              </label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full bg-transparent border-b border-border/40 pb-1.5 text-base font-bold uppercase text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                EVENT TITLE
              </label>
              <input
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder={getEffectiveTitle()}
                className="w-full bg-transparent border-b border-border/40 pb-1.5 text-base font-bold uppercase text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
              />
            </div>
          </div>
        </div>
      </QuoteAccordionCard>

      {/* Section 2: Date & Venue */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.date_venue)}
        onToggle={() => toggleEditSection('date_venue')}
        stepNumber="02"
        title="DATE & VENUE"
        summary={`${formattedDateStr} @ ${eventTimeStart} - ${eventTimeEnd} • ${venueName || 'VENUE TBD'}`}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
              VENUE NAME
            </label>
            <VenueAutocomplete
              value={venueName}
              onChange={val => setVenueName(val)}
              onSelect={place => {
                setVenueName(place.name);
                if (place.address) setVenueAddress(place.address);
                if (place.city) setVenueCity(place.city);
                handleCalculateDistance(place.name || place.city || '');
              }}
              placeholder="VENUE"
              className="w-full bg-transparent border-b border-border/40 pb-1.5 text-base font-bold uppercase text-[var(--fg)] focus:outline-none"
            />
          </div>

          {/* Date & Time Group */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
                EVENT DATE
              </label>
              <DatePicker
                value={eventDate}
                onChange={d => setEventDate(d)}
                accentColor={activeAccentColor}
                placeholder="Select event date..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                  START TIME
                </label>
                <TimePicker
                  value={eventTimeStart}
                  onChange={setEventTimeStart}
                  textSize="text-base"
                  showIcon
                  className="border-b border-border/40 pb-1.5 uppercase text-[var(--fg)]"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                  END TIME
                </label>
                <TimePicker
                  value={eventTimeEnd}
                  onChange={setEventTimeEnd}
                  textSize="text-base"
                  showIcon
                  className="border-b border-border/40 pb-1.5 uppercase text-[var(--fg)]"
                />
              </div>
            </div>
          </div>
        </div>
      </QuoteAccordionCard>

      {/* Section 3: Lineup & Moments */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.lineup_moments)}
        onToggle={() => toggleEditSection('lineup_moments')}
        stepNumber="03"
        title="LINEUP & MUSICAL MOMENTS"
        summary={`${selectedMusicians.length} MUSICIANS • ${musicalMoments.filter(m => m.selected).length} MOMENTS`}
      >
        <div className="space-y-3">
          <div className="divide-y divide-border/30 border-y border-border/30">
            {availableMusicians.map(m => {
              const isSelected = selectedMusicians.some(mus => mus.id === m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => toggleMusician(m)}
                  className="flex items-center justify-between py-2 px-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <DotCheckbox
                      checked={isSelected}
                      activeColor="var(--wizard-accent)"
                      inactiveColor="var(--border)"
                    />
                    <span className="text-sm font-semibold text-[var(--fg)]">{m.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {currencySymbol}{m.fee || 300}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </QuoteAccordionCard>
    </div>
  );

  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;

  const rightButtonLabel = isLastStep ? 'SEND QUOTE' : 'NEXT';
  const rightButtonAction = isLastStep ? () => handleCreate(true) : handleNext;

  // ── EDIT MODE RENDER ────────────────────────────────────────
  if (isEditing) {
    return (
      <motion.div
        data-modal-open="true"
        data-wizard-type="quote"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
        className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col h-full overflow-hidden"
      >
        <WizardAccentRail color={activeAccentColor} />

        {/* Top Header Zone (shrink-0) */}
        <div className="px-6 pb-4 shrink-0 bg-[var(--bg)]/95 backdrop-blur-md border-b border-border/40 z-10 flex items-start justify-between" style={{ paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))' }}>
          <div className="flex flex-col gap-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] shadow-xs">
                EDITING
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground">
                {initialData?.quoteNumber || 'QUOTE'}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground">
                {(eventType || 'event').toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-bold uppercase leading-tight text-[var(--fg)] truncate mt-1">
              {getEffectiveTitle()}
            </h1>
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {formattedDateStr} @ {eventTimeStart} – {eventTimeEnd} • {venueName || 'VENUE TBD'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit quote modal"
            className="w-11 h-11 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-[var(--fg)]" />
          </button>
        </div>

        {/* Scrollable Body Zone */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {renderEditAccordionView()}
        </div>

        {/* Bottom Action Bar (shrink-0) */}
        <div className="px-6 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-4 shrink-0 border-t border-border/40 bg-[var(--bg)]/95 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              TOTAL ESTIMATE
            </span>
            <span className="text-xl font-bold text-[var(--fg)]">
              {currencySymbol}{totals.total.toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-4 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <X className="w-4 h-4 text-[var(--fg)]" />
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => handleCreate(false)}
              className="rounded-xl py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              SAVE CHANGES
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── CREATION MODE RENDER (3-ZONE SHELL) ─────────────────────
  return (
    <motion.div
      data-modal-open="true"
      data-wizard-type="quote"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
      className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col h-full overflow-hidden"
    >
      <WizardAccentRail color={activeAccentColor} />

      {/* Top Header Zone (shrink-0) */}
      <div className="shrink-0 px-6 pb-3 border-b border-border/40 bg-[var(--bg)] z-10 flex flex-col gap-3" style={{ paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))' }}>
        {/* Step indicator bar */}
        <div className="pt-1">
          <InteractiveQuoteStepIndicator
            current={step}
            total={STEPS.length}
            steps={STEPS}
            maxAccessibleStep={maxAccessibleStep}
            onSelectStep={s => setStep(s)}
            activeColor="var(--wizard-accent)"
            inactiveColor="var(--border)"
          />
        </div>

        {/* Eyebrow + Title and Close button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              NEW QUOTE
            </span>
            <h2 className="text-2xl font-bold tracking-tight leading-tight text-[var(--fg)] mt-0.5 truncate">
              {STEPS[step].title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quote wizard"
            className="w-10 h-10 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-[var(--fg)]" />
          </button>
        </div>
      </div>

      {/* Scrollable Body Zone */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}
      </div>

      {/* Bottom Action Bar */}
      <div className="shrink-0 border-t border-border/40 px-6 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-4 bg-[var(--bg)]/95 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-3">
          {isFirstStep ? (
            <button
              type="button"
              onClick={onClose}
              className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-4 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <X className="w-4 h-4 text-[var(--fg)]" />
              CANCEL
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBack}
              className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-4 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[var(--fg)]" />
              BACK
            </button>
          )}
          <button
            type="button"
            onClick={rightButtonAction}
            disabled={!canProceed}
            className={cn(
              'rounded-xl py-4 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2',
              !canProceed
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer'
            )}
          >
            <span>{rightButtonLabel}</span>
            {isLastStep ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
