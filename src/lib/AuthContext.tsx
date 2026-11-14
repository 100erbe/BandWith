import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, getSafeUser, signIn, signUp, signOut, resetPassword, signInWithOAuth, updatePassword, RECOVERY_FLAG } from './supabase';
import { Capacitor } from '@capacitor/core';
import { cleanupPresence } from './services/presence';
import { clearOfflineCache, getOfflineItem, setOfflineItem, getCacheKey } from './offline/storage';
import { clearStageCache } from './stageBleNative';
import { unregisterPushToken } from './services/pushNotifications';
import { realName } from '@/lib/personName';

export type SubTier = 'free_member' | 'single_band' | 'multi_band' | 'unlimited';

// PLG: User mode — 'band'/'band_admin'/'member' = collaborative workspace, 'solo' = personal calendar
export type UserMode = 'band' | 'band_admin' | 'member' | 'solo';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  instrument: string | null;
  phone: string | null;
  bio?: string | null;
  location?: string | null;
  timezone?: string | null;
  preferred_language?: string | null;
  notification_preferences?: Record<string, boolean> | null;
  sub_tier?: SubTier | null;
  user_mode?: UserMode | null;
  updated_at?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  userMode: UserMode | null;         // PLG: current user mode
  setUserMode: (mode: UserMode) => Promise<void>;  // PLG: switch mode
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    metadata?: { full_name?: string }
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithApple: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  /** True after the user opened a password-reset link: the app must ask for a new password. */
  isPasswordRecovery: boolean;
  completePasswordRecovery: (newPassword: string) => Promise<{ error: AuthError | null }>;
  dismissPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Sends the signed-in user's queued offline edits (a few seconds at most) and
 * returns whatever is still queued, to be stored again after sign-out.
 */
const takeUnsyncedQueue = async (
  userId: string | undefined
): Promise<{ key: string; items: unknown[] } | null> => {
  if (!userId) return null;
  try {
    const q = await import('./offline/syncQueue');
    if (typeof navigator === 'undefined' || navigator.onLine) {
      await Promise.race([q.processSyncQueue(), new Promise((resolve) => setTimeout(resolve, 6000))]);
    }
    const items = await q.getPendingMutations();
    return items.length > 0 ? { key: q.getOfflineQueueKey(userId), items } : null;
  } catch {
    return null;
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get(RECOVERY_FLAG) === '1';
    } catch {
      return false;
    }
  });

  const fetchProfile = async (userId: string) => {
    const profileCacheKey = getCacheKey(userId, 'global', 'user_profile');
    try {
      // First attempt to get the profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist (PGRST116), create a basic one
        if (error.code === 'PGRST116') {
          const { data: { user } } = await getSafeUser();
          if (!user) return null;

          const fallbackProfile: Profile = {
            id: user.id,
            email: user.email || '',
            // No name yet: leave it empty (the app shows the address and asks for a name).
            full_name: realName(user.user_metadata?.full_name, user.email) || null,
            avatar_url: user.user_metadata?.avatar_url || null,
            role: 'member',
            instrument: null,
            phone: null,
          };

          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              email: user.email || '',
              full_name: fallbackProfile.full_name,
              avatar_url: fallbackProfile.avatar_url,
              role: 'member',
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating fallback profile:', createError);
            return fallbackProfile;
          }
          setOfflineItem(profileCacheKey, createdProfile).catch(() => {});
          return createdProfile as Profile;
        }
        console.error('Error fetching profile:', error);
        const cached = await getOfflineItem<Profile>(profileCacheKey);
        return cached || null;
      }

      if (data) {
        setOfflineItem(profileCacheKey, data).catch(() => {});
      }
      return data as Profile;
    } catch (error) {
      console.error('Unexpected error in fetchProfile:', error);
      const cached = await getOfflineItem<Profile>(profileCacheKey);
      return cached || null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
      }
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        return { error };
      }

      await refreshProfile();
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setSession(session);
          setUser(session.user);
          const cachedProfile = await getOfflineItem<Profile>(getCacheKey(session.user.id, 'global', 'user_profile'));
          if (cachedProfile) {
            setProfile(cachedProfile);
            setLoading(false);
          }
          const profileData = await fetchProfile(session.user.id);
          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      setSession(session);
      setUser(session?.user ?? null);

      // Quick sign-in keeps the refresh token, which Supabase rotates.
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && Capacitor.isNativePlatform()) {
        import('@/lib/services/biometric')
          .then((m) => m.updateStoredSession(session))
          .catch(() => {});
      }

      if (session?.user) {
        setTimeout(async () => {
          const profileData = await fetchProfile(session.user.id);
          if (profileData) {
            setProfile(profileData);
          }
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    // Native OAuth / magic-link / password-reset redirects come back as deep
    // links (com.bandwith.app://auth/callback?code=...). With PKCE the code can
    // only be exchanged by this app instance (it holds the code_verifier), so a
    // forged link cannot swap the session. Tokens in a URL fragment
    // (#access_token=...) are no longer accepted.
    let removeDeepLinkListener: (() => void) | undefined;
    let disposed = false;
    if (Capacitor.isNativePlatform()) {
      const handleAuthUrl = async (url: string | undefined) => {
        if (!url || !url.includes('auth/callback')) return;
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return;
        }
        const code = parsed.searchParams.get('code');
        if (!code) return;
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[DeepLink] Could not complete sign-in:', error.message);
          return;
        }
        if (parsed.searchParams.get(RECOVERY_FLAG) === '1') {
          setIsPasswordRecovery(true);
        }
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch {
          // In-app browser may already be closed
        }
      };

      const setupDeepLinkListener = async () => {
        try {
          const { App } = await import('@capacitor/app');
          const handle = await App.addListener('appUrlOpen', (data) => {
            handleAuthUrl(data.url);
          });
          if (disposed) {
            handle.remove();
          } else {
            removeDeepLinkListener = () => handle.remove();
          }
          // App opened via a URL while it was closed
          const launch = await App.getLaunchUrl();
          await handleAuthUrl(launch?.url);
        } catch (err) {
          console.error('[DeepLink] Error setting up deep link listener:', err);
        }
      };

      setupDeepLinkListener();
    }

    return () => {
      disposed = true;
      subscription.unsubscribe();
      removeDeepLinkListener?.();
    };
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    return { error };
  };

  const handleSignUp = async (
    email: string,
    password: string,
    metadata?: { full_name?: string }
  ) => {
    const { error } = await signUp(email, password, metadata);
    return { error };
  };

  const handleSignInWithGoogle = async () => {
    const { error } = await signInWithOAuth('google');
    return { error };
  };

  const handleSignInWithApple = async () => {
    const { error } = await signInWithOAuth('apple');
    return { error };
  };

  const handleSignOut = async () => {
    // Offline edits not sent yet: try now, while the session is still valid.
    // What still can't be sent is kept on this device for this account only
    // (its own queue key) and syncs at its next sign-in, instead of being
    // wiped with the offline cache below.
    const pendingQueue = await takeUnsyncedQueue(user?.id);
    // Before the session ends: this device must stop receiving this account's pushes.
    await unregisterPushToken();
    cleanupPresence();
    // With quick sign-in on for this account, keep its session for Face ID.
    let keepDeviceSession = false;
    if (Capacitor.isNativePlatform() && user?.id) {
      try {
        const owner = await (await import('@/lib/services/biometric')).getQuickSignInOwner();
        keepDeviceSession = !!owner?.userId && owner.userId === user.id;
      } catch {
        keepDeviceSession = false;
      }
    }
    const { error } = await signOut({ keepDeviceSession });
    if (!error) {
      setUser(null);
      setProfile(null);
      setSession(null);
      clearStageCache();
      clearOfflineCache()
        .then(() => (pendingQueue ? setOfflineItem(pendingQueue.key, pendingQueue.items) : undefined))
        .catch(() => {});
    }
    return { error };
  };

  const handleResetPassword = async (email: string) => {
    const { error } = await resetPassword(email);
    return { error };
  };

  const completePasswordRecovery = async (newPassword: string) => {
    const { error } = await updatePassword(newPassword);
    if (!error) {
      setIsPasswordRecovery(false);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete(RECOVERY_FLAG);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }
    return { error };
  };

  const dismissPasswordRecovery = () => setIsPasswordRecovery(false);

  // PLG: Derived user mode from profile
  const userMode: UserMode | null = profile?.user_mode || null;

  // PLG: Set user mode and persist to profile
  const setUserMode = async (mode: UserMode) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ user_mode: mode, role: mode === 'solo' ? 'member' : 'admin' })
      .eq('id', user.id);
    if (error) {
      console.error('Failed to set user mode:', error);
      return;
    }
    await refreshProfile();
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!user,
    userMode,
    setUserMode,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithApple: handleSignInWithApple,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    isPasswordRecovery,
    completePasswordRecovery,
    dismissPasswordRecovery,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
