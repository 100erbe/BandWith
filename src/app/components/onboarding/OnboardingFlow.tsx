import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useOnboarding, OnboardingPath } from '@/lib/OnboardingContext';
import { useAuth } from '@/lib/AuthContext';

// Screens
import WelcomeScreen from './WelcomeScreen';
import AccountCreation from './AccountCreation';
import BandCreation from './BandCreation';
import ProfileSetup from './ProfileSetup';
import InviteMembers from './InviteMembers';
import AddSongs from './AddSongs';
import CompletionScreen from './CompletionScreen';
import JoinerInviteLanding from './JoinerInviteLanding';
import JoinerWelcomeBand from './JoinerWelcomeBand';

interface OnboardingFlowProps {
  onComplete: () => void;
  inviteToken?: string;
}

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
  } = useOnboarding();

  const { isAuthenticated, user } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [isLoading, setIsLoading] = useState(!!inviteToken);

  // Handle invite token on mount
  useEffect(() => {
    if (inviteToken) {
      loadInviteData(inviteToken).then((success) => {
        setIsLoading(false);
        if (success) {
          startOnboarding('joiner');
        }
      });
    }
  }, [inviteToken, loadInviteData, startOnboarding]);

  // Handle path selection
  const handleSelectPath = (selectedPath: OnboardingPath) => {
    startOnboarding(selectedPath);
  };

  // Handle completion
  const handleComplete = async () => {
    await completeOnboarding();
    onComplete();
  };

  // Loading state for invite
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          className="w-16 h-16 border-4 border-[#D4FB46]/20 border-t-[#D4FB46] rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  // Welcome screen (no path selected yet)
  if (!path) {
    return (
      <WelcomeScreen
        onSelectPath={handleSelectPath}
        onSignIn={() => setShowSignIn(true)}
      />
    );
  }

  // Creator flow
  if (path === 'creator') {
    const creatorSteps = [
      // Step 0: Account (if not authenticated)
      !isAuthenticated && (
        <AccountCreation
          key="account"
          onBack={() => goToStep(0)}
          onComplete={nextStep}
        />
      ),
      // Step 1: Band Creation
      <BandCreation key="band" onBack={prevStep} onComplete={nextStep} />,
      // Step 2: Profile Setup
      <ProfileSetup key="profile" onBack={prevStep} onComplete={nextStep} />,
      // Step 3: Invite Members
      <InviteMembers key="invite" onBack={prevStep} onComplete={nextStep} />,
      // Step 4: Add Songs
      <AddSongs key="songs" onBack={prevStep} onComplete={nextStep} />,
      // Step 5: Completion
      <CompletionScreen key="complete" onComplete={handleComplete} />,
    ].filter(Boolean);

    // Adjust step index if already authenticated (skip account step)
    const adjustedStep = isAuthenticated ? currentStep : currentStep;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="min-h-screen"
        >
          {creatorSteps[adjustedStep]}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Joiner flow
  if (path === 'joiner') {
    const joinerSteps = [
      // Step 0: Invite Landing
      <JoinerInviteLanding
        key="invite-landing"
        inviteData={inviteData}
        onAccept={nextStep}
        onDecline={() => {
          // Handle decline - could navigate back or close
        }}
      />,
      // Step 1: Account (if not authenticated)
      !isAuthenticated ? (
        <AccountCreation
          key="account"
          onBack={prevStep}
          onComplete={nextStep}
          prefilledEmail={inviteData?.email}
        />
      ) : null,
      // Step 2: Profile Setup
      <ProfileSetup key="profile" onBack={prevStep} onComplete={nextStep} />,
      // Step 3: Welcome to Band
      <JoinerWelcomeBand
        key="welcome-band"
        inviteData={inviteData}
        onComplete={handleComplete}
      />,
    ].filter(Boolean);

    const adjustedStep = isAuthenticated && currentStep > 0 ? currentStep - 1 : currentStep;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="min-h-screen"
        >
          {joinerSteps[adjustedStep]}
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
};

export default OnboardingFlow;
