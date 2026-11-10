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
import { AuthScreen, BackButton, FormError, Kicker, OrDivider, PillButton, PillField } from '@/app/components/bw/Form';
import type { BiometricStatus } from '@/lib/services/biometric';

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
        const status = await bioModule.checkBiometricAvailability({ allowWebTest: true });
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
      const credentials = await bioModule.getCredentialsWithBiometric(undefined, { allowWebTest: true });
      if (!mountedRef.current) return;
      if (credentials) {
        const { error } = await signIn(credentials.email, credentials.password);
        if (!mountedRef.current) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        onSuccess();
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err.message || 'Biometric authentication failed');
      setLoading(false);
    }
  };

  // ── Biometric save prompt: called BEFORE signIn() ──
  const handleBiometricPromptDecision = async (save: boolean) => {
    setShowBiometricPrompt(false);

    if (save && pendingCredentials && biometricModuleRef.current) {
      await biometricModuleRef.current.saveCredentialsForBiometric(
        pendingCredentials.email,
        pendingCredentials.password,
        { allowWebTest: true }
      );
    }

    // Now actually sign in
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
      bioStatus = await biometricModuleRef.current.checkBiometricAvailability({ allowWebTest: true });
      if (mountedRef.current) setBiometricStatus(bioStatus);
    }

    if (bioStatus?.isAvailable && !bioStatus.hasCredentials) {
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
  const biometryName = getBiometryDisplayName(biometricStatus?.biometryType);
  const BiometryIcon = biometricStatus?.biometryType === 'faceId' ? ScanFace : Fingerprint;

  return (
    <AuthScreen top={<BackButton onClick={onBack} />}>
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

        <div className="flex items-center justify-between -mx-3">
          {canUseBiometric ? (
            <PillButton
              variant="ghost"
              size="sm"
              fullWidth={false}
              onClick={() => handleBiometricLogin()}
              disabled={loading}
              icon={<BiometryIcon className="w-[14px] h-[14px]" strokeWidth={2} />}
            >
              Use {biometryName}
            </PillButton>
          ) : (
            <span />
          )}
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
              className="fixed inset-x-0 bottom-0 z-50 bg-sheet text-sheet-foreground rounded-t-[24px] px-5 pt-2"
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
              <h2 id="bio-title" className="bw-h2 text-[28px] mb-3">Enable {biometryName}?</h2>
              <p className="text-[16px] leading-[1.4] text-white/70 mb-6">
                Sign in faster next time using {biometryName}.
              </p>
              <div className="flex flex-col gap-3">
                <PillButton onClick={() => handleBiometricPromptDecision(true)}>Enable {biometryName}</PillButton>
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
