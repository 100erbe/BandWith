import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useBand } from "@/lib/BandContext";
import AuthCallback from "./auth/callback";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));
const OnboardingFlow = lazy(
  () => import("./components/onboarding/OnboardingFlow")
);

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
  const { isAuthenticated, loading: authLoading, userMode, profile } = useAuth();
  const { bands, loading: bandsLoading, refreshBands } = useBand();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const prevAuthRef = useRef(isAuthenticated);
  const onboardingCompletedRef = useRef(false);

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
    
    // PLG: If user is in solo mode, skip onboarding entirely
    if (userMode === 'solo' || profile?.user_mode === 'solo') {
      onboardingCompletedRef.current = true;
      setShowOnboarding(false);
      return;
    }

    // Default logic: show onboarding if no bands exist
    setShowOnboarding(bands.length === 0);
  }, [isAuthenticated, authLoading, bandsLoading, bands.length, userMode, profile?.user_mode]);

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

  if (authLoading) {
    return <BlackScreen />;
  }

  // If bands are loading but we already know onboarding was completed, 
  // don't block navigation, allow it to render so the dashboard shows
  if (isAuthenticated && bandsLoading && !onboardingCompletedRef.current) {
    return <BlackScreen />;
  }

  // Show onboarding for unauthenticated users or existing users who haven't completed
  if ((!isAuthenticated || showOnboarding) && !onboardingCompletedRef.current) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <OnboardingFlow
          onComplete={handleNavigationToDashboard}
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
