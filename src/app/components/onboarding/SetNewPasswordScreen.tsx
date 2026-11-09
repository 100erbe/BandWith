import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff, Lock, Loader2 } from '@/app/components/icons';

const MIN_LENGTH = 8;

/**
 * Shown after the user opens a password-reset link. The link signs them in
 * with a recovery session; this screen asks for the new password.
 */
export default function SetNewPasswordScreen() {
  const { completePasswordRecovery, dismissPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setSaving(true);
    const { error: updateError } = await completePasswordRecovery(password);
    setSaving(false);
    if (updateError) {
      setError(updateError.message || 'Could not update your password. Please try again.');
      return;
    }
    setDone(true);
  };

  const inputClass =
    'w-full h-[52px] pl-12 pr-12 bg-card border border-border rounded-2xl text-foreground text-base ' +
    'placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-accent/40 transition-all';

  return (
    <main className="min-h-screen bg-background flex flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+48px)] pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
      <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-primary mb-2">Account recovery</p>
      <h1 className="text-[40px] leading-[0.95] font-black tracking-tight text-foreground mb-3">
        Set a new password
      </h1>
      <p className="text-[15px] text-muted-foreground mb-8">
        Choose a new password for your BandWith account.
      </p>

      {done ? (
        <div role="status" className="flex flex-col gap-6">
          <p className="text-[15px] text-foreground">Your password has been updated.</p>
          <button
            type="button"
            onClick={dismissPasswordRecovery}
            className="h-14 rounded-full bg-primary text-primary-foreground text-[13px] font-extrabold uppercase tracking-[0.15em] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Continue
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <label htmlFor="new-password" className="block text-[13px] font-semibold text-foreground mb-2">
              New password
            </label>
            <div className="relative">
              <Lock aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                aria-describedby="new-password-hint"
                aria-invalid={!!error}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-muted-foreground rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
              </button>
            </div>
            <p id="new-password-hint" className="mt-2 text-[13px] text-muted-foreground">
              At least {MIN_LENGTH} characters.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-[13px] font-semibold text-foreground mb-2">
              Confirm new password
            </label>
            <div className="relative">
              <Lock aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={!!error}
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-[14px] font-medium text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-4 h-14 rounded-full bg-primary text-primary-foreground text-[13px] font-extrabold uppercase tracking-[0.15em] flex items-center justify-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {saving && <Loader2 aria-hidden className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </main>
  );
}
