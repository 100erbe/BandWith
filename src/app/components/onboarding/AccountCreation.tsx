import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useOnboarding } from '@/lib/OnboardingContext';

interface AccountCreationProps {
  onBack: () => void;
  onComplete: () => void;
  prefilledEmail?: string;
}

export const AccountCreation: React.FC<AccountCreationProps> = ({
  onBack,
  onComplete,
  prefilledEmail,
}) => {
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const { setAccountData, path } = useOnboarding();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [email, setEmail] = useState(prefilledEmail || '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isJoiner = path === 'joiner';
  const isEmailReadonly = isJoiner && !!prefilledEmail;

  const handleOAuthGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (!mountedRef.current) return;
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleOAuthApple = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signInWithApple();
    if (!mountedRef.current) return;
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isJoiner) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          const { error: signUpError } = await signUp(email, password, {
            full_name: fullName,
          });
          if (!mountedRef.current) return;
          if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
          }
        }
      } else {
        const { error } = await signUp(email, password, { full_name: fullName });
        if (!mountedRef.current) return;
        if (error) {
          if (error.message.includes('already registered')) {
            setError('This email is already registered. Try signing in.');
          } else {
            setError(error.message);
          }
          setLoading(false);
          return;
        }
      }

      setAccountData({
        email,
        password,
        authMethod: 'email',
      });

      setSuccess('Account created!');
      setTimeout(() => {
        if (mountedRef.current) onComplete();
      }, 600);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err.message || 'An error occurred');
      setLoading(false);
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
      <motion.div
        className="px-5 pt-5 flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <button
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
      </motion.div>

      {/* Content */}
      <motion.div
        className="flex-1 flex flex-col px-5 py-6 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {/* Title */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <p className="text-white/30 text-[11px] font-bold uppercase tracking-[0.25em] mb-3">
            Step 01
          </p>
          <h1 className="text-[36px] font-black text-white tracking-tight uppercase leading-[0.95]">
            {isJoiner ? 'Join Band' : 'Create'}
            <br />
            <span className="text-white/20">{isJoiner ? '' : 'Account'}</span>
          </h1>
          <p className="text-white/35 text-[14px] font-medium mt-3">
            {isJoiner ? 'One step to join the crew' : "Let's get you set up in seconds"}
          </p>
        </motion.div>

        {/* OAuth */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <button
            onClick={handleOAuthGoogle}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-[48px] rounded-2xl bg-white/5 border border-white/8 text-white font-bold text-[13px] disabled:opacity-50 active:scale-[0.98] transition-all hover:bg-white/10"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>

          <button
            onClick={handleOAuthApple}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-[48px] rounded-2xl bg-white/5 border border-white/8 text-white font-bold text-[13px] disabled:opacity-50 active:scale-[0.98] transition-all hover:bg-white/10"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Apple
          </button>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="flex items-center gap-4 my-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/25 text-[10px] font-bold uppercase tracking-[0.25em]">or with email</span>
          <div className="flex-1 h-px bg-white/10" />
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/10"
              >
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-[13px] font-medium">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/10"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-400 text-[13px] font-medium">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name */}
          {!isJoiner && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" strokeWidth={1.5} />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full h-[52px] pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-[#D5FB46]/40 focus:bg-white/8 transition-all"
                required
              />
            </div>
          )}

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" strokeWidth={1.5} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              readOnly={isEmailReadonly}
              className={`w-full h-[52px] pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-[#D5FB46]/40 focus:bg-white/8 transition-all ${
                isEmailReadonly ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" strokeWidth={1.5} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              className="w-full h-[52px] pl-12 pr-12 bg-white/5 border border-white/10 rounded-2xl text-white text-[15px] placeholder:text-white/25 focus:outline-none focus:border-[#D5FB46]/40 focus:bg-white/8 transition-all"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
            </button>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-full text-[14px] font-black uppercase tracking-[0.15em] bg-[#D5FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 mt-2"
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
              </>
            )}
          </motion.button>
        </motion.form>

        {/* Footer */}
        <motion.p
          className="mt-auto pt-6 text-center text-white/20 text-[11px] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          By continuing, you agree to our{' '}
          <a href="#" className="text-white/35 underline">Terms</a> and{' '}
          <a href="#" className="text-white/35 underline">Privacy Policy</a>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default AccountCreation;
