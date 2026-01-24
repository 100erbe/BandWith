import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables - using mock mode');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Auth helpers
export const signUp = async (
  email: string,
  password: string,
  metadata?: { full_name?: string }
) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signInWithOAuth = async (provider: 'google' | 'apple') => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
};

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
};

export const getSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  return { session, error };
};

// Invite helpers
export const generateInviteToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const createMemberInvite = async (
  bandId: string,
  invitedBy: string,
  email: string,
  name?: string,
  role?: string,
  instruments?: string[],
  permission: 'admin' | 'member' = 'member'
) => {
  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

  const { data, error } = await supabase.from('member_invites').insert({
    band_id: bandId,
    invited_by: invitedBy,
    email: email.toLowerCase().trim(),
    name,
    role,
    instruments,
    permission,
    token,
    expires_at: expiresAt.toISOString(),
  }).select().single();

  return { data, error, token };
};

export const getInviteByToken = async (token: string) => {
  const { data, error } = await supabase
    .from('member_invites')
    .select(`
      *,
      band:bands(id, name, logo_url, description),
      inviter:profiles!invited_by(full_name, email)
    `)
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  return { data, error };
};

export const acceptInvite = async (token: string, userId: string) => {
  // Get the invite
  const { data: invite, error: fetchError } = await getInviteByToken(token);
  if (fetchError || !invite) {
    return { error: new Error('Invalid or expired invite') };
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from('member_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    return { error: new Error('This invite has expired') };
  }

  // Add user to band
  const { error: memberError } = await supabase.from('band_members').insert({
    band_id: invite.band_id,
    user_id: userId,
    role: invite.permission || 'member',
    instrument: invite.role,
  });

  if (memberError) {
    return { error: memberError };
  }

  // Update invite status
  await supabase
    .from('member_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  return { data: invite, error: null };
};

// Onboarding progress helpers
export const getOnboardingProgress = async (userId: string) => {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('user_id', userId)
    .single();

  return { data, error };
};

export const updateOnboardingProgress = async (
  userId: string,
  updates: {
    current_step?: number;
    completed_steps?: string[];
    skipped_steps?: string[];
    checklist_dismissed?: boolean;
    completed_at?: string;
    duration_seconds?: number;
  }
) => {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .upsert({
      user_id: userId,
      ...updates,
    })
    .select()
    .single();

  return { data, error };
};

export const createOnboardingProgress = async (
  userId: string,
  path: 'creator' | 'joiner'
) => {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .insert({
      user_id: userId,
      path,
      current_step: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  return { data, error };
};
