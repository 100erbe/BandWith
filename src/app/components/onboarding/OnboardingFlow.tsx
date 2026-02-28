import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useOnboarding, OnboardingPath } from '@/lib/OnboardingContext';
import { useAuth } from '@/lib/AuthContext';

import WelcomeScreen from './WelcomeScreen';
import SignInScreen from './SignInScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import AccountCreation from './AccountCreation';
import BandCreation from './BandCreation';
import ProfileSetup from './ProfileSetup';
import InviteMembers from './InviteMembers';
import AddSongs from './AddSongs';
import CompletionScreen from './CompletionScreen';
import JoinerInviteLanding, { InviteData } from './JoinerInviteLanding';
import JoinerWelcomeBand from './JoinerWelcomeBand';
import JoinerEmailLookup from './JoinerEmailLookup';
import JoinerNoInvites from './JoinerNoInvites';
import JoinerInviteSelect from './JoinerInviteSelect';

interface OnboardingFlowProps {
  onComplete: () => void;
  inviteToken?: string;
}

type JoinerSubStep = 'email-lookup' | 'no-invites' | 'invite-found' | 'select-invite';
type ScreenMode = 'welcome' | 'sign-in' | 'forgot-password' | 'flow';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  inviteToken,
}) => {
  const {
    path,
    currentStep,
    startOnboarding,
    nextStep,
    prevStep,
    goToStep,
    completeOnboarding,
    loadInviteData,
    inviteData,
    resetOnboarding,
  } = useOnboarding();

  const { isAuthenticated, user } = useAuth();

  // Single screen mode state (replaces multiple booleans)
  const [screenMode, setScreenMode] = useState<ScreenMode>(
    path ? 'flow' : 'welcome'
  );

  // Joiner flow state
  const [joinerSubStep, setJoinerSubStep] = useState<JoinerSubStep>('email-lookup');
  const [foundInvites, setFoundInvites] = useState<InviteData[]>([]);
  const [selectedInvite, setSelectedInvite] = useState<InviteData | null>(null);
  const [lookupEmail, setLookupEmail] = useState('');
  const [isLoading, setIsLoading] = useState(!!inviteToken);

  // When user authenticates while on sign-in screen, go back to flow
  useEffect(() => {
    if (isAuthenticated && screenMode === 'sign-in') {
      // User just signed in — go to the flow
      // If they have no path selected, start creator flow automatically
      if (!path) {
        startOnboarding('creator');
      }
      setScreenMode('flow');
    }
  }, [isAuthenticated, screenMode, path, startOnboarding]);

  // Handle invite token on mount
  useEffect(() => {
    if (inviteToken) {
      loadInviteData(inviteToken).then((success) => {
        setIsLoading(false);
        if (success) {
          startOnboarding('joiner');
          setScreenMode('flow');
        }
      });
    }
  }, [inviteToken, loadInviteData, startOnboarding]);

  const handleBackToWelcome = useCallback(() => {
    resetOnboarding();
    setJoinerSubStep('email-lookup');
    setFoundInvites([]);
    setSelectedInvite(null);
    setLookupEmail('');
    setScreenMode('welcome');
  }, [resetOnboarding]);

  const handleSelectPath = useCallback((selectedPath: OnboardingPath) => {
    startOnboarding(selectedPath);
    setScreenMode('flow');
  }, [startOnboarding]);

  const handleComplete = useCallback(async () => {
    await completeOnboarding();
    onComplete();
  }, [completeOnboarding, onComplete]);

  // Loading state for invite
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-black flex items-center justify-center"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <motion.div
          className="w-12 h-12 border-3 border-[#D5FB46]/20 border-t-[#D5FB46] rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  // ─── SCREEN MODE ROUTING ───

  if (screenMode === 'forgot-password') {
    return (
      <ForgotPasswordScreen
        onBack={() => setScreenMode('sign-in')}
      />
    );
  }

  if (screenMode === 'sign-in') {
    return (
      <SignInScreen
        onBack={() => setScreenMode('welcome')}
        onSuccess={() => {
          // Auth state change will be handled by the useEffect above
        }}
        onForgotPassword={() => setScreenMode('forgot-password')}
      />
    );
  }

  if (screenMode === 'welcome' && !path) {
    return (
      <WelcomeScreen
        onSelectPath={handleSelectPath}
        onSignIn={() => setScreenMode('sign-in')}
      />
    );
  }

  // ─── CREATOR FLOW ───

  if (path === 'creator') {
    const renderCreatorStep = () => {
      if (!isAuthenticated) {
        if (currentStep === 0) {
          return (
            <AccountCreation
              key="account"
              onBack={handleBackToWelcome}
              onComplete={nextStep}
            />
          );
        }
        const stepAfterAccount = currentStep - 1;
        switch (stepAfterAccount) {
          case 0: return <BandCreation key="band" onBack={prevStep} onComplete={nextStep} />;
          case 1: return <ProfileSetup key="profile" onBack={prevStep} onComplete={nextStep} />;
          case 2: return <InviteMembers key="invite" onBack={prevStep} onComplete={nextStep} />;
          case 3: return <AddSongs key="songs" onBack={prevStep} onComplete={nextStep} />;
          case 4: return <CompletionScreen key="complete" onComplete={handleComplete} />;
          default: return null;
        }
      } else {
        switch (currentStep) {
          case 0: return <BandCreation key="band" onBack={handleBackToWelcome} onComplete={nextStep} />;
          case 1: return <ProfileSetup key="profile" onBack={prevStep} onComplete={nextStep} />;
          case 2: return <InviteMembers key="invite" onBack={prevStep} onComplete={nextStep} />;
          case 3: return <AddSongs key="songs" onBack={prevStep} onComplete={nextStep} />;
          case 4: return <CompletionScreen key="complete" onComplete={handleComplete} />;
          default: return null;
        }
      }
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`creator-${currentStep}-${isAuthenticated}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="min-h-screen"
        >
          {renderCreatorStep()}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─── JOINER FLOW ───

  if (path === 'joiner') {
    const handleInvitesFound = (invites: InviteData[], email: string) => {
      setFoundInvites(invites);
      setLookupEmail(email);
      if (invites.length === 1) {
        setSelectedInvite(invites[0]);
        setJoinerSubStep('invite-found');
      } else {
        setJoinerSubStep('select-invite');
      }
    };

    const handleNoInvites = (email: string) => {
      setLookupEmail(email);
      setJoinerSubStep('no-invites');
    };

    const handleSelectInvite = (invite: InviteData) => {
      setSelectedInvite(invite);
      setJoinerSubStep('invite-found');
    };

    const handleAcceptInvite = () => {
      nextStep();
    };

    const activeInvite = inviteData || selectedInvite;

    const renderJoinerStep = () => {
      if (currentStep === 0) {
        if (inviteData) {
          return (
            <JoinerInviteLanding
              key="invite-landing-token"
              inviteData={inviteData}
              onAccept={handleAcceptInvite}
              onDecline={handleBackToWelcome}
            />
          );
        }
        switch (joinerSubStep) {
          case 'email-lookup':
            return (
              <JoinerEmailLookup
                key="email-lookup"
                onBack={handleBackToWelcome}
                onInvitesFound={handleInvitesFound}
                onNoInvites={handleNoInvites}
              />
            );
          case 'no-invites':
            return (
              <JoinerNoInvites
                key="no-invites"
                email={lookupEmail}
                onBack={() => setJoinerSubStep('email-lookup')}
                onCreateBand={() => {
                  resetOnboarding();
                  startOnboarding('creator');
                  setScreenMode('flow');
                }}
              />
            );
          case 'select-invite':
            return (
              <JoinerInviteSelect
                key="invite-select"
                invites={foundInvites}
                onBack={() => setJoinerSubStep('email-lookup')}
                onSelect={handleSelectInvite}
              />
            );
          case 'invite-found':
            return (
              <JoinerInviteLanding
                key="invite-landing-found"
                inviteData={selectedInvite}
                onAccept={handleAcceptInvite}
                onDecline={handleBackToWelcome}
                onBack={() => {
                  if (foundInvites.length > 1) {
                    setJoinerSubStep('select-invite');
                  } else {
                    setJoinerSubStep('email-lookup');
                  }
                }}
              />
            );
          default:
            return null;
        }
      }

      if (!isAuthenticated) {
        switch (currentStep) {
          case 1:
            return (
              <AccountCreation
                key="account"
                onBack={prevStep}
                onComplete={nextStep}
                prefilledEmail={activeInvite?.email || lookupEmail}
              />
            );
          case 2:
            return <ProfileSetup key="profile" onBack={prevStep} onComplete={nextStep} />;
          case 3:
            return (
              <JoinerWelcomeBand
                key="welcome-band"
                inviteData={activeInvite}
                onComplete={handleComplete}
              />
            );
          default:
            return null;
        }
      } else {
        switch (currentStep) {
          case 1:
            return <ProfileSetup key="profile" onBack={prevStep} onComplete={nextStep} />;
          case 2:
            return (
              <JoinerWelcomeBand
                key="welcome-band"
                inviteData={activeInvite}
                onComplete={handleComplete}
              />
            );
          default:
            return null;
        }
      }
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`joiner-${currentStep}-${joinerSubStep}-${isAuthenticated}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="min-h-screen"
        >
          {renderJoinerStep()}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Fallback — if path is set but none of the above matched, show welcome
  return (
    <WelcomeScreen
      onSelectPath={handleSelectPath}
      onSignIn={() => setScreenMode('sign-in')}
    />
  );
};

export default OnboardingFlow;
