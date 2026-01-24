import React, { useState } from 'react';
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
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // OAuth will redirect, so we don't need to handle success here
  };

  const handleOAuthApple = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signInWithApple();
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
      // For joiners, might be logging in to existing account
      // For creators, always creating new account
      if (isJoiner) {
        // Try sign in first
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          // If sign in fails, try sign up
          const { error: signUpError } = await signUp(email, password, {
            full_name: fullName,
          });
          if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
          }
        }
      } else {
        const { error } = await signUp(email, password, { full_name: fullName });
        if (error) {
          if (error.message.includes('already registered')) {
            setError('This email is already registered. Please sign in.');
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

      setSuccess('Account created successfully!');
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background:
              'radial-gradient(circle, rgba(212, 251, 70, 0.3) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-14 pb-4 relative z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-[15px] font-medium">Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 relative z-10">
        {/* Title */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-[32px] font-black text-white leading-tight mb-2">
            Let's get started
          </h1>
          <p className="text-zinc-500 text-[16px]">
            Create your account in seconds
          </p>
        </motion.div>

        {/* OAuth Buttons */}
        <motion.div
          className="space-y-3 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <button
            onClick={handleOAuthGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-black font-bold text-[16px] disabled:opacity-50 transition-all hover:bg-zinc-100 active:scale-98"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={handleOAuthApple}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#1C1C1E] text-white font-bold text-[16px] border border-white/10 disabled:opacity-50 transition-all hover:bg-[#2C2C2E] active:scale-98"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Continue with Apple
          </button>
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-zinc-600 text-[13px] font-medium">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-[14px]">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-400 text-[14px]">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name field (only for creators) */}
          {!isJoiner && (
            <div className="relative">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-[#1C1C1E] border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white text-[16px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/30 transition-colors"
                required
              />
            </div>
          )}

          {/* Email field */}
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600"
              strokeWidth={1.5}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              readOnly={isEmailReadonly}
              className={`w-full bg-[#1C1C1E] border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white text-[16px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/30 transition-colors ${
                isEmailReadonly ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              required
            />
          </div>

          {/* Password field */}
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600"
              strokeWidth={1.5}
            />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isJoiner ? 'Password' : 'Create password'}
              className="w-full bg-[#1C1C1E] border border-white/5 rounded-2xl pl-12 pr-12 py-4 text-white text-[16px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/30 transition-colors"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" strokeWidth={1.5} />
              ) : (
                <Eye className="w-5 h-5" strokeWidth={1.5} />
              )}
            </button>
          </div>

          {/* Password hint */}
          {!isJoiner && (
            <p className="text-zinc-600 text-[12px] px-1">
              Password must be at least 8 characters
            </p>
          )}

          {/* Submit button */}
          <motion.button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#D4FB46] text-black font-bold text-[16px] disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            style={{
              boxShadow: '0 4px 20px rgba(212, 251, 70, 0.3)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" strokeWidth={2} />
              </>
            )}
          </motion.button>
        </motion.form>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 text-center">
        <p className="text-zinc-600 text-[12px] leading-relaxed">
          By continuing, you agree to our{' '}
          <a href="#" className="text-zinc-500 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-zinc-500 underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
};

export default AccountCreation;
