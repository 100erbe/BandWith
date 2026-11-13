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
  getOnboardingProgress,
  updateOnboardingProgress,
  createOnboardingProgress,
} from './supabase';
import {
  acceptInvitation,
  InviteError,
  inviteErrorMessage,
  inviteToBand,
  parseInviteCode,
  previewInvitation,
} from './services/invitations';
import type { InviteData } from '@/app/components/onboarding/JoinerInviteLanding';

// Onboarding step definitions
export type OnboardingPath = 'solo' | 'creator' | 'joiner';

export const CREATOR_STEPS = [
  'welcome',
  'account',
  'intent',
  'band',
  'profile',
  'invite',
  'songs',
  'complete',
] as const;

export const SOLO_STEPS = ['account', 'profile', 'complete'] as const;

export const JOINER_STEPS = [
  'invite-landing',
  'account',
  'profile',
  'welcome-band',
] as const;

export type CreatorStep = (typeof CREATOR_STEPS)[number];
export type JoinerStep = (typeof JOINER_STEPS)[number];
export type OnboardingStep = CreatorStep | JoinerStep;

// Instrument options (rendered with <InstrumentIcon instrumentId={id} />)
export const INSTRUMENTS = [
  { id: 'guitar', label: 'Guitar' },
  { id: 'bass', label: 'Bass' },
  { id: 'drums', label: 'Drums' },
  { id: 'vocals', label: 'Vocals' },
  { id: 'keys', label: 'Keys' },
  { id: 'saxophone', label: 'Saxophone' },
  { id: 'trumpet', label: 'Trumpet' },
  { id: 'violin', label: 'Violin' },
  { id: 'dj', label: 'DJ' },
  { id: 'other', label: 'Other...' },
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

  // Invite token / code logic
  /** Token from an invite link / pasted code (preferred way to accept). */
  inviteToken: string | null;
  /** Band preview shown on the invite landing screen. */
  inviteData: InviteData | null;
  /** Invitation picked from the email lookup (accepted by id + email match). */
  pendingInvitationId: string | null;

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
  resetOnboarding: () => void;
  completeOnboarding: () => Promise<void>;

  // Data setters
  setAccountData: (data: OnboardingState['accountData']) => void;
  setBandData: (data: OnboardingState['bandData']) => void;
  setProfileData: (data: OnboardingState['profileData']) => void;
  setPendingInvitationId: (id: string | null) => void;
  /** Validates a pasted invite code or link and loads its band preview. */
  acceptInviteCode: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
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
  pendingInvitationId: null,
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
    if (state.path === 'creator') return CREATOR_STEPS;
    if (state.path === 'solo') return SOLO_STEPS;
    return JOINER_STEPS;
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
      const steps =
        prev.path === 'creator'
          ? CREATOR_STEPS
          : prev.path === 'solo'
          ? SOLO_STEPS
          : JOINER_STEPS;
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

  // Reset to initial state (go back to welcome)
  const resetOnboarding = useCallback(() => {
    setState(initialState);
  }, []);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    const duration = state.startedAt
      ? Math.round((Date.now() - state.startedAt.getTime()) / 1000)
      : 0;

    // ═══════════════════════════════════════════════════════════════
    // 1) Joiner path — accept the invitation on the server
    //    (bw_accept_invitation checks the email and adds the membership;
    //    the client can't insert itself into band_members).
    //    Throws InviteError so the UI can tell the user what went wrong.
    // ═══════════════════════════════════════════════════════════════
    if (state.path === 'joiner' && (state.inviteToken || state.pendingInvitationId)) {
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

      await acceptInvitation(
        state.inviteToken
          ? { token: state.inviteToken }
          : { invitationId: state.pendingInvitationId! }
      );

      await updateOnboardingProgress(user.id, {
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
      });

      setState((prev) => ({ ...prev, isComplete: true }));
      return;
    }

    // Determine whether the user is going solo (no band created) or creating a band
    const isGoingSolo = state.path !== 'creator' || !state.bandData;

    // ═══════════════════════════════════════════════════════════════
    // 2) Update profile — Branching Intent (Solo vs Band Admin)
    // ═══════════════════════════════════════════════════════════════
    if (state.profileData) {
      await supabase
        .from('profiles')
        .update({
          full_name: state.profileData.fullName,
          instrument: state.profileData.instruments?.join(', '),
          phone: state.profileData.phone,
          user_mode: isGoingSolo ? 'solo' : 'band_admin',
          ...(isGoingSolo ? {} : { role: 'admin', sub_tier: 'single_band' }),
        })
        .eq('id', user.id);
    }

    // ═══════════════════════════════════════════════════════════════
    // 3) Solo path — Mark complete and route to personal calendar
    // ═══════════════════════════════════════════════════════════════
    if (isGoingSolo) {
      await updateOnboardingProgress(user.id, {
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
      });

      setState((prev) => ({
        ...prev,
        isComplete: true,
      }));
      return;
    }

    // ── From here on we know the user wants to create a band ──

    // ═══════════════════════════════════════════════════════════════
    // 4) Free Trial & Subscription Gate
    // ═══════════════════════════════════════════════════════════════
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_mode, sub_tier')
      .eq('id', user.id)
      .single();

    let subTier = profileData?.sub_tier;

    // Ensure first-time band creators get at least the free 'single_band' Indie Act tier
    if (!subTier || subTier === 'free_member') {
      const { error: tierErr } = await supabase
        .from('profiles')
        .update({ sub_tier: 'single_band', user_mode: 'band_admin', role: 'admin' })
        .eq('id', user.id);
      if (!tierErr) {
        subTier = 'single_band';
      }
    }

    const canCreateBands =
      subTier === 'single_band' ||
      subTier === 'multi_band' ||
      subTier === 'unlimited';

    if (!canCreateBands) {
      console.warn(
        'P0001 GUARD: User lacks active trial or plan. Deferring band creation until after payment.',
      );

      await supabase
        .from('onboarding_progress')
        .upsert(
          {
            user_id: user.id,
            pending_band_name: state.bandData!.name,
            pending_band_avatar: state.bandData!.avatarUrl,
            current_step: state.currentStep,
            path: state.path,
          },
          { onConflict: 'user_id' },
        );

      await updateOnboardingProgress(user.id, {
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
      });

      setState((prev) => ({ ...prev, isComplete: true }));
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    // 5) Create band (User is validated)
    // ═══════════════════════════════════════════════════════════════
    const slug = state.bandData!.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const { data: band, error: bandError } = await supabase
      .from('bands')
      .insert({
        name: state.bandData!.name,
        logo_url: state.bandData!.avatarUrl,
        created_by: user.id,
        slug: `${slug}-${Date.now().toString(36)}`,
      })
      .select('id, name, slug, created_by')
      .single();

    if (bandError) {
      console.error('CRITICAL: Band Creation Failed:', bandError);
      return;
    }

    if (band) {
      const { error: memberError } = await supabase
        .from('band_members')
        .upsert(
          {
            band_id: band.id,
            user_id: user.id,
            role: 'admin',
            instrument: state.profileData?.instruments?.join(', '),
          },
          { onConflict: 'band_id,user_id' },
        );

      if (memberError) console.error('Member Upsert Error:', memberError);

      // Invitations go through the invite-member edge function (admin check,
      // band_invitations row, email with the invite link for new users).
      for (const invite of state.invites) {
        try {
          await inviteToBand({
            bandId: band.id,
            email: invite.email,
            role: invite.permission === 'admin' ? 'admin' : 'member',
            inviterName: state.profileData?.fullName,
          });
        } catch (inviteError) {
          console.error('Failed to send invitation to', invite.email, inviteError);
        }
      }

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

  const setPendingInvitationId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, pendingInvitationId: id }));
  }, []);

  // Validate a pasted invite code / link and load the band preview.
  // Joining happens at the end of the joiner flow (completeOnboarding).
  const acceptInviteCode = useCallback(
    async (code: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const token = parseInviteCode(code);
      if (!token) return { ok: false, error: inviteErrorMessage('invalid_code') };
      try {
        const data = await previewInvitation(token);
        setState((prev) => ({
          ...prev,
          inviteToken: token,
          inviteData: data,
          pendingInvitationId: null,
        }));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof InviteError ? err.message : inviteErrorMessage('network'),
        };
      }
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
    const parsed = parseInviteCode(token);
    if (!parsed) return false;
    try {
      const data = await previewInvitation(parsed);
      setState((prev) => ({
        ...prev,
        inviteToken: parsed,
        inviteData: data,
        pendingInvitationId: null,
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
    resetOnboarding,
    completeOnboarding,
    setAccountData,
    setBandData,
    setProfileData,
    setPendingInvitationId,
    acceptInviteCode,
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