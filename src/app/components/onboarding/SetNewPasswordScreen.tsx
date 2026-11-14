import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff, Lock } from '@/app/components/icons';
import { DuoAuthLayout } from './DuoAuthLayout';
import { AuthScreen, FormError, Kicker, PillButton, PillField } from '@/app/components/bw/Form';
import { useT } from '@/lib/i18n';
import { authErrorMessage } from '@/lib/authErrors';

const MIN_LENGTH = 8;

/**
 * Shown after the user opens a password-reset link. The link signs them in
 * with a recovery session; this screen asks for the new password.
 */
export default function SetNewPasswordScreen() {
  const t = useT();
  const { completePasswordRecovery, dismissPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  // Field-level errors sit under their field (Figma: mismatch on "Confirm");
  // anything from the server goes in the banner.
  const [fieldError, setFieldError] = useState<{ field: 'password' | 'confirm'; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (password.length < MIN_LENGTH) {
      setFieldError({ field: 'password', message: t('Use at least {count} characters.', { count: MIN_LENGTH }) });
      return;
    }
    if (password !== confirm) {
      setFieldError({ field: 'confirm', message: t('The two passwords don’t match.') });
      return;
    }
    setSaving(true);
    const { error: updateError } = await completePasswordRecovery(password);
    setSaving(false);
    if (updateError) {
      setError(authErrorMessage(updateError));
      return;
    }
    setDone(true);
  };

  const toggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? t('Hide password') : t('Show password')}
      className="-m-2 p-2 text-muted-foreground"
    >
      {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.75} /> : <Eye className="w-5 h-5" strokeWidth={1.75} />}
    </button>
  );

  if (done) {
    return (
      <DuoAuthLayout>
      <AuthScreen
        bodyClassName="pt-10"
        footer={<PillButton onClick={dismissPasswordRecovery}>{t('Continue')}</PillButton>}
      >
        <div role="status" className="flex flex-col gap-4">
          <Kicker overline={t('All set')} title={t('Password updated')} />
          <p className="text-[16px] leading-[1.45] text-muted-foreground">
            {t('Your password has been updated. Use it next time you sign in.')}
          </p>
        </div>
      </AuthScreen>
      </DuoAuthLayout>
    );
  }

  return (
    <DuoAuthLayout>
    <AuthScreen bodyClassName="pt-10">
      <form onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col gap-5">
        <Kicker overline={t('Account recovery')} title={t('Set a new password')} />
        <p className="text-[16px] leading-[1.45] text-muted-foreground max-w-[340px]">
          {t('Choose a new password for your BandWith account.')}
        </p>
        {error && <FormError>{error}</FormError>}
        <PillField
          id="new-password"
          label={t('New password')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          icon={<Lock className="w-5 h-5" strokeWidth={1.75} />}
          trailing={toggle}
          error={fieldError?.field === 'password' ? fieldError.message : null}
          hint={t('At least {count} characters.', { count: MIN_LENGTH })}
        />
        <PillField
          id="confirm-password"
          label={t('Confirm new password')}
          type={showPassword ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          icon={<Lock className="w-5 h-5" strokeWidth={1.75} />}
          error={fieldError?.field === 'confirm' ? fieldError.message : null}
        />
        <div className="flex-1 min-h-6" />
        <div className="flex flex-col gap-2" style={{ paddingBottom: 'var(--safe-bottom)' }}>
          <PillButton type="submit" loading={saving}>
            {saving ? t('Saving…') : t('Save new password')}
          </PillButton>
          {/* Opened the link by mistake, or it's an old one: keep the current password. */}
          <PillButton variant="ghost" size="md" onClick={dismissPasswordRecovery} disabled={saving} className="text-muted-foreground">
            {t('Keep my current password')}
          </PillButton>
        </div>
      </form>
    </AuthScreen>
    </DuoAuthLayout>
  );
}
