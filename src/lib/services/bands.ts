import { supabase } from '../supabase';
import { notifyInviteSent, notifyMemberJoined } from './notifications';

// Types
export interface Band {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  description?: string;
  created_by?: string;
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
  };
}

export interface BandWithMembers extends Band {
  members: BandMember[];
  member_count: number;
  user_role: 'admin' | 'member';
}

// ============================================
// BANDS CRUD
// ============================================

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
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Supabase error fetching band_members:', error.message, error.code);
      throw error;
    }

    // Handle case where user has no bands
    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    console.log('[getBands] Processing', data.length, 'band memberships');
    
    // Transform data - now includes members!
    const bands = await Promise.all(
      data.map(async (item: any) => {
        const band = item.bands;
        
        // Skip if band relation is null (shouldn't happen but be safe)
        if (!band) {
          console.log('[getBands] Skipping null band relation');
          return null;
        }
        
        console.log('[getBands] Loading members for band:', band.id, band.name);
        
        // Get members with profiles
        const { data: members, error: membersError } = await supabase
          .from('band_members')
          .select(`
            *,
            profile:profiles (
              id,
              email,
              full_name,
              avatar_url
            )
          `)
          .eq('band_id', band.id);

        if (membersError) {
          console.error('[getBands] Error loading members for band', band.id, membersError);
        }
        
        console.log('[getBands] Band', band.name, 'has', members?.length || 0, 'members:', members?.map((m: any) => m.profile?.full_name || m.user_id));

        return {
          ...band,
          user_role: item.role,
          member_count: members?.length || 0,
          members: members || [],
        };
      })
    );

    // Filter out nulls
    const validBands = bands.filter(b => b !== null) as BandWithMembers[];

    return { data: validBands, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

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

    // Get members with profiles (removed is_active filter for consistency)
    const { data: members, error: membersError } = await supabase
      .from('band_members')
      .select(`
        *,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq('band_id', bandId);

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

export const createBand = async (bandData: {
  name: string;
  description?: string;
  logo_url?: string;
}): Promise<{ data: Band | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate slug from name
    const slug = bandData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const { data, error } = await supabase
      .from('bands')
      .insert({
        ...bandData,
        slug: `${slug}-${Date.now().toString(36)}`,
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
          instrument
        )
      `)
      .eq('band_id', bandId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    return { data, error: null };
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
        instrument,
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
    // Soft delete - set is_active to false
    const { error } = await supabase
      .from('band_members')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('id', memberId);

    if (error) throw error;

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

    // Get ALL band members (removed is_active filter as it may cause issues)
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
      .neq('user_id', user.id); // Exclude current user
    
    console.log('[getBandMembersForChat] bandId:', bandId, 'members found:', members?.length, 'error:', error);

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

    // If no query, return empty (use getBandMembersForChat for defaults)
    if (!query || query.length < 2) {
      return { data: [], error: null };
    }

    // Get band members first
    const { data: bandMembers } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('is_active', true);

    const bandMemberIds = new Set(bandMembers?.map(m => m.user_id) || []);

    // Search all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(15);

    if (error) throw error;

    // Mark which users are band members
    const result = (profiles || []).map(p => ({
      ...p,
      isBandMember: bandMemberIds.has(p.id),
    }));

    // Sort: band members first
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

// Add existing user to band directly
export const addExistingUserToBand = async (
  bandId: string,
  userId: string,
  role: 'admin' | 'member' = 'member',
  instrument?: string
): Promise<{ error: Error | null }> => {
  try {
    // Check if user is already in band
    const { data: existingMember } = await supabase
      .from('band_members')
      .select('id, is_active')
      .eq('band_id', bandId)
      .eq('user_id', userId)
      .single();

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
          instrument,
          is_active: true,
        });
      if (error) throw error;
    }

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// Invite member by email (for new users)
export const inviteMember = async (
  bandId: string,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<{ data: { userId?: string; invited: boolean } | null; error: Error | null }> => {
  try {
    // First check if user exists in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      // User exists, add them directly
      const { error } = await addExistingUserToBand(bandId, existingProfile.id, role);
      if (error) throw error;
      return { data: { userId: existingProfile.id, invited: false }, error: null };
    } else {
      // User doesn't exist - send invitation via Supabase Auth
      
      // Get band info and current user info
      const { data: band } = await supabase
        .from('bands')
        .select('name')
        .eq('id', bandId)
        .single();
      
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user?.id)
        .single();
      
      // Send invitation via Edge Function (uses Supabase Auth's invite system)
      try {
        const { data: inviteResult, error: inviteError } = await supabase.functions.invoke('invite-member', {
          body: {
            email: email.toLowerCase(),
            bandId,
            bandName: band?.name || 'Your Band',
            role: role === 'admin' ? 'admin' : 'member',
            inviterName: inviterProfile?.full_name || inviterProfile?.email || 'A band member',
          },
        });
        
        if (inviteError) {
          console.error('Edge function error:', inviteError);
          throw inviteError;
        }
        
        console.log('Invitation sent:', inviteResult);
        
        // Create in-app notification for the admin
        if (user?.id) {
          await notifyInviteSent(user.id, bandId, band?.name || 'Your Band', email);
        }
        
        // If user already existed, return their ID
        if (inviteResult?.userExists && inviteResult?.userId) {
          // Notify all band members that someone joined
          const { data: members } = await supabase
            .from('band_members')
            .select('user_id')
            .eq('band_id', bandId)
            .neq('user_id', inviteResult.userId);
          
          if (members && members.length > 0) {
            const memberIds = members.map(m => m.user_id);
            await notifyMemberJoined(memberIds, bandId, band?.name || 'Your Band', email);
          }
          
          return { data: { userId: inviteResult.userId, invited: false }, error: null };
        }
      } catch (emailError) {
        console.error('Failed to send invitation:', emailError);
        
        // Fallback: store invitation locally for manual follow-up
        await supabase
          .from('band_invitations')
          .upsert({
            band_id: bandId,
            email: email.toLowerCase(),
            role,
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }, {
            onConflict: 'band_id,email',
          });
        
        // Still create a notification even if email failed
        if (user?.id) {
          await notifyInviteSent(user.id, bandId, band?.name || 'Your Band', email);
        }
      }

      return { data: { invited: true }, error: null };
    }
  } catch (error: any) {
    return { data: null, error };
  }
};
