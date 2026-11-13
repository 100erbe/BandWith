import React from 'react';
import { BackButton, PillButton } from '@/app/components/bw/Form';
import { useT } from '@/lib/i18n';
import { useDeputyClaim } from '@/lib/deputyClaim';
import { listMyDeputyGigs, type DeputyClaimResult, type DeputyGig, type MyDeputyGigs } from '@/lib/services/deputies';
import { DeputyGigsList } from './DeputyGigsList';

/** What the claim did, in a sentence (null while nothing to say). */
export function deputyClaimMessage(r: DeputyClaimResult | null, t: (s: string, v?: Record<string, string>) => string) {
  if (!r) return null;
  const band = r.band_name || t('the band');
  switch (r.status) {
    case 'linked':
      return { tone: 'ok' as const, title: t("You're on {band}'s deputy list", { band }), body: t('From now on {band} can ask you in the app: you get a notification and answer here.', { band }) };
    case 'already':
      return { tone: 'ok' as const, title: t("You're on {band}'s deputy list", { band }), body: t('Your gigs with {band} are below.', { band }) };
    case 'taken':
      return { tone: 'warn' as const, title: t('This link belongs to another account'), body: t('{band} linked it to someone else. Ask them to send you a new request.', { band }) };
    case 'member':
      return { tone: 'warn' as const, title: t("You're already in {band}", { band }), body: t('This is a deputy link: send it to the deputy instead.') };
    default:
      return { tone: 'warn' as const, title: t("This link doesn't work."), body: t('Ask the band to send you the request again.') };
  }
}

/** Loads the deputy's gigs and keeps them fresh (back to the app, a push). */
export function useMyDeputyGigs(enabled = true) {
  const [data, setData] = React.useState<MyDeputyGigs | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(async () => {
    const { data: d, error: e } = await listMyDeputyGigs();
    if (e) setError(true);
    else {
      setError(false);
      setData(d);
    }
  }, []);
  React.useEffect(() => {
    if (!enabled) return;
    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const onRefresh = () => void load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('bw:refresh-deputy-gigs', onRefresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('bw:refresh-deputy-gigs', onRefresh);
    };
  }, [enabled, load]);
  const update = React.useCallback((g: DeputyGig) => {
    setData((d) => (d ? { ...d, gigs: d.gigs.map((x) => (x.id === g.id ? g : x)) } : d));
  }, []);
  return { data, error, reload: load, update };
}

/**
 * "Deputy gigs": the requests bands sent this account as a deputy, answered
 * in the app. Inside the app it opens over the screen (`onClose`); for an
 * account with no band of its own it is the home screen (`standalone`).
 */
export const DeputyGigsScreen: React.FC<{
  onClose?: () => void;
  standalone?: boolean;
  focusId?: string | null;
  /** Standalone: the way to a band of one's own, and out. */
  footer?: React.ReactNode;
}> = ({ onClose, standalone = false, focusId, footer }) => {
  const t = useT();
  const { result, pending, dismiss } = useDeputyClaim();
  const { data, error, reload, update } = useMyDeputyGigs(true);

  // A claim that just finished: show its gigs.
  const lastClaim = React.useRef(result);
  React.useEffect(() => {
    if (result && result !== lastClaim.current) void reload();
    lastClaim.current = result;
  }, [result, reload]);

  const message = deputyClaimMessage(result, t);
  const bands = data?.bands.map((b) => b.band_name) ?? [];

  const body = (
    <div className="flex flex-col gap-5 px-4 pt-2 max-w-[960px] w-full mx-auto" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
      {pending && !result && (
        <p className="bw-body-md text-muted-foreground" role="status">
          {t('Linking your account to the band…')}
        </p>
      )}
      {message && (
        <section
          role="status"
          className={
            message.tone === 'ok'
              ? 'rounded-[24px] bg-accent text-accent-foreground p-5 flex flex-col gap-2'
              : 'rounded-[24px] bg-surface-inverse text-surface-inverse-foreground p-5 flex flex-col gap-2'
          }
        >
          <p className="bw-h2 [overflow-wrap:anywhere]">{message.title}</p>
          <p className="bw-body-md opacity-90">{message.body}</p>
          <button type="button" className="bw-label-sm underline underline-offset-2 min-h-[32px] self-start" onClick={dismiss}>
            {t('OK')}
          </button>
        </section>
      )}
      {bands.length > 0 && (
        <p className="bw-body-md text-muted-foreground">
          {t('Bands that call you as a deputy: {bands}', { bands: bands.join(', ') })}
        </p>
      )}
      <DeputyGigsList gigs={data?.gigs ?? null} onChanged={update} focusId={focusId} error={error && !data} onRetry={() => void reload()} />
      {footer}
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="px-4 flex flex-col gap-1" style={{ paddingTop: 'calc(var(--safe-top) + 24px)' }}>
          <p className="bw-label-sm text-muted-foreground">BandWith</p>
          <h1 className="bw-display-lg">{t('Deputy gigs')}</h1>
        </header>
        <div className="pt-4">{body}</div>
      </div>
    );
  }

  return (
    <div
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto overflow-x-hidden"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Deputy gigs')}
    >
      <header className="sticky top-0 z-30 bg-background px-4" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="h-14 flex items-center gap-3">
          {onClose && <BackButton onClick={onClose} />}
          <h1 className="bw-h2 flex-1 min-w-0 truncate">{t('Deputy gigs')}</h1>
        </div>
      </header>
      {body}
    </div>
  );
};

/** The standalone screen's way out: a band of one's own, or sign out. */
export const DeputyHomeFooter: React.FC<{ onStartBand: () => void; onSignOut: () => void }> = ({ onStartBand, onSignOut }) => {
  const t = useT();
  return (
    <section className="rounded-[24px] bg-foreground/[0.05] p-5 flex flex-col gap-3" aria-label={t('Your own band')}>
      <p className="bw-label-md">{t('Playing in a band too?')}</p>
      <p className="bw-body-sm text-muted-foreground">{t('Create your band or join one with an invite: your deputy gigs stay here, in the menu.')}</p>
      <div className="flex flex-wrap gap-2">
        <PillButton size="md" variant="dark" fullWidth={false} onClick={onStartBand}>
          {t('Set up your band')}
        </PillButton>
        <PillButton size="md" variant="ghost" fullWidth={false} onClick={onSignOut}>
          {t('Sign out')}
        </PillButton>
      </div>
    </section>
  );
};
