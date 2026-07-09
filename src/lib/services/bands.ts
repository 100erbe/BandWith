import { supabase } from '../supabase';

// Types
export interface Band {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  description?: string;
  genre?: string;
  created_by?: string;
  plan?: string;
  created_at: string;
  updated_at: string;
}

export interface BandMember {
  id: string;
  band_id: string;
  user_id: string;
  role: 'admin' | 'member';
  instrument?: string;
  stage_name?: string;
  default_fee?: number;
  is_active: boolean;
  joined_at: string;
  left_at?: string;
  // Joined data
  profile?: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    sub_tier?: string | null;
  } | null;
}

export interface BandWithMembers extends Band {
  members: BandMember[];
  member_count: number;
  user_role: 'admin' | 'member';
}

export interface Invitation {
  id: string;
  band_id: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending' | 'accepted' | 'expired';
  token: string;
  created_at: string;
}

// ============================================
// BANDS CRUD
// ============================================

/**
 * Fetch all bands for the current user, including members and role.
 * Uses a single query to get band_members, then batches the member fetching
 * to avoid N+1 query problems.
 */
export const getBands = async (): Promise<{ data: BandWithMembers[] | null; error: Error | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error in getBands:', authError.message);
      throw new Error(`Auth error: ${authError.message}`);
    }
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('band_members')
      .select(`
        band_id,
        role,
        bands (
          id,
          name,
          slug,
          logo_url,
          description,
          created_by,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error('Supabase error fetching band_members:', error.message, error.code);
      throw error;
    }

    // Handle case where user has no bands
    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Collect all band IDs
    const bandIds = data.map((item: any) => item.band_id).filter(Boolean);
    
    // Batch-fetch all members for all bands in one query
    const { data: allMembers, error: membersError } = await supabase
      .from('band_members')
      .select(`
        *,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url,
          sub_tier
        )
      `)
      .in('band_id', bandIds)
      .eq('is_active', true);

    if (membersError) {
      console.error('[getBands] Error batch-loading members:', membersError);
    }

    // Group members by band_id
    const membersByBandId: Record<string, any[]> = {};
    if (allMembers) {
      for (const member of allMembers) {
        const bid = member.band_id;
        if (!membersByBandId[bid]) membersByBandId[bid] = [];
        membersByBandId[bid].push(member);
      }
    }

    // Transform data
    const bands = data
      .map((item: any) => {
        const band = item.bands;
        if (!band) return null;
        
        const members = membersByBandId[band.id] || [];
        
        return {
          ...band,
          user_role: item.role,
          member_count: members.length || 0,
          members: members || [],
        } as BandWithMembers;
      })
      .filter(b => b !== null) as BandWithMembers[];

    return { data: bands, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

/**
 * Fetch a single band by ID with its members.
 */
export const getBand = async (bandId: string): Promise<{ data: BandWithMembers | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: band, error: bandError } = await supabase
      .from('bands')
      .select('*')
      .eq('id', bandId)
      .single();

    if (bandError) throw bandError;

    // Get members with profiles
    const { data: members, error: membersError } = await supabase
      .from('band_members')
      .select(`
        *,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url,
          sub_tier
        )
      `)
      .eq('band_id', bandId)
      .eq('is_active', true);

    if (membersError) throw membersError;

    // Get user's role in this band
    const userMember = members?.find(m => m.user_id === user.id);

    return {
      data: {
        ...band,
        members: members || [],
        member_count: members?.length || 0,
        user_role: userMember?.role || 'member',
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};

/**
 * Create a new band. The DB trigger `handle_new_band` will automatically
 * add the creator as an 'admin' member in band_members.
 */
export const createBand = async (bandData: {
  name: string;
  description?: string;
  logo_url?: string;
}): Promise<{ data: Band | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate a unique slug
    const slugBase = bandData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const { data, error } = await supabase
      .from('bands')
      .insert({
        name: bandData.name,
        description: bandData.description || null,
        logo_url: bandData.logo_url || null,
        slug,
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

export const updateBand = async (
  bandId: string,
  updates: Partial<Band>
): Promise<{ data: Band | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('bands')
      .update(updates)
      .eq('id', bandId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteBand = async (bandId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('bands')
      .delete()
      .eq('id', bandId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// BAND MEMBERS
// ============================================

export const getBandMembers = async (bandId: string): Promise<{ data: BandMember[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('band_members')
      .select(`
        *,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url,
          phone,
          instrument,
          sub_tier
        )
      `)
      .eq('band_id', bandId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    // Ensure profiles with null joins don't crash the UI
    const safeData = (data || []).map((m: any) => ({
      ...m,
      profile: m.profile || null,
    })) as BandMember[];

    return { data: safeData, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const addBandMember = async (
  bandId: string,
  userId: string,
  role: 'admin' | 'member' = 'member',
  instrument?: string
): Promise<{ data: BandMember | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('band_members')
      .insert({
        band_id: bandId,
        user_id: userId,
        role,
        instrument: instrument || null,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateBandMember = async (
  memberId: string,
  updates: Partial<BandMember>
): Promise<{ data: BandMember | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('band_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const removeBandMember = async (memberId: string): Promise<{ error: Error | null }> => {
  try {
    // Hard delete from band_members
    const { error } = await supabase
      .from('band_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// INVITATIONS
// ============================================

/**
 * Invite a person by email. If they already have a profile (existing user),
 * add them directly to band_members. If not, create an invitation in the
 * invitations table.
 */
export const inviteMember = async (
  bandId: string,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<{ data: { userId?: string; invited: boolean } | null; error: Error | null }> => {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // First check if user exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle(); // Use maybeSingle to avoid PGRST116 error

    if (existingProfile) {
      // User exists, add them directly to band_members
      const { error } = await addExistingUserToBand(bandId, existingProfile.id, role);
      if (error) throw error;
      return { data: { userId: existingProfile.id, invited: false }, error: null };
    }

    // User doesn't exist — create a pending invitation
    const { error: inviteError } = await supabase
      .from('invitations')
      .insert({
        band_id: bandId,
        email: normalizedEmail,
        role,
        status: 'pending',
      });

    if (inviteError) throw inviteError;

    return { data: { invited: true }, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

/**
 * Add an existing user directly to a band as a member.
 */
export const addExistingUserToBand = async (
  bandId: string,
  userId: string,
  role: 'admin' | 'member' = 'member',
  instrument?: string
): Promise<{ error: Error | null }> => {
  try {
    // Check if user is already an active member
    const { data: existingMember } = await supabase
      .from('band_members')
      .select('id, is_active')
      .eq('band_id', bandId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      if (existingMember.is_active) {
        throw new Error('This user is already a member of this band');
      }
      // Reactivate the member
      const { error } = await supabase
        .from('band_members')
        .update({ is_active: true, role, left_at: null })
        .eq('id', existingMember.id);
      if (error) throw error;
    } else {
      // Add new member
      const { error } = await supabase
        .from('band_members')
        .insert({
          band_id: bandId,
          user_id: userId,
          role,
          instrument: instrument || null,
          is_active: true,
        });
      if (error) throw error;
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const checkBandAccess = async (
  bandId: string,
  requiredRole?: 'admin' | 'member'
): Promise<{ hasAccess: boolean; role: string | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { hasAccess: false, role: null, error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('band_members')
      .select('role')
      .eq('band_id', bandId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error) return { hasAccess: false, role: null, error };

    const hasAccess = requiredRole ? data.role === requiredRole || data.role === 'admin' : true;

    return { hasAccess, role: data.role, error: null };
  } catch (error: any) {
    return { hasAccess: false, role: null, error };
  }
};

// Alias for removeBandMember
export const removeMember = removeBandMember;

// Update member role
export const updateMemberRole = async (
  memberId: string,
  role: 'admin' | 'member'
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('band_members')
      .update({ role })
      .eq('id', memberId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// Search for users in the app
export const searchUsers = async (
  query: string,
  excludeBandId?: string
): Promise<{ data: { id: string; email: string; full_name?: string; avatar_url?: string }[] | null; error: Error | null }> => {
  try {
    if (!query || query.length < 2) {
      return { data: [], error: null };
    }

    let usersQuery = supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(10);

    const { data, error } = await usersQuery;

    if (error) throw error;

    // If excludeBandId is provided, filter out users already in that band
    if (excludeBandId && data) {
      const { data: existingMembers } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', excludeBandId)
        .eq('is_active', true);

      const existingUserIds = new Set(existingMembers?.map(m => m.user_id) || []);
      const filteredData = data.filter(u => !existingUserIds.has(u.id));
      return { data: filteredData, error: null };
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// Get band members for chat - includes members of the current band
export const getBandMembersForChat = async (
  bandId: string
): Promise<{ data: { id: string; email: string; full_name?: string; avatar_url?: string; role?: string; instrument?: string }[] | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: null };

    const { data: members, error } = await supabase
      .from('band_members')
      .select(`
        user_id,
        role,
        instrument,
        profiles:user_id (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('band_id', bandId)
      .eq('is_active', true)
      .neq('user_id', user.id);

    if (error) throw error;

    const result = (members || [])
      .filter((m: any) => m.profiles)
      .map((m: any) => ({
        id: m.profiles.id,
        email: m.profiles.email,
        full_name: m.profiles.full_name,
        avatar_url: m.profiles.avatar_url,
        role: m.role,
        instrument: m.instrument,
      }));

    return { data: result, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// Search users for chat - includes band members and can search outside
export const searchUsersForChat = async (
  query: string,
  bandId: string
): Promise<{ data: { id: string; email: string; full_name?: string; avatar_url?: string; isBandMember?: boolean }[] | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: null };

    if (!query || query.length < 2) {
      return { data: [], error: null };
    }

    const { data: bandMembers } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('is_active', true);

    const bandMemberIds = new Set(bandMembers?.map(m => m.user_id) || []);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(15);

    if (error) throw error;

    const result = (profiles || []).map(p => ({
      ...p,
      isBandMember: bandMemberIds.has(p.id),
    }));

    result.sort((a, b) => {
      if (a.isBandMember && !b.isBandMember) return -1;
      if (!a.isBandMember && b.isBandMember) return 1;
      return 0;
    });

    return { data: result, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};
