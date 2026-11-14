import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowUpRight,
  CheckCircle2,
  GoogleBrandIcon,
  AppleBrandIcon,
} from '@/app/components/icons';
import { useAuth } from '@/lib/AuthContext';
import { Capacitor } from '@capacitor/core';
import { supabase, getAuthCallbackUrl } from '@/lib/supabase';
import { authErrorKind, authErrorMessage } from '@/lib/authErrors';
import { useOnboarding } from '@/lib/OnboardingContext';
import { AuthScreen, FormError, Kicker, OrDivider, PillButton, PillField } from '@/app/components/bw/Form';
import { WizardTop, wizardStep } from './OnboardingChrome';
import { LegalSheet, legalUrl, type LegalDoc } from '@/app/components/legal/LegalSheet';
import { useT } from '@/lib/i18n';

interface AccountCreationProps {
  onBack: () => void;
  onComplete: () => void;
  prefilledEmail?: string;
  /** Joining with an existing account and a wrong password: "Forgot password?". */
  onForgotPassword?: () => void;
  /** "Check your email" → "I’ve confirmed it: sign in". */
  onSignIn?: () => void;
}

export const AccountCreation: React.FC<AccountCreationProps> = ({
  onBack,
  onComplete,
  prefilledEmail,
  onForgotPassword,
  onSignIn,
}) => {
  const t = useT();
  const { signIn, signUp, signInWithGoogle, signInWithApple, authError, clearAuthError } = useAuth();
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
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  /** Email confirmation is on: the account exists once this address is confirmed. */
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');
  /** Joining with an address that already has an account, and the password didn't match. */
  const [wrongPassword, setWrongPassword] = useState(false);

  // A sign-in that came back to the app and failed (Google / Apple, expired link).
  useEffect(() => {
    if (!authError) return;
    setError(authError);
    setLoading(false);
    clearAuthError();
  }, [authError, clearAuthError]);

  const isJoiner = path === 'joiner';
  const isEmailReadonly = isJoiner && !!prefilledEmail;

  const handleOAuthGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (!mountedRef.current) return;
    if (error) setError(authErrorMessage(error));
    // Native: the in-app browser is open now; closing it must not leave the
    // buttons disabled (web: the page redirects).
    if (error || Capacitor.isNativePlatform()) setLoading(false);
  };

  const handleOAuthApple = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signInWithApple();
    if (!mountedRef.current) return;
    if (error) setError(authErrorMessage(error));
    if (error || Capacitor.isNativePlatform()) setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setWrongPassword(false);
    setLoading(true);

    try {
      if (isJoiner) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          // Supabase answers "invalid credentials" both for a new address and
          // for a wrong password: only then try to create the account.
          if (authErrorKind(signInError) !== 'invalid_credentials') {
            if (!mountedRef.current) return;
            setError(authErrorMessage(signInError));
            setLoading(false);
            return;
          }
          const { error: signUpError, session, existing } = await signUp(email, password, {
            full_name: fullName,
          });
          if (!mountedRef.current) return;
          if (existing || authErrorKind(signUpError) === 'already_registered') {
            // The account exists: the password was wrong.
            setWrongPassword(true);
            setError(t('Wrong password for {email}.', { email }));
            setLoading(false);
            return;
          }
          if (signUpError) {
            setError(authErrorMessage(signUpError));
            setLoading(false);
            return;
          }
          if (!session) {
            setConfirmEmail(email.trim());
            setLoading(false);
            return;
          }
        }
      } else {
        const { error, session, existing } = await signUp(email, password, { full_name: fullName });
        if (!mountedRef.current) return;
        if (error || existing) {
          setError(existing ? t('This email is already registered. Try signing in.') : authErrorMessage(error));
          setLoading(false);
          return;
        }
        if (!session) {
          setConfirmEmail(email.trim());
          setLoading(false);
          return;
        }
      }

      setAccountData({
        email,
        password,
        authMethod: 'email',
      });

      setSuccess(t('Account created!'));
      setTimeout(() => {
        if (mountedRef.current) onComplete();
      }, 600);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(authErrorMessage(err));
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!confirmEmail || resend === 'sending') return;
    setResend('sending');
    setError(null);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: confirmEmail,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    if (!mountedRef.current) return;
    if (error) {
      setError(authErrorMessage(error));
      setResend('idle');
      return;
    }
    setResend('sent');
  };

  const { step, total } = wizardStep(path, 'account');

  // Email confirmation on: no session until the link is opened.
  if (confirmEmail) {
    const [sentBefore, sentAfter = ''] = t('We sent a link to {email}. Open it on this device to confirm your address and finish creating your account.', {
      email: '\u0000',
    }).split('\u0000');
    return (
      <AuthScreen
        top={<WizardTop onBack={() => { setConfirmEmail(null); setResend('idle'); setError(null); }} step={step} total={total} />}
        bodyClassName="pt-2 gap-5"
        footer={
          <>
            {onSignIn && (
              <PillButton onClick={onSignIn} trailingIcon={<ArrowUpRight className="w-5 h-5" />}>
                {t('I’ve confirmed it: sign in')}
              </PillButton>
            )}
            <PillButton variant="ghost" size="md" onClick={handleResend} loading={resend === 'sending'} disabled={resend === 'sent'}>
              {resend === 'sent' ? t('Email sent again') : t('Send the email again')}
            </PillButton>
          </>
        }
      >
        <Kicker overline={t('Account')} title={t('Check your email')} />
        <p role="status" className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground -mt-1 break-words">
          {sentBefore}
          <span className="text-foreground font-medium">{confirmEmail}</span>
          {sentAfter}
        </p>
        {error && <FormError>{error}</FormError>}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      top={<WizardTop onBack={onBack} step={step} total={total} />}
      bodyClassName="pt-2 gap-5"
      footer={
        <>
          <PillButton
            type="submit"
            form="account-creation-form"
            loading={loading}
            trailingIcon={<ArrowUpRight className="w-5 h-5" />}
          >
            {t('Continue')}
          </PillButton>
          <p className="bw-body-sm text-muted-foreground">
            {/* The two links sit inside the sentence: split it around their placeholders. */}
            {t('By continuing you accept the {terms} and {privacy}.').split(/(\{terms\}|\{privacy\})/).map((part, i) =>
              part === '{terms}' ? (
                <a key={i} href={legalUrl('terms')} onClick={(e) => { e.preventDefault(); setLegalDoc('terms'); }} className="text-foreground underline underline-offset-4">{t('Terms')}</a>
              ) : part === '{privacy}' ? (
                <a key={i} href={legalUrl('privacy')} onClick={(e) => { e.preventDefault(); setLegalDoc('privacy'); }} className="text-foreground underline underline-offset-4">{t('Privacy Policy')}</a>
              ) : (
                <React.Fragment key={i}>{part}</React.Fragment>
              ),
            )}
            <LegalSheet doc={legalDoc} onClose={() => setLegalDoc(null)} />
          </p>
        </>
      }
    >
      <Kicker overline={t('Account')} title={isJoiner ? t('Join band') : t('Create account')} />
      <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground -mt-1">
        {isJoiner ? t('One step to join the crew.') : t("Let's get you set up in seconds.")}
      </p>

      {/* OAuth */}
      <div className="grid grid-cols-2 gap-3">
        <PillButton
          variant="white"
          size="md"
          onClick={handleOAuthGoogle}
          disabled={loading}
          icon={<GoogleBrandIcon size={18} className="shrink-0" />}
        >
          Google
        </PillButton>
        <PillButton
          variant="white"
          size="md"
          onClick={handleOAuthApple}
          disabled={loading}
          icon={<AppleBrandIcon size={18} className="shrink-0" />}
        >
          Apple
        </PillButton>
      </div>

      <OrDivider label={t('or with email')} />

      {/* Form (submitted by the pinned footer CTA via form="account-creation-form") */}
      <form id="account-creation-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              key="account-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <FormError>{error}</FormError>
              {wrongPassword && onForgotPassword && (
                <PillButton variant="ghost" size="sm" fullWidth={false} onClick={onForgotPassword} className="mt-2 -mx-3 text-muted-foreground">
                  {t('Forgot password?')}
                </PillButton>
              )}
            </motion.div>
          )}
          {success && (
            <motion.div
              key="account-success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div role="status" className="flex items-center gap-3 p-4 rounded-[20px] border-2 border-success text-success">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-[14px] leading-[1.4] font-medium">{success}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isJoiner && (
          <PillField
            label={t('Full name')}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('Your name')}
            autoComplete="name"
            autoCapitalize="words"
            icon={<User className="w-5 h-5" strokeWidth={1.75} />}
            required
          />
        )}

        <PillField
          label={t('Email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          autoCapitalize="none"
          inputMode="email"
          readOnly={isEmailReadonly}
          className={isEmailReadonly ? 'opacity-50' : undefined}
          icon={<Mail className="w-5 h-5" strokeWidth={1.75} />}
          required
        />

        <PillField
          label={t('Password')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('Password')}
          autoComplete={isJoiner ? 'current-password' : 'new-password'}
          icon={<Lock className="w-5 h-5" strokeWidth={1.75} />}
          hint={t('Min 8 characters')}
          required
          minLength={8}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('Hide password') : t('Show password')}
              className="-m-2 p-2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.75} /> : <Eye className="w-5 h-5" strokeWidth={1.75} />}
            </button>
          }
        />
      </form>
    </AuthScreen>
  );
};

export default AccountCreation;
