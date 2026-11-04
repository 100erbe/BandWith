import { supabase } from '../supabase';

// Types
export type EventType = 'gig' | 'rehearsal' | 'wedding' | 'corporate' | 'private' | 'festival' | 'other';
export type EventStatus = 'draft' | 'tentative' | 'confirmed' | 'cancelled' | 'completed';

export interface Event {
  id: string;
  band_id?: string | null;
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
    userId?: string;
    includePersonal?: boolean;
  }
): Promise<{ data: Event[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });
    
    // Filter by band(s) and/or personal events (band_id IS NULL AND created_by = userId)
    const rawIds = Array.isArray(bandIds) ? bandIds : (bandIds ? [bandIds] : []);
    const bIds = rawIds.filter(Boolean);
    const resolvedUserId = options?.userId || (await supabase.auth.getUser()).data?.user?.id;
    const includePersonal = options?.includePersonal !== false;

    if (bIds.length > 0 && resolvedUserId && includePersonal) {
      // Query band events alongside personal events
      query = query.or(`band_id.in.(${bIds.join(',')}),and(band_id.is.null,created_by.eq.${resolvedUserId})`);
    } else if (bIds.length > 0) {
      query = query.in('band_id', bIds);
    } else if (resolvedUserId && includePersonal) {
      // Solo / no bands: fetch personal events
      query = query.is('band_id', null).eq('created_by', resolvedUserId);
    } else {
      return { data: [], error: null };
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

    if (error) {
      // Resilient fallback in case of PostgREST nested .or syntax issues
      if (bIds.length > 0 && resolvedUserId && includePersonal) {
        let bandQuery = supabase.from('events').select('*').in('band_id', bIds);
        let personalQuery = supabase.from('events').select('*').is('band_id', null).eq('created_by', resolvedUserId);
        
        if (options?.fromDate) {
          bandQuery = bandQuery.gte('event_date', options.fromDate);
          personalQuery = personalQuery.gte('event_date', options.fromDate);
        }
        if (options?.toDate) {
          bandQuery = bandQuery.lte('event_date', options.toDate);
          personalQuery = personalQuery.lte('event_date', options.toDate);
        }
        
        const [bandRes, personalRes] = await Promise.all([bandQuery, personalQuery]);
        if (bandRes.error) throw bandRes.error;
        
        let combined = [...(bandRes.data || []), ...(personalRes.data || [])];
        combined.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
        if (options?.limit) combined = combined.slice(0, options.limit);
        return { data: combined, error: null };
      }
      throw error;
    }

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
      .select(`*`)
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
// PERSONAL GIGS (Solo / Non-Admin Members)
// ============================================

export interface CreatePersonalGigInput {
  userId: string;
  title: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  fee?: number;
  notes?: string;
}

export interface UpdatePersonalGigInput {
  eventId: string;
  userId: string;
  title?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  fee?: number;
  notes?: string;
}

export const createPersonalGig = async (
  input: CreatePersonalGigInput
): Promise<{ data: Event | null; error: Error | null }> => {
  try {
    const { userId, title, eventDate, startTime, endTime, venueName, fee, notes } = input;
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = user?.id || userId;

    if (!effectiveUserId) throw new Error('User authentication is required');
    if (!title?.trim()) throw new Error('Gig title is required');
    if (!eventDate) throw new Error('Event date is required');

    const personalFee = fee != null && !isNaN(Number(fee)) ? Number(fee) : 0;

    // 1. Insert into public.events
    const eventPayload = {
      band_id: null,
      created_by: effectiveUserId,
      event_type: 'gig' as const,
      status: 'confirmed' as const,
      title: title.trim(),
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
      venue_name: venueName?.trim() || null,
      fee: personalFee,
      notes: notes?.trim() || null,
    };

    const { data: newEvent, error: eventError } = await supabase
      .from('events')
      .insert(eventPayload)
      .select()
      .single();

    if (eventError) throw eventError;

    // 2. Insert single confirmed record into public.event_members
    const memberPayload = {
      event_id: newEvent.id,
      user_id: effectiveUserId,
      role: 'solo',
      fee: personalFee,
      status: 'confirmed',
    };

    const { error: memberError } = await supabase
      .from('event_members')
      .insert(memberPayload);

    if (memberError) {
      console.error('Failed to create personal gig event_member record, rolling back:', memberError);
      await supabase.from('events').delete().eq('id', newEvent.id);
      throw new Error(`Failed to save earnings tracker record: ${memberError.message}`);
    }

    return { data: newEvent, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updatePersonalGig = async (
  input: UpdatePersonalGigInput
): Promise<{ data: Event | null; error: Error | null }> => {
  try {
    const { eventId, userId, title, eventDate, startTime, endTime, venueName, fee, notes } = input;
    if (!eventId) throw new Error('Event ID is required');

    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUserId = user?.id || userId;

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title.trim();
    if (eventDate !== undefined) updates.event_date = eventDate;
    if (startTime !== undefined) updates.start_time = startTime || null;
    if (endTime !== undefined) updates.end_time = endTime || null;
    if (venueName !== undefined) {
      updates.venue_name = venueName?.trim() || null;
    }
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (fee !== undefined) {
      updates.fee = fee != null && !isNaN(Number(fee)) ? Number(fee) : 0;
    }

    let eventQuery = supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .is('band_id', null);

    if (effectiveUserId) {
      eventQuery = eventQuery.eq('created_by', effectiveUserId);
    }

    const { data: updatedEvent, error: eventError } = await eventQuery
      .select()
      .single();

    if (eventError) throw eventError;

    if (fee !== undefined && effectiveUserId) {
      const personalFee = fee != null && !isNaN(Number(fee)) ? Number(fee) : 0;
      await supabase
        .from('event_members')
        .update({ fee: personalFee })
        .eq('event_id', eventId)
        .eq('user_id', effectiveUserId);
    }

    return { data: updatedEvent, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deletePersonalGig = async (
  eventId: string,
  userId?: string
): Promise<{ error: Error | null }> => {
  try {
    if (!eventId) throw new Error('Event ID is required');

    // Remove matching event_members first
    let memberQuery = supabase.from('event_members').delete().eq('event_id', eventId);
    if (userId) memberQuery = memberQuery.eq('user_id', userId);
    await memberQuery;

    // Delete personal event
    let eventQuery = supabase.from('events').delete().eq('id', eventId).is('band_id', null);
    if (userId) eventQuery = eventQuery.eq('created_by', userId);
    const { error } = await eventQuery;
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
      .select(`*`)
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
      .select(`*`)
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
      .select('status, fee, event_date, event_type')
      .eq('band_id', bandId)
      .gte('event_date', startOfYear)
      .lte('event_date', endOfYear);

    if (error) throw error;

    // Confirmed gigs only (exclude rehearsals)
    const confirmedGigs = events?.filter(e => 
      (e.status === 'confirmed' || e.status === 'completed') &&
      e.event_type !== 'rehearsal'
    ) || [];

    const currentMonthRevenue = confirmedGigs
      ?.filter(e => 
        e.event_date >= currentMonthStart && 
        e.event_date <= currentMonthEnd
      )
      .reduce((sum, e) => sum + (e.fee || 0), 0) || 0;
    
    const prevMonthRevenue = confirmedGigs
      ?.filter(e => 
        e.event_date >= prevMonthStart && 
        e.event_date <= prevMonthEnd
      )
      .reduce((sum, e) => sum + (e.fee || 0), 0) || 0;
    
    let revenueChange = 0;
    if (prevMonthRevenue > 0) {
      revenueChange = Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
    } else if (currentMonthRevenue > 0) {
      revenueChange = 100;
    }

    // Upcoming confirmed gigs only (exclude past gigs & rehearsals)
    const upcomingConfirmedGigs = confirmedGigs.filter(e => e.event_date >= today);

    const stats = {
      totalEvents: events?.length || 0,
      confirmedEvents: upcomingConfirmedGigs.length,
      totalRevenue: confirmedGigs
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
  bandId: string | null | undefined,
  userId: string,
  year?: number
): Promise<{
  data: { totalEarned: number; confirmedFee: number; pendingFee: number; revenueChange: number; confirmedCount: number } | null;
  error: Error | null;
}> => {
  try {
    const currentYear = year || new Date().getFullYear();
    const startOfYear = `${currentYear}-01-01`;
    const endOfYear = `${currentYear}-12-31`;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    // Query user's event_memberships
    let query = supabase
      .from('event_members')
      .select('fee, status, events!inner(band_id, event_date, status, event_type, created_by)')
      .eq('user_id', userId);

    if (year) {
      query = query
        .gte('events.event_date', startOfYear)
        .lte('events.event_date', endOfYear);
    }

    const { data: memberships, error } = await query;

    if (error) throw error;

    const rawRows = (memberships || []) as any[];
    // Include events for the specific bandId (if given) PLUS any personal gigs (events.band_id IS NULL)
    const rows = rawRows.filter(r => {
      if (bandId && bandId !== 'all') {
        return r.events?.band_id === bandId || !r.events?.band_id;
      }
      return true;
    });

    const confirmed = rows.filter(r => 
      r.status === 'confirmed' && 
      (r.events?.status === 'confirmed' || r.events?.status === 'completed') &&
      r.events?.event_type !== 'rehearsal'
    );
    const upcomingConfirmed = confirmed.filter(r => (r.events?.event_date || '') >= today);
    const pastConfirmed = confirmed.filter(r => (r.events?.event_date || '') < today);

    const confirmedFee = upcomingConfirmed.reduce((s: number, r: any) => s + (r.fee || 0), 0);
    const totalEarned = pastConfirmed.reduce((s: number, r: any) => s + (r.fee || 0), 0);
    const pending = rows.filter(r => r.status === 'pending');
    const pendingFee = pending.reduce((s: number, r: any) => s + (r.fee || 0), 0);
    const curMonth = confirmed.filter((r: any) => r.events?.event_date >= curStart && r.events?.event_date <= curEnd).reduce((s: number, r: any) => s + (r.fee || 0), 0);
    const prevMonth = confirmed.filter((r: any) => r.events?.event_date >= prevStart && r.events?.event_date <= prevEnd).reduce((s: number, r: any) => s + (r.fee || 0), 0);
    let revenueChange = 0;
    if (prevMonth > 0) revenueChange = Math.round(((curMonth - prevMonth) / prevMonth) * 100);
    else if (curMonth > 0) revenueChange = 100;

    return { data: { totalEarned, confirmedFee, pendingFee, revenueChange, confirmedCount: upcomingConfirmed.length }, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};
