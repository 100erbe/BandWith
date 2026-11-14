import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { useAuth } from '@/lib/AuthContext';
import { InviteError, inviteErrorMessage, previewInvitation } from '@/lib/services/invitations';
import { useT } from '@/lib/i18n';

interface InviteLinkNoticeProps {
  token: string;
  /** The link was handled (or dismissed): forget the token. */
  onDone: () => void;
  /** Sign out keeping the token, so the invite opens for the right account. */
  onSignOut: () => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'other-account'; email: string; band: string }
  | { kind: 'error'; message: string };

/**
 * An invite link opened while signed in. Sent to this account's email: the
 * pending-invite card shows it (asked to reload, even if dismissed earlier).
 * Sent to another address, or no longer valid: say so here, instead of
 * opening the app with nothing happening.
 */
export default function InviteLinkNotice({ token, onDone, onSignOut }: InviteLinkNoticeProps) {
  const t = useT();
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const myEmail = (user?.email || '').toLowerCase();

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    previewInvitation(token)
      .then((invite) => {
        if (!alive) return;
        if ((invite.email || '').toLowerCase() === myEmail) {
          window.dispatchEvent(new Event('bw:refresh-invites'));
          onDoneRef.current();
          return;
        }
        setState({ kind: 'other-account', email: invite.email, band: invite.band.name });
      })
      .catch((e) => {
        if (!alive) return;
        setState({ kind: 'error', message: e instanceof InviteError ? e.message : inviteErrorMessage('network') });
      });
    return () => {
      alive = false;
    };
  }, [token, myEmail]);

  const open = state.kind !== 'loading';

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key="invite-link-notice"
          role="dialog"
          aria-modal="false"
          aria-labelledby="invite-link-title"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="bw-pane-float fixed left-4 right-4 bw-status-clear-inset z-[66] mx-auto max-w-md rounded-[24px] bg-sheet text-sheet-foreground p-5 flex flex-col gap-4"
          style={{ bottom: 'calc(var(--safe-bottom) + 96px)' }}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <p className="bw-label-xs text-sheet-foreground/70">{t('Band invite')}</p>
              <h2 id="invite-link-title" className="bw-h3 [overflow-wrap:anywhere]">
                {state.kind === 'other-account'
                  ? t('This invite is for {email}', { email: state.email })
                  : t('This invite can’t be opened')}
              </h2>
              <p className="bw-body-sm text-sheet-foreground/70 [overflow-wrap:anywhere]">
                {state.kind === 'other-account'
                  ? t('You’re signed in as {account}. To join {band}, sign out and open the invite again with {email}.', {
                      account: user?.email || '',
                      band: state.band,
                      email: state.email,
                    })
                  : state.kind === 'error'
                    ? state.message
                    : null}
              </p>
            </div>
            <IconButton label={t('Close')} variant="ghost" size="sm" icon={<X />} onClick={onDone} className="text-sheet-foreground -mr-1 -mt-1" />
          </div>
          {state.kind === 'other-account' ? (
            <div className="flex gap-2">
              <PillButton variant="outline" size="md" onClick={onDone} className="flex-1 border-sheet-foreground text-sheet-foreground">
                {t('Not now')}
              </PillButton>
              <PillButton size="md" onClick={onSignOut} className="flex-[1.4]">
                {t('Sign out')}
              </PillButton>
            </div>
          ) : (
            <PillButton size="md" onClick={onDone}>
              {t('OK')}
            </PillButton>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
