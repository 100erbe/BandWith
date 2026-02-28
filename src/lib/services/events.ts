import { supabase } from '../supabase';

// Types
export type EventType = 'gig' | 'rehearsal' | 'wedding' | 'corporate' | 'private' | 'festival' | 'other';
export type EventStatus = 'draft' | 'tentative' | 'confirmed' | 'cancelled' | 'completed';

export interface Event {
  id: string;
  band_id: string;
  
  // Basic Info
  title: string;
  event_type: EventType;
  status: EventStatus;
  description?: string;
  
  // Date & Time
  event_date: string;
  start_time?: string;
  end_time?: string;
  load_in_time?: string;
  soundcheck_time?: string;
  
  // Location
  venue_name?: string;
  venue_address?: string;
  venue_city?: string;
  venue_country?: string;
  venue_coordinates?: { lat: number; lng: number };
  indoor_outdoor?: 'indoor' | 'outdoor' | 'hybrid';
  
  // Financials
  fee?: number;
  currency?: string;
  deposit_amount?: number;
  deposit_paid?: boolean;
  payment_status?: 'pending' | 'partial' | 'paid';
  
  // Details
  dress_code?: string;
  setlist_id?: string;
  notes?: string;
  internal_notes?: string;
  
  // Contact
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_company?: string;
  
  // Contract
  contract_url?: string;
  contract_signed?: boolean;
  attachments?: any[];
  
  // Recurrence
  is_recurring?: boolean;
  recurrence_rule?: any;
  parent_event_id?: string;
  
  // Quote
  quote_id?: string;
  
  // Meta
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EventMember {
  id: string;
  event_id: string;
  user_id: string;
  status: 'invited' | 'confirmed' | 'declined' | 'maybe';
  fee?: number;
  role?: string;
  notes?: string;
  responded_at?: string;
  created_at: string;
  // Joined data
  profile?: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface EventWithMembers extends Event {
  members: EventMember[];
  band?: {
    id: string;
    name: string;
    logo_url?: string;
  };
}

// ============================================
// EVENTS CRUD
// ============================================

export const getEvents = async (
  bandId: string,
  options?: {
    status?: EventStatus | EventStatus[];
    eventType?: EventType | EventType[];
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<{ data: Event[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('events')
      .select('*')
      .eq('band_id', bandId)
      .order('event_date', { ascending: true });

    if (options?.status) {
      if (Array.isArray(options.status)) {
        query = query.in('status', options.status);
      } else {
        query = query.eq('status', options.status);
      }
    }

    if (options?.eventType) {
      if (Array.isArray(options.eventType)) {
        query = query.in('event_type', options.eventType);
      } else {
        query = query.eq('event_type', options.eventType);
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

export const getEvent = async (eventId: string): Promise<{ data: EventWithMembers | null; error: Error | null }> => {
  try {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        *,
        band:bands (
          id,
          name,
          logo_url
        )
      `)
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    // Get event members
    const { data: members, error: membersError } = await supabase
      .from('event_members')
      .select(`
        *,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('event_id', eventId);

    if (membersError) throw membersError;

    return {
      data: {
        ...event,
        members: members || [],
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getUpcomingEvents = async (
  bandId?: string,
  limit: number = 10
): Promise<{ data: Event[] | null; error: Error | null }> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    let query = supabase
      .from('events')
      .select(`
        *,
        band:bands (
          id,
          name,
          logo_url
        )
      `)
      .gte('event_date', today)
      .neq('status', 'cancelled')
      .order('event_date', { ascending: true })
      .limit(limit);

    if (bandId) {
      query = query.eq('band_id', bandId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const createEvent = async (eventData: Partial<Event>): Promise<{ data: Event | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('events')
      .insert({
        ...eventData,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateEvent = async (
  eventId: string,
  updates: Partial<Event>
): Promise<{ data: Event | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteEvent = async (eventId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// EVENT MEMBERS
// ============================================

export const getEventMembers = async (eventId: string): Promise<{ data: EventMember[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('event_members')
      .select(`
        *,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url,
          phone,
          instrument
        )
      `)
      .eq('event_id', eventId);

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const inviteToEvent = async (
  eventId: string,
  userId: string,
  role?: string,
  fee?: number
): Promise<{ data: EventMember | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('event_members')
      .insert({
        event_id: eventId,
        user_id: userId,
        role,
        fee,
        status: 'invited',
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const respondToEventInvite = async (
  eventMemberId: string,
  status: 'confirmed' | 'declined' | 'maybe'
): Promise<{ data: EventMember | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('event_members')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', eventMemberId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const removeFromEvent = async (eventMemberId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('event_members')
      .delete()
      .eq('id', eventMemberId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// Get current user's membership status for an event
export const getUserEventMembership = async (
  eventId: string,
  userId: string
): Promise<{ data: EventMember | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('event_members')
      .select(`
        *,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"

    return { data: data || null, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// ============================================
// STATISTICS
// ============================================

export const getEventStats = async (
  bandId: string,
  year?: number
): Promise<{
  data: {
    totalEvents: number;
    confirmedEvents: number;
    totalRevenue: number;
    upcomingEvents: number;
    revenueChange: number; // Percentage change vs previous period
  } | null;
  error: Error | null;
}> => {
  try {
    const currentYear = year || new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const endOfYear = `${currentYear}-12-31`;
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate current month and previous month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentMonthStart = new Date(now.getFullYear(), currentMonth, 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), currentMonth + 1, 0).toISOString().split('T')[0];
    
    const prevMonthStart = new Date(now.getFullYear(), currentMonth - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), currentMonth, 0).toISOString().split('T')[0];

    // Get all events for the year
    const { data: events, error } = await supabase
      .from('events')
      .select('status, fee, event_date')
      .eq('band_id', bandId)
      .gte('event_date', startOfYear)
      .lte('event_date', endOfYear);

    if (error) throw error;

    // Calculate current month revenue
    const currentMonthRevenue = events
      ?.filter(e => 
        e.event_date >= currentMonthStart && 
        e.event_date <= currentMonthEnd &&
        (e.status === 'confirmed' || e.status === 'completed')
      )
      .reduce((sum, e) => sum + (e.fee || 0), 0) || 0;
    
    // Calculate previous month revenue
    const prevMonthRevenue = events
      ?.filter(e => 
        e.event_date >= prevMonthStart && 
        e.event_date <= prevMonthEnd &&
        (e.status === 'confirmed' || e.status === 'completed')
      )
      .reduce((sum, e) => sum + (e.fee || 0), 0) || 0;
    
    // Calculate percentage change
    let revenueChange = 0;
    if (prevMonthRevenue > 0) {
      revenueChange = Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
    } else if (currentMonthRevenue > 0) {
      revenueChange = 100; // If previous was 0 but current has revenue, show 100%
    }

    const stats = {
      totalEvents: events?.length || 0,
      confirmedEvents: events?.filter(e => e.status === 'confirmed' || e.status === 'completed').length || 0,
      totalRevenue: events
        ?.filter(e => e.status === 'confirmed' || e.status === 'completed')
        .reduce((sum, e) => sum + (e.fee || 0), 0) || 0,
      upcomingEvents: events?.filter(e => e.event_date >= today && e.status !== 'cancelled').length || 0,
      revenueChange,
    };

    return { data: stats, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};
