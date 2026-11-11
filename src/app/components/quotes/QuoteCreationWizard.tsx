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
  ArrowUpRight,
  Sparkles,
  Check,
  AlertCircle,
  Briefcase,
  Users,
  User,
  Mic2,
  Sliders,
  Music,
  Edit3,
  Share2,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { getEventAccentColor } from '@/app/components/ui/WizardAccentRail';
import { PeekingScrollContainer } from '@/app/components/ui/PeekingScrollContainer';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { DotText, Toggle } from '@/app/components/bw';
import { HeaderAction, IconButton, NavBackButton, Tag } from '@/app/components/bw/Screen';
import { RailCover, useRailAction } from '@/lib/railActions';
import { useSystemBack } from '@/lib/backStack';
import { LeaveWizardSheet } from '@/app/components/bw/LeaveWizardSheet';
import { PillButton, PillField } from '@/app/components/bw/Form';
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
  calculateVAT,
} from '@/app/data/quotes';
import { useBand } from '@/lib/BandContext';
import { todayLocal, toLocalDateString } from '@/lib/dates';
import {
  calculateQuoteTotals,
  calculateTotalsFromSubtotal,
  calculateDepositAmount,
  formatQuoteMoney,
} from '@/lib/services/quoteMath';
import {
  getBandPricing,
  DEFAULT_BAND_PRICING,
  calculateLineupBaseFromSettings,
  calculateTravelFeeFromSettings,
  type BandPricingSettings,
  type CustomService,
  type LineupPackagePreset,
  maskedBankAccount,
} from '@/lib/services/pricing';
import { calculateTravelDistance, venueFields } from '@/lib/services/location';
import { formatDistance, fromUnit, ratePerUnit, toUnit, useDistanceUnit } from '@/lib/units';
import { QuoteDeskMode, quoteDeskLinesFromQuote, useLeadingCompanion, type QuoteDeskLine } from '@/app/components/duo';
import { LiveQuotePreview } from '@/app/components/duo/previews/LiveQuotePreview';
import { personName } from '@/lib/personName';

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

// 'pub' is a wizard-level split of the legacy 'club' value (Figma: 7 chips).
// quotes.event_type is a free VARCHAR, so both persist as-is; existing 'club'
// quotes keep selecting the "Club" chip.
type WizardEventType = QuoteEventType | 'pub';

const EVENT_TYPE_OPTIONS: {
  value: WizardEventType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'wedding', label: 'Wedding', subtitle: 'Ceremony, dinner & party', icon: Sparkles },
  { value: 'corporate', label: 'Corporate', subtitle: 'Company gala & summits', icon: Briefcase },
  { value: 'private', label: 'Private party', subtitle: 'Birthdays & celebrations', icon: Users },
  { value: 'festival', label: 'Festival', subtitle: 'Open-air & main stages', icon: Music },
  { value: 'club', label: 'Club', subtitle: 'Live music & night venue', icon: Mic2 },
  { value: 'pub', label: 'Pub', subtitle: 'Pub & bar sets', icon: Mic2 },
  { value: 'other', label: 'Other', subtitle: 'Tailored event setup', icon: Sliders },
];

/** Human label for a stored event type (falls back to a capitalised raw value). */
const eventTypeLabel = (value?: string | null): string => {
  if (!value) return 'Wedding';
  const opt = EVENT_TYPE_OPTIONS.find(o => o.value === value);
  return opt ? opt.label : value.charAt(0).toUpperCase() + value.slice(1);
};

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

/* ─────────────────────────────────────────────────────────────────────────
 * Local building blocks for the Figma "Quote / New" frames (28:2, 28:166,
 * 28:299). Labels are Label/SM, inputs are 52pt pills on bg/field, choice
 * chips are fully rounded, cards are bg/card r24 p16.
 * ───────────────────────────────────────────────────────────────────────── */

const FieldLabel: React.FC<{ children: React.ReactNode; className?: string; htmlFor?: string }> = ({ children, className, htmlFor }) => (
  <label htmlFor={htmlFor} className={cn('bw-label-sm text-muted-foreground', className)}>
    {children}
  </label>
);

/** Classes that turn the shared Date/Time pickers' trigger into a Figma Input pill. */
const PICKER_PILL =
  'h-[52px] px-4 pb-0 gap-3 rounded-full bg-field border border-border text-lg font-medium text-foreground hover:border-foreground focus:border-foreground';

/** Pill wrapper for inputs that are not PillFields (venue search, inline numbers). */
const PILL_WRAP =
  'flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border text-foreground focus-within:border-2 focus-within:border-foreground transition-[border-color]';

/** Compact numeric pill (44 / 36pt) used inside cards. */
const MiniNumber: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> & {
    label: string;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
    size?: 'md' | 'sm';
  }
> = ({ label, prefix, suffix, size = 'md', className, ...rest }) => (
  <label
    className={cn(
      'flex items-center gap-1 rounded-full bg-field border border-border px-3 text-foreground focus-within:border-foreground',
      size === 'md' ? 'h-11' : 'h-9',
      className,
    )}
  >
    <span className="sr-only">{label}</span>
    {prefix != null && <span className="bw-body-sm text-muted-foreground shrink-0">{prefix}</span>}
    <input
      type="number"
      className={cn('flex-1 min-w-0 w-full bg-transparent outline-none text-right tabular-nums', size === 'md' ? 'bw-body-lg' : 'bw-body-sm font-medium')}
      {...rest}
    />
    {suffix != null && <span className="bw-label-sm text-muted-foreground shrink-0">{suffix}</span>}
  </label>
);

/** Choice chip (Figma Selector). `tone="accent"` uses the quote colour for the selected state. */
const Chip: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  tone?: 'inverse' | 'accent';
  className?: string;
  title?: string;
}> = ({ selected, onClick, children, size = 'sm', tone = 'inverse', className, title }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    title={title}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full bw-label-sm whitespace-nowrap shrink-0 transition-colors active:scale-[var(--press-scale,0.97)]',
      size === 'sm' ? 'h-7 px-3' : 'h-9 px-4',
      selected
        ? tone === 'accent'
          ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]'
          : 'bg-surface-inverse text-surface-inverse-foreground'
        : 'border border-foreground/25 text-foreground',
      className,
    )}
  >
    {children}
  </button>
);

/** Segmented control: pill track, selected option in inverse. */
const Segmented = <T extends string>({
  options,
  value,
  onSelect,
  label,
  track = 'card',
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
  label: string;
  track?: 'card' | 'field';
}) => (
  <div role="radiogroup" aria-label={label} className={cn('flex gap-1 p-1 rounded-full', track === 'card' ? 'bg-card' : 'bg-field')}>
    {options.map(opt => (
      <button
        key={opt.id}
        type="button"
        role="radio"
        aria-checked={value === opt.id}
        onClick={() => onSelect(opt.id)}
        className={cn(
          'flex-1 min-w-0 min-h-10 px-2 py-1.5 rounded-full bw-button-sm leading-tight text-center transition-colors',
          value === opt.id ? 'bg-surface-inverse text-surface-inverse-foreground' : 'text-foreground',
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/** Figma stepper card (Number of sets / Mins per set): Label/SM, − dot value +. */
const StepperCard: React.FC<{ label: string; value: number; onDec: () => void; onInc: () => void; decDisabled?: boolean; incDisabled?: boolean }> = ({
  label,
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}) => (
  <div className="flex flex-col gap-3 p-4 rounded-[24px] bg-card min-w-0">
    <span className="bw-label-sm text-muted-foreground truncate">{label}</span>
    <div className="flex items-center justify-between gap-2">
      <IconButton size="sm" label={`Decrease ${label.toLowerCase()}`} icon={<Minus />} onClick={onDec} disabled={decDisabled} />
      <DotText text={value} size={28} label={`${label}: ${value}`} />
      <IconButton size="sm" variant="filled" label={`Increase ${label.toLowerCase()}`} icon={<Plus />} onClick={onInc} disabled={incDisabled} />
    </div>
  </div>
);

// --- Interactive Step Indicator (Figma: 3 bars + "STEP 1 OF 3 · TITLE") ---
const InteractiveQuoteStepIndicator: React.FC<{
  current: number;
  total: number;
  steps: { id: string; title: string }[];
  maxAccessibleStep: number;
  onSelectStep: (step: number) => void;
  activeColor?: string;
  inactiveColor?: string;
}> = ({ current, total, steps, maxAccessibleStep, onSelectStep, activeColor }) => (
  <div className="flex flex-col gap-2 w-full">
    <div className="flex items-center gap-1.5 w-full">
      {Array.from({ length: total }).map((_, i) => {
        const isAccessible = i <= maxAccessibleStep;
        const isFilled = i <= current;
        return (
          <button
            key={i}
            type="button"
            onClick={() => isAccessible && onSelectStep(i)}
            disabled={!isAccessible}
            aria-label={`Step ${i + 1}: ${steps[i]?.title || ''}`}
            aria-current={i === current ? 'step' : undefined}
            className={cn('flex-1 py-2 -my-2', isAccessible ? 'cursor-pointer' : 'cursor-not-allowed')}
          >
            <span
              className={cn('block h-1 w-full rounded-full transition-colors', !isFilled && 'bg-foreground/15')}
              style={isFilled ? { backgroundColor: activeColor || 'var(--wizard-accent)' } : undefined}
            />
          </button>
        );
      })}
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className="bw-label-xs text-muted-foreground">
        Step {current + 1} of {total}
      </span>
      <span className="bw-label-xs text-foreground truncate">{steps[current]?.title}</span>
    </div>
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
}> = ({ isOpen, onToggle, stepNumber, title, summary, hasWarning, warningLabel = 'Needs attention', children }) => {
  return (
    <div className={cn('rounded-[24px] bg-card overflow-hidden', hasWarning && 'ring-2 ring-warning')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bw-label-sm text-muted-foreground">{stepNumber}</span>
            <span className="bw-label-sm text-foreground">{title}</span>
            {hasWarning && (
              <Tag variant="outline" icon={<AlertCircle />} className="text-warning border-warning">
                {warningLabel}
              </Tag>
            )}
          </div>
          <span className="bw-body-sm text-muted-foreground truncate">{summary}</span>
        </div>
        <ChevronDown className={cn('w-5 h-5 shrink-0 transition-transform', !isOpen && '-rotate-90')} />
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
            <div className="px-4 pb-4 pt-1 flex flex-col gap-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Review breakdown row: Body/MD label, Label/MD value. */
const LedgerRow: React.FC<{ label: string; value: string; tone?: 'success' }> = ({ label, value, tone }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="bw-body-md text-muted-foreground min-w-0">{label}</span>
    <span className={cn('bw-label-md shrink-0', tone === 'success' ? 'text-success' : 'text-foreground')}>{value}</span>
  </div>
);

interface QuoteCreationWizardProps {
  onClose: () => void;
  /** `share`: the user tapped Share, open the PDF/share sheet after saving. */
  onCreate: (quote: Partial<Quote>, opts?: { share?: boolean; askAvailability?: boolean }) => void;
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

  // Distances are kept in km; per-distance services are priced and counted in the chosen unit.
  const distanceUnit = useDistanceUnit();
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
        name: personName(m.profile),
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
  // Ask the lineup for availability now (RSVP), before the client accepts.
  const [askAvailability, setAskAvailability] = useState(false);

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
  >(initialData?.includeProposalSummary ? 'proposal_terms' : 'billing');

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

  // Default eventType to 'wedding' so Step 1 NEXT is never blocked on load
  const [eventType, setEventType] = useState<WizardEventType>(
    initialData?.eventType || 'wedding'
  );

  const activeAccentColor = useMemo(() => getEventAccentColor(eventType, 'quote'), [eventType]);

  const [eventDate, setEventDate] = useState(
    initialData?.eventDate || todayLocal()
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
          const targetQty = Math.max(1, toUnit(travelDistanceKm, distanceUnit));
          const unitPrice = ratePerUnit(srv.price, distanceUnit);
          if (item.quantity !== targetQty || item.price !== unitPrice) {
            changed = true;
            return { ...item, quantity: targetQty, price: unitPrice, amount: unitPrice };
          }
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [allMusicians.length, travelDistanceKm, distanceUnit, pricingSettings.custom_services, pricingSettings.core_members_count]);

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

  // Shared quote math (src/lib/services/quoteMath.ts): same numbers on screen, in the PDF and in the DB
  const totals = useMemo(() => {
    const effectiveBase = lineupBaseAmount + legacyMomentsTotal;
    const t = calculateQuoteTotals({
      lineItems: [
        { amount: effectiveBase },
        { amount: effectiveTravelFee },
        { amount: effectiveAccommodationFee },
        { amount: effectiveMealsFee },
        { amount: effectiveSoundFee },
        { amount: effectiveLightsFee },
        { amount: effectiveBacklineFee },
        ...normalizedCustomItemsForCalc.map(it => ({ amount: it.amount, quantity: it.quantity })),
      ],
      discountType,
      discountValue,
      vatRate,
      vatExempt,
      reverseCharge,
    });
    return {
      subtotal: t.subtotal,
      discountAmount: t.discount,
      netAmount: t.net,
      vatAmount: t.vat,
      total: t.total,
    };
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
    return toLocalDateString(date);
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
        return Math.max(1, travelDistanceKm ? toUnit(travelDistanceKm, distanceUnit) : 50);
      }
      if (srv.unit === 'per_hour' && srv.default_duration_mins) {
        return Math.max(1, Math.round(srv.default_duration_mins / 60));
      }
      return 1;
    },
    [allMusicians.length, pricingSettings.core_members_count, travelDistanceKm, distanceUnit]
  );
  /** Catalog price per unit of the line: per-distance services in the chosen unit. */
  const servicePrice = (srv: Pick<CustomService, 'unit' | 'price'>) =>
    srv.unit === 'per_km' ? ratePerUnit(srv.price, distanceUnit) : srv.price;

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
          price: servicePrice(srv),
          amount: servicePrice(srv),
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
      const clampedPct = Math.min(100, Math.max(0, Number.isFinite(discountPct) ? discountPct : 0));
      const vRate = vatExempt || reverseCharge ? 0 : vatRate;
      const optTotals = calculateTotalsFromSubtotal(grossFee, {
        discountType: 'percentage',
        discountValue: clampedPct,
        vatRate: vRate,
      });
      const discAmt = optTotals.discount;
      const netSub = optTotals.net;
      const vAmt = optTotals.vat;
      const totWithVat = optTotals.total;
      const depPct = depositRequired ? depositPercentage : 0;
      const depAmt = calculateDepositAmount(totWithVat, depPct);
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
        grossFee: optTotals.subtotal,
        discountPercent: clampedPct,
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

    const depositAmt = depositRequired ? calculateDepositAmount(totals.total, depositPercentage) : 0;

    const quoteData: Partial<Quote> = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      // New quotes get their number from the database on insert (services/quotes.ts createQuote);
      // the caller must put the DB number on the quote before the PDF/share step.
      ...(initialData?.quoteNumber ? { quoteNumber: initialData.quoteNumber } : {}),
      // Saved as a draft; it becomes SENT only after a share channel completes (QuoteShareModal).
      status: initialData?.status || 'DRAFT',
      clientName: finalClientName,
      clientEmail: clientEmail.trim() || '',
      clientPhone: clientPhone.trim() || undefined,
      clientCompany: clientCompany.trim() || undefined,
      eventName: finalEventName,
      eventType: (eventType || 'wedding') as QuoteEventType,
      eventDate: eventDate || todayLocal(),
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
      sentAt: initialData?.sentAt,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventTitle: finalEventName,
    };
    onCreate(quoteData, { share: sendImmediately, askAvailability: !isEditing && askAvailability });
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
  const lineupCount = selectedMusicians.length;
  const renderLineupAndExtraSetsSection = () => (
    <div className="flex flex-col gap-4">
      {/* Lineup: adapts to pricingSettings.pricing_mode */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <FieldLabel>Lineup formation package</FieldLabel>
          {pricingSettings.pricing_mode === 'per_musician' && (
            <span className="bw-label-xs text-muted-foreground">
              {lineupCount} of {availableMusicians.length} selected
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {pricingSettings.pricing_mode === 'flat_packages'
            ? activePackages.map(pkg => {
                const isSelected =
                  selectedPackageId === pkg.id || (!selectedPackageId && performanceType === pkg.performanceType);
                return (
                  <Chip key={pkg.id} size="md" selected={isSelected} onClick={() => selectFlatPackage(pkg)} title={`${pkg.musiciansCount} musicians`}>
                    {pkg.name}
                    <span className="opacity-60">
                      {currencySymbol}
                      {pkg.flatPrice.toLocaleString()}
                    </span>
                  </Chip>
                );
              })
            : [
                { label: 'Solo', type: 'solo' as PerformanceType },
                { label: 'Duo', type: 'duo' as PerformanceType },
                { label: 'Trio', type: 'trio' as PerformanceType },
                { label: 'Full band', type: 'full_band' as PerformanceType },
              ].map(preset => (
                <Chip key={preset.label} size="md" selected={performanceType === preset.type} onClick={() => selectPresetLineup(preset.type)}>
                  {preset.label}
                </Chip>
              ))}
        </div>
      </div>

      {/* Lineup card: count + customise, avatars, fee */}
      <div className="flex flex-col gap-4 p-4 rounded-[24px] bg-card">
        <div className="flex items-center justify-between gap-3">
          <span className="bw-label-sm text-foreground">
            {lineupCount} {lineupCount === 1 ? 'musician' : 'musicians'}
          </span>
          {availableMusicians.length > 0 && (
            <PillButton
              variant="outline"
              size="sm"
              fullWidth={false}
              onClick={() => setIsRosterExpanded(!isRosterExpanded)}
              aria-expanded={isRosterExpanded}
              icon={isRosterExpanded ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            >
              {isRosterExpanded ? 'Done' : 'Customize'}
            </PillButton>
          )}
        </div>

        {lineupCount > 0 && (
          <div className="flex items-center -space-x-1.5">
            {selectedMusicians.slice(0, 6).map(m => (
              <span
                key={m.id}
                title={m.name}
                className="w-11 h-11 rounded-full border-[1.5px] border-foreground bg-field text-foreground bw-label-md flex items-center justify-center shrink-0"
              >
                {m.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
            {lineupCount > 6 && (
              <span className="w-11 h-11 rounded-full border-[1.5px] border-foreground bg-surface-inverse text-surface-inverse-foreground bw-label-md flex items-center justify-center shrink-0">
                +{lineupCount - 6}
              </span>
            )}
          </div>
        )}

        {/* Collapsible member fee checklist */}
        <AnimatePresence>
          {isRosterExpanded && (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden flex flex-col divide-y divide-border border-y border-border"
            >
              {availableMusicians.map(musician => {
                const isSelected = selectedMusicians.some(m => m.id === musician.id);
                const currentMusician = selectedMusicians.find(m => m.id === musician.id);
                return (
                  <li key={musician.id} className="flex items-center justify-between gap-3 py-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      onClick={() => toggleMusician(musician)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <DotCheckbox checked={isSelected} activeColor="var(--surface-inverse)" inactiveColor="var(--border)" />
                      <span className="min-w-0 flex flex-col">
                        <span className={cn('bw-body-md font-medium truncate', !isSelected && 'text-muted-foreground')}>{musician.name}</span>
                        <span className="bw-label-xs text-muted-foreground truncate">{musician.instrument || 'Musician'}</span>
                      </span>
                    </button>
                    {isSelected && pricingSettings.pricing_mode === 'per_musician' && (
                      <MiniNumber
                        size="sm"
                        label={`Fee for ${musician.name}`}
                        prefix={currencySymbol}
                        className="w-28 shrink-0"
                        value={currentMusician?.fee || ''}
                        onChange={e => updateMusicianFee(musician.id, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    )}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        <div className="flex items-baseline justify-between gap-3">
          <span className="bw-body-md text-muted-foreground min-w-0">
            {pricingSettings.pricing_mode === 'flat_packages' ? 'Package fee' : 'Musician fees'}
            {pricingSettings.band_markup_type !== 'none' && pricingSettings.band_markup_value > 0
              ? pricingSettings.band_markup_type === 'percent'
                ? ` · incl. +${pricingSettings.band_markup_value}% fund`
                : ` · incl. +${currencySymbol}${pricingSettings.band_markup_value} fund`
              : ''}
          </span>
          <span className="bw-label-md text-foreground shrink-0">
            {currencySymbol}
            {lineupBaseAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Extra sets & add-ons: 1-tap chips */}
      {activeCatalogServices.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>Extra sets &amp; add-ons (optional)</FieldLabel>
            {customItemsTotal > 0 && (
              <span className="bw-label-sm text-foreground">
                +{currencySymbol}
                {customItemsTotal.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeCatalogServices.map(srv => {
              const isAdded = customItems.some(it => it.id === srv.id || it.name === srv.name);
              const qty = getServiceAutoQty(srv);
              const lineTotal = servicePrice(srv) * qty;
              return (
                <Chip key={srv.id} selected={isAdded} onClick={() => toggleBandCustomService(srv)}>
                  {isAdded ? <Check className="w-3 h-3 shrink-0" /> : <Plus className="w-3 h-3 shrink-0" />}
                  <span className="truncate max-w-[180px]">{srv.name}</span>
                  <span className={cn(!isAdded && 'opacity-70')}>
                    · {currencySymbol}
                    {lineTotal.toLocaleString()}
                  </span>
                </Chip>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Inline Travel Pill (rendered beneath the venue input when venue or distance is set)
  const showInlineTravelPill =
    (Boolean(venueName.trim()) && venueName.trim().toUpperCase() !== 'TBD') ||
    (travelDistanceKm != null && travelDistanceKm > 0);

  const renderInlineTravelPill = () => {
    if (!showInlineTravelPill) return null;
    const freeRadius = pricingSettings.free_travel_radius_km || 0;
    const billableKm = travelDistanceKm != null ? Math.max(0, travelDistanceKm - freeRadius) : 0;
    const modeLabel =
      travelMode === 'included'
        ? 'Included'
        : travelMode === 'separate'
          ? `+${currencySymbol}${travelFee}`
          : 'Client';

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 min-h-11 px-4 py-2 rounded-full bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]">
          <MapPin className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            {isCalculatingDistance ? (
              <span className="bw-label-sm">Calculating travel distance…</span>
            ) : travelDistanceKm != null && travelDistanceKm > 0 ? (
              <span className="bw-label-sm block truncate">
                Travel: {formatDistance(travelDistanceKm, distanceUnit)} from band HQ
                <span className="opacity-70">
                  {' · '}
                  {billableKm === 0
                    ? `≤${formatDistance(freeRadius, distanceUnit)} free`
                    : `${formatDistance(billableKm, distanceUnit)} billable`}
                </span>
              </span>
            ) : (
              <label className="flex items-center gap-2">
                <span className="bw-label-sm">Travel</span>
                <input
                  type="number"
                  min="0"
                  value={travelDistanceKm != null ? toUnit(travelDistanceKm, distanceUnit) : ''}
                  onChange={e =>
                    handleManualDistanceChange(
                      e.target.value ? fromUnit(Math.max(0, parseFloat(e.target.value)), distanceUnit) : undefined,
                    )
                  }
                  placeholder={distanceUnit}
                  aria-label={`One-way travel distance in ${distanceUnit === 'mi' ? 'miles' : 'km'}`}
                  className="w-20 h-7 px-3 rounded-full bg-[var(--wizard-accent-fg)]/10 bw-body-sm font-medium outline-none placeholder:opacity-60"
                />
              </label>
            )}
          </div>
          <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center whitespace-nowrap shrink-0 bg-[var(--wizard-accent-fg)] text-[var(--wizard-accent)]">
            {modeLabel}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip
            selected={travelMode === 'included'}
            onClick={() => {
              setTravelMode('included');
              setTravelIncluded(true);
            }}
          >
            Included
          </Chip>
          <Chip
            selected={travelMode === 'separate'}
            onClick={() => {
              setTravelMode('separate');
              setTravelIncluded(false);
              if (travelFee === 0 && travelDistanceKm && travelDistanceKm > 0) {
                setTravelFee(computeTravelFeeForDistance(travelDistanceKm));
              }
            }}
          >
            Separate{travelFee > 0 ? ` (+${currencySymbol}${travelFee})` : ''}
          </Chip>
          <Chip
            selected={travelMode === 'client_provided'}
            onClick={() => {
              setTravelMode('client_provided');
              setTravelIncluded(true);
            }}
          >
            Client arranged
          </Chip>
        </div>
      </div>
    );
  };

  // ── STEP 01: EVENT, LINEUP & EXTRA SETS ─────────────────────
  const renderStep1 = () => (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      <PillField
        label="Client name"
        icon={<User className="w-5 h-5" />}
        value={clientName}
        onChange={e => {
          const val = e.target.value;
          // The auto title ("Wedding - Client") stays a placeholder and is
          // used as the fallback by getEffectiveTitle(), so typing a title
          // never appends to a pre-filled value.
          setClientName(val);
        }}
        placeholder="Client full name"
        autoComplete="off"
      />
      <PillField
        label="Event title"
        value={eventName}
        onChange={e => {
          setEventName(e.target.value);
        }}
        placeholder={getEffectiveTitle()}
        autoComplete="off"
      />

      {/* Event type */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Event type</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPE_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              tone="accent"
              selected={eventType === opt.value}
              title={opt.subtitle}
              onClick={() => {
                setEventType(opt.value);
              }}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      {renderLineupAndExtraSetsSection()}

      {/* Contact details */}
      <div className="grid grid-cols-2 gap-3">
        <PillField
          label="Client email"
          type="email"
          icon={<Mail className="w-5 h-5" />}
          value={clientEmail}
          onChange={e => setClientEmail(e.target.value)}
          placeholder="client@example.com"
          className="min-w-0"
        />
        <PillField
          label="Client phone"
          type="tel"
          icon={<Phone className="w-5 h-5" />}
          value={clientPhone}
          onChange={e => setClientPhone(e.target.value)}
          placeholder="Phone with country code"
          className="min-w-0"
        />
      </div>
    </div>
  );

  // ── STEP 02: DATE, VENUE & AUTO-TRAVEL ──────────────────────
  const seasonLabel =
    pricingSettings.seasonal_pricing_enabled && eventDate
      ? pricingSettings.peak_months?.includes(getEventMonthFromDate(eventDate) || 0)
        ? 'Peak season rate'
        : pricingSettings.off_peak_months?.includes(getEventMonthFromDate(eventDate) || 0)
          ? 'Off-peak rate'
          : 'Standard season'
      : null;
  const setDurationIdx = MOMENT_DURATION_OPTIONS.indexOf(setDuration);

  const renderStep2 = () => (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Venue + inline travel pill */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Venue / location</FieldLabel>
        <div className={PILL_WRAP}>
          <MapPin className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <VenueAutocomplete
              value={venueName}
              onChange={val => setVenueName(val)}
              onSelect={place => {
                const { location, isNamedPlace } = venueFields(place);
                setVenueName(location);
                // The street is the venue itself when the pick is just an address.
                setVenueAddress(isNamedPlace ? place.address || '' : '');
                if (place.city) setVenueCity(place.city);
                if (place.country) setVenueCountry(place.country);
                handleCalculateDistance(place.fullAddress || place.address || place.name || place.city || '');
              }}
              placeholder="Search venue or location…"
              className="border-0 pb-0 text-lg font-medium normal-case text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['TBD', 'Main Stage', 'Private Venue'].map(loc => (
            <Chip
              key={loc}
              tone="accent"
              selected={venueName === loc}
              onClick={() => {
                setVenueName(loc);
                if (loc !== 'TBD') handleCalculateDistance(loc);
              }}
            >
              {loc}
            </Chip>
          ))}
        </div>
      </div>

      {renderInlineTravelPill()}

      {/* Date */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <FieldLabel>Event date</FieldLabel>
          {seasonLabel && <Tag variant="quote">{seasonLabel}</Tag>}
        </div>
        <DatePicker
          value={eventDate}
          onChange={d => setEventDate(d)}
          accentColor={activeAccentColor}
          placeholder="Select event date…"
          className={PICKER_PILL}
        />
      </div>

      {/* Start / end */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2 min-w-0">
          <FieldLabel>Start</FieldLabel>
          <TimePicker
            value={eventTimeStart}
            onChange={val => setEventTimeStart(val)}
            accentColor={activeAccentColor}
            textSize="text-lg"
            showIcon
            className={PICKER_PILL}
          />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>End</FieldLabel>
            {calculatedDurationBadge && <span className="bw-label-xs text-muted-foreground truncate">{calculatedDurationBadge}</span>}
          </div>
          <TimePicker
            value={eventTimeEnd}
            onChange={val => setEventTimeEnd(val)}
            accentColor={activeAccentColor}
            align="end"
            textSize="text-lg"
            showIcon
            className={PICKER_PILL}
          />
        </div>
      </div>

      {/* Sets & set length */}
      <div className="grid grid-cols-2 gap-3">
        <StepperCard
          label="Number of sets"
          value={numberOfSets}
          onDec={() => setNumberOfSets(Math.max(1, numberOfSets - 1))}
          onInc={() => setNumberOfSets(Math.min(8, numberOfSets + 1))}
          decDisabled={numberOfSets <= 1}
          incDisabled={numberOfSets >= 8}
        />
        <StepperCard
          label="Mins per set"
          value={setDuration}
          onDec={() => {
            const prev = [...MOMENT_DURATION_OPTIONS].reverse().find(m => m < setDuration);
            if (prev != null) setSetDuration(prev);
          }}
          onInc={() => {
            const next = MOMENT_DURATION_OPTIONS.find(m => m > setDuration);
            if (next != null) setSetDuration(next);
          }}
          decDisabled={setDuration <= MOMENT_DURATION_OPTIONS[0]}
          incDisabled={setDurationIdx === MOMENT_DURATION_OPTIONS.length - 1 || setDuration >= MOMENT_DURATION_OPTIONS[MOMENT_DURATION_OPTIONS.length - 1]}
        />
      </div>

      <PillField
        label="Guest count (optional)"
        type="number"
        min="0"
        inputMode="numeric"
        icon={<Users className="w-5 h-5" />}
        value={guestCount ?? ''}
        onChange={e => setGuestCount(e.target.value ? Math.max(0, parseInt(e.target.value)) : undefined)}
        placeholder="150"
      />
    </div>
  );

  // Shared Inner Controls for Drawer 1: Billing, Discounts, VAT & Deposit
  const maskedIban = maskedBankAccount(pricingSettings);

  const renderBillingControls = () => (
    <div className="flex flex-col gap-4">
      {/* Base fee override */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="bw-label-sm text-foreground">Base fee override</span>
          <span className="bw-body-sm text-muted-foreground">
            {pricingSettings.pricing_mode === 'flat_packages'
              ? 'Package lineup fee'
              : `Musicians sum: ${currencySymbol}${musiciansTotal.toLocaleString()}`}
          </span>
        </div>
        <MiniNumber
          label="Base fee override"
          prefix={currencySymbol}
          className="w-32 shrink-0"
          value={baseFee || ''}
          onChange={e => {
            setBaseFeeManuallyEdited(true);
            setBaseFee(parseFloat(e.target.value) || 0);
          }}
          placeholder="0"
        />
      </div>

      {/* Package discount */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Package discount</FieldLabel>
        <Segmented
          label="Package discount"
          track="field"
          value={discountType}
          options={[
            { id: 'none', label: 'None' },
            { id: 'percentage', label: '% off' },
            { id: 'fixed', label: `${currencySymbol.trim()} off` },
          ]}
          onSelect={id => {
            setDiscountType(id);
            if (id === 'none') setDiscountValue(0);
            else if (id === 'percentage' && discountValue === 0) setDiscountValue(10);
          }}
        />
        {discountType !== 'none' && (
          <div className="flex items-center justify-between gap-3 pt-1">
            {discountType === 'percentage' && (
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20].map(pct => (
                  <Chip key={pct} selected={discountValue === pct} onClick={() => setDiscountValue(pct)}>
                    {pct}%
                  </Chip>
                ))}
              </div>
            )}
            <MiniNumber
              label="Discount value"
              className="w-28 ml-auto shrink-0"
              min="0"
              max={discountType === 'percentage' ? 100 : undefined}
              suffix={discountType === 'percentage' ? '%' : currencySymbol.trim()}
              value={discountValue || ''}
              onChange={e => {
                const v = Math.max(0, parseFloat(e.target.value) || 0);
                setDiscountValue(discountType === 'percentage' ? Math.min(100, v) : v);
              }}
            />
          </div>
        )}
      </div>

      {/* VAT · deposit · validity */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-2 min-w-0">
          <FieldLabel>VAT rate</FieldLabel>
          {vatExempt ? (
            <span className="h-11 px-3 rounded-full bg-field border border-border bw-body-lg flex items-center text-muted-foreground">0%</span>
          ) : (
            <MiniNumber
              label="VAT rate"
              suffix="%"
              min="0"
              max="50"
              value={vatRate}
              onChange={e => setCustomVatRate(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          )}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <FieldLabel>Deposit</FieldLabel>
          <div className="relative">
            <select
              aria-label="Booking deposit"
              value={depositPercentage}
              onChange={e => {
                const pct = parseInt(e.target.value) || 0;
                setDepositPercentage(pct);
                setDepositRequired(pct > 0);
              }}
              className="w-full h-11 pl-3 pr-7 rounded-full bg-field border border-border bw-body-lg text-foreground outline-none focus:border-foreground appearance-none cursor-pointer"
            >
              {Array.from(new Set([0, 20, 30, 50, depositPercentage])).sort((a, b) => a - b).map(pct => (
                <option key={pct} value={pct}>
                  {pct === 0 ? 'None' : `${pct}%`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <FieldLabel>Validity</FieldLabel>
          <div className="relative">
            <select
              aria-label={`Quote validity (until ${validUntilDate})`}
              value={validityDays}
              onChange={e => setValidityDays(parseInt(e.target.value) || 30)}
              className="w-full h-11 pl-3 pr-7 rounded-full bg-field border border-border bw-body-lg text-foreground outline-none focus:border-foreground appearance-none cursor-pointer"
            >
              {[7, 14, 30, 60, 90].map(days => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
      <span className="bw-body-sm text-muted-foreground -mt-2">Valid until {validUntilDate}</span>

      {/* VAT exempt + show bank details */}
      <div className="flex flex-col gap-2">
        <div
          onClick={() => setVatExempt(!vatExempt)}
          className="flex items-center justify-between gap-3 p-4 rounded-[16px] bg-background cursor-pointer"
        >
          <span className="flex flex-col gap-1 min-w-0">
            <span className="bw-body-lg">VAT exempt</span>
            <span className="bw-body-sm text-muted-foreground">Quote at 0% VAT</span>
          </span>
          <Toggle checked={vatExempt} onCheckedChange={() => setVatExempt(!vatExempt)} onClick={e => e.stopPropagation()} aria-label="VAT exempt" />
        </div>
        <div
          onClick={() => setShowBankDetailsOnPdf(!showBankDetailsOnPdf)}
          className="flex items-center justify-between gap-3 p-4 rounded-[16px] bg-background cursor-pointer"
        >
          <span className="flex flex-col gap-1 min-w-0">
            <span className="bw-body-lg">Show bank details on PDF</span>
            <span className="bw-body-sm text-muted-foreground truncate">{maskedIban || 'Add your bank account in Branding & payment'}</span>
          </span>
          <Toggle
            checked={showBankDetailsOnPdf}
            onCheckedChange={() => setShowBankDetailsOnPdf(!showBankDetailsOnPdf)}
            onClick={e => e.stopPropagation()}
            aria-label="Show bank details on PDF"
          />
        </div>
      </div>
    </div>
  );

  // Shared Inner Controls for Drawer 2: Production, Travel, Hotel & Custom Items
  const renderLogisticsAndCustomItemsControls = () => (
    <div className="flex flex-col gap-5">
      {/* Sound & lighting tier */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <FieldLabel>Sound &amp; lighting production</FieldLabel>
          {productionTier !== 'none' && (
            <Chip
              selected={soundIncluded}
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
            >
              {soundIncluded ? 'Included in base' : 'Separate fee'}
            </Chip>
          )}
        </div>
        <Segmented
          label="Sound & lighting production"
          track="field"
          value={productionTier as 'standard' | 'pro' | 'none'}
          options={[
            { id: 'standard', label: 'Standard PA' },
            { id: 'pro', label: 'Pro PA' },
            { id: 'none', label: 'Client PA' },
          ]}
          onSelect={id => {
            setProductionTier(id);
            if (id === 'none') {
              setSoundFee(0);
            } else if (!soundIncluded) {
              setSoundFee(id === 'pro' ? pricingSettings.production_pro_fee || 600 : pricingSettings.production_standard_fee || 300);
            }
          }}
        />
        {!soundIncluded && productionTier !== 'none' && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="bw-body-md text-muted-foreground">Production fee</span>
            <MiniNumber
              label="Production fee"
              prefix={currencySymbol}
              className="w-32"
              value={soundFee || ''}
              onChange={e => setSoundFee(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      {/* Travel */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Travel &amp; transport</FieldLabel>
        <Segmented
          label="Travel & transport"
          track="field"
          value={travelMode as 'included' | 'separate' | 'client_provided'}
          options={[
            { id: 'included', label: 'Included' },
            { id: 'separate', label: 'Separate fee' },
            { id: 'client_provided', label: 'Client arranged' },
          ]}
          onSelect={id => {
            setTravelMode(id);
            setTravelIncluded(id !== 'separate');
          }}
        />
        {travelMode === 'separate' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <MiniNumber
              label={`One-way distance in ${distanceUnit === 'mi' ? 'miles' : 'km'}`}
              suffix={distanceUnit}
              value={travelDistanceKm != null ? toUnit(travelDistanceKm, distanceUnit) : ''}
              onChange={e => handleManualDistanceChange(e.target.value ? fromUnit(parseFloat(e.target.value), distanceUnit) : undefined)}
              placeholder="0"
            />
            <MiniNumber
              label="Travel fee"
              prefix={currencySymbol}
              value={travelFee || ''}
              onChange={e => setTravelFee(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        )}
      </div>

      {/* Hotel / accommodation */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Hotel &amp; accommodation</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'included', label: 'Included' },
              { id: 'separate', label: 'Separate fee' },
              { id: 'client_provided', label: 'Client hotel' },
              { id: 'none', label: 'Not needed' },
            ] as const
          ).map(opt => (
            <Chip
              key={opt.id}
              size="md"
              selected={accommodationMode === opt.id}
              onClick={() => {
                setAccommodationMode(opt.id);
                setAccommodationNeeded(opt.id === 'separate');
              }}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
        {accommodationMode === 'separate' && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <MiniNumber
              label="Rooms"
              suffix="rooms"
              min="1"
              value={accommodationRooms}
              onChange={e => setAccommodationRooms(parseInt(e.target.value) || 1)}
            />
            <MiniNumber
              label="Nights"
              suffix="nts"
              min="1"
              value={accommodationNights}
              onChange={e => setAccommodationNights(parseInt(e.target.value) || 1)}
            />
            <MiniNumber
              label="Accommodation fee"
              prefix={currencySymbol}
              value={accommodationFee || ''}
              onChange={e => setAccommodationFee(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        )}
      </div>

      {/* Selected sets & one-off custom line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <FieldLabel>Selected sets &amp; custom items</FieldLabel>
          <PillButton
            size="sm"
            variant="ghost"
            fullWidth={false}
            className="-mr-3"
            icon={<Plus className="w-3.5 h-3.5" />}
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
          >
            Add item
          </PillButton>
        </div>

        {customItems.length === 0 ? (
          <span className="bw-body-sm text-muted-foreground">No extra sets or custom line items added.</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {customItems.map((item, idx) => (
              <li key={item.id || idx} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Item name"
                  value={item.name || item.description || ''}
                  onChange={e =>
                    setCustomItems(prev => prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)))
                  }
                  className="flex-1 min-w-0 h-11 px-4 rounded-full bg-field border border-border bw-body-sm font-medium text-foreground outline-none focus:border-foreground"
                  placeholder="Item name…"
                />
                <MiniNumber
                  label="Quantity"
                  prefix="×"
                  min="1"
                  className="w-16 shrink-0 px-2.5"
                  value={item.quantity || 1}
                  onChange={e => {
                    const q = Math.max(1, parseInt(e.target.value) || 1);
                    setCustomItems(prev => prev.map((it, i) => (i === idx ? { ...it, quantity: q } : it)));
                  }}
                />
                <MiniNumber
                  label="Price"
                  prefix={currencySymbol}
                  className="w-24 shrink-0"
                  value={item.price ?? item.amount ?? 0}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setCustomItems(prev => prev.map((it, i) => (i === idx ? { ...it, price: val, amount: val } : it)));
                  }}
                />
                <IconButton
                  size="sm"
                  variant="ghost"
                  label="Remove item"
                  icon={<X />}
                  onClick={() => setCustomItems(prev => prev.filter((_, i) => i !== idx))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // Shared Inner Controls for Drawer 3: Multi-Option Proposal & Contract Terms
  const renderProposalAndTermsControls = () => (
    <div className="flex flex-col gap-5">
      {/* Multi-option tier comparison */}
      <div className="flex flex-col gap-3">
        <div
          onClick={() => handleToggleProposalSummary(!includeProposalSummary)}
          className="flex items-center justify-between gap-3 p-4 rounded-[16px] bg-background cursor-pointer"
        >
          <span className="flex flex-col gap-1 min-w-0">
            <span className="bw-body-lg">Multi-option comparison</span>
            <span className="bw-body-sm text-muted-foreground">Compare lineup sizes or packages side by side in the PDF.</span>
          </span>
          <Toggle
            checked={includeProposalSummary}
            onCheckedChange={() => handleToggleProposalSummary(!includeProposalSummary)}
            onClick={e => e.stopPropagation()}
            aria-label="Multi-option proposal comparison table"
          />
        </div>

        {includeProposalSummary && (
          <div className="flex flex-col gap-2">
            {quoteOptions.map((opt, idx) => (
              <div key={opt.id} className="p-4 rounded-[16px] bg-background flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="bw-label-sm text-foreground">
                    Option {String(idx + 1).padStart(2, '0')} · incl. VAT {formatQuoteMoney(opt.totalWithVat, currencySymbol)}
                  </span>
                  {quoteOptions.length > 1 && (
                    <IconButton size="sm" variant="ghost" label={`Remove option ${idx + 1}`} icon={<Trash2 />} onClick={() => removePackageOption(opt.id)} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1.5 col-span-2">
                    <span className="bw-label-xs text-muted-foreground">Tier name</span>
                    <input
                      type="text"
                      value={opt.name}
                      onChange={e => updatePackageOption(opt.id, { name: e.target.value })}
                      className="h-11 px-4 rounded-full bg-field border border-border bw-body-sm font-medium text-foreground outline-none focus:border-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 min-w-0">
                    <span className="bw-label-xs text-muted-foreground">Musicians</span>
                    <MiniNumber
                      label="Musicians"
                      min="1"
                      value={opt.musiciansCount}
                      onChange={e => updatePackageOption(opt.id, { musiciansCount: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 min-w-0">
                    <span className="bw-label-xs text-muted-foreground">Gross fee</span>
                    <MiniNumber
                      label="Gross fee"
                      prefix={currencySymbol}
                      value={opt.grossFee}
                      onChange={e => updatePackageOption(opt.id, { grossFee: Math.max(0, parseFloat(e.target.value) || 0) })}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 min-w-0">
                    <span className="bw-label-xs text-muted-foreground">Discount</span>
                    <MiniNumber
                      label="Discount percentage"
                      suffix="%"
                      min="0"
                      max="90"
                      value={opt.discountPercent}
                      onChange={e =>
                        updatePackageOption(opt.id, {
                          discountPercent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 col-span-2">
                    <span className="bw-label-xs text-muted-foreground">Lineup / instrumentation</span>
                    <input
                      type="text"
                      value={opt.instrumentsText}
                      onChange={e => updatePackageOption(opt.id, { instrumentsText: e.target.value })}
                      className="h-11 px-4 rounded-full bg-field border border-border bw-body-sm text-foreground outline-none focus:border-foreground"
                    />
                  </label>
                </div>
              </div>
            ))}
            <PillButton size="md" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={addPackageOption}>
              Add option tier
            </PillButton>
          </div>
        )}
      </div>

      <PillField
        label="Quote subtitle (optional)"
        value={quoteDescription}
        onChange={e => setQuoteDescription(e.target.value)}
        placeholder={`Formal quote for an event in ${venueName || venueCity || 'Venue'}`}
      />

      {/* Payment methods */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Payment methods</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'bank_transfer', label: 'Bank transfer' },
            { id: 'credit_card', label: 'Credit card' },
            { id: 'cash', label: 'Cash' },
            { id: 'paypal', label: 'PayPal' },
          ].map(m => {
            const isChecked = paymentMethods.includes(m.id as PaymentMethod);
            return (
              <Chip
                key={m.id}
                size="md"
                selected={isChecked}
                onClick={() => {
                  if (isChecked) {
                    setPaymentMethods(paymentMethods.filter(p => p !== m.id));
                  } else {
                    setPaymentMethods([...paymentMethods, m.id as PaymentMethod]);
                  }
                }}
              >
                {m.label}
              </Chip>
            );
          })}
        </div>
      </div>

      {/* Cancellation policy */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Cancellation policy</FieldLabel>
        <Segmented
          label="Cancellation policy"
          track="field"
          value={cancellationPolicy as CancellationPolicy}
          options={(['flexible', 'moderate', 'strict'] as CancellationPolicy[]).map(pol => ({
            id: pol,
            label: pol.charAt(0).toUpperCase() + pol.slice(1),
          }))}
          onSelect={id => setCancellationPolicy(id)}
        />
      </div>

      {/* Client notes */}
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="quote-client-notes">Client message / notes</FieldLabel>
        <textarea
          id="quote-client-notes"
          value={clientNotes}
          onChange={e => setClientNotes(e.target.value)}
          placeholder="Notes or conditions shown on the quote document…"
          rows={3}
          className="w-full rounded-[24px] bg-field border border-border p-4 bw-body-md text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground resize-none"
        />
      </div>
    </div>
  );

  // ── STEP 03: CONSOLIDATED REVIEW & 3 DRAWERS ────────────────
  const PERFORMANCE_LABEL: Record<string, string> = {
    solo: 'Solo',
    duo: 'Duo',
    trio: 'Trio',
    full_band: 'Full band',
    dj_set: 'DJ set',
    acoustic: 'Acoustic',
  };
  const heroChipStyle: React.CSSProperties = { backgroundColor: 'var(--wizard-accent-fg)', color: 'var(--wizard-accent)' };
  const heroTintStyle: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)' };
  const extrasNames = customItems.map(it => it.name || it.description).filter(Boolean) as string[];

  const billingSummary = [
    vatExempt || reverseCharge ? 'VAT exempt' : `${vatRate}% VAT`,
    depositRequired && depositPercentage > 0 ? `${depositPercentage}% deposit` : 'No deposit',
    `valid ${validityDays} days`,
    totals.discountAmount > 0 ? `−${formatQuoteMoney(totals.discountAmount, currencySymbol)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const logisticsSummary = [
    productionTier === 'pro' ? 'Pro PA' : productionTier === 'none' ? 'Client PA' : productionTier === 'custom' ? 'Custom PA' : 'Standard PA',
    travelMode === 'included' ? 'travel included' : travelMode === 'separate' ? `travel ${currencySymbol}${travelFee}` : 'travel by client',
    `${customItems.length} custom ${customItems.length === 1 ? 'item' : 'items'}`,
  ].join(' · ');
  const proposalSummary = [
    includeProposalSummary ? `${quoteOptions.length} option tiers` : 'Single option',
    paymentMethods.length > 0 ? paymentMethods.map(p => p.replace(/_/g, ' ')).join(', ') : 'No payment method',
    `${cancellationPolicy} cancellation`,
    clientNotes ? 'notes added' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Not a component: a render helper, so the drawer's inputs keep focus across renders.
  const renderReviewDrawer = (
    id: 'billing' | 'logistics' | 'proposal_terms',
    title: string,
    summary: string,
    content: React.ReactNode
  ) => {
    const open = openReviewDrawer === id;
    return (
      <div className="rounded-[24px] bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => toggleReviewDrawer(id)}
          aria-expanded={open}
          className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer"
        >
          <span className="flex flex-col gap-1 min-w-0">
            <span className="bw-label-sm text-foreground">{title}</span>
            <span className="bw-body-sm text-muted-foreground truncate first-letter:uppercase">{summary}</span>
          </span>
          <ChevronDown className={cn('w-5 h-5 shrink-0 transition-transform', !open && '-rotate-90')} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1">{content}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4 duration-300 pb-2">
      {/* Summary hero (quote colour) */}
      <section className="rounded-[24px] p-5 flex flex-col gap-4 bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center" style={heroChipStyle}>
              Quote
            </span>
            <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center" style={heroTintStyle}>
              {eventTypeLabel(eventType)}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 -my-2">
            <button type="button" onClick={() => setStep(0)} className="py-2 inline-flex items-center gap-1 bw-label-xs cursor-pointer">
              <Edit3 className="w-3 h-3" />
              Lineup
            </button>
            <button type="button" onClick={() => setStep(1)} className="py-2 inline-flex items-center gap-1 bw-label-xs cursor-pointer">
              <Edit3 className="w-3 h-3" />
              Venue
            </button>
          </div>
        </div>
        <h2 className="bw-display [overflow-wrap:anywhere]">{getEffectiveTitle()}</h2>
        <div className="flex flex-col gap-3 bw-body-md">
          <p className="[overflow-wrap:anywhere]">
            Client: {clientName.trim() || 'Client TBD'}
            {clientEmail ? ` · ${clientEmail}` : ''}
          </p>
          <p>
            {eventDate ? formattedDateStr : 'Date TBD'} · {eventTimeStart} – {eventTimeEnd} · {venueName || 'Venue TBD'}
            {venueCity ? `, ${venueCity}` : ''}
          </p>
          <p>
            {PERFORMANCE_LABEL[performanceType] || 'Lineup'} ({selectedMusicians.length || pricingSettings.core_members_count}) · {numberOfSets} ×{' '}
            {setDuration} min
            {extrasNames.length > 0 ? ` · ${extrasNames.join(' · ')}` : ''}
          </p>
        </div>
      </section>

      {/* Breakdown */}
      <section className="rounded-[24px] bg-card p-4 flex flex-col gap-3">
        <span className="bw-label-sm text-muted-foreground">Breakdown</span>
        <LedgerRow
          label={`Lineup base (${numberOfSets} × ${setDuration} min)`}
          value={`${currencySymbol}${Math.round(lineupBaseAmount).toLocaleString()}`}
        />
        <LedgerRow
          label={`Sets & extras${customItems.length > 0 ? ` (${customItems.length})` : ''}`}
          value={`${currencySymbol}${Math.round(setsAndExtrasAmount).toLocaleString()}`}
        />
        <LedgerRow
          label="Travel & production"
          value={travelAndProductionAmount > 0 ? `${currencySymbol}${Math.round(travelAndProductionAmount).toLocaleString()}` : 'Included'}
        />
        {totals.discountAmount > 0 && (
          <LedgerRow label="Discount" value={`−${formatQuoteMoney(totals.discountAmount, currencySymbol)}`} tone="success" />
        )}
        <LedgerRow
          label={`VAT ${vatExempt || reverseCharge ? '0% (exempt)' : `${vatRate}%`}`}
          value={formatQuoteMoney(totals.vatAmount, currencySymbol)}
        />
        <hr className="border-0 h-px bg-border" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="bw-label-sm text-foreground">
            Total{depositRequired && depositPercentage > 0 ? ` · ${depositPercentage}% deposit` : ''}
          </span>
          <span className="bw-value-md text-foreground shrink-0">{formatQuoteMoney(totals.total, currencySymbol)}</span>
        </div>
      </section>

      {renderReviewDrawer('billing', 'Billing, discounts, VAT & deposit', billingSummary, renderBillingControls())}
      {renderReviewDrawer('logistics', 'Production & travel', logisticsSummary, renderLogisticsAndCustomItemsControls())}
      {renderReviewDrawer('proposal_terms', 'Multi-option proposal & terms', proposalSummary, renderProposalAndTermsControls())}

      {!isEditing && allMusicians.length > 0 && (
        <section className="rounded-[16px] bg-card p-4 flex flex-col gap-3">
          <div
            onClick={() => setAskAvailability(v => !v)}
            className="flex items-center justify-between gap-3 cursor-pointer"
          >
            <span className="flex flex-col gap-1 min-w-0">
              <span className="bw-label-sm text-muted-foreground">Lineup availability</span>
              <span className="bw-label-md">Ask the lineup now</span>
            </span>
            <Toggle
              checked={askAvailability}
              onCheckedChange={() => setAskAvailability(v => !v)}
              onClick={e => e.stopPropagation()}
              aria-label="Ask the lineup for availability now"
            />
          </div>
          <span className="bw-body-sm text-muted-foreground">
            {askAvailability
              ? "As soon as the quote is saved (shared, or kept as a draft from ✕), the musicians get an availability check (RSVP) for this date, marked as not confirmed yet."
              : 'Musicians are asked once the client accepts. Turn this on to check their availability now.'}
          </span>
        </section>
      )}
    </div>
  );

  // ── ACCORDION EDIT VIEW (ALL 5 SECTIONS FOR isEditing === true) ──
  const renderEditAccordionView = () => (
    <div className="flex flex-col gap-3">
      {/* 01: Client & Occasion */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.client_event)}
        onToggle={() => toggleEditSection('client_event')}
        stepNumber="01"
        title="Client & occasion"
        summary={`${clientName || 'No client'} · ${eventTypeLabel(eventType)} · ${indoorOutdoor}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPE_OPTIONS.map(({ value, label }) => (
              <Chip key={value} tone="accent" selected={eventType === value} onClick={() => setEventType(value)}>
                {label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PillField label="Client name" icon={<User className="w-5 h-5" />} value={clientName} onChange={e => setClientName(e.target.value)} />
            <PillField label="Event title" value={eventName} onChange={e => setEventName(e.target.value)} placeholder={getEffectiveTitle()} />
            <PillField
              label="Client email"
              type="email"
              icon={<Mail className="w-5 h-5" />}
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />
            <PillField
              label="Client phone"
              type="tel"
              icon={<Phone className="w-5 h-5" />}
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="Phone with country code"
            />
          </div>
        </div>
      </QuoteAccordionCard>

      {/* 02: Date & Venue */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.date_venue)}
        onToggle={() => toggleEditSection('date_venue')}
        stepNumber="02"
        title="Date & venue"
        summary={`${formattedDateStr} · ${eventTimeStart} – ${eventTimeEnd} · ${venueName || 'Venue TBD'}`}
      >
        {renderStep2()}
      </QuoteAccordionCard>

      {/* 03: Lineup & Extra Sets */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.lineup_moments)}
        onToggle={() => toggleEditSection('lineup_moments')}
        stepNumber="03"
        title="Lineup & extra sets"
        summary={`${selectedMusicians.length} ${selectedMusicians.length === 1 ? 'musician' : 'musicians'} · ${customItems.length} ${
          customItems.length === 1 ? 'extra' : 'extras'
        } · ${currencySymbol}${(lineupBaseAmount + setsAndExtrasAmount).toLocaleString()}`}
      >
        {renderLineupAndExtraSetsSection()}
      </QuoteAccordionCard>

      {/* 04: Pricing, Logistics & Billing */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.pricing_billing)}
        onToggle={() => toggleEditSection('pricing_billing')}
        stepNumber="04"
        title="Pricing, logistics & billing"
        summary={`Net ${formatQuoteMoney(totals.netAmount, currencySymbol)} · VAT ${vatRate}% · total ${formatQuoteMoney(totals.total, currencySymbol)}`}
      >
        {renderBillingControls()}
        <hr className="border-0 h-px bg-border" />
        {renderLogisticsAndCustomItemsControls()}
      </QuoteAccordionCard>

      {/* 05: Multi-Option Proposal & Terms */}
      <QuoteAccordionCard
        isOpen={Boolean(expandedEditSections.terms_notes)}
        onToggle={() => toggleEditSection('terms_notes')}
        stepNumber="05"
        title="Proposal options & terms"
        summary={proposalSummary}
      >
        {renderProposalAndTermsControls()}
      </QuoteAccordionCard>
    </div>
  );

  // Live quote estimate strip (Figma: black "Total estimate" bar above the actions)
  const estimateSubtitle =
    !isEditing && step === 0
      ? `${lineupCount} ${lineupCount === 1 ? 'musician' : 'musicians'}${
          customItems.length > 0 ? ` + ${customItems.length} ${customItems.length === 1 ? 'add-on' : 'add-ons'}` : ''
        }`
      : !isEditing && step === 1
        ? `${travelMode === 'included' ? 'Incl. travel' : travelMode === 'separate' ? `Travel +${currencySymbol}${travelFee}` : 'Travel by client'} · ${numberOfSets} × ${setDuration} min`
        : `Net ${formatQuoteMoney(totals.netAmount, currencySymbol)} · ${
            vatExempt || reverseCharge ? 'VAT exempt' : `VAT ${vatRate}% ${formatQuoteMoney(totals.vatAmount, currencySymbol)}`
          }`;
  const totalLabel = formatQuoteMoney(totals.total, currencySymbol);

  const renderLiveEstimateBar = () => (
    <div className="bg-surface-inverse text-surface-inverse-foreground px-4 py-3">
      <div className="max-w-xl mx-auto w-full flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="bw-label-sm">Total estimate</span>
          <span className="bw-body-sm truncate opacity-80">{estimateSubtitle}</span>
        </div>
        <div
          className="shrink-0 max-w-[55%]"
          style={{ '--dot-off': 'color-mix(in srgb, currentColor 18%, transparent)' } as React.CSSProperties}
        >
          <DotText text={totalLabel} size={28} showGrid label={`Total estimate ${totalLabel}`} />
        </div>
      </div>
    </div>
  );

  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;
  const headerPadTop = { paddingTop: 'var(--wizard-header-pt, calc(var(--safe-top) + 8px))' };
  const footerPadBottom = { paddingBottom: 'calc(var(--safe-bottom) + 16px)' };

  // ── iPhone Duo ──────────────────────────────────────────────
  // Laptop pose (QuoteDeskMode): the quote's lines as the client reads them.
  // Fixed amounts (lineup, travel, production) are single lines; custom items
  // keep their quantity steppers. Same inputs as `totals`, so the same total.
  const deskLines = useMemo<QuoteDeskLine[]>(() => {
    const fixed: QuoteDeskLine[] = [
      { id: 'f-lineup', description: `Lineup base (${numberOfSets} × ${setDuration} min)`, unitPrice: lineupBaseAmount },
      { id: 'f-travel', description: 'Travel', unitPrice: effectiveTravelFee },
      { id: 'f-accommodation', description: 'Accommodation', unitPrice: effectiveAccommodationFee },
      { id: 'f-meals', description: 'Meals', unitPrice: effectiveMealsFee },
      { id: 'f-sound', description: 'Sound', unitPrice: effectiveSoundFee },
      { id: 'f-lights', description: 'Lights', unitPrice: effectiveLightsFee },
      { id: 'f-backline', description: 'Backline', unitPrice: effectiveBacklineFee },
    ]
      .filter(l => l.unitPrice > 0)
      .map(l => ({ ...l, quantity: 1, adjustable: false }));
    // Quantity of per-person / per-km catalog services follows the lineup / distance.
    const synced = new Set(
      (pricingSettings.custom_services || []).filter(srv => srv.unit === 'per_person' || srv.unit === 'per_km').map(srv => srv.id)
    );
    const rest = quoteDeskLinesFromQuote({
      // `totals` counts every legacy moment, included or not.
      selectedMoments: legacySelectedMoments.map(m => ({ ...m, included: true })),
      customItems: normalizedCustomItemsForCalc,
    }).map(l => (l.id.startsWith('c-') && synced.has(l.id.slice(2)) ? { ...l, adjustable: false } : l));
    return [...fixed, ...rest];
  }, [
    numberOfSets,
    setDuration,
    lineupBaseAmount,
    effectiveTravelFee,
    effectiveAccommodationFee,
    effectiveMealsFee,
    effectiveSoundFee,
    effectiveLightsFee,
    effectiveBacklineFee,
    pricingSettings.custom_services,
    legacySelectedMoments,
    normalizedCustomItemsForCalc,
  ]);

  const handleDeskQuantityChange = (lineId: string, quantity: number) => {
    if (!lineId.startsWith('c-')) return;
    const itemId = lineId.slice(2);
    setCustomItems(prev => prev.map(it => (it.id === itemId ? { ...it, quantity: Math.max(1, quantity) } : it)));
  };

  // Same default line as "Add item" in Production & travel.
  const handleDeskAddLine = () => {
    setCustomItems(prev => [
      ...prev,
      { id: `item-${Date.now()}`, name: 'Custom Line Item', amount: 150, price: 150, quantity: 1, taxable: true },
    ]);
  };

  // Send = save and open the share sheet, like the wizard's Share button.
  const quoteDesk = (
    <QuoteDeskMode
      title={getEffectiveTitle()}
      quoteNumber={initialData?.quoteNumber}
      clientName={clientName.trim() || undefined}
      clientCompany={clientCompany.trim() || undefined}
      eventDate={eventDate || undefined}
      venue={[venueName, venueCity].filter(Boolean).join(', ') || undefined}
      lines={deskLines}
      discountType={discountType}
      discountValue={discountValue}
      vatRate={vatRate}
      vatExempt={vatExempt}
      reverseCharge={reverseCharge}
      billingCountry={billingCountry}
      depositPercentage={depositRequired ? depositPercentage : undefined}
      onQuantityChange={handleDeskQuantityChange}
      onAddLine={handleDeskAddLine}
      onSend={() => handleCreate(true)}
      sendDisabled={!isEditing && (!eventType || !eventDate)}
    />
  );

  // Book layout (Figma "Duo · 06"): steps 1–2 show the live quote on the
  // leading page; step 3 already shows the same review on the trailing page.
  const previewMusicians = selectedMusicians.length || pricingSettings.core_members_count;
  useLeadingCompanion(
    <LiveQuotePreview
      title={getEffectiveTitle()}
      typeLabel={eventType ? eventTypeLabel(eventType) : null}
      quoteNumber={initialData?.quoteNumber}
      client={[clientName.trim(), clientCompany.trim()].filter(Boolean).join(' · ') || null}
      clientEmail={clientEmail.trim() || null}
      dateLabel={eventDate ? formattedDateStr : null}
      timeLabel={eventTimeStart ? `${eventTimeStart}${eventTimeEnd ? ` – ${eventTimeEnd}` : ''}` : null}
      venue={venueName}
      city={venueCity}
      lineup={`${PERFORMANCE_LABEL[performanceType] || 'Lineup'} (${previewMusicians}) · ${numberOfSets} × ${setDuration} min`}
      lineupNames={selectedMusicians.map(m => m.name).filter(Boolean)}
      rows={[
        { label: `Lineup base (${numberOfSets} × ${setDuration} min)`, value: formatQuoteMoney(lineupBaseAmount, currencySymbol) },
        {
          label: `Sets & extras${customItems.length > 0 ? ` (${customItems.length})` : ''}`,
          value: formatQuoteMoney(setsAndExtrasAmount, currencySymbol),
        },
        {
          label: 'Travel & production',
          value: travelAndProductionAmount > 0 ? formatQuoteMoney(travelAndProductionAmount, currencySymbol) : 'Included',
        },
        ...(totals.discountAmount > 0
          ? [{ label: 'Discount', value: `−${formatQuoteMoney(totals.discountAmount, currencySymbol)}`, tone: 'success' as const }]
          : []),
        {
          label: `VAT ${vatExempt || reverseCharge ? '0% (exempt)' : `${vatRate}%`}`,
          value: formatQuoteMoney(totals.vatAmount, currencySymbol),
        },
      ]}
      total={formatQuoteMoney(totals.total, currencySymbol)}
      totalLabel={`Total${depositRequired && depositPercentage > 0 ? ` · ${depositPercentage}% deposit` : ''}`}
    />,
    !isEditing && step < 2
  );

  // ── EDIT MODE RENDER ────────────────────────────────────────
  // iPhone Duo: the wizard's close sits in the system column under the clock
  // (Figma "Closed · Quote / New – 1 Event & lineup").
  // Closing a new quote with something typed in asks to save it as a draft
  // (status DRAFT, listed under Drafts on the home screen and in Quotes).
  const typedSnapshot = JSON.stringify({
    clientName, clientEmail, clientPhone, clientCompany, eventName, eventType, eventDate,
    eventTimeStart, guestCount, venueName, venueAddress, venueCity,
    customItems: customItems.length, discountValue, clientNotes,
  });
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = typedSnapshot;
  const isDirty = typedSnapshot !== baselineRef.current;
  const [leaveOpen, setLeaveOpen] = useState(false);
  const requestCloseRef = useRef<() => void>(onClose);
  requestCloseRef.current = () => {
    if (!isEditing && (isDirty || isLastStep)) setLeaveOpen(true);
    else onClose();
  };
  const requestClose = useCallback(() => requestCloseRef.current(), []);
  useSystemBack(!isEditing, () => {
    if (leaveOpen) setLeaveOpen(false);
    else requestClose();
    return true;
  });

  const closeInRail = useRailAction(isEditing ? undefined : requestClose, {
    label: 'Close quote wizard',
    icon: <X />,
    pane: true,
  });

  if (isEditing) {
    return (
      <motion.div
        data-modal-open="true"
        data-wizard-type="quote"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
        className="bw-pane-detail fixed inset-0 z-[100] bg-background text-foreground flex flex-col h-full overflow-hidden"
      >
        <header className="shrink-0 px-4 pb-4 bg-background" style={headerPadTop}>
          <div className="max-w-xl mx-auto w-full flex items-start gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)]">
                  Editing
                </span>
                <Tag variant="subtle">{initialData?.quoteNumber || 'Quote'}</Tag>
                <Tag variant="subtle">{eventTypeLabel(eventType)}</Tag>
              </div>
              <h1 className="bw-h1 [overflow-wrap:anywhere]">{getEffectiveTitle()}</h1>
              <span className="bw-body-sm text-muted-foreground">
                {formattedDateStr} · {eventTimeStart} – {eventTimeEnd} · {venueName || 'Venue TBD'}
              </span>
            </div>
            <RailCover pane />
            <HeaderAction pane label="Close edit quote modal" icon={<X />} onClick={onClose} />
          </div>
        </header>

        <PeekingScrollContainer className="flex-1 px-4 pt-2 pb-6 min-h-0">
          <div className="max-w-xl mx-auto w-full">{renderEditAccordionView()}</div>
        </PeekingScrollContainer>

        <div className="shrink-0">
          {renderLiveEstimateBar()}
          <div className="px-4 pt-4 bg-background" style={footerPadBottom}>
            <div className="max-w-xl mx-auto w-full flex gap-2">
              <PillButton variant="outline" fullWidth={false} className="px-4" onClick={onClose}>
                Cancel
              </PillButton>
              <PillButton variant="outline" fullWidth={false} className="px-4" onClick={() => handleCreate(false)}>
                Save
              </PillButton>
              <PillButton className="flex-1 min-w-0" icon={<Share2 className="w-[18px] h-[18px]" />} onClick={() => handleCreate(true)}>
                Save & share
              </PillButton>
            </div>
          </div>
        </div>
        {quoteDesk}
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
      className="bw-pane-detail fixed inset-0 z-[100] bg-background text-foreground flex flex-col h-full overflow-hidden"
    >
      {/* Header: back · title · close, then step bars */}
      <header className="shrink-0 px-4 pb-3 bg-background" style={headerPadTop}>
        <div className="max-w-xl mx-auto w-full flex flex-col gap-3">
          <div className="flex items-center gap-3 min-h-11">
            <NavBackButton
              pane
              label={isFirstStep ? 'Close quote wizard' : 'Previous step'}
              onClick={isFirstStep ? requestClose : handleBack}
            />
            <h1 className="flex-1 min-w-0 bw-h2 truncate">New quote</h1>
            {!closeInRail && <IconButton variant="ghost" label="Close quote wizard" icon={<X />} onClick={requestClose} />}
          </div>
          <InteractiveQuoteStepIndicator
            current={step}
            total={STEPS.length}
            steps={STEPS}
            maxAccessibleStep={maxAccessibleStep}
            onSelectStep={s => setStep(s)}
            activeColor="var(--wizard-accent)"
          />
        </div>
      </header>

      {/* Scrollable body */}
      <PeekingScrollContainer className="flex-1 px-4 pt-2 pb-6 min-h-0">
        <div className="max-w-xl mx-auto w-full">
          {step === 0 && renderStep1()}
          {step === 1 && renderStep2()}
          {step === 2 && renderStep3()}
        </div>
      </PeekingScrollContainer>

      {/* Footer: live estimate + actions */}
      <div className="shrink-0">
        {renderLiveEstimateBar()}
        <div className="px-4 pt-4 bg-background" style={footerPadBottom}>
          <div className="max-w-xl mx-auto w-full">
            {isLastStep ? (
              // Saving as a draft is the ✕ (Save draft / Discard): the
              // finished quote's one way forward is to send it.
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <PillButton variant="outline" fullWidth={false} className="px-5" onClick={handleBack}>
                  Back
                </PillButton>
                <PillButton className="min-w-0" icon={<Share2 className="w-[18px] h-[18px]" />} onClick={() => handleCreate(true)}>
                  Save & share
                </PillButton>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <PillButton variant="outline" onClick={isFirstStep ? requestClose : handleBack}>
                  {isFirstStep ? 'Cancel' : 'Back'}
                </PillButton>
                <PillButton onClick={handleNext} disabled={!canProceed}>
                  Next
                  <ArrowUpRight className="w-[18px] h-[18px]" />
                </PillButton>
              </div>
            )}
          </div>
        </div>
      </div>
      {quoteDesk}
      <LeaveWizardSheet
        open={leaveOpen}
        what="quote"
        draftHint={
          askAvailability
            ? "Saved as a draft quote, not sent to the client. The musicians still get the availability check. Find it under Drafts on the home screen, in Quotes, and on its day in the calendar."
            : "Saved as a draft quote that members can't see. Find it under Drafts on the home screen, in Quotes, and on its day in the calendar."
        }
        onSaveDraft={() => {
          setLeaveOpen(false);
          handleCreate(false);
        }}
        onDiscard={() => {
          setLeaveOpen(false);
          onClose();
        }}
        onKeepEditing={() => setLeaveOpen(false)}
      />
    </motion.div>
  );
};
