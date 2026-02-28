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
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
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
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();

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

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Biometric disabled: @aparajita/capacitor-biometric-auth is not linked via SPM.
  // Re-enable when the plugin is properly configured with a Package.swift.

  const handleBiometricLogin = async (mod?: typeof import('@/lib/services/biometric')) => {
    const bioModule = mod || biometricModuleRef.current;
    if (!bioModule) return;

    setLoading(true);
    setError(null);

    try {
      const credentials = await bioModule.getCredentialsWithBiometric();
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

  const handleSaveBiometric = async (save: boolean) => {
    if (save && pendingCredentials && biometricModuleRef.current) {
      await biometricModuleRef.current.saveCredentialsForBiometric(
        pendingCredentials.email,
        pendingCredentials.password
      );
    }
    setShowBiometricPrompt(false);
    setPendingCredentials(null);
    onSuccess();
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
      setLoading(false);
    }
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

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (!mountedRef.current) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (biometricStatus?.isAvailable && !biometricStatus.hasCredentials) {
        setPendingCredentials({ email, password });
        setShowBiometricPrompt(true);
        setLoading(false);
      } else {
        onSuccess();
        setTimeout(() => { if (mountedRef.current) setLoading(false); }, 3000);
      }
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
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
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
          className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <img
          src="/brand/Logo - full text White.png"
          alt="BANDWITH"
          className="h-5 opacity-30"
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
          <p className="text-[#D5FB46] text-[11px] font-bold uppercase tracking-[0.25em] mb-3">
            Welcome back
          </p>
          <h1 className="text-[40px] font-black text-white leading-[0.95] tracking-tight uppercase">
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
            className="w-full flex items-center gap-4 h-[52px] px-5 rounded-2xl bg-white/5 border border-white/8 text-white font-bold text-[14px] disabled:opacity-50 transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleOAuthApple}
            disabled={loading}
            className="w-full flex items-center gap-4 h-[52px] px-5 rounded-2xl bg-white/5 border border-white/8 text-white font-bold text-[14px] disabled:opacity-50 transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Continue with Apple
          </button>
        </motion.div>

        {/* Biometric Login */}
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
              className="w-full flex items-center justify-center gap-3 h-[52px] rounded-2xl bg-[#D5FB46] text-black font-bold text-[14px] disabled:opacity-50 transition-all hover:bg-[#c8ef3a] active:scale-[0.98]"
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
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/25 text-[10px] font-bold uppercase tracking-[0.25em]">or</span>
          <div className="flex-1 h-px bg-white/10" />
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
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" strokeWidth={1.5} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full h-[52px] pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-[#D5FB46]/40 focus:bg-white/8 transition-all"
              autoComplete="email"
              autoCapitalize="none"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" strokeWidth={1.5} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full h-[52px] pl-12 pr-12 bg-white/5 border border-white/10 rounded-2xl text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-[#D5FB46]/40 focus:bg-white/8 transition-all"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
            </button>
          </div>

          {/* Forgot password */}
          <div className="text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-white/30 text-[12px] font-semibold hover:text-white/60 transition-colors"
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
          className="w-full h-14 rounded-full text-[14px] font-black uppercase tracking-[0.15em] bg-[#D5FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
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

      {/* Biometric Save Prompt Modal */}
      <AnimatePresence>
        {showBiometricPrompt && biometricStatus && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => handleSaveBiometric(false)}
            />
            <motion.div
              className="relative w-full max-w-md mx-4 mb-8 bg-[#1A1A1A] rounded-3xl p-6 border border-white/10"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#D5FB46]/10 flex items-center justify-center mb-4">
                  {biometricStatus.biometryType === 'faceId' ? (
                    <ScanFace className="w-8 h-8 text-[#D5FB46]" strokeWidth={1.5} />
                  ) : (
                    <Fingerprint className="w-8 h-8 text-[#D5FB46]" strokeWidth={1.5} />
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Enable {getBiometryDisplayName(biometricStatus.biometryType)}?
                </h3>
                <p className="text-white/50 text-sm mb-6">
                  Sign in faster next time using {getBiometryDisplayName(biometricStatus.biometryType)}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => handleSaveBiometric(false)}
                    className="flex-1 h-12 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/15 transition-all"
                  >
                    Not now
                  </button>
                  <button
                    onClick={() => handleSaveBiometric(true)}
                    className="flex-1 h-12 rounded-xl bg-[#D5FB46] text-black font-bold text-sm hover:bg-[#c8ef3a] transition-all"
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
