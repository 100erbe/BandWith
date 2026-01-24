import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  supabase,
  createMemberInvite,
  getOnboardingProgress,
  updateOnboardingProgress,
  createOnboardingProgress,
} from './supabase';

// Onboarding step definitions
export type OnboardingPath = 'creator' | 'joiner';

export const CREATOR_STEPS = [
  'welcome',
  'account',
  'band',
  'profile',
  'invite',
  'songs',
  'complete',
] as const;

export const JOINER_STEPS = [
  'invite-landing',
  'account',
  'profile',
  'welcome-band',
] as const;

export type CreatorStep = (typeof CREATOR_STEPS)[number];
export type JoinerStep = (typeof JOINER_STEPS)[number];
export type OnboardingStep = CreatorStep | JoinerStep;

// Instrument options
export const INSTRUMENTS = [
  { id: 'guitar', label: 'Guitar', icon: '🎸' },
  { id: 'bass', label: 'Bass', icon: '🎸' },
  { id: 'drums', label: 'Drums', icon: '🥁' },
  { id: 'vocals', label: 'Vocals', icon: '🎤' },
  { id: 'keys', label: 'Keys', icon: '🎹' },
  { id: 'saxophone', label: 'Saxophone', icon: '🎷' },
  { id: 'trumpet', label: 'Trumpet', icon: '🎺' },
  { id: 'violin', label: 'Violin', icon: '🎻' },
  { id: 'dj', label: 'DJ', icon: '💿' },
  { id: 'other', label: 'Other...', icon: '➕' },
] as const;

// Member invite
export interface MemberInvite {
  email: string;
  name?: string;
  role?: string;
  instruments?: string[];
  permission?: 'admin' | 'member';
}

// Song
export interface OnboardingSong {
  id: string;
  title: string;
  artist?: string;
  duration?: number; // seconds
  bpm?: number;
  key?: string;
  genre?: string;
  source?: 'manual' | 'spotify' | 'apple' | 'import';
}

// Context state
interface OnboardingState {
  // Flow control
  path: OnboardingPath | null;
  currentStep: number;
  isComplete: boolean;
  startedAt: Date | null;

  // Invite token (for joiners)
  inviteToken: string | null;
  inviteData: any | null;

  // Collected data
  accountData: {
    email: string;
    password?: string;
    authMethod?: 'email' | 'google' | 'apple';
  } | null;

  bandData: {
    name: string;
    avatarUrl?: string;
  } | null;

  profileData: {
    fullName: string;
    instruments: string[];
    customInstrument?: string;
    phone?: string;
  } | null;

  invites: MemberInvite[];
  songs: OnboardingSong[];

  // Checklist
  checklistDismissed: boolean;
}

interface OnboardingContextType extends OnboardingState {
  // Navigation
  startOnboarding: (path: OnboardingPath) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  goToStep: (step: number) => void;
  completeOnboarding: () => Promise<void>;

  // Data setters
  setAccountData: (data: OnboardingState['accountData']) => void;
  setBandData: (data: OnboardingState['bandData']) => void;
  setProfileData: (data: OnboardingState['profileData']) => void;
  addInvite: (invite: MemberInvite) => void;
  removeInvite: (email: string) => void;
  addSong: (song: OnboardingSong) => void;
  removeSong: (id: string) => void;
  addSongs: (songs: OnboardingSong[]) => void;

  // Invite flow
  setInviteToken: (token: string) => void;
  loadInviteData: (token: string) => Promise<boolean>;

  // Checklist
  dismissChecklist: () => void;

  // Helpers
  getSteps: () => readonly string[];
  getCurrentStepName: () => string;
  getProgress: () => number;

  // Persistence
  saveToServer: () => Promise<void>;
  loadFromServer: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

interface OnboardingProviderProps {
  children: ReactNode;
}

const initialState: OnboardingState = {
  path: null,
  currentStep: 0,
  isComplete: false,
  startedAt: null,
  inviteToken: null,
  inviteData: null,
  accountData: null,
  bandData: null,
  profileData: null,
  invites: [],
  songs: [],
  checklistDismissed: false,
};

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
}) => {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(initialState);

  // Get steps based on path
  const getSteps = useCallback(() => {
    return state.path === 'creator' ? CREATOR_STEPS : JOINER_STEPS;
  }, [state.path]);

  // Get current step name
  const getCurrentStepName = useCallback(() => {
    const steps = getSteps();
    return steps[state.currentStep] || steps[0];
  }, [state.currentStep, getSteps]);

  // Get progress percentage
  const getProgress = useCallback(() => {
    const steps = getSteps();
    return Math.round((state.currentStep / (steps.length - 1)) * 100);
  }, [state.currentStep, getSteps]);

  // Start onboarding
  const startOnboarding = useCallback((path: OnboardingPath) => {
    setState((prev) => ({
      ...prev,
      path,
      currentStep: 0,
      startedAt: new Date(),
      isComplete: false,
    }));
  }, []);

  // Navigation
  const nextStep = useCallback(() => {
    setState((prev) => {
      const steps = prev.path === 'creator' ? CREATOR_STEPS : JOINER_STEPS;
      const newStep = Math.min(prev.currentStep + 1, steps.length - 1);
      return { ...prev, currentStep: newStep };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  }, []);

  const skipStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: step,
    }));
  }, []);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    const duration = state.startedAt
      ? Math.round((Date.now() - state.startedAt.getTime()) / 1000)
      : 0;

    // Create band if creator path
    if (state.path === 'creator' && state.bandData) {
      const { data: band, error: bandError } = await supabase
        .from('bands')
        .insert({
          name: state.bandData.name,
          logo_url: state.bandData.avatarUrl,
          created_by: user.id,
        })
        .select()
        .single();

      if (!bandError && band) {
        // Add creator as admin
        await supabase.from('band_members').insert({
          band_id: band.id,
          user_id: user.id,
          role: 'admin',
          instrument: state.profileData?.instruments?.join(', '),
        });

        // Send invites
        for (const invite of state.invites) {
          await createMemberInvite(
            band.id,
            user.id,
            invite.email,
            invite.name,
            invite.role,
            invite.instruments,
            invite.permission
          );
        }

        // Add songs
        for (const song of state.songs) {
          await supabase.from('songs').insert({
            band_id: band.id,
            title: song.title,
            artist: song.artist,
            duration_seconds: song.duration,
            bpm: song.bpm,
            key: song.key,
          });
        }
      }
    }

    // Update profile
    if (state.profileData) {
      await supabase
        .from('profiles')
        .update({
          full_name: state.profileData.fullName,
          instrument: state.profileData.instruments?.join(', '),
          phone: state.profileData.phone,
        })
        .eq('id', user.id);
    }

    // Mark onboarding complete
    await updateOnboardingProgress(user.id, {
      completed_at: new Date().toISOString(),
      duration_seconds: duration,
    });

    setState((prev) => ({
      ...prev,
      isComplete: true,
    }));
  }, [user, state]);

  // Data setters
  const setAccountData = useCallback(
    (data: OnboardingState['accountData']) => {
      setState((prev) => ({ ...prev, accountData: data }));
    },
    []
  );

  const setBandData = useCallback((data: OnboardingState['bandData']) => {
    setState((prev) => ({ ...prev, bandData: data }));
  }, []);

  const setProfileData = useCallback(
    (data: OnboardingState['profileData']) => {
      setState((prev) => ({ ...prev, profileData: data }));
    },
    []
  );

  const addInvite = useCallback((invite: MemberInvite) => {
    setState((prev) => ({
      ...prev,
      invites: [...prev.invites, invite],
    }));
  }, []);

  const removeInvite = useCallback((email: string) => {
    setState((prev) => ({
      ...prev,
      invites: prev.invites.filter((i) => i.email !== email),
    }));
  }, []);

  const addSong = useCallback((song: OnboardingSong) => {
    setState((prev) => ({
      ...prev,
      songs: [...prev.songs, song],
    }));
  }, []);

  const removeSong = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      songs: prev.songs.filter((s) => s.id !== id),
    }));
  }, []);

  const addSongs = useCallback((songs: OnboardingSong[]) => {
    setState((prev) => ({
      ...prev,
      songs: [...prev.songs, ...songs],
    }));
  }, []);

  // Invite flow
  const setInviteToken = useCallback((token: string) => {
    setState((prev) => ({ ...prev, inviteToken: token }));
  }, []);

  const loadInviteData = useCallback(async (token: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('member_invites')
        .select(
          `
          *,
          band:bands(id, name, logo_url, description),
          inviter:profiles!invited_by(full_name, email)
        `
        )
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        return false;
      }

      setState((prev) => ({
        ...prev,
        inviteToken: token,
        inviteData: data,
        path: 'joiner',
      }));

      return true;
    } catch {
      return false;
    }
  }, []);

  // Checklist
  const dismissChecklist = useCallback(() => {
    setState((prev) => ({ ...prev, checklistDismissed: true }));
    if (user) {
      updateOnboardingProgress(user.id, { checklist_dismissed: true });
    }
  }, [user]);

  // Persistence
  const saveToServer = useCallback(async () => {
    if (!user || !state.path) return;

    await updateOnboardingProgress(user.id, {
      current_step: state.currentStep,
    });
  }, [user, state.path, state.currentStep]);

  const loadFromServer = useCallback(async () => {
    if (!user) return;

    const { data } = await getOnboardingProgress(user.id);
    if (data) {
      setState((prev) => ({
        ...prev,
        path: data.path as OnboardingPath,
        currentStep: data.current_step || 0,
        isComplete: !!data.completed_at,
        checklistDismissed: data.checklist_dismissed || false,
      }));
    }
  }, [user]);

  const value: OnboardingContextType = {
    ...state,
    startOnboarding,
    nextStep,
    prevStep,
    skipStep,
    goToStep,
    completeOnboarding,
    setAccountData,
    setBandData,
    setProfileData,
    addInvite,
    removeInvite,
    addSong,
    removeSong,
    addSongs,
    setInviteToken,
    loadInviteData,
    dismissChecklist,
    getSteps,
    getCurrentStepName,
    getProgress,
    saveToServer,
    loadFromServer,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export default OnboardingContext;
