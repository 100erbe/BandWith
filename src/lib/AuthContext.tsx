import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, signIn, signUp, signOut, resetPassword, signInWithOAuth } from './supabase';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'member';
  instrument: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
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

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Update profile
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
    // Get initial session
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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer profile fetch to avoid blocking
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

    return () => {
      subscription.unsubscribe();
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

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!user,
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
