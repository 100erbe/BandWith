import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ArrowRight, ArrowLeft, Plus, Trash2, Check,
  User, Mail, Phone, Building2, Calendar as CalendarIcon,
  MapPin, Clock, Users, Music, Mic2, Guitar, Drum,
  Globe, Receipt, CreditCard, FileText, Send, Download,
  Share2, Link2, Save, MessageCircle, ChevronDown,
  Plane, Hotel, UtensilsCrossed, Volume2, Lightbulb, Settings,
  Percent, Tag, UserPlus, Search, Heart, Briefcase, PartyPopper,
  Radio, Sparkles, Wine, Utensils, Zap, Moon, LucideIcon, CheckCircle2, Lock, HeartHandshake
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import {
  Quote,
  QuoteEventType,
  PerformanceType,
  CancellationPolicy,
  PaymentMethod,
  QuoteMusician,
  QuoteCustomItem,
  VAT_RATES,
  CANCELLATION_POLICIES,
  BAND_MEMBERS,
  MUSIC_GENRES,
  generateQuoteNumber,
  calculateVAT,
  calculateQuoteTotals,
  getDefaultQuote,
} from '@/app/data/quotes';

// --- STEPS ---
const STEPS = [
  { id: 'event-type', title: 'Event Type', subtitle: 'What kind of event?' },
  { id: 'client', title: 'Client', subtitle: 'Who is it for?' },
  { id: 'date-location', title: 'Date & Location', subtitle: 'When and where?' },
  { id: 'moments', title: 'Musical Moments', subtitle: 'Customize your show' },
  { id: 'performance', title: 'Performance', subtitle: 'Build your band' },
  { id: 'billing', title: 'Billing & VAT', subtitle: 'Tax calculation' },
  { id: 'pricing', title: 'Pricing', subtitle: 'Build your quote' },
  { id: 'terms', title: 'Terms', subtitle: 'Payment & policies' },
  { id: 'review', title: 'Review & Send', subtitle: 'Final check' },
];

// Event Types with icons
const EVENT_TYPES: { value: QuoteEventType; label: string; icon: LucideIcon }[] = [
  { value: 'wedding', label: 'Wedding', icon: HeartHandshake },
  { value: 'corporate', label: 'Corporate', icon: Building2 },
  { value: 'private', label: 'Private', icon: Lock },
  { value: 'festival', label: 'Festival', icon: Radio },
  { value: 'club', label: 'Club', icon: Mic2 },
  { value: 'other', label: 'Other', icon: Music },
];

// Musical Moments
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
  { id: 'ceremony', name: 'Ceremony', description: 'Entrance, ceremony, exit', icon: Heart, basePrice: 300, defaultMusicians: 3, defaultDuration: 30, instruments: ['Vocals', 'Guitar', 'Keys'], selected: false, customized: false },
  { id: 'cocktail', name: 'Cocktail Hour', description: 'Background music', icon: Wine, basePrice: 500, defaultMusicians: 3, defaultDuration: 60, instruments: ['Vocals', 'Guitar', 'Keys'], selected: false, customized: false },
  { id: 'dinner', name: 'Dinner', description: 'Elegant background', icon: Utensils, basePrice: 600, defaultMusicians: 4, defaultDuration: 90, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys'], selected: false, customized: false },
  { id: 'party', name: 'Party / Dancing', description: 'High energy sets', icon: Zap, basePrice: 1200, defaultMusicians: 5, defaultDuration: 120, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys', 'Drums'], selected: false, customized: false },
  { id: 'first-dance', name: 'First Dance', description: 'Special moment', icon: Sparkles, basePrice: 200, defaultMusicians: 2, defaultDuration: 10, instruments: ['Vocals', 'Guitar'], selected: false, customized: false },
  { id: 'afterparty', name: 'After Party', description: 'Late night', icon: Moon, basePrice: 800, defaultMusicians: 4, defaultDuration: 90, instruments: ['Vocals', 'Guitar', 'Bass', 'Keys'], selected: false, customized: false },
];

const AVAILABLE_INSTRUMENTS = ['Vocals', 'Guitar', 'Bass', 'Keys', 'Drums', 'Sax', 'Trumpet', 'Violin', 'DJ'];

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
  { value: 'full_band', label: 'Full Band' },
  { value: 'duo', label: 'Duo' },
  { value: 'trio', label: 'Trio' },
  { value: 'solo', label: 'Solo' },
  { value: 'dj_set', label: 'DJ Set' },
  { value: 'acoustic', label: 'Acoustic' },
];

const DURATION_OPTIONS = [
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 150, label: '2.5 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' },
];

const VALIDITY_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

const DEPOSIT_OPTIONS = [
  { value: 20, label: '20%' },
  { value: 30, label: '30%' },
  { value: 50, label: '50%' },
];

const BALANCE_DUE_OPTIONS = [
  { value: 'before_event', label: 'Before event' },
  { value: 'on_event_day', label: 'On event day' },
  { value: '7_days_after', label: '7 days after' },
  { value: '30_days_after', label: '30 days after' },
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
  const [phoneCountry, setPhoneCountry] = useState('IT');
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

  // === HANDLERS ===
  const handleNext = () => { if (step < STEPS.length - 1) setStep(step + 1); else handleCreate(); };
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

  const addCustomItem = () => setCustomItems([...customItems, { id: `ci-${Date.now()}`, description: '', amount: 0, quantity: 1 }]);
  const updateCustomItem = (index: number, field: keyof QuoteCustomItem, value: string | number) => {
    const updated = [...customItems];
    updated[index] = { ...updated[index], [field]: value };
    setCustomItems(updated);
  };
  const removeCustomItem = (index: number) => setCustomItems(customItems.filter((_, i) => i !== index));

  const addExternalMusician = () => setExternalMusicians([...externalMusicians, { id: `ext-${Date.now()}`, name: '', instrument: '', isExternal: true, isAvailable: true }]);
  const updateExternalMusician = (index: number, field: keyof QuoteMusician, value: string | number) => {
    const updated = [...externalMusicians];
    updated[index] = { ...updated[index], [field]: value };
    setExternalMusicians(updated);
  };
  const removeExternalMusician = (index: number) => setExternalMusicians(externalMusicians.filter((_, i) => i !== index));

  const canProceed = () => {
    switch (step) {
      case 0: return eventType;
      case 1: return clientName.trim() && clientEmail.trim();
      case 2: return eventName.trim() && eventDate && eventTimeStart && venueCity.trim() && venueCountry;
      case 3: return musicalMoments.some(m => m.selected);
      case 4: return selectedMusicians.length > 0 && selectedGenres.length > 0;
      case 5: return billingCountry;
      case 6: return baseFee > 0;
      case 7: return paymentMethods.length > 0;
      case 8: return true;
      default: return false;
    }
  };

  const toggleMoment = (momentId: string) => setMusicalMoments(prev => prev.map(m => m.id === momentId ? { ...m, selected: !m.selected } : m));
  const updateMoment = (momentId: string, updates: Partial<MusicalMoment>) => setMusicalMoments(prev => prev.map(m => m.id === momentId ? { ...m, ...updates, customized: true } : m));
  const toggleMomentInstrument = (momentId: string, instrument: string) => {
    setMusicalMoments(prev => prev.map(m => {
      if (m.id !== momentId) return m;
      const instruments = m.customInstruments || [...m.instruments];
      const newInstruments = instruments.includes(instrument) ? instruments.filter(i => i !== instrument) : [...instruments, instrument];
      return { ...m, customInstruments: newInstruments, customized: true };
    }));
  };
  const getSelectedMomentsTotal = () => musicalMoments.filter(m => m.selected).reduce((sum, m) => sum + (m.customPrice ?? m.basePrice), 0);

  // === EVENT TYPE CARD (Swiss Style) ===
  const renderEventTypeCard = (type: typeof EVENT_TYPES[0]) => (
    <button
      key={type.value}
      onClick={() => setEventType(type.value)}
      className={cn(
        "group relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 flex flex-col items-start gap-4",
        eventType === type.value
          ? "bg-black border-black text-white"
          : "bg-white/10 border-white/10 hover:bg-white/20 text-white/60"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
        eventType === type.value ? "bg-[#D4FB46] text-black" : "bg-white/20 text-white/60 group-hover:text-white"
      )}>
        {React.createElement(type.icon, { className: "w-6 h-6" })}
      </div>
      <span className={cn(
        "text-lg font-black uppercase tracking-tight",
        eventType === type.value ? "text-white" : "text-white/60 group-hover:text-white"
      )}>
        {type.label}
      </span>
    </button>
  );

  // === RENDER STEPS ===
  const renderEventTypeStep = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Select Type</label>
        <div className="grid grid-cols-2 gap-4">
          {EVENT_TYPES.map(type => renderEventTypeCard(type))}
        </div>
      </div>
    </div>
  );

  const renderClientStep = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-8">
        <div className="group relative">
          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Client Name *</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Mario Rossi"
            className="w-full bg-transparent border-b-2 border-white/20 py-2 text-3xl font-black text-white placeholder:text-white/20 focus:outline-none focus:border-white transition-all"
            autoFocus
          />
        </div>

        <div className="group relative">
          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Email *</label>
          <div className="flex items-center gap-3 border-b-2 border-white/20 focus-within:border-white transition-colors py-2">
            <Mail className="w-5 h-5 text-white/40" />
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full bg-transparent text-xl font-bold text-white placeholder:text-white/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Country</label>
            <div className="flex items-center gap-2 border-b-2 border-white/20 py-2">
              <select
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value)}
                className="bg-transparent text-xl font-bold text-white focus:outline-none appearance-none cursor-pointer"
              >
                {COUNTRY_PHONE_CODES.map(c => <option key={c.code} value={c.code} className="text-black">{c.code} {c.prefix}</option>)}
              </select>
            </div>
          </div>
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Phone</label>
            <div className="flex items-center gap-2 border-b-2 border-white/20 focus-within:border-white transition-colors py-2">
              <Phone className="w-5 h-5 text-white/40" />
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full bg-transparent text-xl font-bold text-white placeholder:text-white/20 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="group relative">
          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Company</label>
          <div className="flex items-center gap-3 border-b-2 border-white/20 focus-within:border-white transition-colors py-2">
            <Building2 className="w-5 h-5 text-white/40" />
            <input
              type="text"
              value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)}
              placeholder="Company (optional)"
              className="w-full bg-transparent text-xl font-bold text-white placeholder:text-white/20 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDateLocationStep = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-8">
        <div className="group relative">
          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Event Title *</label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g. Wedding Reception"
            className="w-full bg-transparent border-b-2 border-white/20 py-2 text-3xl font-black text-white placeholder:text-white/20 focus:outline-none focus:border-white transition-all"
          />
        </div>

        <div className="group relative">
          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Venue</label>
          <div className="flex items-center gap-3 border-b-2 border-white/20 focus-within:border-white transition-colors py-2">
            <MapPin className="w-5 h-5 text-white/40" />
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Venue Name"
              className="w-full bg-transparent text-xl font-bold text-white placeholder:text-white/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Date *</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white"
            />
          </div>
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Start *</label>
            <input
              type="time"
              value={eventTimeStart}
              onChange={(e) => setEventTimeStart(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white"
            />
          </div>
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">End</label>
            <input
              type="time"
              value={eventTimeEnd}
              onChange={(e) => setEventTimeEnd(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">City *</label>
            <input
              type="text"
              value={venueCity}
              onChange={(e) => setVenueCity(e.target.value)}
              placeholder="City"
              className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-white"
            />
          </div>
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Country *</label>
            <select
              value={venueCountry}
              onChange={(e) => setVenueCountry(e.target.value)}
              className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white appearance-none"
            >
              {Object.keys(VAT_RATES).map((code) => (
                <option key={code} value={code} className="text-black">{VAT_RATES[code].name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="group relative">
            <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Guests</label>
            <div className="flex items-center gap-2 border-b-2 border-white/20 py-2">
              <Users className="w-5 h-5 text-white/40" />
              <input
                type="number"
                value={guestCount || ''}
                onChange={(e) => setGuestCount(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="150"
                className="w-full bg-transparent text-xl font-bold text-white placeholder:text-white/20 focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Setting</label>
            <div className="flex gap-2">
              {['indoor', 'outdoor'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setIndoorOutdoor(opt as 'indoor' | 'outdoor')}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-full text-xs font-bold uppercase border transition-all",
                    indoorOutdoor === opt
                      ? "bg-black text-[#D4FB46] border-black"
                      : "bg-transparent text-white/60 border-white/20 hover:border-white/40"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMusicalMomentsStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-4">
        {musicalMoments.map((moment) => {
          const isExpanded = expandedMoment === moment.id;
          const price = moment.customPrice ?? moment.basePrice;
          const musicians = moment.customMusicians ?? moment.defaultMusicians;
          const duration = moment.customDuration ?? moment.defaultDuration;
          const instruments = moment.customInstruments ?? moment.instruments;
          const isSelected = moment.selected;

          return (
            <div
              key={moment.id}
              className={cn(
                'rounded-3xl overflow-hidden transition-all border',
                isSelected
                  ? 'bg-black border-black'
                  : 'bg-white/10 border-white/10 hover:bg-white/15'
              )}
            >
              <div className="p-5 flex items-center gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                  isSelected ? 'bg-[#D4FB46] text-black' : 'bg-white/20 text-white/60'
                )}>
                  <moment.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className={cn("font-black text-lg uppercase tracking-tight", isSelected ? "text-white" : "text-white/70")}>{moment.name}</h3>
                  <p className={cn("text-sm", isSelected ? "text-white/60" : "text-white/40")}>{moment.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('text-lg font-black', isSelected ? 'text-[#D4FB46]' : 'text-white/60')}>€{price}</span>
                  <button
                    onClick={() => toggleMoment(moment.id)}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                      isSelected ? 'bg-[#D4FB46] border-[#D4FB46]' : 'bg-transparent border-white/30 hover:border-white/50'
                    )}
                  >
                    {isSelected && <Check className="w-5 h-5 text-black" />}
                  </button>
                </div>
              </div>

              {isSelected && (
                <button
                  onClick={() => setExpandedMoment(isExpanded ? null : moment.id)}
                  className="w-full px-5 py-3 flex items-center justify-between text-white/60 hover:text-white border-t border-white/10"
                >
                  <span className="text-sm font-bold uppercase tracking-wide">Customize</span>
                  <ChevronDown className={cn('w-5 h-5 transition-transform', isExpanded && 'rotate-180')} />
                </button>
              )}

              <AnimatePresence>
                {isSelected && isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-5 pb-5 space-y-5 border-t border-white/10 pt-5">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3 block">Musicians</label>
                        <div className="flex items-center gap-4">
                          <button onClick={() => updateMoment(moment.id, { customMusicians: Math.max(1, musicians - 1) })} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">−</button>
                          <span className="text-2xl font-black text-white w-8 text-center">{musicians}</span>
                          <button onClick={() => updateMoment(moment.id, { customMusicians: Math.min(10, musicians + 1) })} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3 block">Instruments</label>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_INSTRUMENTS.map((instr) => (
                            <button
                              key={instr}
                              onClick={() => toggleMomentInstrument(moment.id, instr)}
                              className={cn('px-4 py-2 rounded-full text-xs font-bold transition-all', instruments.includes(instr) ? 'bg-black text-[#D4FB46]' : 'bg-white/10 text-white/50 hover:bg-white/20')}
                            >
                              {instr}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="group relative">
                          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Price (€)</label>
                          <input type="number" value={price} onChange={(e) => updateMoment(moment.id, { customPrice: parseInt(e.target.value) || 0 })} className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white" />
                        </div>
                        <div className="group relative">
                          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Duration (min)</label>
                          <input type="number" value={duration} onChange={(e) => updateMoment(moment.id, { customDuration: parseInt(e.target.value) || 0 })} className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {musicalMoments.some(m => m.selected) && (
        <div className="p-5 bg-black/30 rounded-2xl flex items-center justify-between border border-white/10">
          <span className="text-white/70 font-bold uppercase tracking-wide text-sm">Total from moments</span>
          <span className="text-2xl font-black text-[#D4FB46]">€{getSelectedMomentsTotal()}</span>
        </div>
      )}
    </div>
  );

  const renderPerformanceStep = () => (
    <div className="space-y-8 h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Performance Type</label>
        <div className="flex flex-wrap gap-2">
          {PERFORMANCE_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setPerformanceType(type.value)}
              className={cn(
                'px-5 py-2 rounded-full text-xs font-bold uppercase border transition-all',
                performanceType === type.value
                  ? 'bg-black text-[#D4FB46] border-black'
                  : 'bg-transparent text-white/60 border-white/20 hover:border-white/40'
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[1px] bg-white/10" />

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Band Members</label>
        <div className="space-y-3">
          {BAND_MEMBERS.map(member => {
            const isSelected = selectedMusicians.find(m => m.id === member.id);
            return (
              <div key={member.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleMusician(member)}>
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
                    isSelected ? "bg-black text-[#D4FB46] border-black" : "bg-transparent text-white/40 border-white/20 group-hover:border-white/40"
                  )}>
                    {isSelected ? <CheckCircle2 className="w-6 h-6" /> : member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className={cn("text-lg font-bold transition-colors", isSelected ? "text-white" : "text-white/50")}>{member.name}</h4>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/40">{member.instrument}</p>
                  </div>
                </div>
                {!isSelected && (
                  <button onClick={() => toggleMusician(member)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/30 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10">
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-[1px] bg-white/10" />

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Genres</label>
        <div className="flex flex-wrap gap-2">
          {MUSIC_GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold uppercase border transition-all',
                selectedGenres.includes(genre)
                  ? 'bg-black text-[#D4FB46] border-black'
                  : 'bg-transparent text-white/60 border-white/20 hover:border-white/40'
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBillingStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Billing Country</label>
        <select
          value={billingCountry}
          onChange={(e) => setBillingCountry(e.target.value)}
          className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white focus:outline-none focus:border-white appearance-none"
        >
          {Object.keys(VAT_RATES).map((code) => (
            <option key={code} value={code} className="text-black">{VAT_RATES[code].name} - {VAT_RATES[code].rate}%</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="group relative">
          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">VAT Number</label>
          <input
            type="text"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            placeholder="IT01234567890"
            className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-white"
          />
        </div>
        <div className="group relative">
          <label className="absolute -top-3 left-0 text-[10px] font-bold uppercase tracking-widest text-white/40">Fiscal Code</label>
          <input
            type="text"
            value={fiscalCode}
            onChange={(e) => setFiscalCode(e.target.value)}
            placeholder="RSSMRA80..."
            className="w-full bg-transparent border-b-2 border-white/20 py-2 text-xl font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-white"
          />
        </div>
      </div>

      <div className="h-[1px] bg-white/10" />

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Tax Options</label>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setVatExempt(!vatExempt)}
            className={cn(
              'px-5 py-3 rounded-xl text-sm font-bold border transition-all',
              vatExempt ? 'bg-black text-[#D4FB46] border-black' : 'bg-transparent text-white/60 border-white/20'
            )}
          >
            VAT Exempt
          </button>
          <button
            onClick={() => setReverseCharge(!reverseCharge)}
            className={cn(
              'px-5 py-3 rounded-xl text-sm font-bold border transition-all',
              reverseCharge ? 'bg-black text-[#D4FB46] border-black' : 'bg-transparent text-white/60 border-white/20'
            )}
          >
            Reverse Charge
          </button>
        </div>
      </div>

      <div className="p-5 bg-white/10 rounded-2xl">
        <div className="flex items-center justify-between">
          <span className="text-white/70 font-bold uppercase tracking-wide text-sm">Applicable VAT Rate</span>
          <span className="text-2xl font-black text-white">{vatRate}%</span>
        </div>
      </div>
    </div>
  );

  const renderPricingStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="p-6 bg-white/10 rounded-3xl border border-white/10">
        <div className="group relative">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Base Performance Fee</label>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black text-white/40">€</span>
            <input
              type="number"
              value={baseFee || ''}
              onChange={(e) => setBaseFee(parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-transparent text-4xl font-black text-white placeholder:text-white/20 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Travel & Logistics</label>
        <div className="space-y-3">
          <ToggleRow icon={<Plane className="w-5 h-5" />} label="Travel" included={travelIncluded} onToggle={() => setTravelIncluded(!travelIncluded)} fee={travelFee} onFeeChange={setTravelFee} showFee={!travelIncluded} />
          <ToggleRow icon={<Hotel className="w-5 h-5" />} label="Accommodation" included={!accommodationNeeded} onToggle={() => setAccommodationNeeded(!accommodationNeeded)} fee={accommodationFee} onFeeChange={setAccommodationFee} showFee={accommodationNeeded} includedLabel="Not needed" extraLabel="Required" />
          <ToggleRow icon={<UtensilsCrossed className="w-5 h-5" />} label="Meals" included={mealsIncluded} onToggle={() => setMealsIncluded(!mealsIncluded)} fee={mealsFee} onFeeChange={setMealsFee} showFee={!mealsIncluded} />
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Technical</label>
        <div className="space-y-3">
          <ToggleRow icon={<Volume2 className="w-5 h-5" />} label="Sound" included={soundIncluded} onToggle={() => setSoundIncluded(!soundIncluded)} fee={soundFee} onFeeChange={setSoundFee} showFee={!soundIncluded} />
          <ToggleRow icon={<Lightbulb className="w-5 h-5" />} label="Lights" included={lightsIncluded} onToggle={() => setLightsIncluded(!lightsIncluded)} fee={lightsFee} onFeeChange={setLightsFee} showFee={!lightsIncluded} />
          <ToggleRow icon={<Guitar className="w-5 h-5" />} label="Backline" included={backlineIncluded} onToggle={() => setBacklineIncluded(!backlineIncluded)} fee={backlineFee} onFeeChange={setBacklineFee} showFee={!backlineIncluded} />
        </div>
      </div>

      <div className="h-[1px] bg-white/10" />

      <div className="p-5 bg-black/30 rounded-2xl space-y-3 border border-white/10">
        <div className="flex justify-between text-white/60"><span>Subtotal</span><span className="font-bold">€{totals.subtotal}</span></div>
        {totals.discountAmount > 0 && <div className="flex justify-between text-red-400"><span>Discount</span><span className="font-bold">-€{totals.discountAmount}</span></div>}
        <div className="flex justify-between text-white/60"><span>VAT ({vatRate}%)</span><span className="font-bold">€{totals.vatAmount}</span></div>
        <div className="h-[1px] bg-white/20" />
        <div className="flex justify-between text-white text-xl"><span className="font-bold">Total</span><span className="font-black text-[#D4FB46]">€{totals.total}</span></div>
      </div>
    </div>
  );

  const renderTermsStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Quote Validity</label>
        <div className="flex flex-wrap gap-2">
          {VALIDITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setValidityDays(opt.value)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold uppercase border transition-all',
                validityDays === opt.value
                  ? 'bg-black text-[#D4FB46] border-black'
                  : 'bg-transparent text-white/60 border-white/20'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Deposit Required</label>
        <div className="flex flex-wrap gap-2">
          {DEPOSIT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDepositPercentage(opt.value)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold uppercase border transition-all',
                depositPercentage === opt.value
                  ? 'bg-black text-[#D4FB46] border-black'
                  : 'bg-transparent text-white/60 border-white/20'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Payment Methods</label>
        <div className="flex flex-wrap gap-2">
          {(['bank_transfer', 'credit_card', 'paypal', 'cash'] as PaymentMethod[]).map(method => (
            <button
              key={method}
              onClick={() => togglePaymentMethod(method)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold uppercase border transition-all',
                paymentMethods.includes(method)
                  ? 'bg-black text-[#D4FB46] border-black'
                  : 'bg-transparent text-white/60 border-white/20'
              )}
            >
              {method.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 ml-1">Cancellation Policy</label>
        <div className="flex flex-wrap gap-2">
          {(['flexible', 'moderate', 'strict'] as CancellationPolicy[]).map(policy => (
            <button
              key={policy}
              onClick={() => setCancellationPolicy(policy)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold uppercase border transition-all',
                cancellationPolicy === policy
                  ? 'bg-black text-[#D4FB46] border-black'
                  : 'bg-transparent text-white/60 border-white/20'
              )}
            >
              {policy}
            </button>
          ))}
        </div>
      </div>

      <div className="group relative">
        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">Notes for Client</label>
        <textarea
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          placeholder="Any notes to include in the quote..."
          rows={3}
          className="w-full bg-transparent border-2 border-white/20 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 resize-none"
        />
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-black text-[#D4FB46] text-[10px] font-black uppercase tracking-widest rounded-full">{eventType}</span>
          <span className="text-white/50 text-xs font-bold uppercase tracking-widest">{eventDate} @ {eventTimeStart}</span>
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter leading-[0.9] uppercase">{eventName || 'Untitled'}</h2>
        <p className="text-xl text-white/60 font-medium">{venueName || venueCity}</p>
      </div>

      <div className="h-[1px] bg-white/10" />

      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 bg-white/10 rounded-3xl border border-white/10">
          <User className="w-8 h-8 text-white/30 mb-4" />
          <span className="block text-2xl font-black text-white">{clientName}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">Client</span>
        </div>
        <div className="p-6 bg-white/10 rounded-3xl border border-white/10">
          <Users className="w-8 h-8 text-white/30 mb-4" />
          <span className="block text-2xl font-black text-white">{selectedMusicians.length}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">Musicians</span>
        </div>
        <div className="p-6 bg-white/10 rounded-3xl border border-white/10">
          <Music className="w-8 h-8 text-white/30 mb-4" />
          <span className="block text-2xl font-black text-white">{musicalMoments.filter(m => m.selected).length}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">Moments</span>
        </div>
        <div className="p-6 bg-black rounded-3xl border border-black">
          <Receipt className="w-8 h-8 text-[#D4FB46]/50 mb-4" />
          <span className="block text-2xl font-black text-[#D4FB46]">€{totals.total}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">Total</span>
        </div>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return renderEventTypeStep();
      case 1: return renderClientStep();
      case 2: return renderDateLocationStep();
      case 3: return renderMusicalMomentsStep();
      case 4: return renderPerformanceStep();
      case 5: return renderBillingStep();
      case 6: return renderPricingStep();
      case 7: return renderTermsStep();
      case 8: return renderReviewStep();
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-[#998878] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex justify-between items-start shrink-0 relative z-20 max-w-4xl mx-auto w-full">
        <div>
          <span className="text-white/40 text-xs font-black uppercase tracking-[0.3em] mb-2 block">Step 0{step + 1}</span>
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">{STEPS[step].title}</h2>
          <p className="text-white/50 font-bold text-sm mt-1 tracking-tight">{STEPS[step].subtitle}</p>
        </div>
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/50 hover:text-white transition-all hover:rotate-90"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-6 pt-4 mt-auto shrink-0 relative z-20 border-t border-white/10 max-w-4xl mx-auto w-full">
        {step === STEPS.length - 1 ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button onClick={handleBack} className="flex-1 h-12 rounded-full text-xs font-bold uppercase text-white/60 flex items-center justify-center gap-2 hover:bg-white/10 border border-white/20">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => handleCreate(false)} className="flex-1 h-12 rounded-full text-xs font-bold uppercase bg-white/20 text-white hover:bg-white/30 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Save Draft
              </button>
            </div>
            <button onClick={() => handleCreate(true)} className="w-full h-16 rounded-full text-sm font-black uppercase tracking-widest bg-black text-[#D4FB46] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-xl">
              <Send className="w-5 h-5" /> Send Quote
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            {step > 0 ? (
              <button onClick={handleBack} className="px-6 py-4 rounded-full text-xs font-bold uppercase text-white/50 hover:text-white flex items-center gap-3 transition-colors group hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                'h-16 px-10 rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-4 transition-all shadow-xl hover:shadow-black/10',
                !canProceed()
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-black text-[#D4FB46] hover:scale-105 active:scale-95'
              )}
            >
              Next Step <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// --- Toggle Row Component ---
interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  included: boolean;
  onToggle: () => void;
  fee: number;
  onFeeChange: (value: number) => void;
  showFee: boolean;
  includedLabel?: string;
  extraLabel?: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, included, onToggle, fee, onFeeChange, showFee, includedLabel = 'Included', extraLabel = 'Extra' }) => (
  <div className="bg-white/10 rounded-xl overflow-hidden border border-white/10">
    <div className="flex items-center gap-3 p-4">
      <div className="text-white/40">{icon}</div>
      <span className="flex-1 font-bold text-white">{label}</span>
      <button onClick={onToggle} className="flex items-center gap-2 group cursor-pointer">
        <span className={cn('text-xs font-medium transition-colors', included ? 'text-white/60' : 'text-white/30')}>{includedLabel}</span>
        <div className={cn('relative w-14 h-8 rounded-full transition-all duration-200 p-1', included ? 'bg-white/20' : 'bg-black')}>
          <div className={cn('absolute w-6 h-6 rounded-full transition-all duration-200 flex items-center justify-center', included ? 'left-1 bg-white/60' : 'left-7 bg-[#D4FB46]')}>
            {!included && <Check className="w-3 h-3 text-black" />}
          </div>
        </div>
        <span className={cn('text-xs font-medium transition-colors', !included ? 'text-white' : 'text-white/30')}>{extraLabel}</span>
      </button>
    </div>
    {showFee && (
      <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between bg-black/20 rounded-lg p-3">
          <span className="text-xs text-white/60 font-medium">Additional fee</span>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-sm">€</span>
            <input type="number" min="0" value={fee || ''} onChange={(e) => onFeeChange(parseInt(e.target.value) || 0)} className="w-24 bg-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white text-right focus:outline-none focus:ring-2 focus:ring-white/20" placeholder="0" />
          </div>
        </div>
      </div>
    )}
  </div>
);
