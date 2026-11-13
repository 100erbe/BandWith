import React from 'react';
import { DuoAuthLayout } from '@/app/components/onboarding/DuoAuthLayout';
import { usePushNotifications } from '@/app/hooks/usePushNotifications';
import { useAuth } from '@/lib/AuthContext';
import { DeputyGigsScreen, DeputyHomeFooter } from './DeputyGigsScreen';

/**
 * Home for an account that has no band of its own but plays as a deputy
 * (086): "Deputy gigs", with pushes on, and a way to set up a band. On the
 * open iPhone Duo the brand page sits on the leading page, like sign-in.
 */
const DeputyHome: React.FC<{ onStartBand: () => void; onSignOut: () => void }> = ({ onStartBand, onSignOut }) => {
  const { isAuthenticated } = useAuth();
  const { initialize, isSupported } = usePushNotifications();
  const [focusId, setFocusId] = React.useState<string | null>(null);

  // Requests reach the deputy as pushes: register this device.
  React.useEffect(() => {
    if (isAuthenticated && isSupported) initialize().catch(console.error);
  }, [isAuthenticated, isSupported, initialize]);

  // A push tapped while here: this is already the screen, just refresh.
  React.useEffect(() => {
    const onNavigate = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { requestId?: string } | undefined;
      setFocusId(d?.requestId ?? null);
      window.dispatchEvent(new CustomEvent('bw:refresh-deputy-gigs'));
    };
    window.addEventListener('push-navigate', onNavigate);
    return () => window.removeEventListener('push-navigate', onNavigate);
  }, []);

  return (
    <DuoAuthLayout screenKey="deputy-home">
      <DeputyGigsScreen standalone focusId={focusId} footer={<DeputyHomeFooter onStartBand={onStartBand} onSignOut={onSignOut} />} />
    </DuoAuthLayout>
  );
};

export default DeputyHome;
