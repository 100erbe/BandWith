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
  GoogleBrandIcon,
  AppleBrandIcon,
} from '@/app/components/icons';
import { useAuth } from '@/lib/AuthContext';
import { BrandLogo } from '@/app/components/ui/BrandLogo';
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
      className="min-h-screen bg-background flex flex-col relative overflow-hidden"
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
          <p className="text-muted-foreground/50 text-[11px] font-bold uppercase tracking-[0.25em] mb-3">
            Step 01
          </p>
          <h1 className="text-[36px] font-black text-foreground tracking-tight uppercase leading-[0.95]">
            {isJoiner ? 'Join Band' : 'Create'}
            <br />
            <span className="text-muted-foreground/30">{isJoiner ? '' : 'Account'}</span>
          </h1>
          <p className="text-muted-foreground/55 text-[14px] font-medium mt-3">
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
            className="flex items-center justify-center gap-2 h-[48px] rounded-2xl bg-card border border-border text-foreground font-bold text-[13px] disabled:opacity-50 active:scale-[0.98] transition-all hover:bg-card/80"
          >
            <GoogleBrandIcon className="w-5 h-5 shrink-0" />
            Google
          </button>

          <button
            onClick={handleOAuthApple}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-[48px] rounded-2xl bg-card border border-border text-foreground font-bold text-[13px] disabled:opacity-50 active:scale-[0.98] transition-all hover:bg-card/80"
          >
            <AppleBrandIcon className="w-5 h-5 shrink-0" />
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
          <div className="flex-1 h-px bg-card/80" />
          <span className="text-muted-foreground/40 text-[10px] font-bold uppercase tracking-[0.25em]">or with email</span>
          <div className="flex-1 h-px bg-card/80" />
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
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full h-[52px] pl-12 pr-4 bg-card border border-border rounded-2xl text-foreground text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40 focus:bg-card/80 transition-all"
                required
              />
            </div>
          )}

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              readOnly={isEmailReadonly}
              className={`w-full h-[52px] pl-12 pr-4 bg-card border border-border rounded-2xl text-foreground text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40 focus:bg-card/80 transition-all ${
                isEmailReadonly ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              className="w-full h-[52px] pl-12 pr-12 bg-card border border-border rounded-2xl text-foreground text-[15px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/40 focus:bg-card/80 transition-all"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground/90 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
            </button>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-full text-[14px] font-black uppercase tracking-[0.15em] bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 mt-2"
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
          className="mt-auto pt-6 text-center text-muted-foreground/30 text-[11px] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          By continuing, you agree to our{' '}
          <a href="#" className="text-muted-foreground/55 underline">Terms</a> and{' '}
          <a href="#" className="text-muted-foreground/55 underline">Privacy Policy</a>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default AccountCreation;
