import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useBand } from "@/lib/BandContext";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));
const OnboardingFlow = lazy(
  () => import("./components/onboarding/OnboardingFlow")
);

const BlackScreen = () => <div className="min-h-screen bg-black" />;

export default function App() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { bands, loading: bandsLoading, refreshBands } = useBand();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const prevAuthRef = useRef(isAuthenticated);
  const onboardingCompletedRef = useRef(false);

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
    
    // Default logic: show onboarding if no bands exist
    setShowOnboarding(bands.length === 0);
  }, [isAuthenticated, authLoading, bandsLoading, bands.length]);

  // Add an effect to save an empty mock band context array if we bypass onboarding but have no bands
  useEffect(() => {
    if (onboardingCompletedRef.current && bands.length === 0 && !bandsLoading && !authLoading) {
      // It's likely the db insert failed, we should still allow the user to use the UI with a mock band
      console.warn("No bands returned after onboarding. This usually means a DB schema/RLS issue.");
    }
  }, [bands.length, bandsLoading, authLoading]);

  if (authLoading) {
    return <BlackScreen />;
  }

  // If bands are loading but we already know onboarding was completed, 
  // don't block navigation, allow it to render so the mock dashboard shows
  if (isAuthenticated && bandsLoading && !onboardingCompletedRef.current) {
    return <BlackScreen />;
  }

    // Handle manual navigation when user presses onComplete
    const handleNavigationToDashboard = () => {
        console.log("Navigating to dashboard!");
        onboardingCompletedRef.current = true;
        setShowOnboarding(false);
        
        // Fire refreshBands in background to avoid blocking the transition
        refreshBands().catch(e => console.error("Error refreshing bands:", e));
    };

  if (!isAuthenticated && !onboardingCompletedRef.current) {
    if (showOnboarding) {
      return (
        <Suspense fallback={<BlackScreen />}>
          <OnboardingFlow
            onComplete={handleNavigationToDashboard}
          />
        </Suspense>
      );
    }
  }

  if (showOnboarding && !onboardingCompletedRef.current) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <OnboardingFlow
          onComplete={handleNavigationToDashboard}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<BlackScreen />}>
      <AuthenticatedApp />
    </Suspense>
  );
}
