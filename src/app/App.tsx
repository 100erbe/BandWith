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

  useEffect(() => {
    if (authLoading || bandsLoading) return;
    setShowOnboarding(!isAuthenticated || bands.length === 0);
  }, [isAuthenticated, authLoading, bandsLoading, bands.length]);

  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      setShowOnboarding(true);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  if (authLoading || (isAuthenticated && bandsLoading)) {
    return <BlackScreen />;
  }

  if (showOnboarding || !isAuthenticated) {
    return (
      <Suspense fallback={<BlackScreen />}>
        <OnboardingFlow
          onComplete={async () => {
            await refreshBands();
            setShowOnboarding(false);
          }}
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
