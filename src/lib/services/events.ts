import { supabase } from '../supabase';

// Types
export type EventType = 'gig' | 'rehearsal' | 'wedding' | 'corporate' | 'private' | 'festival' | 'other';
export type EventStatus = 'draft' | 'tentative' | 'confirmed' | 'cancelled' | 'completed';

export interface Event {
  id: string;
  band_id: string;
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
  
  // Display aliases (from joined/transformed data)
  date?: string;
  time?: string;
  venue?: string;
  address?: string;
  
  // Meta
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EventMember {
  id: string;
  event_id: string;
  user_id: string;
  status: 'confirmed' | 'declined' | 'maybe' | 'pending';
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
  } | null;
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
  bandIds: string | string[],
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
      .order('event_date', { ascending: true });
    
    // Filter by band(s) - single band or multiple
    const bIds = Array.isArray(bandIds) ? bandIds : [bandIds];
    if (bIds.length > 0) {
      query = query.in('band_id', bIds);
    }

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
        members: (members || []).map((m: any) => ({
          ...m,
          profile: m.profile || null,
        })),
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

/**
 * Create an event and its members atomically.
 * Uses a single function to ensure both operations succeed or fail together.
 * This prevents "Ghost Events" (events in the DB with zero members).
 */
export const createEvent = async (
  eventData: Partial<Event>,
  memberIds?: { user_id: string; role?: string; fee?: number; status?: string }[]
): Promise<{ data: Event | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    if (!eventData.band_id) throw new Error('band_id is required');

    // Sanitize and prepare the event payload to match DB schema
    const sanitizedPayload = {
      band_id: eventData.band_id,
      title: eventData.title || 'Untitled Event',
      event_type: eventData.event_type || 'gig',
      status: eventData.status || 'confirmed',
      event_date: eventData.event_date || new Date().toISOString().split('T')[0],
      start_time: eventData.start_time || null,
      end_time: eventData.end_time || null,
      load_in_time: eventData.load_in_time || null,
      soundcheck_time: eventData.soundcheck_time || null,
      venue: eventData.venue_name || (eventData as any).venue || null,
      venue_name: eventData.venue_name || null,
      venue_address: eventData.venue_address || null,
      venue_city: eventData.venue_city || null,
      client_name: eventData.client_name || null,
      fee: eventData.fee != null ? eventData.fee : 0,
      price: (eventData as any).price != null ? (eventData as any).price : 0,
      description: eventData.description || null,
      notes: eventData.notes || null,
      indoor_outdoor: eventData.indoor_outdoor || null,
      is_recurring: eventData.is_recurring || false,
      recurrence_rule: eventData.recurrence_rule || null,
      setlist_id: eventData.setlist_id || null,
      capacity: (eventData as any).capacity || null,
      created_by: user.id,
    };

    // Insert the event
    const { data: newEvent, error: eventError } = await supabase
      .from('events')
      .insert(sanitizedPayload)
      .select()
      .single();

    if (eventError) throw eventError;

    // If memberIds are provided, insert them into event_members
    if (memberIds && memberIds.length > 0) {
      const eventMemberPayloads = memberIds.map(m => ({
        event_id: newEvent.id,
        user_id: m.user_id,
        role: m.role || null,
        fee: m.fee != null ? m.fee : 0,
        status: m.status || 'confirmed',
      }));

      const { error: membersError } = await supabase
        .from('event_members')
        .insert(eventMemberPayloads);

      if (membersError) {
        // Rollback: delete the event if member insertion fails
        console.error('Event member insertion failed, rolling back event creation:', membersError);
        await supabase.from('events').delete().eq('id', newEvent.id);
        throw new Error(`Failed to add event members: ${membersError.message}`);
      }
    }

    // Return the event with member count
    return {
      data: {
        ...newEvent,
        member_count: memberIds?.length || 0,
      } as any,
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateEvent = async (
  eventId: string,
  updates: Partial<Event>
): Promise<{ data: Event | null; error: Error | null }> => {
  try {
    // Ensure fee/price are numbers
    const sanitizedUpdates = {
      ...updates,
      fee: updates.fee != null ? updates.fee : undefined,
      price: (updates as any).price != null ? (updates as any).price : undefined,
    };

    const { data, error } = await supabase
      .from('events')
      .update(sanitizedUpdates)
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

    const safeData = (data || []).map((m: any) => ({
      ...m,
      profile: m.profile || null,
    })) as EventMember[];

    return { data: safeData, error: null };
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
        role: role || null,
        fee: fee != null ? fee : 0,
        status: 'pending',
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
      .maybeSingle();

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
      .maybeSingle();

    if (error) throw error;

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
    revenueChange: number;
  } | null;
  error: Error | null;
}> => {
  try {
    const currentYear = year || new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const endOfYear = `${currentYear}-12-31`;
    const today = new Date().toISOString().split('T')[0];
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentMonthStart = new Date(now.getFullYear(), currentMonth, 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(now.getFullYear(), currentMonth + 1, 0).toISOString().split('T')[0];
    
    const prevMonthStart = new Date(now.getFullYear(), currentMonth - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), currentMonth, 0).toISOString().split('T')[0];

    const { data: events, error } = await supabase
      .from('events')
      .select('status, fee, event_date')
      .eq('band_id', bandId)
      .gte('event_date', startOfYear)
      .lte('event_date', endOfYear);

    if (error) throw error;

    const currentMonthRevenue = events
      ?.filter(e => 
        e.event_date >= currentMonthStart && 
        e.event_date <= currentMonthEnd &&
        (e.status === 'confirmed' || e.status === 'completed')
      )
      .reduce((sum, e) => sum + (e.fee || 0), 0) || 0;
    
    const prevMonthRevenue = events
      ?.filter(e => 
        e.event_date >= prevMonthStart && 
        e.event_date <= prevMonthEnd &&
        (e.status === 'confirmed' || e.status === 'completed')
      )
      .reduce((sum, e) => sum + (e.fee || 0), 0) || 0;
    
    let revenueChange = 0;
    if (prevMonthRevenue > 0) {
      revenueChange = Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
    } else if (currentMonthRevenue > 0) {
      revenueChange = 100;
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

export const getMemberPersonalStats = async (
  bandId: string,
  userId: string,
  year?: number
): Promise<{
  data: { totalEarned: number; confirmedFee: number; pendingFee: number; revenueChange: number } | null;
  error: Error | null;
}> => {
  try {
    const currentYear = year || new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const endOfYear = `${currentYear}-12-31`;
    const now = new Date();
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const { data: memberships, error } = await supabase
      .from('event_members')
      .select('fee, status, events!inner(band_id, event_date, status)')
      .eq('user_id', userId)
      .eq('events.band_id', bandId)
      .gte('events.event_date', startOfYear)
      .lte('events.event_date', endOfYear);

    if (error) throw error;

    const rows = (memberships || []) as any[];
    const confirmed = rows.filter(r => r.status === 'confirmed' && (r.events?.status === 'confirmed' || r.events?.status === 'completed'));
    const totalEarned = confirmed.reduce((s: number, r: any) => s + (r.fee || 0), 0);
    const pending = rows.filter(r => r.status === 'pending');
    const pendingFee = pending.reduce((s: number, r: any) => s + (r.fee || 0), 0);
    const curMonth = confirmed.filter((r: any) => r.events?.event_date >= curStart && r.events?.event_date <= curEnd).reduce((s: number, r: any) => s + (r.fee || 0), 0);
    const prevMonth = confirmed.filter((r: any) => r.events?.event_date >= prevStart && r.events?.event_date <= prevEnd).reduce((s: number, r: any) => s + (r.fee || 0), 0);
    let revenueChange = 0;
    if (prevMonth > 0) revenueChange = Math.round(((curMonth - prevMonth) / prevMonth) * 100);
    else if (curMonth > 0) revenueChange = 100;

    return { data: { totalEarned, confirmedFee: totalEarned, pendingFee, revenueChange }, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};
