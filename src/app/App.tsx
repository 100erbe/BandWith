import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useBand } from "@/lib/BandContext";
import AuthCallback from "./auth/callback";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { inviteTokenFromUrl } from "@/lib/services/invitations";
import { useOnboarding } from "@/lib/OnboardingContext";
import {
  claimPendingDeputyToken,
  deputyTokenFromUrl,
  pendingDeputyToken,
  savePendingDeputyToken,
  useDeputyClaim,
} from "@/lib/deputyClaim";
import { listMyDeputyGigs } from "@/lib/services/deputies";
import { supabase } from "@/lib/supabase";
import { appLockSupported, markUnlocked, shouldLockOnLaunch } from "@/lib/appLock";
import { useServerLocaleSync } from "@/lib/i18n/serverLocale";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));
const SetNewPasswordScreen = lazy(
  () => import("./components/onboarding/SetNewPasswordScreen")
);
const OnboardingFlow = lazy(
  () => import("./components/onboarding/OnboardingFlow")
);
const DeputyHome = lazy(() => import("./components/deputy/DeputyHome"));
const AppLockScreen = lazy(() => import("./components/onboarding/AppLockScreen"));
const BandsLoadError = lazy(() => import("./components/onboarding/BandsLoadError"));

// Remembers that this account has deputy gigs and no band, so the next
// launch opens "Deputy gigs" straight away (checked again in the background).
const deputyHomeKey = (userId: string) => `bw_deputy_home:${userId}`;
const readDeputyHome = (userId?: string): boolean => {
  if (!userId) return false;
  try {
    return localStorage.getItem(deputyHomeKey(userId)) === "1";
  } catch {
    return false;
  }
};
const writeDeputyHome = (userId: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(deputyHomeKey(userId), "1");
    else localStorage.removeItem(deputyHomeKey(userId));
  } catch {
    /* ignore */
  }
};

const BlackScreen = () => <div className="min-h-screen bg-background" />;

// Detect whether the current URL is an OAuth callback
// (contains a hash fragment with access_token or an auth code param)
const isAuthCallback = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  const path = window.location.pathname;
  // Supabase implicit flow uses URL hash: #access_token=xxx
  if (hash && (hash.includes('access_token=') || hash.includes('type=recovery') || hash.includes('type=signup'))) return true;
  // PKCE flow uses query params: ?code=xxx
  if (search && search.includes('code=')) return true;
  // Also check if we're exactly on the /auth/callback path (sometimes used as entry point)
  if (path.endsWith('/auth/callback')) return true;
  return false;
};

export default function App() {
  const { isAuthenticated, loading: authLoading, userMode, profile, isPasswordRecovery, user, signOut } = useAuth();
  // The server writes some pushes (deputies) in the language of the app.
  useServerLocaleSync(isAuthenticated && !isPasswordRecovery ? user?.id : null, profile?.preferred_language);
  const { startOnboarding, goToStep } = useOnboarding();
  const deputyClaim = useDeputyClaim();
  const { bands, loading: bandsLoading, refreshBands, error: bandsError } = useBand();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const prevAuthRef = useRef(isAuthenticated);

  // App lock (src/lib/appLock.ts): decided once, when the session saved at
  // launch is known. A sign-in later in this run never locks.
  const [lock, setLock] = useState<'checking' | 'locked' | 'open'>(() => (appLockSupported() ? 'checking' : 'open'));
  useEffect(() => {
    if (lock !== 'checking' || authLoading) return;
    if (isAuthenticated && shouldLockOnLaunch(true)) {
      setLock('locked');
    } else {
      markUnlocked();
      setLock('open');
    }
  }, [lock, authLoading, isAuthenticated]);
  // Signed out from the lock screen: the next sign-in opens the app.
  useEffect(() => {
    if (lock === 'locked' && !authLoading && !isAuthenticated) {
      markUnlocked();
      setLock('open');
    }
  }, [lock, authLoading, isAuthenticated]);
  const handleUnlock = useCallback(() => {
    markUnlocked();
    setLock('open');
  }, []);
  const onboardingCompletedRef = useRef(false);

  // Invite link: web `/?invite=<token>`, native deep link `…://invite?invite=<token>`.
  const [inviteToken, setInviteToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : inviteTokenFromUrl(window.location.href)
  );

  useEffect(() => {
    // Drop the token from the address bar so a refresh doesn't re-open the invite.
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    // Deputy reply page → "Get BandWith": keep the token until signed in.
    const deputyToken = deputyTokenFromUrl(url.href);
    if (deputyToken) savePendingDeputyToken(deputyToken);
    if (url.searchParams.has('invite') || url.searchParams.has('deputy')) {
      url.searchParams.delete('invite');
      url.searchParams.delete('deputy');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      const token = inviteTokenFromUrl(url);
      if (token) setInviteToken(token);
      const deputyToken = deputyTokenFromUrl(url);
      if (deputyToken) savePendingDeputyToken(deputyToken);
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, []);

  // Deputy link: link the account as soon as the user is signed in.
  useEffect(() => {
    if (!isAuthenticated || authLoading || isPasswordRecovery) return;
    if (pendingDeputyToken()) void claimPendingDeputyToken();
  }, [isAuthenticated, authLoading, isPasswordRecovery, deputyClaim.pending]);

  // Before signing in: which band sent the link, for the welcome screen.
  const [deputyBand, setDeputyBand] = useState<string | null>(null);
  useEffect(() => {
    const token = pendingDeputyToken();
    if (isAuthenticated || authLoading || !token) return;
    let alive = true;
    void supabase.rpc('bw_deputy_request_view', { p_token: token }).then(({ data }) => {
      const band = (data as { band_name?: string } | null)?.band_name;
      if (alive && band) setDeputyBand(band);
    });
    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading, deputyClaim.pending]);

  // An account with no band of its own but with deputy gigs lands on
  // "Deputy gigs" instead of the band set-up (it can still start one).
  const isSolo = userMode === 'solo' || profile?.user_mode === 'solo';
  const [deputyHome, setDeputyHome] = useState<boolean>(() => readDeputyHome(user?.id));
  const [skipDeputyHome, setSkipDeputyHome] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || authLoading || bandsLoading || !user?.id) return;
    if (bands.length > 0 || isSolo) {
      writeDeputyHome(user.id, false);
      setDeputyHome(false);
      return;
    }
    setDeputyHome(readDeputyHome(user.id));
    let alive = true;
    void listMyDeputyGigs().then(({ data, error }) => {
      if (!alive || error) return;
      const on = data.bands.length > 0;
      writeDeputyHome(user.id, on);
      setDeputyHome(on);
    });
    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading, bandsLoading, bands.length, isSolo, user?.id, deputyClaim.result]);

  // Handle manual navigation when user presses onComplete in the onboarding flow.
  // Defined early with useCallback to be stable across renders and available before any early return.
  const handleNavigationToDashboard = useCallback(() => {
    console.log("Navigating to dashboard!");
    onboardingCompletedRef.current = true;
    setShowOnboarding(false);

    // Fire refreshBands in background to avoid blocking the transition
    refreshBands().catch(e => console.error("Error refreshing bands:", e));
  }, [refreshBands]);

  useEffect(() => {
    // If user is NOT authenticated, ALWAYS show onboarding/sign-in
    // and reset the completion flag
    if (!isAuthenticated && !authLoading) {
      onboardingCompletedRef.current = false;
      setShowOnboarding(true);
      return;
    }

    // If onboarding was completed during this session, NEVER show it again 
    if (onboardingCompletedRef.current) {
      setShowOnboarding(false);
      return;
    }
    
    if (authLoading || bandsLoading) return;

    // The band list couldn't be loaded: that is not "no bands" (render shows a retry screen).
    if (bandsError && bands.length === 0) return;
    
    // PLG: If user is in solo mode, skip onboarding entirely
    if (userMode === 'solo' || profile?.user_mode === 'solo') {
      onboardingCompletedRef.current = true;
      setShowOnboarding(false);
      return;
    }

    // Default logic: show onboarding if no bands exist
    setShowOnboarding(bands.length === 0);
  }, [isAuthenticated, authLoading, bandsLoading, bands.length, bandsError, userMode, profile?.user_mode]);

  // Add an effect to warn if we bypass onboarding but have no bands
  useEffect(() => {
    if (onboardingCompletedRef.current && bands.length === 0 && !bandsLoading && !authLoading) {
      console.warn("No bands returned after onboarding. This usually means a DB schema/RLS issue.");
    }
  }, [bands.length, bandsLoading, authLoading]);

  // If the URL indicates an OAuth callback, render the callback page
  // which extracts the session from the URL and redirects to the app root
  if (isAuthCallback()) {
    return <AuthCallback />;
  }

  if (authLoading || lock === 'checking') {
    return <BlackScreen />;
  }

  // Cold start with a saved session: prove it's the owner before anything shows.
  if (lock === 'locked' && isAuthenticated) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <AppLockScreen onUnlock={handleUnlock} />
      </Suspense>
    );
  }

  // Opened a password-reset link: ask for the new password before anything else.
  if (isAuthenticated && isPasswordRecovery) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <SetNewPasswordScreen />
      </Suspense>
    );
  }

  // If bands are loading but we already know onboarding was completed, 
  // don't block navigation, allow it to render so the dashboard shows
  if (isAuthenticated && bandsLoading && !onboardingCompletedRef.current) {
    return <BlackScreen />;
  }

  // Signed in but the band list didn't load: never send the user into
  // onboarding (it would offer solo mode and hide the bands they have).
  if (
    isAuthenticated &&
    !bandsLoading &&
    bands.length === 0 &&
    bandsError &&
    !isSolo &&
    !onboardingCompletedRef.current
  ) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <BandsLoadError onRetry={refreshBands} onSignOut={() => void signOut()} />
      </Suspense>
    );
  }

  // A deputy without a band: their gigs (with the claim's result), and a way to a band.
  if (
    isAuthenticated &&
    !bandsLoading &&
    bands.length === 0 &&
    !isSolo &&
    !skipDeputyHome &&
    !onboardingCompletedRef.current &&
    (deputyHome || deputyClaim.pending || !!deputyClaim.result)
  ) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <DeputyHome
          onStartBand={() => {
            deputyClaim.dismiss();
            startOnboarding('creator');
            goToStep(1);
            setSkipDeputyHome(true);
          }}
          onSignOut={() => {
            deputyClaim.dismiss();
            void signOut();
          }}
        />
      </Suspense>
    );
  }

  // Show onboarding for unauthenticated users or existing users who haven't completed
  if ((!isAuthenticated || showOnboarding) && !onboardingCompletedRef.current) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <OnboardingFlow
          onComplete={handleNavigationToDashboard}
          inviteToken={inviteToken ?? undefined}
          deputyBand={!isAuthenticated ? deputyBand : null}
        />
      </Suspense>
    );
  }

  // Default: show the main authenticated app
  return (
    <Suspense fallback={<BlackScreen />}>
      <AuthenticatedApp />
    </Suspense>
  );
}
