import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Users, X } from '@/app/components/icons';
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
    getMyPendingInvitations().then((list) => {
      if (cancelled) return;
      const dismissed = readDismissed();
      setInvites(list.filter((i) => !dismissed.includes(i.id)));
    });
    return () => {
      cancelled = true;
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
          className="fixed left-4 right-4 z-[65] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          <div className="flex items-start gap-3">
            {current.bandLogoUrl ? (
              <img
                src={current.bandLogoUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-[14px] font-black text-accent"
              >
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Band invite
              </p>
              <h2 id="pending-invite-title" className="text-[15px] font-bold leading-snug text-foreground">
                {current.inviterName ? `${current.inviterName} invited you to join ` : 'You’re invited to join '}
                {current.bandName}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Users aria-hidden className="h-3.5 w-3.5" />
                {current.memberCount} {current.memberCount === 1 ? 'member' : 'members'} · as{' '}
                {current.role === 'admin' ? 'admin' : 'member'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLater}
              aria-label="Decide later"
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleDecline}
              disabled={!!busy}
              className="h-11 flex-1 rounded-xl border border-border text-[12px] font-bold uppercase tracking-wider text-foreground hover:bg-foreground/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </button>
            <button
              type="button"
              onClick={handleJoin}
              disabled={!!busy}
              aria-busy={busy === 'join'}
              className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-accent text-[12px] font-black uppercase tracking-wider text-accent-foreground disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {busy === 'join' && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
              {busy === 'join' ? 'Joining…' : 'Join band'}
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export default PendingInvitesPrompt;
