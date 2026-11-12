import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowUpRight,
  Fingerprint,
  ScanFace,
  GoogleBrandIcon,
  AppleBrandIcon,
} from '@/app/components/icons';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { AuthScreen, BackButton, FormError, Kicker, OrDivider, PillButton, PillField } from '@/app/components/bw/Form';
import type { BiometricStatus } from '@/lib/services/biometric';
import { useSheetDrag } from '@/app/components/bw/useSheetDrag';

interface SignInScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  onForgotPassword: () => void;
  /** "New here? Create an account" */
  onCreateAccount?: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onBack,
  onSuccess,
  onForgotPassword,
  onCreateAccount,
}) => {
  const bioDrag = useSheetDrag(() => { void handleBiometricPromptDecision(false); });
  const { signIn, signInWithGoogle, signInWithApple, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Biometric state — module loaded lazily to avoid native plugin in entry chunk
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  const biometricModuleRef = useRef<typeof import('@/lib/services/biometric') | null>(null);
  const mountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    mountedRef.current = true;
    onSuccessRef.current = onSuccess;
    return () => { mountedRef.current = false; };
  }, [onSuccess]);

  // Load biometric module on mount
  useEffect(() => {
    (async () => {
      try {
        const bioModule = await import('@/lib/services/biometric');
        biometricModuleRef.current = bioModule;
        const status = await bioModule.checkBiometricAvailability({ allowWebTest: import.meta.env.DEV });
        if (mountedRef.current) {
          setBiometricStatus(status);
        }
      } catch (err) {
        console.log('[SignIn] Biometric check failed:', err);
      }
    })();
  }, []);

  // Watch for OAuth completing via deep link
  useEffect(() => {
    if (isAuthenticated) {
      onSuccessRef.current();
    }
  }, [isAuthenticated]);

  // ── Biometric login (when credentials already saved) ──
  const handleBiometricLogin = async (mod?: typeof import('@/lib/services/biometric')) => {
    const bioModule = mod || biometricModuleRef.current;
    if (!bioModule) return;

    setLoading(true);
    setError(null);

    try {
      const quick = await bioModule.getQuickSignIn(undefined, { allowWebTest: import.meta.env.DEV });
      if (!mountedRef.current) return;
      if (!quick) {
        setLoading(false);
        return;
      }
      const forget = async (message: string) => {
        await bioModule.deleteBiometricCredentials();
        if (!mountedRef.current) return;
        setBiometricStatus((prev) => (prev ? { ...prev, hasCredentials: false, email: undefined } : prev));
        setError(message);
        setLoading(false);
      };
      if (quick.kind === 'session') {
        // Resume the account's session from its refresh token.
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: quick.refreshToken });
        if (!mountedRef.current) return;
        if (error || !data.session) {
          await forget('Quick sign-in expired. Sign in with your password once to turn it back on.');
          return;
        }
        await bioModule.updateStoredSession(data.session);
        onSuccess();
        return;
      }
      // Older build: a saved password. Use it once, then keep the token instead.
      const { error } = await signIn(quick.email, quick.password);
      if (!mountedRef.current) return;
      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          await forget('Your password changed. Sign in with it once to turn quick sign-in back on.');
          return;
        }
        setError(error.message);
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      await bioModule.updateStoredSession(session);
      onSuccess();
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err.message || 'Biometric authentication failed');
      setLoading(false);
    }
  };

  // ── Biometric save prompt: called BEFORE signIn() ──
  const handleBiometricPromptDecision = async (save: boolean) => {
    setShowBiometricPrompt(false);

    if (!pendingCredentials) return;
    setLoading(true);
    setError(null);

    try {
      const { error } = await signIn(pendingCredentials.email, pendingCredentials.password);
      if (!mountedRef.current) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Quick sign-in keeps the session's refresh token, never the password,
      // and only once the password is proven right.
      if (save && biometricModuleRef.current) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await biometricModuleRef.current.saveSessionForBiometric(session, { allowWebTest: import.meta.env.DEV });
        }
      }
      onSuccess();
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleOAuthGoogle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (!mountedRef.current) return;
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleOAuthApple = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(null);
    const { error } = await signInWithApple();
    if (!mountedRef.current) return;
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  /** Sign-in: show biometric save prompt BEFORE calling signIn() to avoid race conditions. */
  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setError(null);

    // Check if we should show the "Enable Fingerprint?" prompt BEFORE signing in
    let bioStatus = biometricStatus;
    if (!bioStatus && biometricModuleRef.current) {
      bioStatus = await biometricModuleRef.current.checkBiometricAvailability({ allowWebTest: import.meta.env.DEV });
      if (mountedRef.current) setBiometricStatus(bioStatus);
    }

    // Offer quick sign-in when it is off, or ask before moving it from
    // another account to this one (PR-42).
    const typedEmail = email.trim().toLowerCase();
    if (bioStatus?.isAvailable && (!bioStatus.hasCredentials || (bioStatus.email && bioStatus.email !== typedEmail))) {
      // Show prompt first — signIn() happens after user decides
      setPendingCredentials({ email, password });
      setShowBiometricPrompt(true);
      return;
    }

    // No biometric prompt needed — sign in directly
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (!mountedRef.current) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const getBiometryDisplayName = (type?: string) => {
    switch (type) {
      case 'faceId': return 'Face ID';
      case 'touchId': return 'Touch ID';
      case 'fingerprint': return 'Fingerprint';
      case 'iris': return 'Iris';
      default: return 'Biometric';
    }
  };

  const canUseBiometric = !!(biometricStatus?.isAvailable && biometricStatus.hasCredentials);
  const replacingAccount = !!(
    biometricStatus?.hasCredentials &&
    biometricStatus.email &&
    pendingCredentials &&
    biometricStatus.email !== pendingCredentials.email.trim().toLowerCase()
  );
  const biometryName = getBiometryDisplayName(biometricStatus?.biometryType);
  const BiometryIcon = biometricStatus?.biometryType === 'faceId' ? ScanFace : Fingerprint;

  return (
    <AuthScreen top={<BackButton onClick={onBack} className="bw-duo-rail-back" />}>
      <motion.form
        className="flex flex-col gap-5"
        onSubmit={handleSubmit}
        noValidate
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Kicker overline="Welcome back" title="Sign in" />

        <div className="flex flex-col gap-3">
          <PillButton
            variant="white"
            onClick={handleOAuthGoogle}
            disabled={loading}
            icon={<GoogleBrandIcon className="w-5 h-5" />}
          >
            Continue with Google
          </PillButton>
          <PillButton
            variant="white"
            onClick={handleOAuthApple}
            disabled={loading}
            icon={<AppleBrandIcon className="w-5 h-5" />}
          >
            Continue with Apple
          </PillButton>
        </div>

        <OrDivider />

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <FormError>{error}</FormError>
            </motion.div>
          )}
        </AnimatePresence>

        <PillField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourband.com"
          icon={<Mail className="w-5 h-5" strokeWidth={1.75} />}
        />
        <PillField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          icon={<Lock className="w-5 h-5" strokeWidth={1.75} />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="-m-2 p-2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.75} /> : <Eye className="w-5 h-5" strokeWidth={1.75} />}
            </button>
          }
        />

        <div className="flex items-center justify-end -mx-3">
          <PillButton variant="ghost" size="sm" fullWidth={false} onClick={onForgotPassword} className="text-muted-foreground">
            Forgot password?
          </PillButton>
        </div>

        <PillButton
          type="submit"
          loading={loading}
          disabled={!email || !password}
          trailingIcon={<ArrowUpRight className="w-5 h-5" />}
        >
          Sign in
        </PillButton>

        {/* Full-size biometric sign-in, as easy to hit as the main button. */}
        {canUseBiometric && (
          <PillButton
            variant="outline"
            onClick={() => handleBiometricLogin()}
            disabled={loading}
            icon={<BiometryIcon className="w-6 h-6" strokeWidth={1.75} />}
          >
            Use {biometryName}
          </PillButton>
        )}
        {canUseBiometric && biometricStatus?.email && (
          <p className="bw-body-sm text-muted-foreground -mt-2 text-center break-all">{biometricStatus.email}</p>
        )}

        {onCreateAccount && (
          <p className="bw-body-sm text-muted-foreground">
            New here?{' '}
            <button type="button" onClick={onCreateAccount} className="underline underline-offset-4 text-foreground">
              Create an account
            </button>
          </p>
        )}
      </motion.form>

      {/* Biometric save prompt — shown BEFORE signIn, avoids race conditions */}
      <AnimatePresence>
        {showBiometricPrompt && biometricStatus && (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleBiometricPromptDecision(false)}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bio-title"
              {...bioDrag.sheet}
              onPointerDown={bioDrag.handle.onPointerDown}
              className="touch-none fixed inset-x-0 bottom-0 z-50 bg-sheet text-sheet-foreground rounded-t-[24px] px-5 pt-2"
              style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/40" aria-hidden />
              <div className="w-16 h-16 rounded-[20px] bg-accent text-accent-foreground flex items-center justify-center mb-5">
                <BiometryIcon className="w-8 h-8" strokeWidth={1.75} />
              </div>
              <p className="bw-label-sm text-white/70 mb-1">Faster sign-in</p>
              <h2 id="bio-title" className="bw-h2 text-[28px] mb-3">
                {replacingAccount ? `Use ${biometryName} for this account?` : `Enable ${biometryName}?`}
              </h2>
              <p className="text-[16px] leading-[1.4] text-white/70 mb-6 break-words">
                {replacingAccount
                  ? `${biometryName} now signs in ${biometricStatus.email}. Switch it to ${pendingCredentials?.email.trim().toLowerCase()}?`
                  : `Sign in faster next time using ${biometryName}.`}
              </p>
              <div className="flex flex-col gap-3">
                <PillButton onClick={() => handleBiometricPromptDecision(true)}>
                  {replacingAccount ? `Switch ${biometryName}` : `Enable ${biometryName}`}
                </PillButton>
                <PillButton variant="ghost" size="md" className="text-white" onClick={() => handleBiometricPromptDecision(false)}>
                  Not now
                </PillButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AuthScreen>
  );
};

export default SignInScreen;
