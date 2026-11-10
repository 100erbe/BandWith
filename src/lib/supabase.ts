import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { createDemoClient } from './demo/demoClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Demo mode (development builds only): the app runs on an in-memory fake
 * backend with sample data, and any sign-in opens the demo account. It turns
 * on when VITE_DEMO_MODE=true or when the Supabase env vars are missing.
 * `import.meta.env.DEV` is false in production builds, so it can never ship.
 */
export const isDemoMode =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEMO_MODE === 'true' || !supabaseUrl || !supabaseAnonKey);

if (isDemoMode) {
  console.info('[BandWith] Demo mode: using local sample data, no Supabase connection.');
} else if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables');
}

// Create a Supabase client using the standard browser client.
// The @supabase/ssr createServerClient is for Next.js/Remix server environments
// and interferes with session persistence in a standard SPA.
// We use createClient which automatically handles localStorage in the browser
// and works correctly with OAuth redirect flows.
export const supabase = isDemoMode
  ? (createDemoClient() as unknown as ReturnType<typeof createClient>)
  : createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // PKCE: the auth code can only be exchanged by the app instance that
      // started the flow (it holds the code_verifier), so a crafted deep link
      // can no longer log the user into someone else's account.
      flowType: 'pkce',
      storage: Capacitor.isNativePlatform()
        ? {
            // For Capacitor native apps, use a simple in-memory + localStorage hybrid
            getItem: async (key: string) => {
              try {
                return localStorage.getItem(key);
              } catch {
                return null;
              }
            },
            setItem: async (key: string, value: string) => {
              try {
                localStorage.setItem(key, value);
              } catch {
                // Storage not available
              }
            },
            removeItem: async (key: string) => {
              try {
                localStorage.removeItem(key);
              } catch {
                // Storage not available
              }
            },
          }
        : undefined, // Use default browser localStorage for web
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
  const isNative = Capacitor.isNativePlatform();
  // For native apps, use deep link redirect with platform-specific scheme
  // iOS uses app.bandwith.mobile://, Android uses com.bandwith.app://
  const redirectTo = getAuthCallbackUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // Use skipBrowserRedirect: true for native so we can manually open the URL
      // in an in-app browser (Custom Chrome Tab) instead of a full redirect
      skipBrowserRedirect: isNative,
    },
  });
  
  if (error) {
    console.error('[OAuth] Error:', error);
    return { data, error };
  }
  
  // For native, open the browser manually using Capacitor Browser plugin
  // This gives a clean in-app browser instead of showing the Supabase URL
  if (isNative && data?.url) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ 
        url: data.url,
        presentationStyle: 'popover',
      });
    } catch (browserErr) {
      console.error('[OAuth] Failed to open browser:', browserErr);
    }
  }
  
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

/** Deep-link (native) or web URL that Supabase redirects auth flows back to. */
export const getAuthCallbackUrl = (params?: Record<string, string>) => {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  if (Capacitor.isNativePlatform()) {
    const scheme = Capacitor.getPlatform() === 'ios' ? 'app.bandwith.mobile' : 'com.bandwith.app';
    return `${scheme}://auth/callback${query}`;
  }
  return `${window.location.origin}/auth/callback${query}`;
};

/** Query flag added to the reset-password redirect so the app knows to ask for a new password. */
export const RECOVERY_FLAG = 'bw_recovery';

export const resetPassword = async (email: string) => {
  // Inside Capacitor `window.location.origin` is https://localhost, a dead page
  // for a link opened from an email, so native uses the app's deep link.
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthCallbackUrl({ [RECOVERY_FLAG]: '1' }),
  });
  return { data, error };
};

export const updatePassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({ password });
  return { data, error };
};

// Offline-safe getUser wrapper: resolves from persisted local session first
// so offline operations never fail with "Not authenticated" when a session exists.
const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = (async (jwt?: string) => {
  if (!jwt) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        return { data: { user: sessionData.session.user }, error: null } as any;
      }
    } catch {
      // Fall through to network getUser
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { data: { user: null }, error: new Error('Offline') as any };
    }
  }
  return originalGetUser(jwt);
}) as typeof supabase.auth.getUser;

export const getSafeUser = () => supabase.auth.getUser();

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await getSafeUser();
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
    pending_band_name?: string;
    pending_band_avatar?: string;
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
