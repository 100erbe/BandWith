import { supabase, getSafeUser } from '../supabase';
import type {
  Quote as AppQuote,
  QuoteMusician as AppQuoteMusician,
  QuoteStatus as AppQuoteStatus,
} from '@/app/data/quotes';
import { roundCents, totalsForQuote } from './quoteMath';

// Types
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'negotiating' | 'archived';

export interface Quote {
  id: string;
  band_id: string;
  quote_number: string;
  status: QuoteStatus;
  
  // Client Info
  client_name: string;
  client_email?: string;
  client_phone?: string;
  client_company?: string;
  
  // Event Info
  event_name?: string;
  event_type?: string;
  event_date?: string;
  event_time_start?: string;
  event_time_end?: string;
  guest_count?: number;
  
  // Location
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_country?: string;
  indoor_outdoor?: 'indoor' | 'outdoor';
  
  // Performance
  performance_type?: string;
  set_duration_minutes?: number;
  number_of_sets?: number;
  break_duration_minutes?: number;
  genres?: string[];
  special_requests?: string;
  
  // Billing & VAT
  billing_country?: string;
  billing_address?: string;
  vat_number?: string;
  fiscal_code?: string;
  vat_rate?: number;
  vat_exempt?: boolean;
  reverse_charge?: boolean;
  
  // Pricing
  currency?: string;
  base_fee?: number;
  travel_included?: boolean;
  travel_fee?: number;
  travel_distance_km?: number;
  accommodation_needed?: boolean;
  accommodation_fee?: number;
  meals_included?: boolean;
  meals_fee?: number;
  sound_included?: boolean;
  sound_fee?: number;
  lights_included?: boolean;
  lights_fee?: number;
  backline_included?: boolean;
  backline_fee?: number;
  custom_items?: Array<{ id: string; description: string; amount: number; quantity: number }>;
  
  // Discounts
  discount_type?: 'none' | 'percentage' | 'fixed';
  discount_value?: number;
  discount_reason?: string;
  
  // Calculated Totals
  subtotal?: number;
  discount_amount?: number;
  net_amount?: number;
  vat_amount?: number;
  total?: number;
  
  // Terms
  valid_until?: string;
  deposit_required?: boolean;
  deposit_percentage?: number;
  deposit_due_date?: string;
  balance_due_date?: string;
  payment_methods?: string[];
  cancellation_policy?: string;
  cancellation_terms?: string;
  
  // Notes
  internal_notes?: string;
  client_notes?: string;
  special_terms?: string;
  
  // Tracking
  sent_at?: string;
  accepted_at?: string;
  viewed_at?: string;
  responded_at?: string;
  response_type?: 'accepted' | 'declined';
  rejection_reason?: string;
  converted_to_event_id?: string;

  // Wizard extras (migration 051): package options and PDF presentation
  options?: unknown[] | null;
  presentation?: Record<string, unknown> | null;
  deposit_amount?: number;

  // Meta
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteMusician {
  id: string;
  quote_id: string;
  user_id?: string;
  name: string;
  instrument?: string;
  fee?: number;
  is_external?: boolean;
  is_available?: boolean;
  created_at: string;
}

export interface QuoteWithMusicians extends Quote {
  musicians: QuoteMusician[];
  band?: {
    id: string;
    name: string;
    logo_url?: string;
  };
}

// ============================================
// QUOTES CRUD
// ============================================

export const getQuotes = async (
  bandId: string,
  options?: {
    status?: QuoteStatus | QuoteStatus[];
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<{ data: Quote[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('quotes')
      .select('*, musicians:quote_musicians(*)')
      .eq('band_id', bandId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      if (Array.isArray(options.status)) {
        query = query.in('status', options.status);
      } else {
        query = query.eq('status', options.status);
      }
    }

    if (options?.fromDate) {
      query = query.gte('event_date', options.fromDate);
    }

    if (options?.toDate) {
      query = query.lte('event_date', options.toDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getQuote = async (quoteId: string): Promise<{ data: QuoteWithMusicians | null; error: Error | null }> => {
  try {
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        band:bands (
          id,
          name,
          logo_url
        )
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError) throw quoteError;

    // Get quote musicians
    const { data: musicians, error: musiciansError } = await supabase
      .from('quote_musicians')
      .select('*')
      .eq('quote_id', quoteId);

    if (musiciansError) throw musiciansError;

    return {
      data: {
        ...quote,
        musicians: musicians || [],
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};

/**
 * Asks the database for the next per-band quote number (migration 043:
 * `generate_quote_number(p_band_id uuid)`, SECURITY DEFINER, admin-only, atomic counter).
 * If the database has not been migrated yet (function signature not found, PostgREST
 * PGRST202) it falls back to the legacy `generate_quote_number(band_prefix)`.
 * Never invents a number on the client: the DB number is the single source of truth.
 */
export const generateQuoteNumberForBand = async (
  bandId: string
): Promise<{ data: string | null; error: Error | null }> => {
  const { data, error } = await supabase.rpc('generate_quote_number', { p_band_id: bandId });
  if (!error && typeof data === 'string' && data) return { data, error: null };

  if (error && (error as any).code === 'PGRST202') {
    const legacy = await supabase.rpc('generate_quote_number', { band_prefix: 'BW' });
    if (!legacy.error && typeof legacy.data === 'string' && legacy.data) {
      return { data: legacy.data, error: null };
    }
    return { data: null, error: (legacy.error as any) || new Error('Could not generate a quote number') };
  }

  return { data: null, error: (error as any) || new Error('Could not generate a quote number') };
};

export const createQuote = async (
  quoteData: Partial<Quote>,
  musicians?: Omit<QuoteMusician, 'id' | 'quote_id' | 'created_at'>[]
): Promise<{ data: Quote | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');
    if (!quoteData.band_id) throw new Error('A band is required to create a quote');

    // The quote number always comes from the database (any client-side number is replaced)
    const { data: quoteNumber, error: numberError } = await generateQuoteNumberForBand(quoteData.band_id);
    if (numberError || !quoteNumber) throw numberError || new Error('Could not generate a quote number');

    const { data: quote, error: insertError } = await supabase
      .from('quotes')
      .insert({
        ...quoteData,
        quote_number: quoteNumber,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Add musicians if provided
    if (musicians && musicians.length > 0) {
      const { error: musiciansError } = await supabase
        .from('quote_musicians')
        .insert(
          musicians.map(m => ({
            ...m,
            quote_id: quote.id,
          }))
        );

      if (musiciansError) {
        // Do not leave a half-written quote behind: remove it and report the failure
        const { error: cleanupError } = await supabase.from('quotes').delete().eq('id', quote.id);
        if (cleanupError) {
          console.error('Error removing quote after musicians insert failed:', cleanupError);
        }
        throw new Error(`Could not save the quote musicians: ${musiciansError.message || 'unknown error'}`);
      }
    }

    return { data: quote, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateQuote = async (
  quoteId: string,
  updates: Partial<Quote>
): Promise<{ data: Quote | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteQuote = async (quoteId: string): Promise<{ error: Error | null }> => {
  try {
    // Return the deleted id: RLS silently filters rows, so 0 rows means "not allowed / not found"
    const { data, error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Quote not found or you do not have permission to delete it');
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// QUOTE ACTIONS
// ============================================

export const sendQuote = async (quoteId: string): Promise<{ data: Quote | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;

    // TODO: Send email to client

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const markQuoteViewed = async (quoteId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .eq('status', 'sent'); // Only update if currently 'sent'

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const acceptQuote = async (quoteId: string): Promise<{ data: Quote | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
        response_type: 'accepted',
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;

    // The tentative event created with the quote becomes a confirmed gig
    // (the database trigger notifies the lineup).
    if (data?.converted_to_event_id) {
      const { error: evErr } = await supabase
        .from('events')
        .update({ status: 'confirmed' })
        .eq('id', data.converted_to_event_id)
        .eq('status', 'tentative');
      if (evErr) console.warn('[quotes] accepted, but the event was not confirmed:', evErr);
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const declineQuote = async (
  quoteId: string,
  reason?: string
): Promise<{ data: Quote | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
        response_type: 'declined',
        rejection_reason: reason,
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const duplicateQuote = async (quoteId: string): Promise<{ data: Quote | null; error: Error | null }> => {
  try {
    // Get original quote
    const { data: original, error: fetchError } = await getQuote(quoteId);
    if (fetchError || !original) throw fetchError || new Error('Quote not found');

    // Create new quote without id and with reset status
    const { id, quote_number, status, sent_at, viewed_at, responded_at, response_type, rejection_reason, converted_to_event_id, created_by, created_at, updated_at, musicians, band, ...quoteData } = original;

    const { data, error } = await createQuote(
      {
        ...quoteData,
        status: 'draft',
      },
      musicians?.map(({ id, quote_id, created_at, ...m }) => m)
    );

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const convertQuoteToEvent = async (quoteId: string): Promise<{ data: { eventId: string } | null; error: Error | null }> => {
  try {
    const { data: quote, error: fetchError } = await getQuote(quoteId);
    if (fetchError || !quote) throw fetchError || new Error('Quote not found');

    // Create event from quote
    const { data: event, error: createError } = await supabase
      .from('events')
      .insert({
        band_id: quote.band_id,
        title: quote.event_name || `Event for ${quote.client_name}`,
        event_type: quote.event_type || 'gig',
        status: 'confirmed',
        event_date: quote.event_date,
        start_time: quote.event_time_start,
        end_time: quote.event_time_end,
        venue_name: quote.venue_name,
        venue_address: quote.venue_address,
        venue_city: quote.venue_city,
        venue_country: quote.venue_country,
        indoor_outdoor: quote.indoor_outdoor,
        fee: quote.total,
        currency: quote.currency,
        client_name: quote.client_name,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        client_company: quote.client_company,
        notes: quote.client_notes,
        internal_notes: quote.internal_notes,
        quote_id: quoteId,
        created_by: quote.created_by,
      })
      .select()
      .single();

    if (createError) throw createError;

    // Update quote with event reference
    await supabase
      .from('quotes')
      .update({ converted_to_event_id: event.id })
      .eq('id', quoteId);

    return { data: { eventId: event.id }, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// ============================================
// STATISTICS
// ============================================

export const getQuoteStats = async (
  bandId: string
): Promise<{
  data: {
    totalQuotes: number;
    pendingQuotes: number;
    acceptedQuotes: number;
    totalPipeline: number;
    acceptedRevenue: number;
  } | null;
  error: Error | null;
}> => {
  try {
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('status, total')
      .eq('band_id', bandId)
      .neq('status', 'archived');

    if (error) throw error;

    const stats = {
      totalQuotes: quotes?.length || 0,
      pendingQuotes: quotes?.filter(q => ['draft', 'sent', 'viewed', 'negotiating'].includes(q.status)).length || 0,
      acceptedQuotes: quotes?.filter(q => q.status === 'accepted').length || 0,
      totalPipeline: quotes
        ?.filter(q => ['sent', 'viewed', 'negotiating'].includes(q.status))
        .reduce((sum, q) => sum + (q.total || 0), 0) || 0,
      acceptedRevenue: quotes
        ?.filter(q => q.status === 'accepted')
        .reduce((sum, q) => sum + (q.total || 0), 0) || 0,
    };

    return { data: stats, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// ============================================
// APP <-> DB MAPPING
// ============================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

const DB_STATUSES: QuoteStatus[] = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'negotiating', 'archived'];

const textOrUndefined = (v?: string | null): string | undefined => (v && String(v).trim() ? String(v) : undefined);
const intOrUndefined = (v?: number | null): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined;
const num = (v?: number | null): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Wizard fields with no column of their own, kept in `quotes.presentation` so the PDF can be rebuilt. */
const PRESENTATION_KEYS = [
  'musicianCount', 'quoteDescription', 'validityDays', 'customDisclaimer', 'productionTier',
  'productionBullets', 'travelMode', 'accommodationMode', 'accommodationRooms', 'accommodationNights',
  'mealsMode', 'showBankDetailsOnPdf', 'paymentTermsText', 'selectedMoments', 'includeProposalSummary',
] as const;

const pickPresentation = (q: Partial<AppQuote>): Record<string, unknown> | null => {
  const out: Record<string, unknown> = {};
  for (const key of PRESENTATION_KEYS) {
    const v = (q as Record<string, unknown>)[key];
    if (v !== undefined && v !== null && v !== '') out[key] = v;
  }
  return Object.keys(out).length ? out : null;
};

/** Maps the wizard's camelCase quote to `quotes` table columns (only columns that exist). */
export const appQuoteToDbRecord = (q: Partial<AppQuote>, bandId: string): Partial<Quote> => {
  const totals = totalsForQuote(q);
  const status = String(q.status || 'draft').toLowerCase() as QuoteStatus;
  const dbStatus: QuoteStatus = DB_STATUSES.includes(status) ? status : 'draft';

  return {
    band_id: bandId,
    status: dbStatus,
    client_name: textOrUndefined(q.clientName) || 'Client',
    client_email: textOrUndefined(q.clientEmail),
    client_phone: textOrUndefined(q.clientPhone),
    client_company: textOrUndefined(q.clientCompany),
    event_name: textOrUndefined(q.eventName || q.eventTitle),
    event_type: textOrUndefined(q.eventType),
    event_date: textOrUndefined(q.eventDate),
    event_time_start: textOrUndefined(q.eventTimeStart),
    event_time_end: textOrUndefined(q.eventTimeEnd),
    guest_count: intOrUndefined(q.guestCount),
    venue_name: textOrUndefined(q.venueName),
    venue_address: textOrUndefined(q.venueAddress),
    venue_city: textOrUndefined(q.venueCity),
    venue_country: textOrUndefined(q.venueCountry),
    indoor_outdoor: textOrUndefined(q.indoorOutdoor) as Quote['indoor_outdoor'],
    performance_type: textOrUndefined(q.performanceType),
    set_duration_minutes: intOrUndefined(q.setDuration),
    number_of_sets: intOrUndefined(q.numberOfSets),
    break_duration_minutes: intOrUndefined(q.breakDuration),
    genres: q.genres && q.genres.length > 0 ? q.genres : undefined,
    special_requests: textOrUndefined(q.specialRequests),
    billing_country: textOrUndefined(q.billingCountry),
    billing_address: textOrUndefined(q.billingAddress),
    vat_number: textOrUndefined(q.vatNumber),
    fiscal_code: textOrUndefined(q.fiscalCode),
    vat_rate: Math.max(0, num(q.vatRate)),
    vat_exempt: Boolean(q.vatExempt),
    reverse_charge: Boolean(q.reverseCharge),
    currency: textOrUndefined(q.currency) || 'EUR',
    base_fee: roundCents(num(q.baseFee)),
    travel_included: q.travelIncluded,
    travel_fee: roundCents(num(q.travelFee)),
    travel_distance_km: intOrUndefined(q.travelDistanceKm),
    accommodation_needed: q.accommodationNeeded,
    accommodation_fee: roundCents(num(q.accommodationFee)),
    meals_included: q.mealsIncluded,
    meals_fee: roundCents(num(q.mealsFee)),
    sound_included: q.soundIncluded,
    sound_fee: roundCents(num(q.soundFee)),
    lights_included: q.lightsIncluded,
    lights_fee: roundCents(num(q.lightsFee)),
    backline_included: q.backlineIncluded,
    backline_fee: roundCents(num(q.backlineFee)),
    custom_items: (q.customItems || []).map(ci => ({
      id: ci.id,
      description: ci.description || ci.name || '',
      amount: roundCents(num(ci.price ?? ci.amount)),
      quantity: ci.quantity || 1,
    })),
    discount_type: q.discountType || 'none',
    discount_value: Math.max(0, num(q.discountValue)),
    discount_reason: textOrUndefined(q.discountReason),
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    net_amount: totals.net,
    vat_amount: totals.vat,
    total: totals.total,
    valid_until: textOrUndefined(q.validUntil),
    deposit_required: q.depositRequired,
    deposit_percentage: intOrUndefined(q.depositPercentage),
    deposit_due_date: textOrUndefined(q.depositDueDate),
    balance_due_date: textOrUndefined(q.balanceDueDate),
    payment_methods: q.paymentMethods && q.paymentMethods.length > 0 ? q.paymentMethods : undefined,
    cancellation_policy: textOrUndefined(q.cancellationPolicy),
    cancellation_terms: textOrUndefined(q.cancellationTerms),
    internal_notes: textOrUndefined(q.internalNotes),
    client_notes: textOrUndefined(q.clientNotes || q.notes),
    special_terms: textOrUndefined(q.specialTerms),
    deposit_amount: q.depositRequired === false
      ? 0
      : roundCents(num(q.depositAmount ?? (totals.total * num(q.depositPercentage)) / 100)),
    options: q.quoteOptions && q.quoteOptions.length > 0 ? (q.quoteOptions as unknown[]) : null,
    presentation: pickPresentation(q),
    sent_at: dbStatus === 'sent' ? q.sentAt || new Date().toISOString() : undefined,
  };
};

/** Maps the wizard's musicians to `quote_musicians` rows (user_id only when it is a real profile id). */
export const appMusiciansToDb = (
  musicians?: AppQuoteMusician[]
): Omit<QuoteMusician, 'id' | 'quote_id' | 'created_at'>[] =>
  (musicians || [])
    .filter(m => m && textOrUndefined(m.name))
    .map(m => ({
      user_id: isUuid(m.userId) ? m.userId : undefined,
      name: m.name,
      instrument: textOrUndefined(m.instrument),
      fee: roundCents(num(m.fee)),
      is_external: Boolean(m.isExternal),
      is_available: m.isAvailable !== false,
    }));

/** Maps a `quotes` row to the app's camelCase quote used by the list, detail modal and PDF. */
export const dbQuoteToAppQuote = (q: Quote & { musicians?: QuoteMusician[] }): AppQuote => ({
  ...((q.presentation as Partial<AppQuote>) || {}),
  quoteOptions: Array.isArray(q.options) && q.options.length > 0 ? (q.options as AppQuote['quoteOptions']) : undefined,
  depositAmount: q.deposit_amount != null ? Number(q.deposit_amount) : undefined,
  id: q.id,
  bandId: q.band_id,
  quoteNumber: q.quote_number || '',
  status: (q.status?.toUpperCase() || 'DRAFT') as AppQuoteStatus,
  clientName: q.client_name,
  clientEmail: q.client_email || '',
  clientPhone: q.client_phone,
  clientCompany: q.client_company,
  eventName: q.event_name || '',
  eventType: (q.event_type || 'other') as AppQuote['eventType'],
  eventDate: q.event_date || '',
  eventTimeStart: q.event_time_start ? q.event_time_start.slice(0, 5) : '',
  eventTimeEnd: q.event_time_end ? q.event_time_end.slice(0, 5) : undefined,
  guestCount: q.guest_count,
  venueName: q.venue_name,
  venueAddress: q.venue_address,
  venueCity: q.venue_city || '',
  venueCountry: q.venue_country || '',
  indoorOutdoor: q.indoor_outdoor,
  performanceType: (q.performance_type || 'full_band') as AppQuote['performanceType'],
  setDuration: q.set_duration_minutes || 0,
  numberOfSets: q.number_of_sets || 0,
  breakDuration: q.break_duration_minutes,
  musicians: (q.musicians || []).map(m => ({
    id: m.user_id || m.id,
    userId: m.user_id,
    name: m.name,
    instrument: m.instrument || '',
    fee: Number(m.fee || 0),
    isExternal: Boolean(m.is_external),
    isAvailable: m.is_available !== false,
  })) as AppQuote['musicians'],
  genres: q.genres || [],
  specialRequests: q.special_requests,
  billingCountry: q.billing_country || '',
  billingAddress: q.billing_address,
  vatNumber: q.vat_number,
  fiscalCode: q.fiscal_code,
  vatRate: Number(q.vat_rate ?? 0),
  vatExempt: Boolean(q.vat_exempt),
  reverseCharge: Boolean(q.reverse_charge),
  currency: q.currency || 'EUR',
  baseFee: Number(q.base_fee || 0),
  travelIncluded: q.travel_included ?? true,
  travelFee: Number(q.travel_fee || 0),
  travelDistanceKm: q.travel_distance_km,
  accommodationNeeded: Boolean(q.accommodation_needed),
  accommodationFee: Number(q.accommodation_fee || 0),
  mealsIncluded: q.meals_included ?? true,
  mealsFee: Number(q.meals_fee || 0),
  soundIncluded: q.sound_included ?? true,
  soundFee: Number(q.sound_fee || 0),
  lightsIncluded: q.lights_included ?? true,
  lightsFee: Number(q.lights_fee || 0),
  backlineIncluded: q.backline_included ?? true,
  backlineFee: Number(q.backline_fee || 0),
  customItems: (q.custom_items || []).map(ci => ({ ...ci, name: ci.description, price: ci.amount })),
  discountType: (q.discount_type || 'none') as AppQuote['discountType'],
  discountValue: Number(q.discount_value || 0),
  discountReason: q.discount_reason,
  subtotal: Number(q.subtotal || 0),
  discountAmount: Number(q.discount_amount || 0),
  netAmount: Number(q.net_amount || 0),
  vatAmount: Number(q.vat_amount || 0),
  total: Number(q.total || 0),
  validUntil: q.valid_until || '',
  depositRequired: q.deposit_required ?? true,
  depositPercentage: q.deposit_percentage ?? 30,
  depositDueDate: q.deposit_due_date,
  balanceDueDate: q.balance_due_date || '',
  paymentMethods: (q.payment_methods || []) as AppQuote['paymentMethods'],
  cancellationPolicy: (q.cancellation_policy || 'moderate') as AppQuote['cancellationPolicy'],
  cancellationTerms: q.cancellation_terms,
  internalNotes: q.internal_notes,
  clientNotes: q.client_notes,
  specialTerms: q.special_terms,
  sentAt: q.sent_at,
  viewedAt: q.viewed_at,
  respondedAt: q.responded_at,
  convertedToEventId: q.converted_to_event_id,
  createdAt: q.created_at,
  updatedAt: q.updated_at,
  createdBy: q.created_by || '',
  // legacy fields used by the list
  eventId: q.converted_to_event_id,
  eventTitle: q.event_name || 'Untitled Quote',
  lineItems: [],
  discount: Number(q.discount_amount || 0),
  tax: Number(q.vat_amount || 0),
  notes: q.client_notes || '',
});
