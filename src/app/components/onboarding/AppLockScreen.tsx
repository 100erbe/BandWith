import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { Fingerprint, ScanFace, Lock, Eye, EyeOff, LogOut } from '@/app/components/icons';
import { AuthScreen, FormError, Kicker, PillButton, PillField } from '@/app/components/bw/Form';
import { DuoAuthLayout } from './DuoAuthLayout';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { authenticateDevice, getDeviceAuthInfo, type DeviceAuthInfo } from '@/lib/appLock';
import { useT } from '@/lib/i18n';
import { authErrorKind, authErrorMessage } from '@/lib/authErrors';

interface AppLockScreenProps {
  /** Called once the owner proved it's them. */
  onUnlock: () => void;
}

/**
 * Shown on a cold start with a saved session (see src/lib/appLock.ts).
 * Nothing of the app is mounted behind it. Ways in: Face ID / Touch ID /
 * fingerprint with the device passcode as the system's own fallback, the
 * account password, or signing out (which needs a full sign-in to get back).
 */
export const AppLockScreen: React.FC<AppLockScreenProps> = ({ onUnlock }) => {
  const t = useT();
  const { user, signOut } = useAuth();
  const [info, setInfo] = useState<DeviceAuthInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const autoPrompted = useRef(false);
  const mounted = useRef(true);

  const email = (user?.email || '').toLowerCase();
  // The password way in only makes sense for accounts that have one (not Google/Apple only).
  const hasPassword = !!email && (user?.identities ?? []).some((i) => i.provider === 'email');

  const deviceName =
    info?.kind === 'faceId'
      ? 'Face ID'
      : info?.kind === 'touchId'
        ? 'Touch ID'
        : info?.kind === 'passcode'
          ? t('device passcode')
          : info?.kind === 'iris'
            ? t('iris')
            : t('fingerprint');
  const DeviceIcon = info?.kind === 'faceId' ? ScanFace : info?.kind === 'passcode' ? Lock : Fingerprint;

  useEffect(() => {
    mounted.current = true;
    void getDeviceAuthInfo().then((res) => {
      if (!mounted.current) return;
      setInfo(res);
      if (!res.canCheck) setShowPassword(true);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const unlockWithDevice = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await authenticateDevice(t('Unlock BandWith'), { cancel: t('Cancel'), title: t('Unlock BandWith') });
    if (!mounted.current) return;
    setBusy(false);
    if (result === 'ok') {
      onUnlock();
      return;
    }
    if (result === 'unavailable') {
      setInfo((prev) => (prev ? { ...prev, canCheck: false } : prev));
      setShowPassword(true);
      setError(hasPassword ? t('This device can’t check it’s you. Enter your password.') : null);
      return;
    }
    if (result === 'failed') setError(t('Couldn’t check it’s you. Try again.'));
  }, [busy, hasPassword, onUnlock, t]);

  // Ask straight away, as the system lock screen does.
  useEffect(() => {
    if (!info?.canCheck || autoPrompted.current) return;
    autoPrompted.current = true;
    void unlockWithDevice();
  }, [info, unlockWithDevice]);

  // Android Back on the lock screen leaves the app instead of going anywhere in it.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let remove: (() => void) | undefined;
    let disposed = false;
    void import('@capacitor/app').then(({ App }) =>
      App.addListener('backButton', () => {
        void App.minimizeApp();
      }).then((h) => {
        if (disposed) h.remove();
        else remove = () => h.remove();
      })
    );
    return () => {
      disposed = true;
      remove?.();
    };
  }, []);

  const unlockWithPassword = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!password || checkingPassword) return;
    setCheckingPassword(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!mounted.current) return;
    setCheckingPassword(false);
    if (signInError) {
      setError(authErrorKind(signInError) === 'invalid_credentials' ? t('Wrong password.') : authErrorMessage(signInError));
      return;
    }
    setPassword('');
    onUnlock();
  };

  const body = !info
    ? ''
    : info.canCheck
      ? t('Use {name} to open your bands.', { name: deviceName })
      : hasPassword
        ? t('Enter your account password to open your bands.')
        : t('Sign in again to open your bands.');

  return (
    <DuoAuthLayout screenKey="app-lock">
      <AuthScreen
        top={<span className="bw-label-sm text-muted-foreground">BandWith</span>}
        footer={
          <PillButton
            variant="ghost"
            size="md"
            className="text-muted-foreground"
            onClick={() => void signOut()}
            disabled={busy || checkingPassword}
            icon={<LogOut className="w-[18px] h-[18px]" />}
          >
            {t('Sign out')}
          </PillButton>
        }
      >
        <motion.div
          className="flex flex-col gap-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-16 h-16 rounded-[20px] bg-accent text-accent-foreground flex items-center justify-center [@media(max-height:520px)]:hidden">
            <DeviceIcon className="w-8 h-8" strokeWidth={1.75} aria-hidden />
          </div>
          <Kicker title={t('Locked')} />
          <div className="flex flex-col gap-1">
            <p className="bw-body-md text-foreground">{body}</p>
            {email && <p className="bw-body-sm text-muted-foreground break-all">{email}</p>}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <FormError>{error}</FormError>
              </motion.div>
            )}
          </AnimatePresence>

          {info?.canCheck && (
            <PillButton
              onClick={() => void unlockWithDevice()}
              loading={busy}
              icon={<DeviceIcon className="w-6 h-6" strokeWidth={1.75} />}
            >
              {t('Unlock with {name}', { name: deviceName })}
            </PillButton>
          )}

          {hasPassword && !showPassword && (
            <PillButton variant="outline" onClick={() => setShowPassword(true)} disabled={busy}>
              {t('Use password')}
            </PillButton>
          )}

          {hasPassword && showPassword && (
            <form className="flex flex-col gap-3" onSubmit={unlockWithPassword} noValidate>
              <PillField
                label={t('Password')}
                type={revealPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('Your password')}
                icon={<Lock className="w-5 h-5" strokeWidth={1.75} />}
                trailing={
                  <button
                    type="button"
                    onClick={() => setRevealPassword((v) => !v)}
                    aria-label={revealPassword ? t('Hide password') : t('Show password')}
                    className="-m-2 p-2 text-muted-foreground"
                  >
                    {revealPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.75} /> : <Eye className="w-5 h-5" strokeWidth={1.75} />}
                  </button>
                }
              />
              <PillButton type="submit" variant={info?.canCheck ? 'outline' : 'primary'} loading={checkingPassword} disabled={!password}>
                {t('Unlock')}
              </PillButton>
            </form>
          )}

        </motion.div>
      </AuthScreen>
    </DuoAuthLayout>
  );
};

export default AppLockScreen;
