import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, signIn, signUp, signOut, resetPassword, signInWithOAuth } from './supabase';
import { Capacitor } from '@capacitor/core';

export type SubTier = 'free_member' | 'single_band' | 'multi_band' | 'unlimited';

// PLG: User mode — 'band' = collaborative workspace, 'solo' = personal calendar
export type UserMode = 'band' | 'solo';

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
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  userMode: UserMode | null;
  setUserMode: (mode: UserMode) => Promise<void>;
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

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
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
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;

          const fallbackProfile: Profile = {
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
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
          return createdProfile as Profile;
        }
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('Unexpected error in fetchProfile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
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
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
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
      console.log('Auth event:', event);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(async () => {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
        }, 0);
      } else {
        setProfile(null);
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    // Listen for deep links in native (Capacitor) environment
    // This handles the OAuth redirect back to the app from Google/Apple
    let deepLinkCleanup: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      const setupDeepLinkListener = async () => {
        try {
          const { App } = await import('@capacitor/app');
          
          App.addListener('appUrlOpen', async (data) => {
            const url = data.url;
            console.log('[DeepLink] App opened with URL:', url);
            
            // Check if this is an auth callback
            if (url && url.includes('auth/callback')) {
              // Extract the hash fragment from the deep link URL
              const hashIndex = url.indexOf('#');
              if (hashIndex >= 0) {
                const hash = url.substring(hashIndex);
                console.log('[DeepLink] Auth hash found, setting session...');
                
                // Parse the hash params and set the session
                const hashParams = new URLSearchParams(hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                
                if (accessToken) {
                  const { data: sessionData, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || '',
                  });
                  
                  if (error) {
                    console.error('[DeepLink] Error setting session:', error);
                  } else if (sessionData.session) {
                    console.log('[DeepLink] Session established successfully');
                  }
                }
              } else if (url.includes('code=')) {
                // PKCE flow — code is in the query string
                console.log('[DeepLink] Auth code found, exchanging...');
                // The onAuthStateChange listener should handle this
              }
            }
          });
          
          // Check if the app was opened via a URL while closed
          const result = await App.getLaunchUrl();
          if (result?.url && result.url.includes('auth/callback')) {
            console.log('[DeepLink] Launched with auth URL:', result.url);
            const url = result.url;
            const hashIndex = url.indexOf('#');
            if (hashIndex >= 0) {
              const hash = url.substring(hashIndex);
              const hashParams = new URLSearchParams(hash.substring(1));
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');
              
              if (accessToken) {
                const { data: sessionData, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken || '',
                });
                
                if (error) {
                  console.error('[DeepLink] Error setting session from launch URL:', error);
                } else if (sessionData.session) {
                  console.log('[DeepLink] Session established from launch URL');
                }
              }
            }
          }
        } catch (err) {
          console.error('[DeepLink] Error setting up deep link listener:', err);
        }
      };
      
      setupDeepLinkListener();
      
      deepLinkCleanup = () => {
        // Capacitor doesn't provide a direct way to remove listeners,
        // but the component unmount will clean up
      };
    }

    return () => {
      subscription.unsubscribe();
      if (deepLinkCleanup) deepLinkCleanup();
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
    const { error } = await signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
      setSession(null);
    }
    return { error };
  };

  const handleResetPassword = async (email: string) => {
    const { error } = await resetPassword(email);
    return { error };
  };

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
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
