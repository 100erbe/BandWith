import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Plus, Minus, Trash2,
  Mail, Phone, MapPin, ChevronUp, ArrowLeft, ArrowRight,
  Plane, Hotel, UtensilsCrossed, Volume2, Guitar,
  Heart, Wine, Utensils, Zap, Sparkles, Moon,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
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

const DEFAULT_MUSICAL_MOMENTS: MusicalMoment[] = [
  { id: 'ceremony', name: 'CEREMONY', description: 'ENTRANCE, CEREMONY, EXIT', icon: Heart, basePrice: 1200, defaultMusicians: 3, defaultDuration: 30, instruments: ['Vocals', 'Guitar', 'Keys'], selected: false, customized: false },
  { id: 'cocktail', name: 'COCKTAIL HOUR', description: 'BACKGROUND MUSIC', icon: Wine, basePrice: 500, defaultMusicians: 3, defaultDuration: 60, instruments: ['Vocals', 'Guitar', 'Keys'], selected: false, customized: false },
  { id: 'dinner', name: 'DINNER', description: 'ELEGANT BACKGROUND', icon: Utensils, basePrice: 600, defaultMusicians: 4, defaultDuration: 90, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys'], selected: false, customized: false },
  { id: 'party', name: 'PARTY / DANCING', description: 'HIGH ENERGY SETS', icon: Zap, basePrice: 1200, defaultMusicians: 5, defaultDuration: 120, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys', 'Drums'], selected: false, customized: false },
  { id: 'first-dance', name: 'FIRST DANCE', description: 'SPECIAL MOMENT', icon: Sparkles, basePrice: 200, defaultMusicians: 2, defaultDuration: 10, instruments: ['Vocals', 'Guitar'], selected: false, customized: false },
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

interface QuoteCreationWizardProps {
  onClose: () => void;
  onCreate: (quote: Partial<Quote>) => void;
  initialEventId?: string;
  initialEventTitle?: string;
  initialClientName?: string;
}

export const QuoteCreationWizard: React.FC<QuoteCreationWizardProps> = ({
  onClose,
  onCreate,
  initialClientName,
}) => {
  const [step, setStep] = useState(0);
  const defaults = getDefaultQuote();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  // === FORM STATE ===
  const [clientName, setClientName] = useState(initialClientName || '');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('US');
  const [clientCompany, setClientCompany] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState<QuoteEventType>('wedding');
  const [eventDate, setEventDate] = useState('');
  const [eventTimeStart, setEventTimeStart] = useState('');
  const [eventTimeEnd, setEventTimeEnd] = useState('');
  const [guestCount, setGuestCount] = useState<number | undefined>();
  const [venueName, setVenueName] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [venueCountry, setVenueCountry] = useState('IT');
  const [indoorOutdoor, setIndoorOutdoor] = useState<'indoor' | 'outdoor'>('indoor');
  const [musicalMoments, setMusicalMoments] = useState<MusicalMoment[]>(DEFAULT_MUSICAL_MOMENTS);
  const [expandedMoment, setExpandedMoment] = useState<string | null>(null);
  const [performanceType, setPerformanceType] = useState<PerformanceType>('full_band');
  const [setDuration, setSetDuration] = useState(120);
  const [numberOfSets, setNumberOfSets] = useState(2);
  const [breakDuration, setBreakDuration] = useState(20);
  const [selectedMusicians, setSelectedMusicians] = useState<QuoteMusician[]>([]);
  const [externalMusicians, setExternalMusicians] = useState<QuoteMusician[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState('');
  const [billingCountry, setBillingCountry] = useState('IT');
  const [vatNumber, setVatNumber] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [vatExempt, setVatExempt] = useState(false);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [baseFee, setBaseFee] = useState(0);
  const [travelIncluded, setTravelIncluded] = useState(true);
  const [travelFee, setTravelFee] = useState(0);
  const [accommodationNeeded, setAccommodationNeeded] = useState(false);
  const [accommodationFee, setAccommodationFee] = useState(0);
  const [mealsIncluded, setMealsIncluded] = useState(true);
  const [mealsFee, setMealsFee] = useState(0);
  const [soundIncluded, setSoundIncluded] = useState(true);
  const [soundFee, setSoundFee] = useState(0);
  const [lightsIncluded, setLightsIncluded] = useState(true);
  const [lightsFee, setLightsFee] = useState(0);
  const [backlineIncluded, setBacklineIncluded] = useState(true);
  const [backlineFee, setBacklineFee] = useState(0);
  const [customItems, setCustomItems] = useState<QuoteCustomItem[]>([]);
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [validityDays, setValidityDays] = useState(30);
  const [depositRequired, setDepositRequired] = useState(true);
  const [depositPercentage, setDepositPercentage] = useState(30);
  const [depositDueDate, setDepositDueDate] = useState('on_acceptance');
  const [balanceDueDate, setBalanceDueDate] = useState('7_days_after');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(['bank_transfer']);
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>('moderate');
  const [cancellationTerms, setCancellationTerms] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

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

  const selectedMomentsTotal = useMemo(() =>
    musicalMoments.filter(m => m.selected).reduce((sum, m) => sum + (m.customPrice ?? m.basePrice), 0)
  , [musicalMoments]);

  // === HANDLERS ===
  const handleNext = () => { if (step < STEPS.length - 1) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const handleCreate = (sendImmediately = false) => {
    const quoteData: Partial<Quote> = {
      quoteNumber: generateQuoteNumber(),
      status: sendImmediately ? 'SENT' : 'DRAFT',
      clientName, clientEmail, clientPhone: clientPhone || undefined, clientCompany: clientCompany || undefined,
      eventName, eventType, eventDate, eventTimeStart, eventTimeEnd: eventTimeEnd || undefined, guestCount,
      venueName: venueName || undefined, venueCity, venueCountry, indoorOutdoor,
      performanceType, setDuration, numberOfSets, breakDuration,
      musicians: allMusicians, genres: selectedGenres, specialRequests: specialRequests || undefined,
      billingCountry, vatNumber: vatNumber || undefined, fiscalCode: fiscalCode || undefined, vatRate, vatExempt, reverseCharge,
      currency: 'EUR', baseFee, travelIncluded, travelFee: travelIncluded ? 0 : travelFee,
      accommodationNeeded, accommodationFee: accommodationNeeded ? accommodationFee : 0,
      mealsIncluded, mealsFee: mealsIncluded ? 0 : mealsFee, soundIncluded, soundFee: soundIncluded ? 0 : soundFee,
      lightsIncluded, lightsFee: lightsIncluded ? 0 : lightsFee, backlineIncluded, backlineFee: backlineIncluded ? 0 : backlineFee,
      customItems, discountType, discountValue, discountReason: discountReason || undefined,
      ...totals, validUntil: validUntilDate, depositRequired, depositPercentage, depositDueDate, balanceDueDate,
      paymentMethods, cancellationPolicy, cancellationTerms: cancellationTerms || undefined,
      clientNotes: clientNotes || undefined, internalNotes: internalNotes || undefined,
      sentAt: sendImmediately ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), eventTitle: eventName,
    };
    onCreate(quoteData);
  };

  const toggleMusician = (musician: QuoteMusician) => {
    if (selectedMusicians.find(m => m.id === musician.id)) {
      setSelectedMusicians(selectedMusicians.filter(m => m.id !== musician.id));
    } else {
      setSelectedMusicians([...selectedMusicians, musician]);
    }
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

  const phonePrefix = COUNTRY_PHONE_CODES.find(c => c.code === phoneCountry)?.prefix || '+1';

  // === STEP INDICATOR ===
  const StepIndicators = () => (
    <div className="flex gap-1 items-center justify-center">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-[10px] transition-all',
            i === step ? 'w-4 bg-white' : 'w-2 bg-white/20'
          )}
        />
      ))}
    </div>
  );

  // === FIELD COMPONENT ===
  const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[12px] font-bold uppercase tracking-wide text-white">{label}</span>
      {children}
      <div className="h-px bg-white/20 mt-1" />
    </div>
  );

  // === TAG PILL ===
  const TagPill: React.FC<{ children: React.ReactNode; active?: boolean }> = ({ children, active }) => (
    <div className={cn(
      'px-2.5 py-1 rounded-[6px] text-[12px] font-bold uppercase',
      active ? 'bg-black text-white' : 'bg-black/30 text-[#9a8878]'
    )}>
      {children}
    </div>
  );

  // ═══════════════════════════════════
  // STEP 01: CLIENT & DATE
  // ═══════════════════════════════════
  const renderClientDateStep = () => (
    <div className="flex flex-col gap-10">
      <Field label="CLIENT NAME">
        <input
          type="text"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="EG. PAOLO ROSSI"
          className="w-full bg-transparent text-[24px] font-bold text-white placeholder:text-white/30 focus:outline-none uppercase"
          autoFocus
        />
      </Field>

      <Field label="EMAIL">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-white/40 shrink-0" />
          <input
            type="email"
            value={clientEmail}
            onChange={e => setClientEmail(e.target.value)}
            placeholder="EMAIL@EXAMPLE.COM"
            className="w-full bg-transparent text-[24px] font-bold text-white placeholder:text-white/30 focus:outline-none uppercase"
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field label="COUNTRY">
          <select
            value={phoneCountry}
            onChange={e => setPhoneCountry(e.target.value)}
            className="w-full bg-transparent text-[24px] font-bold text-white focus:outline-none appearance-none uppercase"
          >
            {COUNTRY_PHONE_CODES.map(c => (
              <option key={c.code} value={c.code} className="text-black">{c.code} {c.prefix}</option>
            ))}
          </select>
        </Field>
        <Field label="PHONE NUMBER">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-white/40 shrink-0" />
            <input
              type="tel"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="123-123-1234"
              className="w-full bg-transparent text-[24px] font-bold text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Field label="DATE">
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full bg-transparent text-[24px] font-bold text-white focus:outline-none uppercase"
          />
        </Field>
        <Field label="START">
          <input
            type="time"
            value={eventTimeStart}
            onChange={e => setEventTimeStart(e.target.value)}
            className="w-full bg-transparent text-[24px] font-bold text-white focus:outline-none uppercase"
          />
        </Field>
      </div>

      <Field label="VENUE">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-white/40 shrink-0" />
          <input
            type="text"
            value={venueName}
            onChange={e => setVenueName(e.target.value)}
            placeholder="VILLA REGINA"
            className="w-full bg-transparent text-[24px] font-bold text-white placeholder:text-white/30 focus:outline-none uppercase"
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-5">
        <Field label="CITY">
          <input
            type="text"
            value={venueCity}
            onChange={e => setVenueCity(e.target.value)}
            placeholder="CITY"
            className="w-full bg-transparent text-[20px] font-bold text-white placeholder:text-white/30 focus:outline-none uppercase"
          />
        </Field>
        <Field label="COUNTRY">
          <select
            value={venueCountry}
            onChange={e => setVenueCountry(e.target.value)}
            className="w-full bg-transparent text-[20px] font-bold text-white focus:outline-none appearance-none uppercase"
          >
            {Object.keys(VAT_RATES).map(code => (
              <option key={code} value={code} className="text-black">{VAT_RATES[code].name.toUpperCase()}</option>
            ))}
          </select>
        </Field>
      </div>

      {venueCity && (
        <div className="flex flex-wrap gap-2">
          {[venueCity, VAT_RATES[venueCountry]?.name].filter(Boolean).map((tag, i) => (
            <div key={i} className="px-3 py-1.5 rounded-[6px] bg-white/10 text-[12px] font-bold text-white/60 uppercase">
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
                isSelected ? 'text-white' : 'text-black/30'
              )}>
                {type.label}
              </span>
            </div>
            <DotRadio
              selected={isSelected}
              activeColor="#ffffff"
              inactiveColor="rgba(255,255,255,0.2)"
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
        <span className="text-[12px] font-bold uppercase tracking-wide text-white/50">TYPE</span>
        <div className="flex flex-wrap gap-2">
          {PERFORMANCE_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setPerformanceType(type.value)}
              className={cn(
                'px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all',
                performanceType === type.value
                  ? 'bg-black text-white border-black'
                  : 'bg-transparent text-white/60 border-white/20'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="flex flex-col gap-4">
        <span className="text-[12px] font-bold uppercase tracking-wide text-white/50">BAND MEMBERS</span>
        <div className="flex flex-col gap-3">
          {BAND_MEMBERS.map(member => {
            const isSelected = !!selectedMusicians.find(m => m.id === member.id);
            return (
              <button
                key={member.id}
                onClick={() => toggleMusician(member)}
                className="flex items-center gap-4 w-full text-left"
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0',
                  isSelected ? 'bg-[#D5FB46] text-black border-[#D5FB46]' : 'bg-transparent text-white/40 border-white/20'
                )}>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white/60">{member.instrument}</span>
                    {isSelected && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-black text-white">MANDATORY</span>}
                  </div>
                  <p className={cn('text-[16px] font-bold uppercase mt-1', isSelected ? 'text-white' : 'text-white/40')}>{member.name}</p>
                </div>
                <DotCheckbox
                  checked={isSelected}
                  activeColor="#ffffff"
                  inactiveColor="rgba(255,255,255,0.2)"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="flex flex-col gap-4">
        <span className="text-[12px] font-bold uppercase tracking-wide text-white/50">GENRES</span>
        <div className="flex flex-wrap gap-2">
          {MUSIC_GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={cn(
                'px-4 py-2 rounded-full text-[12px] font-bold uppercase border transition-all',
                selectedGenres.includes(genre)
                  ? 'bg-black text-white border-black'
                  : 'bg-transparent text-white/60 border-white/20'
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
                <TagPill active={isSelected}>${price}</TagPill>
                <span className={cn(
                  'text-[24px] font-bold uppercase leading-tight',
                  isSelected ? 'text-white' : 'text-black/30'
                )}>
                  {moment.name}
                </span>
                <span className={cn(
                  'text-[12px] font-bold uppercase',
                  isSelected ? 'text-white/60' : 'text-black/20'
                )}>
                  {moment.description}
                </span>
              </div>
              <DotCheckbox
                checked={isSelected}
                activeColor="#ffffff"
                inactiveColor="rgba(255,255,255,0.2)"
              />
            </button>

            {isSelected && (
              <div className="mt-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase text-white/50">MUSICIANS</span>
                  <span className="text-[32px] font-bold text-white">{musicians}</span>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateMoment(moment.id, { customMusicians: Math.max(1, musicians - 1) }); }}
                    className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateMoment(moment.id, { customMusicians: Math.min(10, musicians + 1) }); }}
                    className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedMoment(isExpanded ? null : moment.id); }}
                    className="flex items-center gap-2 text-white/50 text-[12px] font-bold uppercase mt-1"
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
                      <div className="flex flex-col gap-5 pt-3 border-t border-white/10">
                        <div className="flex flex-col gap-3">
                          <span className="text-[12px] font-bold uppercase text-white/50">PERFORMANCE TYPE</span>
                          <div className="flex flex-wrap gap-2">
                            {PERFORMANCE_TYPES.map(type => (
                              <button
                                key={type.value}
                                onClick={(e) => { e.stopPropagation(); setPerformanceType(type.value); }}
                                className={cn(
                                  'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all',
                                  performanceType === type.value
                                    ? 'bg-black text-white border-black'
                                    : 'bg-transparent text-white/60 border-white/20'
                                )}
                              >
                                {type.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <Field label="PRICE">
                            <div className="flex items-center gap-1">
                              <span className="text-white/40 font-bold">$</span>
                              <input
                                type="number"
                                value={price}
                                onChange={e => updateMoment(moment.id, { customPrice: parseInt(e.target.value) || 0 })}
                                onClick={e => e.stopPropagation()}
                                className="w-full bg-transparent text-[24px] font-bold text-white focus:outline-none"
                              />
                            </div>
                          </Field>
                          <Field label="DURATION (MIN)">
                            <input
                              type="number"
                              value={duration}
                              onChange={e => updateMoment(moment.id, { customDuration: parseInt(e.target.value) || 0 })}
                              onClick={e => e.stopPropagation()}
                              className="w-full bg-transparent text-[24px] font-bold text-white focus:outline-none"
                            />
                          </Field>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="h-px bg-white/10 mt-6" />
          </div>
        );
      })}

      {musicalMoments.some(m => m.selected) && (
        <div className="mt-4 bg-white/10 rounded-[16px] px-6 py-4">
          <span className="text-[12px] font-bold uppercase text-white/60">PARTIAL</span>
          <p className="text-[32px] font-bold text-white">${selectedMomentsTotal}</p>
        </div>
      )}
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
            <span className="text-white/40 text-[32px] font-bold">$</span>
            <input
              type="number"
              value={baseFee || ''}
              onChange={e => setBaseFee(parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-transparent text-[42px] font-bold text-white placeholder:text-white/20 focus:outline-none"
            />
          </div>
        </div>
        <DotCheckbox checked={baseFee > 0} activeColor="#ffffff" inactiveColor="rgba(255,255,255,0.2)" />
      </div>

      <div className="h-px bg-white/10" />

      {/* Additional Fees */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold uppercase text-white/50">ADDITIONAL FEES</span>
        <span className="text-[24px] font-bold uppercase text-white">EXTRA</span>
      </div>

      <FeeRow label="TRAVEL" tag="TRAVEL & LOGISTICS" included={travelIncluded} onToggle={() => setTravelIncluded(!travelIncluded)} />
      <FeeRow label="ACCOMMODATION" tag="TRAVEL & LOGISTICS" included={!accommodationNeeded} onToggle={() => setAccommodationNeeded(!accommodationNeeded)} />
      <FeeRow label="MEALS" tag="TRAVEL & LOGISTICS" included={mealsIncluded} onToggle={() => setMealsIncluded(!mealsIncluded)} />
      <FeeRow label="EQUIPMENT" tag="TECHNICAL" included={soundIncluded && lightsIncluded && backlineIncluded} onToggle={() => { setSoundIncluded(!soundIncluded); setLightsIncluded(!lightsIncluded); setBacklineIncluded(!backlineIncluded); }} />

      <div className="h-px bg-white/10" />

      {/* Tax Options */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-white/50">TAX OPTIONS</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setVatExempt(!vatExempt)}
            className={cn('px-3 py-1.5 rounded-[6px] text-[12px] font-bold uppercase border transition-all',
              vatExempt ? 'bg-black text-white border-black' : 'bg-transparent text-white/40 border-white/20'
            )}
          >
            VAT EXEMPT
          </button>
          <button
            onClick={() => setReverseCharge(!reverseCharge)}
            className={cn('px-3 py-1.5 rounded-[6px] text-[12px] font-bold uppercase border transition-all',
              reverseCharge ? 'bg-black text-white border-black' : 'bg-transparent text-white/40 border-white/20'
            )}
          >
            REVERSE CHARGE
          </button>
        </div>
      </div>

      {/* Quote Validity */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-white/50">QUOTE VALIDITY</span>
        <div className="flex flex-wrap gap-2">
          {VALIDITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setValidityDays(opt.value)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                validityDays === opt.value ? 'bg-black text-white border-black' : 'bg-transparent text-white/40 border-white/20'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deposit */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-white/50">DEPOSIT REQUIRED</span>
        <div className="flex flex-wrap gap-2">
          {DEPOSIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDepositPercentage(opt.value)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                depositPercentage === opt.value ? 'bg-black text-white border-black' : 'bg-transparent text-white/40 border-white/20'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-white/50">PAYMENT METHODS</span>
        <div className="flex flex-wrap gap-2">
          {(['bank_transfer', 'credit_card', 'paypal', 'cash'] as PaymentMethod[]).map(method => (
            <button
              key={method}
              onClick={() => togglePaymentMethod(method)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                paymentMethods.includes(method) ? 'bg-black text-white border-black' : 'bg-transparent text-white/40 border-white/20'
              )}
            >
              {method.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Cancellation Policy */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-white/50">CANCELLATION POLICY</span>
        <div className="flex flex-wrap gap-2">
          {(['flexible', 'moderate', 'strict'] as CancellationPolicy[]).map(policy => (
            <button
              key={policy}
              onClick={() => setCancellationPolicy(policy)}
              className={cn('px-3 py-1.5 rounded-full text-[12px] font-bold uppercase border transition-all',
                cancellationPolicy === policy ? 'bg-black text-white border-black' : 'bg-transparent text-white/40 border-white/20'
              )}
            >
              {policy}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-bold uppercase text-white/50">NOTES</span>
        <textarea
          value={clientNotes}
          onChange={e => setClientNotes(e.target.value)}
          placeholder="ANY NOTES TO INCLUDE IN THE QUOTE..."
          rows={3}
          className="w-full bg-transparent border border-white/20 rounded-[10px] p-4 text-white text-[14px] font-bold placeholder:text-white/20 focus:outline-none focus:border-white/40 resize-none uppercase"
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
          <h2 className="text-[32px] font-bold text-white uppercase leading-tight">
            {eventName || 'UNTITLED EVENT'}
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-white/60" />
              <span className="text-[14px] font-bold text-white uppercase">{venueName || venueCity || 'TBD'}</span>
            </div>
            <div className="px-3 py-1.5 rounded-[6px] bg-white/10 text-[12px] font-bold text-white/60 uppercase">
              START - {eventTimeStart || 'TBD'}
            </div>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Year & Date */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white/50 uppercase">YEAR</span>
            <span className="text-[42px] font-bold text-white leading-none">{yearNum}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white/50 uppercase">DATE</span>
            <span className="text-[42px] font-bold text-white leading-none">{monthName} {dayNum}</span>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Client & Pricing */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white/50 uppercase">CLIENT</span>
            <span className="text-[32px] font-bold text-white uppercase leading-tight">{clientName || 'TBD'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white/50 uppercase">PRICING & FINANCE</span>
            <span className="text-[32px] font-bold text-white leading-tight">
              ${totals.total >= 1000 ? `${(totals.total / 1000).toFixed(1)}K` : totals.total}
            </span>
            <span className="text-[14px] font-bold text-white/50 uppercase">DP{depositPercentage}%</span>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Guests */}
        {guestCount && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold text-white/50 uppercase">GUESTS</span>
              <span className="text-[42px] font-bold text-white leading-none">{guestCount}</span>
            </div>
            <div className="h-px bg-white/10" />
          </>
        )}

        {/* Moments & Members */}
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white/50 uppercase">MUSIC MOMENTS</span>
            <span className="text-[32px] font-bold text-white leading-none">{selectedMomentCount}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white/50 uppercase">MEMBERS</span>
            <span className="text-[32px] font-bold text-white leading-none">{allMusicians.length}</span>
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

  // === MAIN RENDER ===
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-[#9a8878] flex flex-col overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-[62px] pb-4 flex flex-col gap-2 shrink-0 relative z-20">
        <StepIndicators />
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white uppercase">
              STEP {String(step + 1).padStart(2, '0')}
            </span>
            <h2 className="text-[32px] font-bold text-white uppercase leading-none">
              {STEPS[step].title}
            </h2>
            <span className="text-[16px] font-bold text-black/30 uppercase">
              {STEPS[step].subtitle}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-[50px] h-[50px] rounded-full bg-[rgba(216,216,216,0.3)] border-2 border-white flex items-center justify-center shrink-0"
          >
            <X className="w-6 h-6 text-white" />
          </button>
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
        className="px-4 pt-5 pb-[30px] shrink-0 relative z-20 bg-[#9a8878] rounded-t-[26px] shadow-[0px_-4px_20px_rgba(0,0,0,0.1)]"
      >
        {step === STEPS.length - 1 ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleCreate(false)}
                className="bg-white/20 rounded-[10px] py-4 flex items-center justify-center gap-2"
              >
                <span className="text-[16px] font-bold text-black uppercase">SAVE DRAFT</span>
              </button>
              <button
                onClick={() => handleCreate(true)}
                className="bg-black rounded-[10px] py-4 flex items-center justify-center gap-2"
              >
                <span className="text-[16px] font-bold text-white uppercase">SEND QUOTE</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-[12px] font-bold text-[#A73131] uppercase text-center py-2"
            >
              DISCARD
            </button>
          </div>
        ) : step === 4 ? (
          /* Billing step footer with total */
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold text-white/60 uppercase">TOTAL + TAXES</span>
              <span className="text-[12px] font-bold text-white/40">${totals.subtotal}+{totals.vatAmount.toFixed(0)}</span>
              <span className="text-[32px] font-bold text-white">${totals.total.toFixed(0)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleBack}
                className="bg-white/20 rounded-[10px] py-4 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
                <span className="text-[16px] font-bold text-black uppercase">BACK</span>
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={cn(
                  'rounded-[10px] py-4 flex items-center justify-center gap-2 transition-all',
                  canProceed() ? 'bg-black' : 'bg-black/30'
                )}
              >
                <span className={cn('text-[16px] font-bold uppercase', canProceed() ? 'text-white' : 'text-white/30')}>NEXT</span>
                <ArrowRight className={cn('w-4 h-4', canProceed() ? 'text-white' : 'text-white/30')} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="bg-white/20 rounded-[10px] py-4 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-black" />
                <span className="text-[16px] font-bold text-black uppercase">BACK</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="bg-white/20 rounded-[10px] py-4 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4 text-black" />
                <span className="text-[16px] font-bold text-black uppercase">CANCEL</span>
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                'rounded-[10px] py-4 flex items-center justify-center gap-2 transition-all',
                canProceed() ? 'bg-black' : 'bg-black/30'
              )}
            >
              <span className={cn('text-[16px] font-bold uppercase', canProceed() ? 'text-white' : 'text-white/30')}>
                NEXT
              </span>
              <ArrowRight className={cn('w-4 h-4', canProceed() ? 'text-white' : 'text-white/30')} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// === Fee Row Component ===
const FeeRow: React.FC<{
  label: string;
  tag: string;
  included: boolean;
  onToggle: () => void;
}> = ({ label, tag, included, onToggle }) => (
  <button onClick={onToggle} className="flex items-start justify-between gap-5 w-full text-left">
    <div className="flex flex-col gap-1 flex-1">
      <div className="px-2.5 py-1 rounded-[6px] bg-white/10 text-[12px] font-bold text-white/40 uppercase self-start">
        {tag}
      </div>
      <span className={cn(
        'text-[20px] font-bold uppercase',
        !included ? 'text-white' : 'text-white/30'
      )}>
        {label}
      </span>
    </div>
    <DotCheckbox
      checked={!included}
      activeColor="#ffffff"
      inactiveColor="rgba(255,255,255,0.2)"
    />
  </button>
);
