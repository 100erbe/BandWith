import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Users, X } from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import {
  acceptInvitation,
  declineInvitation,
  getMyPendingInvitations,
  InviteError,
  type PendingInvitation,
} from '@/lib/services/invitations';

interface PendingInvitesPromptProps {
  userId: string | null | undefined;
  /** Called after joining, with the band id (refresh bands, switch to it). */
  onJoined: (bandId: string, bandName: string) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  /** Hide while another full-screen surface is open. */
  hidden?: boolean;
}

const DISMISSED_KEY = 'bw:dismissed_invites';

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable: the card just comes back next launch
  }
}

/**
 * Card shown to signed-in users who have a pending band invitation
 * (invite sent to an email that already has an account).
 */
export function PendingInvitesPrompt({ userId, onJoined, onToast, hidden }: PendingInvitesPromptProps) {
  const [invites, setInvites] = useState<PendingInvitation[]>([]);
  const [busy, setBusy] = useState<'join' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = (includeDismissed: boolean) =>
      getMyPendingInvitations().then((list) => {
        if (cancelled) return;
        const dismissed = includeDismissed ? [] : readDismissed();
        setInvites(list.filter((i) => !dismissed.includes(i.id)));
      });
    load(false);
    // A push about a new invite (or the app coming back) reloads the list;
    // an invite the user just got is shown even if an older one was dismissed.
    const onRefresh = () => load(true);
    const onVisible = () => { if (document.visibilityState === 'visible') load(false); };
    window.addEventListener('bw:refresh-invites', onRefresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('bw:refresh-invites', onRefresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  const current = invites[0];

  const next = () => {
    setError(null);
    setInvites((list) => list.slice(1));
  };

  const handleLater = () => {
    if (!current) return;
    writeDismissed([...readDismissed(), current.id]);
    next();
  };

  const handleJoin = async () => {
    if (!current || busy) return;
    setBusy('join');
    setError(null);
    try {
      const bandId = await acceptInvitation({ invitationId: current.id });
      onToast?.(`You joined ${current.bandName}`, 'success');
      onJoined(bandId, current.bandName);
      next();
    } catch (e) {
      setError(e instanceof InviteError ? e.message : 'We couldn’t join the band. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    if (!current || busy) return;
    setBusy('decline');
    setError(null);
    try {
      await declineInvitation(current.id);
      onToast?.(`Invite from ${current.bandName} declined`, 'info');
      next();
    } catch {
      setError('We couldn’t decline the invite. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const initials = current?.bandName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence>
      {current && !hidden && (
        <motion.section
          key={current.id}
          role="dialog"
          aria-modal="false"
          aria-labelledby="pending-invite-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="bw-pane-float fixed left-4 right-4 bw-status-clear-inset z-[65] mx-auto max-w-md rounded-[24px] bg-sheet text-sheet-foreground p-5 flex flex-col gap-4"
          style={{ bottom: 'calc(var(--safe-bottom) + 96px)' }}
        >
          {/* Figma: Home / Pending band invite (dark card) */}
          <div className="flex items-start gap-3">
            {current.bandLogoUrl ? (
              <img src={current.bandLogoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
            ) : (
              <div
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground bw-h3"
              >
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <p className="bw-label-xs text-sheet-foreground/70">Band invite</p>
              <h2 id="pending-invite-title" className="bw-h3 [overflow-wrap:anywhere]">
                {current.inviterName ? `${current.inviterName} invited you to join ` : 'You’re invited to join '}
                {current.bandName}
              </h2>
              <p className="flex items-center gap-1.5 bw-body-sm text-sheet-foreground/70">
                <Users aria-hidden className="h-4 w-4" />
                {current.memberCount} {current.memberCount === 1 ? 'member' : 'members'} · as{' '}
                {current.role === 'admin' ? 'admin' : 'member'}
              </p>
            </div>
            <IconButton label="Decide later" variant="ghost" size="sm" icon={<X />} onClick={handleLater} className="text-sheet-foreground -mr-1 -mt-1" />
          </div>

          {error && (
            <p role="alert" className="bw-body-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <PillButton
              variant="outline"
              size="md"
              onClick={handleDecline}
              disabled={!!busy}
              className="flex-1 border-sheet-foreground text-sheet-foreground"
            >
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </PillButton>
            <PillButton
              size="md"
              onClick={handleJoin}
              disabled={!!busy}
              aria-busy={busy === 'join'}
              className="flex-[1.4]"
              icon={busy === 'join' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : undefined}
            >
              {busy === 'join' ? 'Joining…' : 'Join band'}
            </PillButton>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export default PendingInvitesPrompt;
