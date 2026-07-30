import { supabase } from '../supabase';

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
  viewed_at?: string;
  responded_at?: string;
  response_type?: 'accepted' | 'declined';
  rejection_reason?: string;
  converted_to_event_id?: string;
  
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
      .select('*')
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

export const createQuote = async (
  quoteData: Partial<Quote>,
  musicians?: Omit<QuoteMusician, 'id' | 'quote_id' | 'created_at'>[]
): Promise<{ data: Quote | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate quote number using RPC
    const { data: quoteNumber, error: rpcError } = await supabase
      .rpc('generate_quote_number', { band_prefix: 'BW' });

    if (rpcError) {
      // Fallback to simple generation
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      quoteData.quote_number = `BW-${year}-${random}`;
    } else {
      quoteData.quote_number = quoteNumber;
    }

    const { data: quote, error: insertError } = await supabase
      .from('quotes')
      .insert({
        ...quoteData,
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
        console.error('Error adding musicians:', musiciansError);
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
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId);

    if (error) throw error;

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
        responded_at: new Date().toISOString(),
        response_type: 'accepted',
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
    const { id, quote_number, status, sent_at, viewed_at, responded_at, response_type, rejection_reason, created_at, updated_at, musicians, band, ...quoteData } = original;

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
