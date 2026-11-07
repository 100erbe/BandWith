import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useOnboarding, OnboardingPath } from '@/lib/OnboardingContext';
import { useAuth } from '@/lib/AuthContext';

import WelcomeScreen from './WelcomeScreen';
import SignInScreen from './SignInScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import AccountCreation from './AccountCreation';
import IntentSelector from './IntentSelector';
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
    goToStep,
    completeOnboarding,
    acceptInviteCode,
    loadInviteData,
    inviteData,
    resetOnboarding,
  } = useOnboarding();

  const { isAuthenticated } = useAuth();

  // Screen mode state
  const [screenMode, setScreenMode] = useState<ScreenMode>(
    path ? 'flow' : 'welcome'
  );

  // Joiner flow state
  const [joinerSubStep, setJoinerSubStep] = useState<JoinerSubStep>('email-lookup');
  const [foundInvites, setFoundInvites] = useState<InviteData[]>([]);
  const [selectedInvite, setSelectedInvite] = useState<InviteData | null>(null);
  const [lookupEmail, setLookupEmail] = useState('');
  const [isLoading, setIsLoading] = useState(!!inviteToken);

  // Modal and back handling refs
  const closeInviteInputRef = useRef<(() => boolean) | null>(null);
  const closeAddSongsModalRef = useRef<(() => boolean) | null>(null);
  const lastBackPressRef = useRef<number>(0);
  const [exitToast, setExitToast] = useState<string | null>(null);

  // Keep a snapshot of navigation state for the hardware back button handler
  const backNavStateRef = useRef({
    screenMode,
    path,
    currentStep,
    joinerSubStep,
    foundInvites,
    selectedInvite,
    inviteData,
    isAuthenticated,
  });

  useEffect(() => {
    backNavStateRef.current = {
      screenMode,
      path,
      currentStep,
      joinerSubStep,
      foundInvites,
      selectedInvite,
      inviteData,
      isAuthenticated,
    };
  });

  // When user authenticates while on sign-in screen, go back to flow
  useEffect(() => {
    if (isAuthenticated && screenMode === 'sign-in') {
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

  const handleComplete = useCallback(async () => {
    try {
      await completeOnboarding();
    } catch (e) {
      console.error('Onboarding complete error:', e);
    }
    onComplete();
  }, [completeOnboarding, onComplete]);

  // Unified Back Navigation Handler (used by Android soft key, Escape key, and back buttons)
  const handleBack = useCallback(() => {
    // 1. If child modal is open (e.g., custom song or import modal in AddSongs)
    if (closeAddSongsModalRef.current && closeAddSongsModalRef.current()) {
      return;
    }

    const s = backNavStateRef.current;

    // 2. Screen modes: forgot-password -> sign-in
    if (s.screenMode === 'forgot-password') {
      setScreenMode('sign-in');
      return;
    }

    // 3. Screen modes: sign-in -> welcome
    if (s.screenMode === 'sign-in') {
      setScreenMode('welcome');
      return;
    }

    // 4. Welcome screen (root screen)
    if (s.screenMode === 'welcome' && !s.path) {
      // If inline invite input is open, close it first
      if (closeInviteInputRef.current && closeInviteInputRef.current()) {
        return;
      }
      // Double tap to exit on Android
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        App.exitApp();
      } else {
        lastBackPressRef.current = now;
        setExitToast('Tap again to exit');
        setTimeout(() => setExitToast(null), 2000);
      }
      return;
    }

    // 5. Flow navigation: CREATOR PATH
    if (s.path === 'creator') {
      // Step 0: Account creation (if not authenticated)
      // Step 1: Intent selector
      if (!s.isAuthenticated || s.currentStep <= 1) {
        handleBackToWelcome();
        return;
      }
      // Step 2: Band creation -> back to Intent selector (step 1)
      if (s.currentStep === 2) {
        goToStep(1);
        return;
      }
      // Step 3: Profile setup -> back to Band creation (step 2)
      if (s.currentStep === 3) {
        goToStep(2);
        return;
      }
      // Step 4: Invite members -> back to Profile setup (step 3)
      if (s.currentStep === 4) {
        goToStep(3);
        return;
      }
      // Step 5: Add songs -> back to Invite members (step 4)
      if (s.currentStep === 5) {
        goToStep(4);
        return;
      }
      // Step 6: Completion screen -> back to Add songs (step 5)
      if (s.currentStep === 6) {
        goToStep(5);
        return;
      }
    }

    // 6. Flow navigation: SOLO PATH
    if (s.path === 'solo') {
      // Step 1: Profile setup -> return to Intent selector in creator path
      if (s.currentStep <= 1) {
        startOnboarding('creator');
        goToStep(1);
        return;
      }
      // Step 2: Completion -> back to Profile setup (step 1)
      if (s.currentStep === 2) {
        goToStep(1);
        return;
      }
    }

    // 7. Flow navigation: JOINER PATH
    if (s.path === 'joiner') {
      if (s.currentStep === 0) {
        if (s.inviteData) {
          handleBackToWelcome();
          return;
        }
        if (s.joinerSubStep === 'invite-found') {
          if (s.foundInvites.length > 1) {
            setJoinerSubStep('select-invite');
          } else {
            setJoinerSubStep('email-lookup');
          }
          return;
        }
        if (s.joinerSubStep === 'select-invite' || s.joinerSubStep === 'no-invites') {
          setJoinerSubStep('email-lookup');
          return;
        }
        if (s.joinerSubStep === 'email-lookup') {
          handleBackToWelcome();
          return;
        }
      }
      // Step 1 or higher in joiner -> back to step 0 (invite landing / lookup)
      if (s.currentStep >= 1) {
        goToStep(0);
        return;
      }
    }

    // Fallback: return to welcome screen
    handleBackToWelcome();
  }, [handleBackToWelcome, goToStep, startOnboarding]);

  // Register Capacitor hardware/soft-key back button listener + Escape key for web
  useEffect(() => {
    let removeListener: (() => void) | undefined;

    try {
      const handlerPromise = App.addListener('backButton', () => {
        handleBack();
      });
      handlerPromise.then((h) => {
        removeListener = () => h.remove();
      });
    } catch {
      // Non-native environment
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (removeListener) removeListener();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleBack]);

  // Loading state for invite
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <motion.div
          className="w-12 h-12 border-3 border-accent/20 border-t-accent rounded-full"
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
      <>
        <WelcomeScreen
          onGetStarted={() => {
            startOnboarding('creator');
            setScreenMode('flow');
          }}
          onSignIn={() => setScreenMode('sign-in')}
          onInviteCodeSubmit={(code) => {
            acceptInviteCode(code).then((valid) => {
              if (valid) {
                startOnboarding('creator');
                setScreenMode('flow');
              }
            });
          }}
          inviteCodeLoading={false}
          inviteCodeError={null}
          closeInviteInputRef={closeInviteInputRef}
        />
        <AnimatePresence>
          {exitToast && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[250] px-4 py-2 rounded-full text-xs font-semibold text-white/95 bg-black/65 dark:bg-zinc-900/75 backdrop-blur-md border border-white/10 shadow-lg text-center whitespace-nowrap pointer-events-none select-none max-w-[85vw]"
            >
              {exitToast}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ─── CREATOR FLOW ───

  if (path === 'creator') {
    const renderCreatorStep = () => {
      // Step 0: Not yet authenticated -> show account creation
      if (!isAuthenticated) {
        return (
          <AccountCreation
            key="account"
            onBack={handleBackToWelcome}
            onComplete={() => goToStep(1)}
          />
        );
      }

      // Step 0 or 1: Authenticated intent selector
      if (currentStep <= 1) {
        return (
          <IntentSelector
            key="intent"
            onSelectSolo={() => {
              startOnboarding('solo');
              goToStep(1);
            }}
            onSelectBand={() => goToStep(2)}
            onBack={handleBackToWelcome}
          />
        );
      }

      switch (currentStep) {
        case 2:
          return <BandCreation key="band" onBack={() => goToStep(1)} onComplete={() => goToStep(3)} />;
        case 3:
          return <ProfileSetup key="profile" onBack={() => goToStep(2)} onComplete={() => goToStep(4)} />;
        case 4:
          return <InviteMembers key="invite" onBack={() => goToStep(3)} onComplete={() => goToStep(5)} />;
        case 5:
          return (
            <AddSongs
              key="songs"
              onBack={() => goToStep(4)}
              onComplete={() => goToStep(6)}
              closeModalRef={closeAddSongsModalRef}
            />
          );
        case 6:
          return <CompletionScreen key="complete" onComplete={handleComplete} />;
        default:
          return null;
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

  // ─── SOLO FLOW ───

  if (path === 'solo') {
    const renderSoloStep = () => {
      if (!isAuthenticated) {
        return (
          <AccountCreation
            key="solo-account"
            onBack={handleBackToWelcome}
            onComplete={() => goToStep(1)}
          />
        );
      }

      // Step 1: Profile setup for solo artist
      if (currentStep <= 1) {
        return (
          <ProfileSetup
            key="solo-profile"
            onBack={() => {
              startOnboarding('creator');
              goToStep(1);
            }}
            onComplete={() => goToStep(2)}
          />
        );
      }

      // Step 2: Completion
      return <CompletionScreen key="solo-complete" onComplete={handleComplete} />;
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`solo-${currentStep}-${isAuthenticated}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="min-h-screen"
        >
          {renderSoloStep()}
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
      goToStep(1);
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
              onBack={handleBackToWelcome}
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

      // Step 1: Account creation if not yet authenticated
      if (!isAuthenticated) {
        return (
          <AccountCreation
            key="joiner-account"
            onBack={() => goToStep(0)}
            onComplete={() => goToStep(2)}
            prefilledEmail={activeInvite?.email || lookupEmail}
          />
        );
      }

      // Step 1 or 2: Profile setup
      if (currentStep === 1 || currentStep === 2) {
        return (
          <ProfileSetup
            key="joiner-profile"
            onBack={() => goToStep(0)}
            onComplete={() => goToStep(3)}
          />
        );
      }

      // Step 3: Welcome to band
      return (
        <JoinerWelcomeBand
          key="welcome-band"
          inviteData={activeInvite}
          onComplete={handleComplete}
        />
      );
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

  // Fallback: Welcome screen
  return (
    <>
      <WelcomeScreen
        onGetStarted={() => {
          startOnboarding('creator');
          setScreenMode('flow');
        }}
        onSignIn={() => setScreenMode('sign-in')}
        onInviteCodeSubmit={(code) => {
          acceptInviteCode(code).then((valid) => {
            if (valid) {
              startOnboarding('creator');
              setScreenMode('flow');
            }
          });
        }}
        inviteCodeLoading={false}
        inviteCodeError={null}
        closeInviteInputRef={closeInviteInputRef}
      />
      <AnimatePresence>
        {exitToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[250] px-4 py-2 rounded-full text-xs font-semibold text-white/95 bg-black/65 dark:bg-zinc-900/75 backdrop-blur-md border border-white/10 shadow-lg text-center whitespace-nowrap pointer-events-none select-none max-w-[85vw]"
          >
            {exitToast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OnboardingFlow;
