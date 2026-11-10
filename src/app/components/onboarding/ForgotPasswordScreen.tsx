import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Send } from '@/app/components/icons';
import { useAuth } from '@/lib/AuthContext';
import { AuthScreen, BackButton, FormError, Kicker, PillButton, PillField } from '@/app/components/bw/Form';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBack,
}) => {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);

    try {
      const { error } = await resetPassword(trimmed);
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <AuthScreen top={<BackButton onClick={onBack} className="bw-duo-rail-back" />}>
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            className="flex-1 flex flex-col gap-5 pt-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-24 h-24 rounded-[24px] bg-accent text-accent-foreground flex items-center justify-center"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            >
              <Mail className="w-10 h-10" strokeWidth={1.75} />
            </motion.div>
            <Kicker overline="Link sent" title="Check your email" size="xl" />
            <p className="text-[18px] font-medium leading-[1.35] tracking-[-0.005em] text-muted-foreground max-w-[340px]">
              We sent a link to <span className="text-foreground">{email}</span>. Follow it to create a new
              password. The link expires in 1 hour.
            </p>
            <div className="flex-1" />
            <PillButton variant="dark" onClick={onBack}>
              Back to sign in
            </PillButton>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            noValidate
            className="flex-1 flex flex-col gap-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Kicker overline="Account recovery" title="Reset password" />
            <p className="text-[16px] leading-[1.45] text-muted-foreground max-w-[340px]">
              Enter the email you signed up with. We&apos;ll send you a link to choose a new password.
            </p>
            {error && <FormError>{error}</FormError>}
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
              required
              autoFocus
            />
            <div className="flex-1" />
            <PillButton
              type="submit"
              variant="dark"
              loading={loading}
              disabled={!email}
              trailingIcon={<Send className="w-5 h-5" />}
            >
              Send reset link
            </PillButton>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthScreen>
  );
};

export default ForgotPasswordScreen;
