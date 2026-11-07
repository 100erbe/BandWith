import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  AlertCircle,
  Briefcase,
  Users,
  Mic2,
  Sliders,
  Music,
  Calendar,
  Edit3,
  Layers,
  Euro,
  Share2,
  Truck,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { WizardAccentRail, getEventAccentColor } from '@/app/components/ui/WizardAccentRail';
import { PeekingScrollContainer } from '@/app/components/ui/PeekingScrollContainer';
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
  QuotePackageOption,
  QuoteSelectedMoment,
  BAND_MEMBERS,
  generateQuoteNumber,
  calculateVAT,
  calculateQuoteTotals,
} from '@/app/data/quotes';
import { useBand } from '@/lib/BandContext';
import {
  getBandPricing,
  DEFAULT_BAND_PRICING,
  calculateLineupBaseFromSettings,
  calculateTravelFeeFromSettings,
  type BandPricingSettings,
  type CustomService,
  type LineupPackagePreset,
} from '@/lib/services/pricing';
import { calculateTravelDistance } from '@/lib/services/location';

export interface QuoteBandMember {
  id: string;
  name: string;
  role: string;
  initials?: string;
  fee?: string;
  user_id?: string;
}

export const MOMENT_DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 180, 240];

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

const getEventMonthFromDate = (dateStr?: string): number | undefined => {
  if (!dateStr) return undefined;
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    if (m >= 1 && m <= 12) return m;
  }
  return undefined;
};

const calcMusicianAutoFee = (
  musicianId: string,
  currentSelectedIds: string[],
  settings: BandPricingSettings,
  musiciansList: QuoteMusician[]
): number => {
  const member = musiciansList.find(m => m.id === musicianId || m.userId === musicianId);
  if (settings.use_roster_member_fees && member?.fee && member.fee > 0) {
    return member.fee;
  }
  const idx = currentSelectedIds.includes(musicianId)
    ? currentSelectedIds.indexOf(musicianId)
    : currentSelectedIds.length;
  const useSubRate =
    Boolean(settings.enable_external_sub_rate) && idx >= (settings.core_members_count || 4);
  if (useSubRate) {
    return settings.external_sub_rate || settings.session_musician_rate || 200;
  }
  return settings.base_musician_rate || settings.core_member_rate || 250;
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
}> = ({
  isOpen,
  onToggle,
  stepNumber,
  title,
  summary,
  hasWarning,
  warningLabel = 'NEEDS ATTENTION',
  children,
}) => {
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
  initialEventTitle,
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
    if (pricingSettings.currency === 'CHF') return 'CHF ';
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

  // Accordion state for Edit mode (all 5 sections)
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

  // Consolidated 3 Review Drawers in Step 3 (Creation Mode)
  const [openReviewDrawer, setOpenReviewDrawer] = useState<
    'billing' | 'logistics' | 'proposal_terms' | null
  >(initialData?.includeProposalSummary ? 'proposal_terms' : null);

  const toggleReviewDrawer = (drawer: 'billing' | 'logistics' | 'proposal_terms') => {
    setOpenReviewDrawer(prev => (prev === drawer ? null : drawer));
  };

  // Lineup bar expansion in Step 1
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);

  // === FORM STATE ===
  const [clientName, setClientName] = useState(
    initialData?.clientName || initialClientName || ''
  );
  const [clientEmail, setClientEmail] = useState(initialData?.clientEmail || '');
  const [clientPhone, setClientPhone] = useState(initialData?.clientPhone || '');
  const [clientCompany, setClientCompany] = useState(initialData?.clientCompany || '');
  const [eventName, setEventName] = useState(
    initialData?.eventName || initialData?.eventTitle || initialEventTitle || ''
  );
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(
    Boolean(initialData?.eventName || initialData?.eventTitle || initialEventTitle)
  );

  // Default eventType to 'wedding' so Step 1 NEXT is never blocked on load
  const [eventType, setEventType] = useState<QuoteEventType>(
    initialData?.eventType || 'wedding'
  );

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
  const [indoorOutdoor, setIndoorOutdoor] = useState<'indoor' | 'outdoor' | 'hybrid'>(
    initialData?.indoorOutdoor || 'indoor'
  );

  const [performanceType, setPerformanceType] = useState<PerformanceType>(
    initialData?.performanceType || 'full_band'
  );
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [setDuration, setSetDuration] = useState(initialData?.setDuration || 120);
  const [numberOfSets, setNumberOfSets] = useState(initialData?.numberOfSets || 2);
  const [breakDuration] = useState(initialData?.breakDuration || 15);

  const [selectedMusicians, setSelectedMusicians] = useState<QuoteMusician[]>(
    initialData?.musicians?.filter(m => !m.isExternal) || []
  );
  const [externalMusicians] = useState<QuoteMusician[]>(
    initialData?.musicians?.filter(m => m.isExternal) || []
  );
  const [selectedGenres] = useState<string[]>(initialData?.genres || []);
  const [specialRequests] = useState(initialData?.specialRequests || '');

  // Preserve any legacy selectedMoments on existing saved quotes
  const [legacySelectedMoments] = useState<QuoteSelectedMoment[]>(
    initialData?.selectedMoments || []
  );

  // Billing & VAT
  const [billingCountry] = useState(initialData?.billingCountry || 'IT');
  const [vatNumber] = useState(initialData?.vatNumber || '');
  const [fiscalCode] = useState(initialData?.fiscalCode || '');
  const [vatExempt, setVatExempt] = useState(initialData?.vatExempt || false);
  const [reverseCharge] = useState(initialData?.reverseCharge || false);
  const [baseFee, setBaseFee] = useState(initialData?.baseFee || 0);
  const [baseFeeManuallyEdited, setBaseFeeManuallyEdited] = useState(
    Boolean(initialData?.baseFee)
  );
  const [travelIncluded, setTravelIncluded] = useState(
    initialData?.travelIncluded !== undefined ? initialData.travelIncluded : false
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
  const [mealsIncluded] = useState(
    initialData?.mealsIncluded !== undefined ? initialData.mealsIncluded : true
  );
  const [mealsFee] = useState(initialData?.mealsFee || 0);
  const [soundIncluded, setSoundIncluded] = useState(
    initialData?.soundIncluded !== undefined ? initialData.soundIncluded : true
  );
  const [soundFee, setSoundFee] = useState(initialData?.soundFee || 0);
  const [lightsIncluded] = useState(
    initialData?.lightsIncluded !== undefined ? initialData.lightsIncluded : true
  );
  const [lightsFee] = useState(initialData?.lightsFee || 0);
  const [backlineIncluded] = useState(
    initialData?.backlineIncluded !== undefined ? initialData.backlineIncluded : true
  );
  const [backlineFee] = useState(initialData?.backlineFee || 0);
  const [customItems, setCustomItems] = useState<QuoteCustomItem[]>(
    initialData?.customItems || []
  );
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>(
    initialData?.discountType || 'none'
  );
  const [discountValue, setDiscountValue] = useState(initialData?.discountValue || 0);
  const [discountReason] = useState(initialData?.discountReason || '');
  const [validityDays, setValidityDays] = useState(initialData?.validityDays || 30);
  const [depositRequired, setDepositRequired] = useState(
    initialData?.depositRequired !== undefined ? initialData.depositRequired : true
  );
  const [depositPercentage, setDepositPercentage] = useState(
    initialData?.depositPercentage || 30
  );
  const [depositDueDate] = useState(initialData?.depositDueDate || 'on_acceptance');
  const [balanceDueDate] = useState(initialData?.balanceDueDate || '7_days_after');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    initialData?.paymentMethods || ['bank_transfer']
  );
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>(
    initialData?.cancellationPolicy || 'moderate'
  );
  const [cancellationTerms] = useState(initialData?.cancellationTerms || '');
  const [clientNotes, setClientNotes] = useState(initialData?.clientNotes || '');
  const [internalNotes] = useState(initialData?.internalNotes || '');

  // Extended PDF & Proposal fields
  const [quoteDescription, setQuoteDescription] = useState(
    initialData?.quoteDescription || ''
  );
  const [productionTier, setProductionTier] = useState<'standard' | 'pro' | 'custom' | 'none'>(
    initialData?.productionTier || 'standard'
  );
  const [travelMode, setTravelMode] = useState<'included' | 'separate' | 'client_provided'>(
    initialData?.travelMode ||
      (initialData?.travelIncluded === true ? 'included' : 'separate')
  );
  const [accommodationMode, setAccommodationMode] = useState<
    'none' | 'included' | 'separate' | 'client_provided'
  >(
    initialData?.accommodationMode ||
      (initialData?.accommodationNeeded
        ? (initialData?.accommodationFee || 0) > 0
          ? 'separate'
          : 'included'
        : 'included')
  );
  const [accommodationRooms, setAccommodationRooms] = useState<number>(
    initialData?.accommodationRooms || 3
  );
  const [accommodationNights, setAccommodationNights] = useState<number>(
    initialData?.accommodationNights || 1
  );
  const [showBankDetailsOnPdf, setShowBankDetailsOnPdf] = useState<boolean>(
    initialData?.showBankDetailsOnPdf !== undefined ? initialData.showBankDetailsOnPdf : true
  );
  const [customVatRate, setCustomVatRate] = useState<number | null>(
    initialData?.vatRate !== undefined ? initialData.vatRate : null
  );
  const [includeProposalSummary, setIncludeProposalSummary] = useState<boolean>(
    Boolean(initialData?.includeProposalSummary)
  );
  const [quoteOptions, setQuoteOptions] = useState<QuotePackageOption[]>(
    initialData?.quoteOptions || []
  );

  // Helper to compute lineup base from current selection + pricingSettings
  const computeLineupBase = useCallback(
    (
      musiciansList: QuoteMusician[],
      perfType: PerformanceType,
      pkgId: string | undefined,
      dateStr: string,
      settings: BandPricingSettings
    ): number => {
      const rosterSum = musiciansList.reduce((sum, m) => sum + (m.fee || 0), 0);
      const calc = calculateLineupBaseFromSettings({
        packageId: pkgId,
        performanceType: perfType,
        musiciansCount: Math.max(1, musiciansList.length || settings.core_members_count || 1),
        rosterFeesSum: rosterSum,
        eventMonth: getEventMonthFromDate(dateStr),
        settings,
      });
      return calc.totalLineupBase;
    },
    []
  );

  // Smart Initialization on Load
  const hasInitializedPricingRef = useRef(false);

  useEffect(() => {
    const effectiveBandId = selectedBand?.id || 'default';
    let isCancelled = false;

    getBandPricing(effectiveBandId).then(settings => {
      if (isCancelled) return;
      setPricingSettings(settings);

      if (
        !hasInitializedPricingRef.current &&
        !initialData?.baseFee &&
        (!initialData?.musicians || initialData.musicians.length === 0)
      ) {
        hasInitializedPricingRef.current = true;

        if (settings.pricing_mode === 'flat_packages') {
          const activePkgs = (settings.lineup_packages || []).filter(p => p.is_active);
          const fullPkg =
            activePkgs.find(p => p.performanceType === 'full_band') ||
            activePkgs[activePkgs.length - 1] ||
            settings.lineup_packages[0];

          if (fullPkg) {
            setSelectedPackageId(fullPkg.id);
            setPerformanceType(fullPkg.performanceType);
            const targetCount = Math.min(fullPkg.musiciansCount, availableMusicians.length);
            const targetRoster = availableMusicians.slice(0, targetCount);
            setSelectedMusicians(targetRoster);
            const computed = calculateLineupBaseFromSettings({
              packageId: fullPkg.id,
              performanceType: fullPkg.performanceType,
              musiciansCount: fullPkg.musiciansCount,
              eventMonth: getEventMonthFromDate(eventDate),
              settings,
            });
            setBaseFee(computed.totalLineupBase);
          }
        } else {
          // 'per_musician' mode: select first core_members_count || availableMusicians.length members
          const desiredCount = settings.core_members_count || availableMusicians.length || 4;
          const targetCount =
            availableMusicians.length > 0
              ? Math.min(desiredCount, availableMusicians.length)
              : desiredCount;

          if (availableMusicians.length > 0) {
            const slice = availableMusicians.slice(0, targetCount);
            const sliceIds = slice.map(m => m.id);
            const populated = slice.map((m, idx) => ({
              ...m,
              fee: calcMusicianAutoFee(m.id, sliceIds.slice(0, idx), settings, availableMusicians),
            }));
            setSelectedMusicians(populated);
            setPerformanceType(
              targetCount <= 1
                ? 'solo'
                : targetCount === 2
                  ? 'duo'
                  : targetCount === 3
                    ? 'trio'
                    : 'full_band'
            );
            const rosterSum = populated.reduce((sum, m) => sum + (m.fee || 0), 0);
            const computed = calculateLineupBaseFromSettings({
              performanceType: 'full_band',
              musiciansCount: populated.length,
              rosterFeesSum: rosterSum,
              eventMonth: getEventMonthFromDate(eventDate),
              settings,
            });
            setBaseFee(computed.totalLineupBase);
          } else {
            const computed = calculateLineupBaseFromSettings({
              performanceType: 'full_band',
              musiciansCount: targetCount,
              eventMonth: getEventMonthFromDate(eventDate),
              settings,
            });
            setBaseFee(computed.totalLineupBase);
          }
        }

        // Apply default Travel & Production policies from settings
        if (initialData?.travelMode === undefined && initialData?.travelIncluded === undefined) {
          const isTravInc =
            Boolean(settings.default_travel_included) ||
            settings.default_travel_mode === 'included';
          setTravelIncluded(isTravInc);
          setTravelMode(
            isTravInc
              ? 'included'
              : settings.default_travel_mode === 'client_provided'
                ? 'client_provided'
                : 'separate'
          );
        }

        if (initialData?.productionTier === undefined && initialData?.soundIncluded === undefined) {
          if (
            settings.default_production_mode === 'client_provided' ||
            settings.default_production_mode === 'none'
          ) {
            setProductionTier('none');
            setSoundIncluded(true);
            setSoundFee(0);
          } else if (settings.default_production_mode === 'separate') {
            const defTier =
              settings.default_production_tier === 'pro' ? 'pro' : 'standard';
            setProductionTier(defTier);
            setSoundIncluded(false);
            setSoundFee(
              defTier === 'pro'
                ? settings.production_pro_fee || 600
                : settings.production_standard_fee || 300
            );
          } else {
            setProductionTier('standard');
            setSoundIncluded(true);
            setSoundFee(0);
          }
        }
      }

      if (!isEditing) {
        if (settings.default_deposit_rate !== undefined) {
          setDepositPercentage(settings.default_deposit_rate);
          setDepositRequired(settings.default_deposit_rate > 0);
        }
        if (settings.default_validity_days) {
          setValidityDays(settings.default_validity_days);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    selectedBand?.id,
    availableMusicians,
    initialData?.baseFee,
    initialData?.musicians,
    initialData?.travelMode,
    initialData?.travelIncluded,
    initialData?.productionTier,
    initialData?.soundIncluded,
    isEditing,
    eventDate,
  ]);

  // Re-apply seasonal adjustment when eventDate changes (if seasonal_pricing_enabled and not manually overridden)
  useEffect(() => {
    if (!hasInitializedPricingRef.current || baseFeeManuallyEdited) return;
    if (!pricingSettings.seasonal_pricing_enabled) return;
    const nextBase = computeLineupBase(
      selectedMusicians,
      performanceType,
      selectedPackageId,
      eventDate,
      pricingSettings
    );
    setBaseFee(nextBase);
  }, [
    eventDate,
    pricingSettings,
    baseFeeManuallyEdited,
    selectedMusicians,
    performanceType,
    selectedPackageId,
    computeLineupBase,
  ]);

  const allMusicians = useMemo(
    () => [...selectedMusicians, ...externalMusicians],
    [selectedMusicians, externalMusicians]
  );

  // Sync per_person / per_km service quantities in customItems when lineup count or travel distance changes
  useEffect(() => {
    const serviceById = new Map(
      (pricingSettings.custom_services || []).map(s => [s.id, s])
    );
    setCustomItems(prev => {
      let changed = false;
      const next = prev.map(item => {
        const srv = serviceById.get(item.id);
        if (!srv) return item;
        if (srv.unit === 'per_person') {
          const targetQty = Math.max(
            1,
            allMusicians.length || pricingSettings.core_members_count || 1
          );
          if (item.quantity !== targetQty) {
            changed = true;
            return { ...item, quantity: targetQty, price: srv.price, amount: srv.price };
          }
        } else if (srv.unit === 'per_km' && travelDistanceKm && travelDistanceKm > 0) {
          if (item.quantity !== travelDistanceKm) {
            changed = true;
            return { ...item, quantity: travelDistanceKm, price: srv.price, amount: srv.price };
          }
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [allMusicians.length, travelDistanceKm, pricingSettings.custom_services, pricingSettings.core_members_count]);

  // Distance & Flexible Travel Calculation
  const computeTravelFeeForDistance = useCallback(
    (oneWayKm: number) => {
      const freeRadius = pricingSettings.free_travel_radius_km || 0;
      const billableKm = Math.max(0, oneWayKm - freeRadius);
      if (billableKm <= 0) return 0;

      const musiciansCount = Math.max(
        1,
        allMusicians.length || pricingSettings.core_members_count || 1
      );
      return calculateTravelFeeFromSettings(oneWayKm, musiciansCount, pricingSettings);
    },
    [pricingSettings, allMusicians.length]
  );

  const handleCalculateDistance = async (venueLoc: string) => {
    const originAddress =
      pricingSettings.band_origin_address ||
      (selectedBand as any)?.location ||
      (selectedBand as any)?.address;
    if (!venueLoc || !originAddress) return;
    setIsCalculatingDistance(true);
    try {
      const origin =
        typeof originAddress === 'string' ? { address: originAddress } : originAddress;
      const distResult = await calculateTravelDistance(origin, { address: venueLoc });
      if (distResult != null) {
        setTravelDistanceKm(distResult.distanceKm);
        const freeRadius = pricingSettings.free_travel_radius_km || 0;
        const billableKm = Math.max(0, distResult.distanceKm - freeRadius);
        const autoTravelFee =
          billableKm > 0 ? computeTravelFeeForDistance(distResult.distanceKm) : 0;
        setTravelFee(autoTravelFee);

        if (pricingSettings.default_travel_included || billableKm === 0) {
          setTravelMode('included');
          setTravelIncluded(true);
        } else {
          setTravelMode('separate');
          setTravelIncluded(false);
        }
      }
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const handleManualDistanceChange = (kmVal?: number) => {
    setTravelDistanceKm(kmVal);
    if (kmVal && kmVal > 0) {
      const fee = computeTravelFeeForDistance(kmVal);
      setTravelFee(fee);
    } else {
      setTravelFee(0);
    }
  };

  // Totals
  const vatRate = useMemo(() => {
    if (vatExempt || reverseCharge) return 0;
    if (customVatRate !== null) return customVatRate;
    if (pricingSettings.default_vat_rate !== undefined && pricingSettings.default_vat_rate >= 0) {
      return pricingSettings.default_vat_rate;
    }
    return calculateVAT(
      billingCountry,
      'IT',
      Boolean(vatNumber),
      Boolean(clientCompany),
      vatExempt,
      reverseCharge
    );
  }, [
    billingCountry,
    vatNumber,
    clientCompany,
    vatExempt,
    reverseCharge,
    customVatRate,
    pricingSettings.default_vat_rate,
  ]);

  const musiciansTotal = useMemo(() => {
    return selectedMusicians.reduce((sum, m) => sum + (m.fee || 0), 0);
  }, [selectedMusicians]);

  const legacyMomentsTotal = useMemo(
    () => legacySelectedMoments.reduce((sum, m) => sum + (m.price || 0), 0),
    [legacySelectedMoments]
  );

  const customItemsTotal = useMemo(
    () =>
      customItems.reduce(
        (sum, item) => sum + (item.price ?? item.amount ?? 0) * (item.quantity || 1),
        0
      ),
    [customItems]
  );

  const normalizedCustomItemsForCalc = useMemo<QuoteCustomItem[]>(
    () =>
      customItems.map(it => ({
        ...it,
        amount: it.price ?? it.amount ?? 0,
        price: it.price ?? it.amount ?? 0,
        quantity: it.quantity || 1,
      })),
    [customItems]
  );

  const lineupBaseAmount = useMemo(() => {
    return baseFee > 0 ? baseFee : musiciansTotal > 0 ? musiciansTotal : 0;
  }, [baseFee, musiciansTotal]);

  const effectiveTravelFee = travelMode === 'separate' && !travelIncluded ? travelFee : 0;
  const effectiveAccommodationFee =
    accommodationMode === 'separate' && accommodationNeeded ? accommodationFee : 0;
  const effectiveSoundFee = !soundIncluded && productionTier !== 'none' ? soundFee : 0;
  const effectiveMealsFee = mealsIncluded ? 0 : mealsFee;
  const effectiveLightsFee = lightsIncluded ? 0 : lightsFee;
  const effectiveBacklineFee = backlineIncluded ? 0 : backlineFee;

  const travelAndProductionAmount =
    effectiveTravelFee +
    effectiveAccommodationFee +
    effectiveSoundFee +
    effectiveMealsFee +
    effectiveLightsFee +
    effectiveBacklineFee;

  const setsAndExtrasAmount = legacyMomentsTotal + customItemsTotal;

  const totals = useMemo(() => {
    const effectiveBase = lineupBaseAmount + legacyMomentsTotal;
    return calculateQuoteTotals(
      effectiveBase,
      effectiveTravelFee,
      effectiveAccommodationFee,
      effectiveMealsFee,
      effectiveSoundFee,
      effectiveLightsFee,
      effectiveBacklineFee,
      normalizedCustomItemsForCalc,
      discountType,
      discountValue,
      vatRate,
      vatExempt,
      reverseCharge
    );
  }, [
    lineupBaseAmount,
    legacyMomentsTotal,
    effectiveTravelFee,
    effectiveAccommodationFee,
    effectiveMealsFee,
    effectiveSoundFee,
    effectiveLightsFee,
    effectiveBacklineFee,
    normalizedCustomItemsForCalc,
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
        return Boolean(eventType);
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

  // Select a Flat Lineup Package (when pricing_mode === 'flat_packages')
  const selectFlatPackage = (pkg: LineupPackagePreset) => {
    setSelectedPackageId(pkg.id);
    setPerformanceType(pkg.performanceType);
    setBaseFeeManuallyEdited(false);

    const targetCount = Math.min(pkg.musiciansCount, availableMusicians.length);
    const nextRoster = availableMusicians.slice(0, targetCount);
    setSelectedMusicians(nextRoster);

    const computed = calculateLineupBaseFromSettings({
      packageId: pkg.id,
      performanceType: pkg.performanceType,
      musiciansCount: pkg.musiciansCount,
      eventMonth: getEventMonthFromDate(eventDate),
      settings: pricingSettings,
    });
    setBaseFee(computed.totalLineupBase);
  };

  // Select a Preset Formation (when pricing_mode === 'per_musician')
  const selectPresetLineup = (type: PerformanceType) => {
    setPerformanceType(type);
    setBaseFeeManuallyEdited(false);
    const fullCount = pricingSettings.core_members_count || availableMusicians.length || 4;
    const countMap: Record<PerformanceType, number> = {
      solo: 1,
      duo: 2,
      trio: 3,
      full_band: fullCount,
      dj_set: 1,
      acoustic: 2,
    };
    const desired = countMap[type] || 1;
    const count = Math.min(desired, availableMusicians.length);
    const target = availableMusicians.slice(0, count);
    const targetIds = target.map(m => m.id);
    const updated = target.map((m, idx) => {
      const fee = getAutoFeeForMusician(m.id, targetIds.slice(0, idx), pricingSettings, m);
      return { ...m, fee };
    });
    setSelectedMusicians(updated);
    const nextBase = computeLineupBase(updated, type, undefined, eventDate, pricingSettings);
    setBaseFee(nextBase);
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

    if (pricingSettings.pricing_mode === 'per_musician') {
      setBaseFeeManuallyEdited(false);
      const nextPerf: PerformanceType =
        updated.length <= 1
          ? 'solo'
          : updated.length === 2
            ? 'duo'
            : updated.length === 3
              ? 'trio'
              : 'full_band';
      setPerformanceType(nextPerf);
      const nextBase = computeLineupBase(
        updated,
        nextPerf,
        undefined,
        eventDate,
        pricingSettings
      );
      setBaseFee(nextBase);
    }
  };

  const updateMusicianFee = (musicianId: string, fee: number) => {
    setSelectedMusicians(prev => {
      const updated = prev.map(m => (m.id === musicianId ? { ...m, fee } : m));
      if (pricingSettings.pricing_mode === 'per_musician') {
        setBaseFeeManuallyEdited(false);
        const rosterSum = updated.reduce((sum, m) => sum + (m.fee || 0), 0);
        const calc = calculateLineupBaseFromSettings({
          performanceType,
          musiciansCount: Math.max(1, updated.length),
          rosterFeesSum: rosterSum > 0 ? rosterSum : undefined,
          eventMonth: getEventMonthFromDate(eventDate),
          settings: { ...pricingSettings, use_roster_member_fees: true },
        });
        setBaseFee(calc.totalLineupBase);
      }
      return updated;
    });
  };

  // Service Chip Quantity Helper & 1-Tap Toggle
  const getServiceAutoQty = useCallback(
    (srv: Pick<CustomService, 'unit' | 'default_duration_mins'>): number => {
      if (srv.unit === 'per_person') {
        return Math.max(1, allMusicians.length || pricingSettings.core_members_count || 1);
      }
      if (srv.unit === 'per_km') {
        return Math.max(1, travelDistanceKm || 50);
      }
      if (srv.unit === 'per_hour' && srv.default_duration_mins) {
        return Math.max(1, Math.round(srv.default_duration_mins / 60));
      }
      return 1;
    },
    [allMusicians.length, pricingSettings.core_members_count, travelDistanceKm]
  );

  const toggleBandCustomService = (srv: CustomService) => {
    setCustomItems(prev => {
      const exists = prev.some(it => it.id === srv.id || it.name === srv.name);
      if (exists) {
        return prev.filter(it => it.id !== srv.id && it.name !== srv.name);
      }
      const qty = getServiceAutoQty(srv);
      return [
        ...prev,
        {
          id: srv.id,
          name: srv.name,
          description: srv.description,
          price: srv.price,
          amount: srv.price,
          quantity: qty,
          taxable: true,
        },
      ];
    });
  };

  const computePackageOption = useCallback(
    (
      id: string,
      name: string,
      musiciansCount: number,
      instrumentsText: string,
      grossFee: number,
      discountPct: number
    ): QuotePackageOption => {
      const discAmt = discountPct > 0 ? Math.round(grossFee * (discountPct / 100)) : 0;
      const netSub = grossFee - discAmt;
      const vRate = vatExempt || reverseCharge ? 0 : vatRate;
      const vAmt = Math.round(netSub * (vRate / 100));
      const totWithVat = netSub + vAmt;
      const depPct = depositRequired ? depositPercentage : 0;
      const depAmt = Math.round(totWithVat * (depPct / 100));
      return {
        id,
        name,
        label: name,
        lineupLabel: `${musiciansCount} Musicians`,
        musiciansCount,
        instrumentsSummary: instrumentsText,
        instrumentsDetail: instrumentsText,
        instrumentsText,
        setsCount: numberOfSets,
        setDurationMinutes: setDuration,
        grossFee,
        discountPercent: discountPct,
        discountAmount: discAmt,
        netSubtotal: netSub,
        vatRate: vRate,
        vatAmount: vAmt,
        totalWithVat: totWithVat,
        depositPercentage: depPct,
        depositAmount: depAmt,
      };
    },
    [vatExempt, reverseCharge, vatRate, depositRequired, depositPercentage, numberOfSets, setDuration]
  );

  const handleToggleProposalSummary = (enabled: boolean) => {
    setIncludeProposalSummary(enabled);
    if (enabled && quoteOptions.length === 0) {
      const discPct =
        discountType === 'percentage' && discountValue > 0 ? discountValue : 0;

      if (pricingSettings.pricing_mode === 'flat_packages') {
        const activePkgs = (pricingSettings.lineup_packages || []).filter(p => p.is_active);
        if (activePkgs.length > 0) {
          setQuoteOptions(
            activePkgs.map((pkg, i) =>
              computePackageOption(
                `opt-${i + 1}`,
                pkg.name,
                pkg.musiciansCount,
                pkg.description || `${pkg.musiciansCount} Musicians`,
                pkg.flatPrice + setsAndExtrasAmount + travelAndProductionAmount,
                discPct
              )
            )
          );
          return;
        }
      }

      const baseCount = Math.max(2, allMusicians.length || pricingSettings.core_members_count || 4);
      const baseGross = Math.max(500, Math.round(totals.subtotal || 2000));
      const stepFee =
        pricingSettings.external_sub_rate ||
        pricingSettings.base_musician_rate ||
        pricingSettings.session_musician_rate ||
        250;

      const defaultTiers: QuotePackageOption[] = [
        computePackageOption(
          'opt-1',
          `${baseCount}pc Lineup`,
          baseCount,
          `${baseCount} Musicians`,
          baseGross,
          discPct
        ),
        computePackageOption(
          'opt-2',
          `${baseCount + 1}pc Lineup`,
          baseCount + 1,
          `${baseCount + 1} Musicians (+ Guest / Horn)`,
          baseGross + stepFee,
          discPct
        ),
        computePackageOption(
          'opt-3',
          `${baseCount + 2}pc Lineup`,
          baseCount + 2,
          `${baseCount + 2} Musicians (+ Full Section)`,
          baseGross + stepFee * 2,
          discPct
        ),
      ];
      setQuoteOptions(defaultTiers);
    }
  };

  const addPackageOption = () => {
    const prev = quoteOptions[quoteOptions.length - 1];
    const stepFee =
      pricingSettings.external_sub_rate ||
      pricingSettings.base_musician_rate ||
      pricingSettings.session_musician_rate ||
      250;
    const nextCount = prev ? prev.musiciansCount + 1 : Math.max(2, allMusicians.length + 1);
    const nextGross = prev
      ? prev.grossFee + stepFee
      : Math.max(500, Math.round(totals.subtotal || 2000));
    const nextDisc = prev
      ? prev.discountPercent
      : discountType === 'percentage'
        ? discountValue
        : 0;
    setQuoteOptions([
      ...quoteOptions,
      computePackageOption(
        `opt-${Date.now()}`,
        `${nextCount}pc Lineup`,
        nextCount,
        `${nextCount} Musicians`,
        nextGross,
        nextDisc
      ),
    ]);
  };

  const updatePackageOption = (id: string, patch: Partial<QuotePackageOption>) => {
    setQuoteOptions(prev =>
      prev.map(opt => {
        if (opt.id !== id) return opt;
        const merged = { ...opt, ...patch };
        return computePackageOption(
          merged.id,
          merged.name || merged.label || '',
          merged.musiciansCount,
          merged.instrumentsText || merged.instrumentsDetail || '',
          merged.grossFee,
          merged.discountPercent
        );
      })
    );
  };

  const removePackageOption = (id: string) => {
    setQuoteOptions(prev => prev.filter(o => o.id !== id));
  };

  const handleCreate = (sendImmediately = true) => {
    const finalEventName = getEffectiveTitle();
    const finalClientName = clientName.trim() || 'Client';

    const activePkg =
      pricingSettings.pricing_mode === 'flat_packages'
        ? pricingSettings.lineup_packages.find(p => p.id === selectedPackageId)
        : undefined;

    const finalMusicianCount =
      activePkg?.musiciansCount || allMusicians.length || pricingSettings.core_members_count || 1;

    const depositAmt = depositRequired
      ? Math.round(totals.total * (depositPercentage / 100))
      : 0;

    const quoteData: Partial<Quote> = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      quoteNumber: initialData?.quoteNumber || generateQuoteNumber(),
      status: sendImmediately ? 'SENT' : initialData?.status || 'DRAFT',
      clientName: finalClientName,
      clientEmail: clientEmail.trim() || '',
      clientPhone: clientPhone.trim() || undefined,
      clientCompany: clientCompany.trim() || undefined,
      eventName: finalEventName,
      eventType: (eventType || 'wedding') as QuoteEventType,
      eventDate: eventDate || new Date().toISOString().split('T')[0],
      eventTimeStart: eventTimeStart || '20:00',
      eventTimeEnd: eventTimeEnd || undefined,
      guestCount,
      venueName: venueName || 'TBD',
      venueAddress: venueAddress || undefined,
      venueCity: venueCity || '',
      venueCountry,
      indoorOutdoor,
      performanceType,
      setDuration,
      numberOfSets,
      breakDuration,
      musicians: allMusicians,
      musicianCount: finalMusicianCount,
      genres: selectedGenres,
      specialRequests: specialRequests || undefined,
      billingCountry,
      vatNumber: vatNumber || undefined,
      fiscalCode: fiscalCode || undefined,
      vatRate,
      vatExempt,
      reverseCharge,
      currency: pricingSettings.currency || 'EUR',
      baseFee: lineupBaseAmount,
      travelIncluded: travelMode !== 'separate',
      travelFee: effectiveTravelFee,
      travelDistanceKm,
      travelMode,
      accommodationNeeded: accommodationMode === 'separate',
      accommodationFee: effectiveAccommodationFee,
      accommodationMode,
      accommodationRooms,
      accommodationNights,
      mealsIncluded,
      mealsFee: effectiveMealsFee,
      soundIncluded,
      soundFee: effectiveSoundFee,
      lightsIncluded,
      lightsFee: effectiveLightsFee,
      backlineIncluded,
      backlineFee: effectiveBacklineFee,
      productionTier,
      customItems: normalizedCustomItemsForCalc,
      selectedMoments: legacySelectedMoments.length > 0 ? legacySelectedMoments : undefined,
      discountType,
      discountValue,
      discountReason: discountReason || undefined,
      ...totals,
      depositAmount: depositAmt,
      validityDays,
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
      quoteDescription: quoteDescription.trim() || undefined,
      showBankDetailsOnPdf,
      includeProposalSummary,
      quoteOptions: includeProposalSummary ? quoteOptions : undefined,
      sentAt: sendImmediately ? new Date().toISOString() : initialData?.sentAt,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventTitle: finalEventName,
    };
    onCreate(quoteData);
  };

  const activeCatalogServices = useMemo(
    () => (pricingSettings.custom_services || []).filter(s => s.is_active),
    [pricingSettings.custom_services]
  );

  const activePackages = useMemo(
    () => (pricingSettings.lineup_packages || []).filter(p => p.is_active),
    [pricingSettings.lineup_packages]
  );

  // Shared Lineup + Extra Sets UI block (used in Step 1 and Edit Accordion 03)
  const renderLineupAndExtraSetsSection = () => (
    <div className="space-y-4">
      {/* Lineup Section: Adapts to pricingSettings.pricing_mode */}
      {pricingSettings.pricing_mode === 'flat_packages' ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              LINEUP FORMATION PACKAGE
            </span>
            <span className="text-xs font-bold text-[var(--wizard-accent)]">
              {currencySymbol}
              {lineupBaseAmount.toLocaleString()} base
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {activePackages.map(pkg => {
              const isSelected =
                selectedPackageId === pkg.id ||
                (!selectedPackageId && performanceType === pkg.performanceType);
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => selectFlatPackage(pkg)}
                  className={cn(
                    'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
                    isSelected
                      ? 'bg-[var(--wizard-accent)]/12 border-[var(--wizard-accent)] shadow-2xs'
                      : 'bg-card border-border/40 hover:border-border'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase text-[var(--fg)] truncate">
                      {pkg.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {pkg.musiciansCount}p
                    </span>
                  </div>
                  <span className="text-sm font-black text-[var(--wizard-accent)] tabular-nums">
                    {currencySymbol}
                    {pkg.flatPrice.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Compact Roster Selector Bar for Flat Package */}
          {availableMusicians.length > 0 && (
            <div className="bg-card border border-border/40 rounded-xl px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                  {selectedMusicians.slice(0, 5).map(m => (
                    <div
                      key={m.id}
                      className="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-card bg-foreground text-background"
                      title={m.name}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-semibold text-muted-foreground truncate">
                  {selectedMusicians.length} roster members assigned
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsRosterExpanded(!isRosterExpanded)}
                className="text-xs font-bold text-[var(--wizard-accent)] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>{isRosterExpanded ? 'Done' : 'Members'}</span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform',
                    isRosterExpanded && 'rotate-180'
                  )}
                />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
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
                <span className="text-xs font-bold text-[var(--wizard-accent)] truncate">
                  {currencySymbol}
                  {lineupBaseAmount.toLocaleString()} lineup base
                  {pricingSettings.band_markup_type !== 'none' &&
                  pricingSettings.band_markup_value > 0
                    ? pricingSettings.band_markup_type === 'percent'
                      ? ` (incl. +${pricingSettings.band_markup_value}% fund)`
                      : ` (incl. +${currencySymbol}${pricingSettings.band_markup_value} fund)`
                    : ''}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsRosterExpanded(!isRosterExpanded)}
              className="text-xs font-bold text-[var(--wizard-accent)] hover:opacity-80 flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
            >
              <span>{isRosterExpanded ? 'Done' : 'Customize'}</span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 transition-transform',
                  isRosterExpanded && 'rotate-180'
                )}
              />
            </button>
          </div>
        </div>
      )}

      {/* Collapsible 1-Column Member Fee Checklist */}
      <AnimatePresence>
        {isRosterExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-2"
          >
            <div className="divide-y divide-border/30 border-y border-border/30">
              {availableMusicians.map(musician => {
                const isSelected = selectedMusicians.some(m => m.id === musician.id);
                const currentMusician = selectedMusicians.find(m => m.id === musician.id);

                return (
                  <div
                    key={musician.id}
                    className="flex items-center justify-between py-2 px-2 hover:bg-card/60 transition-colors rounded-lg"
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
                            isSelected
                              ? 'text-[var(--fg)] font-semibold'
                              : 'text-muted-foreground'
                          )}
                        >
                          {musician.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider block leading-normal">
                          {musician.instrument || 'Musician'}
                        </span>
                      </div>
                    </div>

                    {isSelected && pricingSettings.pricing_mode === 'per_musician' && (
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

      {/* Unified Extra Sets & Add-Ons 1-Tap Chips */}
      {activeCatalogServices.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              EXTRA SETS & ADD-ONS{' '}
              <span className="text-[10px] font-normal lowercase opacity-60">(optional)</span>
            </span>
            {customItemsTotal > 0 && (
              <span className="text-xs font-bold text-[var(--wizard-accent)]">
                +{currencySymbol}
                {customItemsTotal.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeCatalogServices.map(srv => {
              const isAdded = customItems.some(
                it => it.id === srv.id || it.name === srv.name
              );
              const qty = getServiceAutoQty(srv);
              const lineTotal = srv.price * qty;

              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => toggleBandCustomService(srv)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                    isAdded
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)] shadow-2xs'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)] hover:border-border'
                  )}
                >
                  {isAdded ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  )}
                  <span className="truncate max-w-[180px]">{srv.name}</span>
                  <span
                    className={cn(
                      'text-[11px] font-black tabular-nums ml-0.5',
                      isAdded ? 'opacity-90' : 'text-[var(--fg)]/70'
                    )}
                  >
                    +{currencySymbol}
                    {lineTotal.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Inline Travel Pill Bar (rendered beneath VenueAutocomplete when venue or distance is set)
  const showInlineTravelPill =
    (Boolean(venueName.trim()) && venueName.trim().toUpperCase() !== 'TBD') ||
    (travelDistanceKm != null && travelDistanceKm > 0);

  const renderInlineTravelPill = () => {
    if (!showInlineTravelPill) return null;
    const freeRadius = pricingSettings.free_travel_radius_km || 0;
    const billableKm =
      travelDistanceKm != null ? Math.max(0, travelDistanceKm - freeRadius) : 0;

    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-card border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <Truck className="w-3.5 h-3.5 text-[var(--wizard-accent)] shrink-0" />
          {isCalculatingDistance ? (
            <span className="text-xs font-semibold text-muted-foreground">
              Calculating travel distance...
            </span>
          ) : travelDistanceKm != null && travelDistanceKm > 0 ? (
            <span className="text-xs font-bold text-[var(--fg)] truncate">
              {travelDistanceKm} km one-way{' '}
              <span className="font-normal text-muted-foreground">
                ({billableKm === 0 ? `≤${freeRadius}km free local` : `${billableKm}km billable`})
              </span>
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Travel:</span>
              <input
                type="number"
                min="0"
                value={travelDistanceKm ?? ''}
                onChange={e =>
                  handleManualDistanceChange(
                    e.target.value ? Math.max(0, parseFloat(e.target.value)) : undefined
                  )
                }
                placeholder="Dist. km"
                className="w-20 bg-background border border-border/40 rounded-md px-2 py-0.5 text-xs font-bold text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 bg-background border border-border/40 rounded-lg p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTravelMode('included');
              setTravelIncluded(true);
            }}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all cursor-pointer',
              travelMode === 'included'
                ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]'
                : 'text-muted-foreground hover:text-[var(--fg)]'
            )}
          >
            Included
          </button>
          <button
            type="button"
            onClick={() => {
              setTravelMode('separate');
              setTravelIncluded(false);
              if (travelFee === 0 && travelDistanceKm && travelDistanceKm > 0) {
                setTravelFee(computeTravelFeeForDistance(travelDistanceKm));
              }
            }}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all cursor-pointer',
              travelMode === 'separate'
                ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]'
                : 'text-muted-foreground hover:text-[var(--fg)]'
            )}
          >
            Separate{travelFee > 0 ? ` (+${currencySymbol}${travelFee})` : ''}
          </button>
          <button
            type="button"
            onClick={() => {
              setTravelMode('client_provided');
              setTravelIncluded(true);
            }}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all cursor-pointer',
              travelMode === 'client_provided'
                ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]'
                : 'text-muted-foreground hover:text-[var(--fg)]'
            )}
          >
            Client Arranged
          </button>
        </div>
      </div>
    );
  };

  // ── STEP 01: EVENT, LINEUP & EXTRA SETS ─────────────────────
  const renderStep1 = () => (
    <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Client & Occasion Inputs (Always 2-Column so Lineup peeks at 90% viewport) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1 truncate">
            EVENT TITLE{' '}
            <span className="text-[10px] font-normal text-muted-foreground/60 lowercase">
              (opt.)
            </span>
          </label>
          <input
            type="text"
            value={eventName}
            onChange={e => {
              setEventName(e.target.value);
              setTitleManuallyEdited(true);
            }}
            placeholder={getEffectiveTitle()}
            className="w-full bg-transparent border-b border-border/40 pb-1.5 text-sm sm:text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1 truncate">
            CLIENT NAME{' '}
            <span className="text-[10px] font-normal text-muted-foreground/60 lowercase">
              (opt.)
            </span>
          </label>
          <input
            type="text"
            value={clientName}
            onChange={e => {
              const val = e.target.value;
              setClientName(val);
              if (!titleManuallyEdited) {
                const typeLabel = eventType
                  ? eventType.charAt(0).toUpperCase() + eventType.slice(1)
                  : 'Wedding';
                setEventName(val ? `${typeLabel} - ${val}` : '');
              }
            }}
            placeholder="e.g. Paolo Rossi"
            className="w-full bg-transparent border-b border-border/40 pb-1.5 text-sm sm:text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Event Type Grid (Compact 2/3-Column) */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
          EVENT TYPE
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                    setEventName(clientName ? `${typeLabel} - ${clientName}` : '');
                  }
                }}
                className={cn(
                  'py-1.5 px-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2',
                  isSelected
                    ? 'bg-[var(--wizard-accent)]/10 border-[var(--wizard-accent)] shadow-xs'
                    : 'bg-card/60 border-border/40 hover:border-border hover:bg-card'
                )}
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isSelected
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]'
                      : 'bg-muted/60 text-muted-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold text-[var(--fg)] leading-tight truncate">
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate leading-snug">
                    {opt.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lineup & Unified Extra Sets Chips (Placed directly below Event Type so sections peek at 90% viewport) */}
      {renderLineupAndExtraSetsSection()}

      {/* Contact Details (Always 2-Column) */}
      <div className="grid grid-cols-2 gap-3 pt-0.5">
        <div>
          <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1 truncate">
            CLIENT EMAIL{' '}
            <span className="text-[10px] font-normal text-muted-foreground/60 lowercase">
              (opt.)
            </span>
          </label>
          <div className="relative">
            <input
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full bg-transparent border-b border-border/40 pb-1.5 pl-5 text-xs sm:text-sm font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
            />
            <Mail className="w-3.5 h-3.5 text-muted-foreground absolute left-0 bottom-2" />
          </div>
        </div>
        <div>
          <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1 truncate">
            CLIENT PHONE{' '}
            <span className="text-[10px] font-normal text-muted-foreground/60 lowercase">
              (opt.)
            </span>
          </label>
          <div className="relative">
            <input
              type="tel"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="+39 333 1234567"
              className="w-full bg-transparent border-b border-border/40 pb-1.5 pl-5 text-xs sm:text-sm font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:border-[var(--wizard-accent)] focus:outline-none transition-colors"
            />
            <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-0 bottom-2" />
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 02: DATE, VENUE & AUTO-TRAVEL ──────────────────────
  const renderStep2 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Unified Venue Input + Inline Travel Pill */}
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
              handleCalculateDistance(
                place.fullAddress || place.address || place.name || place.city || ''
              );
            }}
            placeholder="Search venue or location..."
            className="w-full bg-transparent border-b border-border/40 focus:border-[var(--wizard-accent)] pb-2 text-base font-medium text-[var(--fg)] placeholder:text-muted-foreground/60 focus:outline-none transition-colors pl-7"
          />
          <MapPin className="w-4 h-4 text-muted-foreground absolute left-0 bottom-3" />
        </div>

        {/* Inline Travel Pill directly beneath VenueAutocomplete */}
        {renderInlineTravelPill()}

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
        </div>
      </div>

      {/* Date & Time Group */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              EVENT DATE
            </label>
            {pricingSettings.seasonal_pricing_enabled && eventDate && (
              <span className="text-[11px] font-bold text-[var(--wizard-accent)]">
                {pricingSettings.peak_months?.includes(getEventMonthFromDate(eventDate) || 0)
                  ? 'Peak Season Rate Applied'
                  : pricingSettings.off_peak_months?.includes(
                        getEventMonthFromDate(eventDate) || 0
                      )
                    ? 'Off-Peak Rate Applied'
                    : 'Standard Season'}
              </span>
            )}
          </div>
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
              accentColor={activeAccentColor}
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
              accentColor={activeAccentColor}
              align="end"
              textSize="text-base"
              showIcon
              className="border-b border-border/40 text-[var(--fg)] focus-within:border-[var(--wizard-accent)] transition-colors pb-1.5"
            />
          </div>
        </div>

        {/* Performance Sets, Set Duration & Guest Count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
              NUMBER OF SETS
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumberOfSets(n)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                    numberOfSets === n
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                  )}
                >
                  {n} {n === 1 ? 'Set' : 'Sets'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
              MINS PER SET
            </label>
            <div className="flex gap-1.5">
              {[45, 60, 90, 120].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSetDuration(mins)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                    setDuration === mins
                      ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                      : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
                  )}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">
              GUEST COUNT{' '}
              <span className="text-[10px] font-normal lowercase opacity-60">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              value={guestCount ?? ''}
              onChange={e =>
                setGuestCount(e.target.value ? Math.max(0, parseInt(e.target.value)) : undefined)
              }
              placeholder="e.g. 150"
              className="w-full bg-card border border-border/40 rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Shared Inner Controls for Drawer 1: Billing, Discounts, VAT & Deposit
  const renderBillingControls = () => (
    <div className="space-y-4">
      {/* Base Fee Override */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            BASE FEE OVERRIDE
          </label>
          <span className="text-xs text-muted-foreground">
            {pricingSettings.pricing_mode === 'flat_packages'
              ? 'Package lineup fee'
              : `Musicians sum: ${currencySymbol}${musiciansTotal.toLocaleString()}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-muted-foreground">{currencySymbol}</span>
          <input
            type="number"
            value={baseFee || ''}
            onChange={e => {
              setBaseFeeManuallyEdited(true);
              setBaseFee(parseFloat(e.target.value) || 0);
            }}
            placeholder="0"
            className="w-28 bg-card border border-border/40 focus:border-[var(--wizard-accent)] rounded-lg px-2.5 py-1.5 text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
          />
        </div>
      </div>

      {/* Package Discount */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            PACKAGE DISCOUNT
          </label>
          <div className="flex gap-1">
            {(
              [
                { id: 'none', label: 'None' },
                { id: 'percentage', label: '% Off' },
                { id: 'fixed', label: `${currencySymbol.trim()} Off` },
              ] as const
            ).map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDiscountType(d.id);
                  if (d.id === 'none') setDiscountValue(0);
                  else if (d.id === 'percentage' && discountValue === 0) setDiscountValue(10);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border transition-all cursor-pointer',
                  discountType === d.id
                    ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                    : 'bg-card text-muted-foreground border-border/40'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {discountType !== 'none' && (
          <div className="flex items-center justify-between gap-3 pt-1">
            {discountType === 'percentage' && (
              <div className="flex gap-1.5">
                {[5, 10, 15, 20].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDiscountValue(pct)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                      discountValue === pct
                        ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                        : 'bg-card text-muted-foreground border-border/40'
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="number"
                min="0"
                value={discountValue || ''}
                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                className="w-20 bg-card border border-border/40 rounded-lg px-2.5 py-1 text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
              />
              <span className="text-xs font-bold text-muted-foreground">
                {discountType === 'percentage' ? '%' : currencySymbol}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* VAT Rate & Exempt */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            TAX / VAT RATE
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVatExempt(!vatExempt)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border transition-all cursor-pointer',
                vatExempt
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                  : 'bg-card text-muted-foreground border-border/40'
              )}
            >
              VAT Exempt (0%)
            </button>
            {!vatExempt && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={vatRate}
                  onChange={e => setCustomVatRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 bg-card border border-border/40 rounded-lg px-2 py-1 text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
                />
                <span className="text-xs font-bold text-muted-foreground">%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deposit Percentage Pills */}
      <div className="pt-2 border-t border-border/30">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
          BOOKING DEPOSIT REQUIRED
        </label>
        <div className="flex gap-2">
          {[0, 20, 30, 50].map(pct => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                setDepositPercentage(pct);
                setDepositRequired(pct > 0);
              }}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center',
                depositPercentage === pct
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              {pct === 0 ? 'None' : `${pct}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Validity Days & Show IBAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/30">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
            QUOTE VALIDITY
          </label>
          <select
            value={validityDays}
            onChange={e => setValidityDays(parseInt(e.target.value) || 30)}
            className="w-full bg-card border border-border/40 rounded-xl px-3 py-2 text-xs font-bold text-[var(--fg)] focus:outline-none cursor-pointer"
          >
            {[7, 14, 30, 60, 90].map(days => (
              <option key={days} value={days} className="bg-card text-[var(--fg)]">
                {days} Days (until {validUntilDate})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={() => setShowBankDetailsOnPdf(!showBankDetailsOnPdf)}
            className={cn(
              'w-full py-2 px-3 rounded-xl border text-xs font-bold uppercase flex items-center justify-between transition-all cursor-pointer',
              showBankDetailsOnPdf
                ? 'bg-[var(--wizard-accent)]/10 border-[var(--wizard-accent)] text-[var(--fg)]'
                : 'bg-card border-border/40 text-muted-foreground'
            )}
          >
            <span>Show IBAN on PDF</span>
            <DotCheckbox
              checked={showBankDetailsOnPdf}
              activeColor="var(--wizard-accent)"
              inactiveColor="var(--border)"
            />
          </button>
        </div>
      </div>
    </div>
  );

  // Shared Inner Controls for Drawer 2: Production, Travel, Hotel & Custom Items
  const renderLogisticsAndCustomItemsControls = () => (
    <div className="space-y-4">
      {/* Sound & Lighting Tier */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            SOUND & LIGHTING PRODUCTION
          </label>
          {productionTier !== 'none' && (
            <button
              type="button"
              onClick={() => {
                const nextIncluded = !soundIncluded;
                setSoundIncluded(nextIncluded);
                if (!nextIncluded && soundFee === 0) {
                  setSoundFee(
                    productionTier === 'pro'
                      ? pricingSettings.production_pro_fee || 600
                      : pricingSettings.production_standard_fee || 300
                  );
                }
              }}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border transition-all cursor-pointer',
                soundIncluded
                  ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                  : 'bg-[var(--wizard-accent)]/15 text-[var(--wizard-accent)] border-[var(--wizard-accent)]/30'
              )}
            >
              {soundIncluded ? 'Included in Base' : 'Separate Fee'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'standard', label: 'Standard PA' },
              { id: 'pro', label: 'Pro PA' },
              { id: 'none', label: 'Client PA' },
            ] as const
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setProductionTier(t.id);
                if (t.id === 'none') {
                  setSoundFee(0);
                } else if (!soundIncluded) {
                  setSoundFee(
                    t.id === 'pro'
                      ? pricingSettings.production_pro_fee || 600
                      : pricingSettings.production_standard_fee || 300
                  );
                }
              }}
              className={cn(
                'py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                productionTier === t.id
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!soundIncluded && productionTier !== 'none' && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">Production Fee</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-muted-foreground">{currencySymbol}</span>
              <input
                type="number"
                value={soundFee || ''}
                onChange={e => setSoundFee(parseFloat(e.target.value) || 0)}
                className="w-24 bg-card border border-border/40 rounded-lg px-2.5 py-1 text-right text-xs font-bold text-[var(--fg)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Travel Override */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          TRAVEL & TRANSPORT
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'included', label: 'Included' },
              { id: 'separate', label: 'Separate Fee' },
              { id: 'client_provided', label: 'Client Arranged' },
            ] as const
          ).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setTravelMode(opt.id);
                setTravelIncluded(opt.id !== 'separate');
              }}
              className={cn(
                'py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                travelMode === opt.id
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {travelMode === 'separate' && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between bg-card border border-border/40 rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">One-way (km)</span>
              <input
                type="number"
                value={travelDistanceKm ?? ''}
                onChange={e =>
                  handleManualDistanceChange(
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                placeholder="0"
                className="w-16 bg-transparent text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between bg-card border border-border/40 rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Fee ({currencySymbol})</span>
              <input
                type="number"
                value={travelFee || ''}
                onChange={e => setTravelFee(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-20 bg-transparent text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Hotel / Accommodation Override */}
      <div className="space-y-2 pt-2 border-t border-border/30">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          HOTEL & ACCOMMODATION
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { id: 'included', label: 'Included' },
              { id: 'separate', label: 'Separate Fee' },
              { id: 'client_provided', label: 'Client Hotel' },
              { id: 'none', label: 'Not Needed' },
            ] as const
          ).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setAccommodationMode(opt.id);
                setAccommodationNeeded(opt.id === 'separate');
              }}
              className={cn(
                'py-1.5 rounded-lg text-xs font-bold uppercase border transition-all cursor-pointer',
                accommodationMode === opt.id
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] border-[var(--wizard-accent)]'
                  : 'bg-card text-muted-foreground border-border/40 hover:text-[var(--fg)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {accommodationMode === 'separate' && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="flex items-center justify-between bg-card border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground">Rooms</span>
              <input
                type="number"
                min="1"
                value={accommodationRooms}
                onChange={e => setAccommodationRooms(parseInt(e.target.value) || 1)}
                className="w-10 bg-transparent text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between bg-card border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground">Nights</span>
              <input
                type="number"
                min="1"
                value={accommodationNights}
                onChange={e => setAccommodationNights(parseInt(e.target.value) || 1)}
                className="w-10 bg-transparent text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between bg-card border border-border/40 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground">{currencySymbol}</span>
              <input
                type="number"
                value={accommodationFee || ''}
                onChange={e => setAccommodationFee(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-16 bg-transparent text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Selected Sets & One-Off Custom Line Items */}
      <div className="space-y-2.5 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            SELECTED SETS & CUSTOM ITEMS
          </span>
          <button
            type="button"
            onClick={() =>
              setCustomItems(prev => [
                ...prev,
                {
                  id: `item-${Date.now()}`,
                  name: 'Custom Line Item',
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
            <span>Add Custom Line Item</span>
          </button>
        </div>

        {customItems.length === 0 ? (
          <span className="text-xs text-muted-foreground block">
            No extra sets or custom line items added.
          </span>
        ) : (
          <div className="space-y-2">
            {customItems.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={item.name || item.description || ''}
                  onChange={e =>
                    setCustomItems(prev =>
                      prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it))
                    )
                  }
                  className="flex-1 min-w-0 bg-card border border-border/40 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--fg)] focus:outline-none"
                  placeholder="Item name..."
                />
                <div className="flex items-center gap-1 bg-card border border-border/40 rounded-lg px-2 py-1.5 w-16 shrink-0">
                  <span className="text-[10px] text-muted-foreground">×</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity || 1}
                    onChange={e => {
                      const q = Math.max(1, parseInt(e.target.value) || 1);
                      setCustomItems(prev =>
                        prev.map((it, i) => (i === idx ? { ...it, quantity: q } : it))
                      );
                    }}
                    className="w-full bg-transparent text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 bg-card border border-border/40 rounded-lg px-2 py-1.5 w-24 shrink-0">
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
                    className="w-full bg-transparent text-right text-xs font-bold text-[var(--fg)] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCustomItems(prev => prev.filter((_, i) => i !== idx))}
                  className="p-1 text-muted-foreground hover:text-[var(--danger)] shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Shared Inner Controls for Drawer 3: Multi-Option Proposal & Contract Terms
  const renderProposalAndTermsControls = () => (
    <div className="space-y-4">
      {/* Multi-Option Tier Comparison Toggle */}
      <div className="space-y-3">
        <div
          onClick={() => handleToggleProposalSummary(!includeProposalSummary)}
          className={cn(
            'p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all',
            includeProposalSummary
              ? 'bg-[var(--wizard-accent)]/10 border-[var(--wizard-accent)]'
              : 'bg-card border-border/40'
          )}
        >
          <div className="pr-3">
            <span className="text-xs font-bold uppercase block text-[var(--fg)]">
              Multi-Option Proposal Comparison Table
            </span>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Compare multiple lineup sizes/packages side-by-side in the exported PDF.
            </span>
          </div>
          <DotCheckbox
            checked={includeProposalSummary}
            activeColor="var(--wizard-accent)"
            inactiveColor="var(--border)"
          />
        </div>

        {includeProposalSummary && (
          <div className="space-y-2.5">
            {quoteOptions.map((opt, idx) => (
              <div
                key={opt.id}
                className="p-3 rounded-xl bg-background border border-border/40 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--wizard-accent)]">
                    OPTION 0{idx + 1} • INCL. VAT: {currencySymbol}
                    {opt.totalWithVat.toLocaleString()}
                  </span>
                  {quoteOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePackageOption(opt.id)}
                      className="text-muted-foreground hover:text-[var(--danger)] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Tier Name
                    </label>
                    <input
                      type="text"
                      value={opt.name}
                      onChange={e => updatePackageOption(opt.id, { name: e.target.value })}
                      className="w-full bg-card border border-border/40 rounded-lg px-2 py-1 text-xs font-bold text-[var(--fg)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Musicians
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={opt.musiciansCount}
                      onChange={e =>
                        updatePackageOption(opt.id, {
                          musiciansCount: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-full bg-card border border-border/40 rounded-lg px-2 py-1 text-xs font-bold text-[var(--fg)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Gross Fee ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      value={opt.grossFee}
                      onChange={e =>
                        updatePackageOption(opt.id, {
                          grossFee: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-card border border-border/40 rounded-lg px-2 py-1 text-xs font-bold text-[var(--fg)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Discount %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={opt.discountPercent}
                      onChange={e =>
                        updatePackageOption(opt.id, {
                          discountPercent: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-card border border-border/40 rounded-lg px-2 py-1 text-xs font-bold text-[var(--fg)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                    Lineup / Instrumentation Description
                  </label>
                  <input
                    type="text"
                    value={opt.instrumentsText}
                    onChange={e =>
                      updatePackageOption(opt.id, { instrumentsText: e.target.value })
                    }
                    className="w-full bg-card border border-border/40 rounded-lg px-2.5 py-1 text-xs text-[var(--fg)]"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addPackageOption}
              className="w-full py-2 rounded-xl border border-dashed border-border hover:border-[var(--wizard-accent)] text-xs font-bold uppercase text-[var(--wizard-accent)] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lineup Option Tier</span>
            </button>
          </div>
        )}
      </div>

      {/* Quote Subtitle */}
      <div className="pt-2 border-t border-border/30">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
          QUOTE SUBTITLE / DESCRIPTION{' '}
          <span className="text-[10px] font-normal lowercase opacity-60">(optional)</span>
        </label>
        <input
          type="text"
          value={quoteDescription}
          onChange={e => setQuoteDescription(e.target.value)}
          placeholder={`Formal quote for an event in ${venueName || venueCity || 'Venue'}`}
          className="w-full bg-background border border-border/40 focus:border-[var(--wizard-accent)] rounded-xl px-3 py-2 text-xs text-[var(--fg)] focus:outline-none"
        />
      </div>

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
    </div>
  );

  // ── STEP 03: CONSOLIDATED REVIEW & 3 DRAWERS ────────────────
  const renderStep3 = () => (
    <div className="space-y-3.5 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Unified Summary Card + Mini Financial Ledger */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/40 space-y-3.5 shadow-2xs">
        {/* Badges & Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[var(--wizard-accent)]/15 text-[var(--wizard-accent)]">
                QUOTE
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
                {eventType.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
                {selectedMusicians.length || pricingSettings.core_members_count} MUSICIANS
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)] tracking-tight truncate">
              {getEffectiveTitle()}
            </h3>
            <span className="text-xs text-muted-foreground font-semibold block mt-0.5 uppercase truncate">
              Client: {clientName.trim() || 'Client TBD'}
              {clientEmail ? ` • ${clientEmail}` : ''}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs font-bold text-[var(--wizard-accent)]">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>Lineup</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>Venue</span>
            </button>
          </div>
        </div>

        {/* Date & Venue Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/30 text-xs text-[var(--fg)]">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-[var(--wizard-accent)] shrink-0" />
            <span className="font-semibold truncate">
              {eventDate ? formattedDateStr : 'Date TBD'} · {eventTimeStart}–{eventTimeEnd}
            </span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-[var(--wizard-accent)] shrink-0" />
            <span className="font-semibold truncate">
              {venueName || 'Venue TBD'}
              {venueCity ? `, ${venueCity}` : ''}
            </span>
          </div>
        </div>

        {/* Mini Financial Ledger */}
        <div className="rounded-xl bg-background/70 border border-border/40 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Lineup Base ({numberOfSets}×{setDuration}m)</span>
            <span className="font-bold text-[var(--fg)] tabular-nums">
              {currencySymbol}
              {Math.round(lineupBaseAmount).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>
              Selected Sets & Extras
              {customItems.length > 0 ? ` (${customItems.length})` : ''}
            </span>
            <span className="font-bold text-[var(--fg)] tabular-nums">
              {setsAndExtrasAmount > 0
                ? `${currencySymbol}${Math.round(setsAndExtrasAmount).toLocaleString()}`
                : `${currencySymbol}0`}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Travel & Production</span>
            <span className="font-bold text-[var(--fg)] tabular-nums">
              {travelAndProductionAmount > 0
                ? `${currencySymbol}${Math.round(travelAndProductionAmount).toLocaleString()}`
                : 'Included'}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Discount</span>
            <span
              className={cn(
                'font-bold tabular-nums',
                totals.discountAmount > 0 ? 'text-emerald-600' : 'text-[var(--fg)]'
              )}
            >
              {totals.discountAmount > 0
                ? `−${currencySymbol}${Math.round(totals.discountAmount).toLocaleString()}`
                : `${currencySymbol}0`}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>VAT ({vatExempt || reverseCharge ? '0% Exempt' : `${vatRate}%`})</span>
            <span className="font-bold text-[var(--fg)] tabular-nums">
              {currencySymbol}
              {Math.round(totals.vatAmount).toLocaleString()}
            </span>
          </div>
          <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--fg)]">
              Total{depositRequired && depositPercentage > 0 ? ` (${depositPercentage}% Deposit)` : ''}
            </span>
            <span className="text-base font-black text-[var(--wizard-accent)] tabular-nums">
              {currencySymbol}
              {Math.round(totals.total).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Drawer 1: Billing, Discounts, VAT & Deposit */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => toggleReviewDrawer('billing')}
          className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <Euro className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-[var(--fg)] block truncate">
                Billing, Discounts, VAT & Deposit
              </span>
              <span className="text-xs text-muted-foreground block truncate">
                Net: {currencySymbol}
                {Math.round(totals.netAmount).toLocaleString()}
                {totals.discountAmount > 0
                  ? ` (−${currencySymbol}${Math.round(totals.discountAmount)})`
                  : ''}{' '}
                • VAT: {vatRate}% • Deposit: {depositRequired ? `${depositPercentage}%` : 'None'}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              openReviewDrawer === 'billing' && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {openReviewDrawer === 'billing' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 overflow-hidden"
            >
              {renderBillingControls()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drawer 2: Production, Travel, Hotel & Custom Items */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => toggleReviewDrawer('logistics')}
          className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-[var(--fg)] block truncate">
                Production, Travel, Hotel & Custom Items
              </span>
              <span className="text-xs text-muted-foreground block truncate">
                PA: {productionTier.toUpperCase()} • Travel:{' '}
                {travelMode === 'included'
                  ? 'Included'
                  : travelMode === 'separate'
                    ? `${currencySymbol}${travelFee}`
                    : 'Client'}{' '}
                • {customItems.length} {customItems.length === 1 ? 'Extra' : 'Extras'}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              openReviewDrawer === 'logistics' && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {openReviewDrawer === 'logistics' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 overflow-hidden"
            >
              {renderLogisticsAndCustomItemsControls()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drawer 3: Multi-Option Proposal & Contract Terms */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => toggleReviewDrawer('proposal_terms')}
          className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--wizard-accent)]/10 text-[var(--wizard-accent)] flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-[var(--fg)] block truncate">
                Multi-Option Proposal & Contract Terms
              </span>
              <span className="text-xs text-muted-foreground block truncate">
                {includeProposalSummary
                  ? `${quoteOptions.length} Option Tiers`
                  : 'Single-Option Quote'}{' '}
                • {cancellationPolicy.toUpperCase()} • {clientNotes ? 'Notes added' : 'Standard terms'}
              </span>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2',
              openReviewDrawer === 'proposal_terms' && 'rotate-180'
            )}
          />
        </button>

        <AnimatePresence>
          {openReviewDrawer === 'proposal_terms' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4 border-t border-border/30 pt-3 overflow-hidden"
            >
              {renderProposalAndTermsControls()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ── ACCORDION EDIT VIEW (ALL 5 SECTIONS FOR isEditing === true) ──
  const renderEditAccordionView = () => (
    <div className="flex flex-col gap-4">
      {/* 01: Client & Occasion */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.client_event)}
        onToggle={() => toggleEditSection('client_event')}
        stepNumber="01"
        title="CLIENT & OCCASION"
        summary={`${clientName || 'NO CLIENT'} • ${(eventType || 'wedding').toUpperCase()} • ${indoorOutdoor.toUpperCase()}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                className="w-full bg-transparent border-b border-border/40 pb-1.5 text-base font-bold text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
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
                className="w-full bg-transparent border-b border-border/40 pb-1.5 text-base font-bold text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                CLIENT EMAIL
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full bg-transparent border-b border-border/40 pb-1.5 text-sm font-medium text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                CLIENT PHONE
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                placeholder="+39 333 1234567"
                className="w-full bg-transparent border-b border-border/40 pb-1.5 text-sm font-medium text-[var(--fg)] focus:outline-none focus:border-[var(--wizard-accent)]"
              />
            </div>
          </div>
        </div>
      </QuoteAccordionCard>

      {/* 02: Date & Venue */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.date_venue)}
        onToggle={() => toggleEditSection('date_venue')}
        stepNumber="02"
        title="DATE & VENUE"
        summary={`${formattedDateStr} @ ${eventTimeStart} - ${eventTimeEnd} • ${venueName || 'VENUE TBD'}`}
      >
        {renderStep2()}
      </QuoteAccordionCard>

      {/* 03: Lineup & Extra Sets */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.lineup_moments)}
        onToggle={() => toggleEditSection('lineup_moments')}
        stepNumber="03"
        title="LINEUP & EXTRA SETS"
        summary={`${selectedMusicians.length} MUSICIANS • ${customItems.length} EXTRAS • ${currencySymbol}${(lineupBaseAmount + setsAndExtrasAmount).toLocaleString()}`}
      >
        {renderLineupAndExtraSetsSection()}
      </QuoteAccordionCard>

      {/* 04: Pricing, Logistics & Billing */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.pricing_billing)}
        onToggle={() => toggleEditSection('pricing_billing')}
        stepNumber="04"
        title="PRICING, LOGISTICS & BILLING"
        summary={`NET ${currencySymbol}${Math.round(totals.netAmount).toLocaleString()} • VAT ${vatRate}% • TOTAL ${currencySymbol}${Math.round(totals.total).toLocaleString()}`}
      >
        <div className="space-y-5">
          {renderBillingControls()}
          <div className="pt-3 border-t border-border/40">
            {renderLogisticsAndCustomItemsControls()}
          </div>
        </div>
      </QuoteAccordionCard>

      {/* 05: Multi-Option Proposal & Terms */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.terms_notes)}
        onToggle={() => toggleEditSection('terms_notes')}
        stepNumber="05"
        title="PROPOSAL OPTIONS & TERMS"
        summary={`${includeProposalSummary ? `${quoteOptions.length} OPTIONS` : 'SINGLE QUOTE'} • ${cancellationPolicy.toUpperCase()} • ${paymentMethods.join(', ').toUpperCase()}`}
      >
        {renderProposalAndTermsControls()}
      </QuoteAccordionCard>
    </div>
  );

  // Compact Live Quote Estimate Bar (used in Footer across all steps)
  const renderLiveEstimateBar = () => (
    <div className="flex items-baseline justify-between mb-2.5 px-1 gap-2">
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          TOTAL ESTIMATE
        </span>
        <span className="text-[11px] text-muted-foreground truncate">
          Net {currencySymbol}
          {Math.round(totals.netAmount).toLocaleString()} ·{' '}
          {vatExempt || reverseCharge
            ? 'VAT Exempt'
            : `+${vatRate}% VAT (${currencySymbol}${Math.round(totals.vatAmount).toLocaleString()})`}
        </span>
      </div>
      <span className="text-xl font-black text-[var(--fg)] tabular-nums shrink-0">
        {currencySymbol}
        {Math.round(totals.total).toLocaleString()}
      </span>
    </div>
  );

  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;

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

        {/* Top Header Zone */}
        <div
          className="px-6 pb-4 shrink-0 bg-[var(--bg)]/95 backdrop-blur-md border-b border-border/40 z-10 flex items-start justify-between"
          style={{
            paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))',
          }}
        >
          <div className="flex flex-col gap-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] shadow-xs">
                EDITING
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground">
                {initialData?.quoteNumber || 'QUOTE'}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-md bg-muted text-muted-foreground">
                {(eventType || 'wedding').toUpperCase()}
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
        <PeekingScrollContainer className="flex-1 px-6 py-4 min-h-0">
          {renderEditAccordionView()}
        </PeekingScrollContainer>

        {/* Bottom Action Bar */}
        <div className="px-6 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-3.5 shrink-0 border-t border-border/40 bg-[var(--bg)]/95 backdrop-blur-md">
          {renderLiveEstimateBar()}
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-xs uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4 text-[var(--fg)]" />
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => handleCreate(false)}
              className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-xs uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              SAVE DRAFT
            </button>
            <button
              type="button"
              onClick={() => handleCreate(true)}
              className="rounded-xl py-3.5 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              SHARE QUOTE
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

      {/* Top Header Zone */}
      <div
        className="shrink-0 px-6 pb-3 border-b border-border/40 bg-[var(--bg)] z-10 flex flex-col gap-3"
        style={{
          paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))',
        }}
      >
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
      <PeekingScrollContainer className="flex-1 px-6 py-4 space-y-5 min-h-0">
        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}
      </PeekingScrollContainer>

      {/* Bottom Action Bar (with Live Quote Estimate on ALL steps) */}
      <div className="shrink-0 border-t border-border/40 px-6 pb-[max(env(safe-area-inset-bottom,16px),16px)] pt-3.5 bg-[var(--bg)]/95 backdrop-blur-md">
        {renderLiveEstimateBar()}

        {isLastStep ? (
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={handleBack}
              className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-xs uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[var(--fg)]" />
              BACK
            </button>
            <button
              type="button"
              onClick={() => handleCreate(false)}
              className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-xs uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-[var(--fg)]" />
              SAVE DRAFT
            </button>
            <button
              type="button"
              onClick={() => handleCreate(true)}
              className="rounded-xl py-3.5 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              SHARE QUOTE
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {isFirstStep ? (
              <button
                type="button"
                onClick={onClose}
                className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--fg)]" />
                CANCEL
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBack}
                className="bg-card text-[var(--fg)] border border-border/40 rounded-xl py-3.5 font-bold text-sm uppercase tracking-wider hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--fg)]" />
                BACK
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className={cn(
                'rounded-xl py-3.5 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                !canProceed
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-95 shadow-lg shadow-black/20 cursor-pointer'
              )}
            >
              <span>NEXT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
