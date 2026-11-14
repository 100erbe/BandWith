import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Link, Loader2, X } from '@/app/components/icons';
import { BrandLockup } from '@/app/components/bw/BrandMark';
import { PillButton, PillField, Selector } from '@/app/components/bw/Form';
import { isDemoMode, signIn } from '@/lib/supabase';
import { setStatusBarTone } from '@/lib/systemBars';
import { useSheetDrag } from '@/app/components/bw/useSheetDrag';
import { useT } from '@/lib/i18n';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onInviteCodeSubmit: (code: string) => void;
  /** "No code? Find my invite by email" */
  onFindInviteByEmail?: () => void;
  inviteCodeLoading: boolean;
  inviteCodeError: string | null;
  closeInviteInputRef?: React.MutableRefObject<(() => boolean) | null>;
  /** Opened from a deputy reply link: the band that asked. */
  deputyBand?: string | null;
}

/** Figma "Dot hero": two rows of pills (52) and dots (10), gap 8 / 6. */
const DOT_HERO: number[][] = [
  [52, 52, 10, 52, 10, 10],
  [10, 52, 52, 10, 52, 10],
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onSignIn,
  onInviteCodeSubmit,
  onFindInviteByEmail,
  inviteCodeLoading,
  inviteCodeError,
  closeInviteInputRef,
  deputyBand,
}) => {
  const t = useT();
  const FEATURES = [t('Shared calendars'), t('Automated quotes'), t('Rehearsal costs'), t('Setlist builder')];
  const drag = useSheetDrag(() => closeSheet());
  // Open the sheet straight away when we arrive with an error (e.g. a dead invite link).
  const [showInviteInput, setShowInviteInput] = useState(!!inviteCodeError);
  const [inviteCode, setInviteCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const closeSheet = () => {
    setShowInviteInput(false);
    setInviteCode('');
    setSubmitted(false);
  };

  useEffect(() => {
    if (closeInviteInputRef) {
      closeInviteInputRef.current = () => {
        if (showInviteInput) {
          closeSheet();
          return true;
        }
        return false;
      };
    }
    return () => {
      if (closeInviteInputRef) closeInviteInputRef.current = null;
    };
  }, [showInviteInput, closeInviteInputRef]);

  // Lime surface → dark status-bar icons in both themes; the sheet's scrim is dark.
  useEffect(() => setStatusBarTone(showInviteInput ? 'dark' : 'light'), [showInviteInput]);

  const handleInviteSubmit = () => {
    if (inviteCode.trim().length < 2 || inviteCodeLoading) return;
    setSubmitted(true);
    onInviteCodeSubmit(inviteCode.trim());
  };

  if (submitted && inviteCodeLoading) {
    return (
      <div
        className="min-h-[100dvh] bg-accent text-accent-foreground flex flex-col items-center justify-center px-5 gap-4"
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="bw-label-sm">{t('Checking invite code…')}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-accent text-accent-foreground flex flex-col relative"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div
        className="flex-1 flex flex-col gap-6 px-4 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <BrandLockup size={18} monochrome />
        </motion.div>

        <motion.div
          aria-hidden
          className="flex flex-col gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          {DOT_HERO.map((row, r) => (
            <div key={r} className="flex items-center gap-2">
              {row.map((w, i) => (
                <motion.span
                  key={i}
                  className="h-2.5 rounded-full bg-current"
                  style={{ width: w }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2 + (r * 6 + i) * 0.03, duration: 0.25 }}
                />
              ))}
            </div>
          ))}
        </motion.div>

        <motion.div
          className="flex flex-col gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 className="font-[family-name:var(--font-display)] font-bold uppercase text-[56px] leading-[0.88] tracking-[-0.03em]">
            {t('Your music, your schedule, your way.')}
          </h1>
          <p className="text-[18px] font-medium leading-[1.35] tracking-[-0.005em] max-w-[340px]">
            {t('Manage gigs, rehearsals and sync your band — or just keep your own calendar in tune.')}
          </p>
          <ul className="flex flex-wrap gap-x-2 gap-y-1.5" aria-label={t('Features')}>
            {FEATURES.map((f) => (
              <li key={f}>
                <Selector>{f}</Selector>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          className="mt-auto flex flex-col gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          {deputyBand && (
            <p role="status" className="rounded-[20px] bg-surface-inverse text-surface-inverse-foreground px-4 py-3 bw-body-md">
              {t('{band} calls you as a deputy. Create an account or sign in: your gigs with them will be in the app.', { band: deputyBand })}
            </p>
          )}
          <PillButton variant="dark" onClick={onGetStarted} trailingIcon={<ArrowUpRight className="w-5 h-5" />}>
            {t('Get started')}
          </PillButton>
          <PillButton variant="outline" onClick={onSignIn} className="border-accent-foreground text-accent-foreground">
            {t('Sign in')}
          </PillButton>
          <PillButton
            variant="ghost"
            size="md"
            onClick={() => setShowInviteInput(true)}
            icon={<Link className="w-[18px] h-[18px]" />}
            className="text-accent-foreground"
          >
            {t('I have an invite code')}
          </PillButton>
          {/* Demo access (development builds only) */}
          {isDemoMode && (
            <PillButton
              variant="ghost"
              size="sm"
              loading={demoLoading}
              onClick={() => {
                setDemoLoading(true);
                signIn('demo@example.com', 'demo').finally(() => setDemoLoading(false));
              }}
              className="text-accent-foreground underline underline-offset-4"
            >
              {t('Enter demo')}
            </PillButton>
          )}
        </motion.div>
      </div>

      {/* Invite code sheet (Figma: Auth / Welcome – Invite code) */}
      <AnimatePresence>
        {showInviteInput && (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="invite-sheet-title"
              {...drag.sheet}
              onPointerDown={drag.handle.onPointerDown}
              className="touch-none fixed inset-x-0 bottom-0 z-50 bg-sheet text-sheet-foreground rounded-t-[24px] px-5 pt-2"
              style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/40" aria-hidden />
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex flex-col gap-1">
                  <p className="bw-label-sm text-white/70">{t('Invite code')}</p>
                  <h2 id="invite-sheet-title" className="bw-h2 text-[28px]">{t('Join a band')}</h2>
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label={t('Close')}
                  className="w-9 h-9 rounded-full border-[1.5px] border-white flex items-center justify-center active:scale-[var(--press-scale)] transition-transform"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <PillField
                  tone="sheet"
                  label={t('Invite code or link')}
                  id="invite-code"
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={inviteCode}
                  error={inviteCodeError}
                  onChange={(e) => {
                    setInviteCode(e.target.value);
                    setSubmitted(false);
                  }}
                  placeholder={t('Paste invite code or link')}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInviteSubmit();
                  }}
                />
                <PillButton
                  onClick={handleInviteSubmit}
                  disabled={inviteCode.trim().length < 2}
                  loading={inviteCodeLoading}
                >
                  {t('Join')}
                </PillButton>
                <div className="flex items-center justify-between">
                  {onFindInviteByEmail ? (
                    <PillButton variant="ghost" size="sm" fullWidth={false} onClick={onFindInviteByEmail} className="text-accent -ml-3">
                      {t('No code? Find my invite by email')}
                    </PillButton>
                  ) : (
                    <span />
                  )}
                  <PillButton variant="ghost" size="sm" fullWidth={false} onClick={closeSheet} className="text-white -mr-3">
                    {t('Cancel')}
                  </PillButton>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WelcomeScreen;
