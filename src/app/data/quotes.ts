// Quote Status enum matching backend
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'NEGOTIATING' | 'ARCHIVED';

// Event types
export type QuoteEventType = 'wedding' | 'corporate' | 'private' | 'festival' | 'club' | 'other';

// Performance types
export type PerformanceType = 'full_band' | 'duo' | 'trio' | 'solo' | 'dj_set' | 'acoustic';

// Cancellation policies
export type CancellationPolicy = 'flexible' | 'moderate' | 'strict' | 'custom';

// Payment methods
export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'paypal' | 'cash';

// VAT rates by country
export const VAT_RATES: Record<string, { rate: number; isEU: boolean; name: string }> = {
  'IT': { rate: 22, isEU: true, name: 'Italy' },
  'DE': { rate: 19, isEU: true, name: 'Germany' },
  'FR': { rate: 20, isEU: true, name: 'France' },
  'ES': { rate: 21, isEU: true, name: 'Spain' },
  'UK': { rate: 20, isEU: false, name: 'United Kingdom' },
  'AT': { rate: 20, isEU: true, name: 'Austria' },
  'NL': { rate: 21, isEU: true, name: 'Netherlands' },
  'BE': { rate: 21, isEU: true, name: 'Belgium' },
  'PT': { rate: 23, isEU: true, name: 'Portugal' },
  'GR': { rate: 24, isEU: true, name: 'Greece' },
  'CH': { rate: 0, isEU: false, name: 'Switzerland' },
  'US': { rate: 0, isEU: false, name: 'United States' },
  'PL': { rate: 23, isEU: true, name: 'Poland' },
  'SE': { rate: 25, isEU: true, name: 'Sweden' },
  'DK': { rate: 25, isEU: true, name: 'Denmark' },
  'FI': { rate: 24, isEU: true, name: 'Finland' },
  'IE': { rate: 23, isEU: true, name: 'Ireland' },
  'CZ': { rate: 21, isEU: true, name: 'Czech Republic' },
  'RO': { rate: 19, isEU: true, name: 'Romania' },
  'HU': { rate: 27, isEU: true, name: 'Hungary' },
  'HR': { rate: 25, isEU: true, name: 'Croatia' },
  'SK': { rate: 20, isEU: true, name: 'Slovakia' },
  'SI': { rate: 22, isEU: true, name: 'Slovenia' },
  'BG': { rate: 20, isEU: true, name: 'Bulgaria' },
  'LT': { rate: 21, isEU: true, name: 'Lithuania' },
  'LV': { rate: 21, isEU: true, name: 'Latvia' },
  'EE': { rate: 20, isEU: true, name: 'Estonia' },
  'CY': { rate: 19, isEU: true, name: 'Cyprus' },
  'MT': { rate: 18, isEU: true, name: 'Malta' },
  'LU': { rate: 17, isEU: true, name: 'Luxembourg' },
};

// Cancellation policy details
export const CANCELLATION_POLICIES: Record<CancellationPolicy, { 
  label: string; 
  over60: string; 
  days30to60: string; 
  days15to30: string; 
  under15: string 
}> = {
  flexible: {
    label: 'Flexible',
    over60: '100% refund',
    days30to60: '100% refund',
    days15to30: '50% refund',
    under15: '25% refund',
  },
  moderate: {
    label: 'Moderate',
    over60: '100% refund',
    days30to60: '50% refund',
    days15to30: 'No refund',
    under15: 'No refund',
  },
  strict: {
    label: 'Strict',
    over60: '50% refund',
    days30to60: 'No refund',
    days15to30: 'No refund',
    under15: 'No refund',
  },
  custom: {
    label: 'Custom',
    over60: 'Custom terms',
    days30to60: 'Custom terms',
    days15to30: 'Custom terms',
    under15: 'Custom terms',
  },
};

// Musician interface
export interface QuoteMusician {
  id: string;
  userId?: string;
  name: string;
  instrument: string;
  fee?: number;
  isExternal: boolean;
  isAvailable: boolean;
}

// Custom line item
export interface QuoteCustomItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
}

// Line item interface (legacy compatibility)
export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Full Quote interface matching the new spec
export interface Quote {
  id: string;
  bandId: string;
  quoteNumber: string; // e.g., BW-2026-0042
  status: QuoteStatus;

  // Step 1: Client Info
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientCompany?: string;

  // Step 1: Event Info
  eventName: string;
  eventType: QuoteEventType;
  eventDate: string;
  eventTimeStart: string;
  eventTimeEnd?: string;
  guestCount?: number;

  // Step 1: Location
  venueName?: string;
  venueAddress?: string;
  venueCity: string;
  venueCountry: string;
  indoorOutdoor?: 'indoor' | 'outdoor';

  // Step 2: Performance
  performanceType: PerformanceType;
  setDuration: number; // minutes
  numberOfSets: number;
  breakDuration?: number; // minutes
  musicians: QuoteMusician[];
  genres: string[];
  specialRequests?: string;

  // Step 3: Billing & VAT
  billingCountry: string;
  billingAddress?: string;
  vatNumber?: string;
  fiscalCode?: string;
  vatRate: number;
  vatExempt: boolean;
  reverseCharge: boolean;

  // Step 4: Pricing
  currency: string;
  baseFee: number;
  travelIncluded: boolean;
  travelFee: number;
  travelDistanceKm?: number;
  accommodationNeeded: boolean;
  accommodationFee: number;
  mealsIncluded: boolean;
  mealsFee: number;
  soundIncluded: boolean;
  soundFee: number;
  lightsIncluded: boolean;
  lightsFee: number;
  backlineIncluded: boolean;
  backlineFee: number;
  customItems: QuoteCustomItem[];
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  discountReason?: string;

  // Calculated totals
  subtotal: number;
  discountAmount: number;
  netAmount: number;
  vatAmount: number;
  total: number;

  // Step 5: Terms
  validUntil: string;
  depositRequired: boolean;
  depositPercentage: number;
  depositDueDate?: string;
  balanceDueDate: string;
  paymentMethods: PaymentMethod[];
  cancellationPolicy: CancellationPolicy;
  cancellationTerms?: string;

  // Notes
  internalNotes?: string;
  clientNotes?: string;
  specialTerms?: string;

  // Tracking
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  responseType?: 'accepted' | 'rejected';
  rejectionReason?: string;
  convertedToEventId?: string;

  // Meta
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // Legacy fields for compatibility
  eventId?: string;
  lineItems?: QuoteLineItem[];
  discount?: number;
  tax?: number;
  notes?: string;
  eventTitle?: string;
}

// Available band members for selection
export const BAND_MEMBERS: QuoteMusician[] = [
  { id: 'm1', name: 'Gianluca Boccia', instrument: 'Guitar / Vocals', isExternal: false, isAvailable: true },
  { id: 'm2', name: 'Centerbe', instrument: 'Drums', isExternal: false, isAvailable: true },
  { id: 'm3', name: 'Marco Rossi', instrument: 'Bass', isExternal: false, isAvailable: true },
  { id: 'm4', name: 'Sara Bianchi', instrument: 'Keyboards', isExternal: false, isAvailable: false },
  { id: 'm5', name: 'Andrea Verdi', instrument: 'Saxophone', isExternal: false, isAvailable: true },
];

// Music genres available
export const MUSIC_GENRES = [
  'Pop', 'Rock', 'Jazz', 'Soul', 'Funk', 'R&B', 'Disco',
  '80s', '90s', '2000s', 'Current Hits', 'Reggae', 'Latin',
  'Swing', 'Blues', 'Country', 'Classical', 'Acoustic'
];

// Helper: Generate quote number
export const generateQuoteNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `BW-${year}-${random}`;
};

// Helper: Calculate VAT based on billing country and conditions
export const calculateVAT = (
  billingCountry: string,
  bandCountry: string,
  hasVATNumber: boolean,
  isB2B: boolean,
  vatExempt: boolean,
  reverseCharge: boolean
): number => {
  if (vatExempt || reverseCharge) return 0;

  const countryData = VAT_RATES[billingCountry];
  if (!countryData) return 22; // Default to Italy

  // Same country - apply standard rate
  if (billingCountry === bandCountry) {
    return countryData.rate;
  }

  // Intra-EU B2B with VAT number → Reverse Charge (0%)
  if (countryData.isEU && isB2B && hasVATNumber) {
    return 0;
  }

  // Intra-EU B2C → VAT of destination country
  if (countryData.isEU && !isB2B) {
    return countryData.rate;
  }

  // Extra-EU → No VAT (export)
  if (!countryData.isEU) {
    return 0;
  }

  return countryData.rate;
};

// Helper: Calculate quote totals
export const calculateQuoteTotals = (
  baseFee: number,
  travelFee: number,
  accommodationFee: number,
  mealsFee: number,
  soundFee: number,
  lightsFee: number,
  backlineFee: number,
  customItems: QuoteCustomItem[],
  discountType: 'none' | 'percentage' | 'fixed',
  discountValue: number,
  vatRate: number,
  vatExempt: boolean,
  reverseCharge: boolean
): { subtotal: number; discountAmount: number; netAmount: number; vatAmount: number; total: number } => {
  let subtotal = baseFee + travelFee + accommodationFee + mealsFee + soundFee + lightsFee + backlineFee;
  subtotal += customItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);

  const discountAmount = discountType === 'percentage'
    ? subtotal * (discountValue / 100)
    : discountType === 'fixed' ? discountValue : 0;

  const netAmount = subtotal - discountAmount;

  const vatAmount = vatExempt || reverseCharge
    ? 0
    : netAmount * (vatRate / 100);

  const total = netAmount + vatAmount;

  return { subtotal, discountAmount, netAmount, vatAmount, total };
};

// Helper: Create a full quote from partial data
export const createQuote = (
  bandId: string,
  eventId: string,
  lineItems: Omit<QuoteLineItem, 'id' | 'total'>[],
  options: {
    discount?: number;
    tax?: number;
    notes?: string;
    validUntil?: string;
    eventTitle?: string;
    clientName?: string;
  } = {}
): Quote => {
  const enrichedItems = lineItems.map(item => createLineItem(
    item.description,
    item.quantity,
    item.unitPrice
  ));

  const subtotal = calculateSubtotal(enrichedItems);
  const discount = options.discount || 0;
  const tax = options.tax || 0;
  const total = subtotal - discount + tax;

  const now = new Date().toISOString();
  const defaults = getDefaultQuote();

  return {
    id: `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    bandId,
    quoteNumber: generateQuoteNumber(),
    status: 'DRAFT',
    clientName: options.clientName || 'Unknown Client',
    clientEmail: '',
    eventName: options.eventTitle || 'Untitled Event',
    eventType: 'other',
    eventDate: new Date().toISOString().split('T')[0],
    eventTimeStart: '20:00',
    venueCity: '',
    venueCountry: 'IT',
    performanceType: 'full_band',
    setDuration: 120,
    numberOfSets: 2,
    musicians: [],
    genres: [],
    billingCountry: 'IT',
    vatRate: 22,
    vatExempt: false,
    reverseCharge: false,
    currency: 'EUR',
    baseFee: subtotal,
    travelIncluded: true,
    travelFee: 0,
    accommodationNeeded: false,
    accommodationFee: 0,
    mealsIncluded: true,
    mealsFee: 0,
    soundIncluded: true,
    soundFee: 0,
    lightsIncluded: true,
    lightsFee: 0,
    backlineIncluded: true,
    backlineFee: 0,
    customItems: [],
    discountType: discount > 0 ? 'fixed' : 'none',
    discountValue: discount,
    subtotal,
    discountAmount: discount,
    netAmount: subtotal - discount,
    vatAmount: tax,
    total,
    validUntil: options.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    depositRequired: true,
    depositPercentage: 30,
    balanceDueDate: '7_days_after',
    paymentMethods: ['bank_transfer'],
    cancellationPolicy: 'moderate',
    createdAt: now,
    updatedAt: now,
    createdBy: 'user-1',
    eventTitle: options.eventTitle,
    eventId,
    lineItems: enrichedItems,
    discount,
    tax,
    notes: options.notes,
  };
};

// Helper: Create line item (legacy)
export const createLineItem = (
  description: string,
  quantity: number,
  unitPrice: number
): QuoteLineItem => ({
  id: `li-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  description,
  quantity,
  unitPrice,
  total: quantity * unitPrice,
});

// Helper: Calculate subtotal (legacy)
export const calculateSubtotal = (lineItems: QuoteLineItem[]): number => {
  return lineItems.reduce((acc, item) => acc + item.total, 0);
};

// Helper: Calculate total (legacy)
export const calculateTotal = (subtotal: number, discount: number, tax: number): number => {
  return subtotal - discount + tax;
};

// Status display helpers
export const getStatusColor = (status: QuoteStatus): string => {
  switch (status) {
    case 'DRAFT': return 'bg-gray-200 text-gray-700';
    case 'SENT': return 'bg-blue-100 text-blue-700';
    case 'ACCEPTED': return 'bg-green-100 text-green-700';
    case 'DECLINED': return 'bg-red-100 text-red-700';
    case 'EXPIRED': return 'bg-orange-100 text-orange-700';
    case 'NEGOTIATING': return 'bg-yellow-100 text-yellow-700';
    case 'ARCHIVED': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-200 text-gray-700';
  }
};

export const getStatusLabel = (status: QuoteStatus): string => {
  switch (status) {
    case 'DRAFT': return 'Draft';
    case 'SENT': return 'Sent';
    case 'ACCEPTED': return 'Accepted';
    case 'DECLINED': return 'Declined';
    case 'EXPIRED': return 'Expired';
    case 'NEGOTIATING': return 'Negotiating';
    case 'ARCHIVED': return 'Archived';
    default: return status;
  }
};

// Default quote values
export const getDefaultQuote = (): Partial<Quote> => ({
  status: 'DRAFT',
  quoteNumber: generateQuoteNumber(),
  currency: 'EUR',
  vatRate: 22,
  vatExempt: false,
  reverseCharge: false,
  travelIncluded: true,
  travelFee: 0,
  accommodationNeeded: false,
  accommodationFee: 0,
  mealsIncluded: true,
  mealsFee: 0,
  soundIncluded: true,
  soundFee: 0,
  lightsIncluded: true,
  lightsFee: 0,
  backlineIncluded: true,
  backlineFee: 0,
  customItems: [],
  discountType: 'none',
  discountValue: 0,
  depositRequired: true,
  depositPercentage: 30,
  depositDueDate: 'on_acceptance',
  balanceDueDate: '7_days_after',
  paymentMethods: ['bank_transfer'],
  cancellationPolicy: 'moderate',
  billingCountry: 'IT',
  baseFee: 0,
  numberOfSets: 2,
  setDuration: 120,
  breakDuration: 20,
  musicians: [],
  genres: [],
});

// Mock data with full Quote model
export const QUOTES_DATA: Quote[] = [
  {
    id: 'quote-001',
    bandId: 'band-1',
    quoteNumber: 'BW-2026-0042',
    status: 'SENT',
    clientName: 'Mario Rossi',
    clientEmail: 'mario.rossi@email.com',
    clientPhone: '+39 333 1234567',
    eventName: 'Wedding Reception',
    eventType: 'wedding',
    eventDate: '2026-03-15',
    eventTimeStart: '20:00',
    eventTimeEnd: '02:00',
    guestCount: 150,
    venueName: 'Villa Rosa',
    venueCity: 'Rome',
    venueCountry: 'IT',
    indoorOutdoor: 'indoor',
    performanceType: 'full_band',
    setDuration: 120,
    numberOfSets: 2,
    breakDuration: 20,
    musicians: BAND_MEMBERS.slice(0, 4),
    genres: ['Pop', 'Rock', 'Soul', 'Disco'],
    billingCountry: 'IT',
    vatRate: 22,
    vatExempt: false,
    reverseCharge: false,
    currency: 'EUR',
    baseFee: 2500,
    travelIncluded: true,
    travelFee: 0,
    accommodationNeeded: true,
    accommodationFee: 150,
    mealsIncluded: true,
    mealsFee: 0,
    soundIncluded: false,
    soundFee: 400,
    lightsIncluded: true,
    lightsFee: 0,
    backlineIncluded: true,
    backlineFee: 0,
    customItems: [
      { id: 'ci-1', description: 'DJ Set after party', amount: 300, quantity: 1 },
      { id: 'ci-2', description: 'Acoustic ceremony', amount: 200, quantity: 1 },
    ],
    discountType: 'percentage',
    discountValue: 10,
    discountReason: 'Returning client',
    subtotal: 3550,
    discountAmount: 355,
    netAmount: 3195,
    vatAmount: 702.90,
    total: 3897.90,
    validUntil: '2026-02-24',
    depositRequired: true,
    depositPercentage: 30,
    depositDueDate: 'on_acceptance',
    balanceDueDate: '7_days_after',
    paymentMethods: ['bank_transfer', 'credit_card'],
    cancellationPolicy: 'moderate',
    createdAt: '2026-01-21T10:00:00Z',
    updatedAt: '2026-01-21T14:30:00Z',
    viewedAt: '2026-01-22T09:15:00Z',
    createdBy: 'user-1',
    eventTitle: 'Wedding Reception',
  },
  {
    id: 'quote-002',
    bandId: 'band-1',
    quoteNumber: 'BW-2026-0038',
    status: 'DRAFT',
    clientName: 'RedBull Events',
    clientEmail: 'events@redbull.com',
    eventName: 'Summer Festival',
    eventType: 'festival',
    eventDate: '2026-07-20',
    eventTimeStart: '21:00',
    guestCount: 5000,
    venueName: 'Arena Centrale',
    venueCity: 'Milan',
    venueCountry: 'IT',
    indoorOutdoor: 'outdoor',
    performanceType: 'full_band',
    setDuration: 180,
    numberOfSets: 1,
    musicians: BAND_MEMBERS.filter(m => m.isAvailable),
    genres: ['Rock', 'Pop', 'Current Hits'],
    billingCountry: 'IT',
    vatRate: 22,
    vatExempt: false,
    reverseCharge: false,
    currency: 'EUR',
    baseFee: 8000,
    travelIncluded: true,
    travelFee: 0,
    accommodationNeeded: true,
    accommodationFee: 500,
    mealsIncluded: true,
    mealsFee: 0,
    soundIncluded: true,
    soundFee: 0,
    lightsIncluded: true,
    lightsFee: 0,
    backlineIncluded: true,
    backlineFee: 0,
    customItems: [],
    discountType: 'none',
    discountValue: 0,
    subtotal: 8500,
    discountAmount: 0,
    netAmount: 8500,
    vatAmount: 1870,
    total: 10370,
    validUntil: '2026-02-28',
    depositRequired: true,
    depositPercentage: 50,
    balanceDueDate: 'before_event',
    paymentMethods: ['bank_transfer'],
    cancellationPolicy: 'strict',
    createdAt: '2026-01-23T09:30:00Z',
    updatedAt: '2026-01-23T09:30:00Z',
    createdBy: 'user-1',
    eventTitle: 'Summer Festival',
  },
  {
    id: 'quote-003',
    bandId: 'band-1',
    quoteNumber: 'BW-2026-0035',
    status: 'ACCEPTED',
    clientName: 'Generali Insurance',
    clientEmail: 'events@generali.it',
    clientCompany: 'Generali SpA',
    eventName: 'Corporate Dinner Gala',
    eventType: 'corporate',
    eventDate: '2026-02-28',
    eventTimeStart: '20:30',
    eventTimeEnd: '23:30',
    guestCount: 200,
    venueName: 'Grand Hotel',
    venueCity: 'Venice',
    venueCountry: 'IT',
    indoorOutdoor: 'indoor',
    performanceType: 'trio',
    setDuration: 90,
    numberOfSets: 2,
    breakDuration: 30,
    musicians: BAND_MEMBERS.slice(0, 3),
    genres: ['Jazz', 'Swing', 'Soul'],
    billingCountry: 'IT',
    vatNumber: 'IT12345678901',
    vatRate: 22,
    vatExempt: false,
    reverseCharge: false,
    currency: 'EUR',
    baseFee: 1500,
    travelIncluded: false,
    travelFee: 200,
    travelDistanceKm: 280,
    accommodationNeeded: false,
    accommodationFee: 0,
    mealsIncluded: true,
    mealsFee: 0,
    soundIncluded: true,
    soundFee: 0,
    lightsIncluded: true,
    lightsFee: 0,
    backlineIncluded: true,
    backlineFee: 0,
    customItems: [],
    discountType: 'none',
    discountValue: 0,
    subtotal: 1700,
    discountAmount: 0,
    netAmount: 1700,
    vatAmount: 374,
    total: 2074,
    validUntil: '2026-02-10',
    depositRequired: true,
    depositPercentage: 30,
    depositDueDate: 'on_acceptance',
    balanceDueDate: '7_days_after',
    paymentMethods: ['bank_transfer'],
    cancellationPolicy: 'moderate',
    createdAt: '2026-01-15T11:00:00Z',
    updatedAt: '2026-01-18T09:30:00Z',
    viewedAt: '2026-01-16T10:00:00Z',
    respondedAt: '2026-01-18T09:30:00Z',
    responseType: 'accepted',
    createdBy: 'user-1',
    eventTitle: 'Corporate Dinner',
  },
];

// Legacy format for backwards compatibility with QuotesExpanded pipeline chart
export interface LegacyQuote {
  id: number;
  title: string;
  client: string;
  amount: number;
  probability: number;
  status: 'Negotiating' | 'Sent' | 'Finalizing' | 'Draft';
  date: string;
}

// Convert Quote to legacy format for pipeline chart
export const toLegacyQuote = (quote: Quote): LegacyQuote => {
  const statusMap: Record<QuoteStatus, 'Negotiating' | 'Sent' | 'Finalizing' | 'Draft'> = {
    'DRAFT': 'Draft',
    'SENT': 'Sent',
    'ACCEPTED': 'Finalizing',
    'DECLINED': 'Sent',
    'EXPIRED': 'Sent',
    'NEGOTIATING': 'Negotiating',
    'ARCHIVED': 'Draft',
  };

  const probabilityMap: Record<QuoteStatus, number> = {
    'DRAFT': 20,
    'SENT': 50,
    'ACCEPTED': 100,
    'DECLINED': 0,
    'EXPIRED': 0,
    'NEGOTIATING': 70,
    'ARCHIVED': 0,
  };

  return {
    id: parseInt(quote.id.replace(/\D/g, '')) || Date.now(),
    title: quote.eventTitle || quote.eventName || 'Untitled',
    client: quote.clientName || 'Unknown Client',
    amount: quote.total,
    probability: probabilityMap[quote.status],
    status: statusMap[quote.status],
    date: new Date(quote.createdAt).toLocaleDateString(),
  };
};

// Get legacy quotes for pipeline chart
export const getLegacyQuotes = (): LegacyQuote[] => {
  return QUOTES_DATA.map(toLegacyQuote);
};

// Helper: Duplicate a quote
export const duplicateQuote = (quote: Quote): Quote => {
  const now = new Date().toISOString();
  return {
    ...quote,
    id: `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    quoteNumber: generateQuoteNumber(),
    status: 'DRAFT',
    viewedAt: undefined,
    respondedAt: undefined,
    sentAt: undefined,
    responseType: undefined,
    createdAt: now,
    updatedAt: now,
  };
};
