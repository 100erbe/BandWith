import React, { useState } from 'react';
import { RefreshCw, LogOut, WifiOff } from '@/app/components/icons';
import { AuthScreen, Kicker, PillButton } from '@/app/components/bw/Form';
import { DuoAuthLayout } from './DuoAuthLayout';
import { useT } from '@/lib/i18n';

interface BandsLoadErrorProps {
  onRetry: () => Promise<void> | void;
  onSignOut: () => void;
}

/**
 * Signed in, but the band list could not be loaded (offline, server error,
 * an outdated app). Shown instead of onboarding: "no answer" is not "no
 * bands", and onboarding would offer to start over in solo mode while the
 * user's bands are still there.
 */
export const BandsLoadError: React.FC<BandsLoadErrorProps> = ({ onRetry, onSignOut }) => {
  const t = useT();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <DuoAuthLayout screenKey="bands-load-error">
      <AuthScreen
        top={<span className="bw-label-sm text-muted-foreground">BandWith</span>}
        footer={
          <>
            <PillButton onClick={() => void retry()} loading={retrying} icon={<RefreshCw className="w-5 h-5" />}>
              {t('Try again')}
            </PillButton>
            <PillButton
              variant="ghost"
              size="md"
              className="text-muted-foreground"
              onClick={onSignOut}
              icon={<LogOut className="w-[18px] h-[18px]" />}
            >
              {t('Sign out')}
            </PillButton>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="w-16 h-16 rounded-[20px] bg-accent text-accent-foreground flex items-center justify-center [@media(max-height:520px)]:hidden">
            <WifiOff className="w-8 h-8" strokeWidth={1.75} aria-hidden />
          </div>
          <Kicker title={t('Can’t load your bands')} />
          <p className="bw-body-md text-foreground">
            {t('Your bands and gigs are safe. Check your connection and try again. If it keeps happening, update BandWith to the latest version.')}
          </p>
        </div>
      </AuthScreen>
    </DuoAuthLayout>
  );
};

export default BandsLoadError;
