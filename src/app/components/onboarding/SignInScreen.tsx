import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Fingerprint,
  ScanFace,
  GoogleBrandIcon,
  AppleBrandIcon,
} from '@/app/components/icons';
import { useAuth } from '@/lib/AuthContext';
import { BrandLogo } from '@/app/components/ui/BrandLogo';
import type { BiometricStatus } from '@/lib/services/biometric';

interface SignInScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  onForgotPassword: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onBack,
  onSuccess,
  onForgotPassword,
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

  return (
    <div
      className="min-h-screen bg-background flex flex-col relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 relative z-10 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-muted-foreground/80 hover:text-foreground hover:bg-card transition-all"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <BrandLogo
          variant="waveform"
          lockup="horizontal"
          className="h-6 opacity-60"
          textClassName="text-lg"
        />

        <div className="w-11" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-10 relative z-10 overflow-y-auto">
        {/* Headline */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <p className="text-accent text-[11px] font-bold uppercase tracking-[0.25em] mb-3">
            Welcome back
          </p>
          <h1 className="text-[40px] font-black text-foreground leading-[0.95] tracking-tight uppercase">
            Sign in
          </h1>
        </motion.div>

        {/* OAuth Buttons */}
        <motion.div
          className="space-y-3 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <button
            type="button"
            onClick={handleOAuthGoogle}
            disabled={loading}
            className="w-full flex items-center gap-4 h-[52px] px-5 rounded-2xl bg-card border border-border text-foreground font-bold text-[14px] disabled:opacity-50 transition-all hover:bg-card/80 active:scale-[0.98]"
          >
            <GoogleBrandIcon className="w-5 h-5 shrink-0" />
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleOAuthApple}
            disabled={loading}
            className="w-full flex items-center gap-4 h-[52px] px-5 rounded-2xl bg-card border border-border text-foreground font-bold text-[14px] disabled:opacity-50 transition-all hover:bg-card/80 active:scale-[0.98]"
          >
            <AppleBrandIcon className="w-5 h-5 shrink-0" />
            Continue with Apple
          </button>
        </motion.div>

        {/* Biometric Login (when credentials already saved) */}
        {biometricStatus?.isAvailable && biometricStatus.hasCredentials && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <button
              type="button"
              onClick={() => handleBiometricLogin()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-[52px] rounded-2xl bg-accent text-accent-foreground font-bold text-[14px] disabled:opacity-50 transition-all hover:bg-accent/90 active:scale-[0.98]"
            >
              {biometricStatus.biometryType === 'faceId' ? (
                <ScanFace className="w-6 h-6" strokeWidth={1.5} />
              ) : (
                <Fingerprint className="w-6 h-6" strokeWidth={1.5} />
              )}
              Sign in with {getBiometryDisplayName(biometricStatus.biometryType)}
            </button>
          </motion.div>
        )}

        {/* Divider */}
        <motion.div
          className="flex items-center gap-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <div className="flex-1 h-px bg-card/80" />
          <span className="text-muted-foreground/40 text-[10px] font-bold uppercase tracking-[0.25em]">or</span>
          <div className="flex-1 h-px bg-card/80" />
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/10"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-red-400 text-[13px] font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full h-[52px] pl-12 pr-4 bg-card border border-border rounded-2xl text-foreground text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40 focus:bg-card/80 transition-all"
              autoComplete="email"
              autoCapitalize="none"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-[52px] pl-12 pr-12 bg-card border border-border rounded-2xl text-foreground text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40 focus:bg-card/80 transition-all"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground/90 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
            </button>
          </div>

          {/* Forgot password */}
          <div className="text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-muted-foreground/50 text-[12px] font-semibold hover:text-muted-foreground/90 transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </motion.form>
      </div>

      {/* Footer */}
      <motion.div
        className="px-5 pb-8 pt-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="w-full h-14 rounded-full text-[14px] font-black uppercase tracking-[0.15em] bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </button>
      </motion.div>

      {/* Biometric Save Prompt Modal — shown BEFORE signIn, avoids race conditions */}
      <AnimatePresence>
        {showBiometricPrompt && biometricStatus && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => handleBiometricPromptDecision(false)}
            />
            <motion.div
              className="relative w-full max-w-md mx-4 mb-8 bg-card rounded-3xl p-6 border border-border"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                  {biometricStatus.biometryType === 'faceId' ? (
                    <ScanFace className="w-8 h-8 text-accent" strokeWidth={1.5} />
                  ) : (
                    <Fingerprint className="w-8 h-8 text-accent" strokeWidth={1.5} />
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Enable {getBiometryDisplayName(biometricStatus.biometryType)}?
                </h3>
                <p className="text-muted-foreground/80 text-sm mb-6">
                  Sign in faster next time using {getBiometryDisplayName(biometricStatus.biometryType)}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => handleBiometricPromptDecision(false)}
                    className="flex-1 h-12 rounded-xl bg-card/80 text-foreground font-bold text-sm hover:bg-white/15 transition-all"
                  >
                    Not now
                  </button>
                  <button
                    onClick={() => handleBiometricPromptDecision(true)}
                    className="flex-1 h-12 rounded-xl bg-accent text-accent-foreground font-bold text-sm hover:bg-accent/90 transition-all"
                  >
                    Enable
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SignInScreen;