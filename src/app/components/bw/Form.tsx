import React from 'react';
import { AlertCircle, ArrowLeft, Loader2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { useRailBack } from '@/lib/railActions';

/* ─────────────────────────────────────────────────────────────────────────
 * Form building blocks from the Figma design system (Button, Input, Top Bar,
 * Kicker). Used by the auth, onboarding and joiner flows.
 * ───────────────────────────────────────────────────────────────────────── */

type PillVariant = 'primary' | 'dark' | 'outline' | 'white' | 'ghost' | 'danger';
type PillSize = 'lg' | 'md' | 'sm';

const VARIANT: Record<PillVariant, string> = {
  primary: 'bg-accent text-accent-foreground',
  dark: 'bg-surface-inverse text-surface-inverse-foreground',
  outline: 'border-[1.5px] border-foreground text-foreground',
  white: 'bg-white text-black',
  ghost: 'text-foreground',
  danger: 'text-destructive',
};

const SIZE: Record<PillSize, string> = {
  lg: 'h-14 px-5 text-[14px] gap-2',
  md: 'h-11 px-4 text-[14px] gap-2',
  sm: 'h-9 px-3 text-[12px] tracking-[0.02em] gap-2',
};

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant;
  size?: PillSize;
  /** Icon before the label (label stays centred). */
  icon?: React.ReactNode;
  /** Icon pushed to the far edge (Figma primary CTA: label left, ↗ right). */
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ variant = 'primary', size = 'lg', icon, trailingIcon, loading, fullWidth = true, className, children, disabled, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center rounded-full font-semibold uppercase leading-none whitespace-nowrap select-none',
        'transition-[transform,opacity] active:scale-[var(--press-scale,0.97)] disabled:opacity-40 disabled:active:scale-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        VARIANT[variant],
        SIZE[size],
        trailingIcon ? 'justify-between' : 'justify-center',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      <span className="inline-flex items-center gap-2">
        {loading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : icon}
        {children}
      </span>
      {trailingIcon && !loading && <span className="inline-flex shrink-0">{trailingIcon}</span>}
    </button>
  ),
);
PillButton.displayName = 'PillButton';

/** Circular back button (Figma Top Bar → Back). 36pt visual, 44pt hit area. */
export const BackButton: React.FC<{ onClick: () => void; label?: string; className?: string; tone?: 'default' | 'inverse' }> = ({
  onClick,
  label = 'Back',
  className,
  tone = 'default',
}) => {
  // iPhone Duo: Back lives in the side rail.
  if (useRailBack(onClick, label)) return null;
  return (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn('-m-1 p-1 rounded-full active:scale-[var(--press-scale,0.97)] transition-transform', className)}
  >
    <span
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-full border-[1.5px]',
        tone === 'inverse' ? 'border-current' : 'border-foreground text-foreground',
      )}
    >
      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
    </span>
  </button>
  );
};

/** Overline in micro caps + display title (Figma "Kicker"). */
export const Kicker: React.FC<{
  overline?: React.ReactNode;
  title: React.ReactNode;
  size?: 'xl' | 'lg' | 'md';
  className?: string;
  as?: 'h1' | 'h2';
}> = ({ overline, title, size = 'lg', className, as: Tag = 'h1' }) => (
  <div className={cn('flex flex-col gap-1', className)}>
    {overline && <p className="bw-label-sm text-muted-foreground">{overline}</p>}
    <Tag
      className={cn(
        'font-[family-name:var(--font-display)] font-bold uppercase text-foreground',
        size === 'xl' && 'text-[56px] leading-[0.88] tracking-[-0.03em]',
        size === 'lg' && 'text-[44px] leading-[0.9] tracking-[-0.03em]',
        size === 'md' && 'text-[28px] leading-[0.95] tracking-[-0.02em]',
      )}
    >
      {title}
    </Tag>
  </div>
);

export interface PillFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Leading 20px icon. */
  icon?: React.ReactNode;
  /** Trailing control (e.g. show-password toggle). Replaced by the error icon on error. */
  trailing?: React.ReactNode;
  error?: string | null;
  /** Helper shown under the field when there is no error. */
  hint?: React.ReactNode;
  /** Dark sheet variant (invite code sheet). */
  tone?: 'default' | 'sheet';
  /** Hide the visual label but keep it for screen readers. */
  hideLabel?: boolean;
}

/** Text field: label in micro caps above a 52pt pill (Figma "Input"). */
export const PillField = React.forwardRef<HTMLInputElement, PillFieldProps>(
  ({ label, icon, trailing, error, hint, tone = 'default', hideLabel, id, className, ...rest }, ref) => {
    const autoId = React.useId();
    const fieldId = id ?? autoId;
    const msgId = `${fieldId}-msg`;
    const sheet = tone === 'sheet';
    return (
      <div className={cn('flex flex-col gap-2 w-full', className)}>
        <label htmlFor={fieldId} className={cn('bw-label-sm', sheet ? 'text-white/70' : 'text-muted-foreground', hideLabel && 'sr-only')}>
          {label}
        </label>
        <div
          className={cn(
            'flex items-center gap-3 h-[52px] px-4 rounded-full border transition-[border-color,box-shadow]',
            sheet ? 'bg-white/10 border-white/20 text-white' : 'bg-field border-border text-foreground',
            error
              ? 'border-2 border-destructive'
              : sheet
                ? 'focus-within:border-2 focus-within:border-white'
                : 'focus-within:border-2 focus-within:border-foreground',
          )}
        >
          {icon && <span className={cn('shrink-0 flex', sheet ? 'text-white/70' : 'text-foreground')}>{icon}</span>}
          <input
            ref={ref}
            id={fieldId}
            aria-invalid={!!error || undefined}
            aria-describedby={error || hint ? msgId : undefined}
            className={cn(
              'flex-1 min-w-0 bg-transparent outline-none text-[18px] font-medium leading-[1.35] tracking-[-0.005em]',
              sheet ? 'placeholder:text-white/40' : 'placeholder:text-muted-foreground/60',
            )}
            {...rest}
          />
          {error ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-destructive" aria-hidden />
          ) : (
            trailing
          )}
        </div>
        {error ? (
          <p id={msgId} role="alert" className="text-destructive text-[14px] leading-[1.4]">
            {error}
          </p>
        ) : hint ? (
          <p id={msgId} className={cn('text-[14px] leading-[1.4]', sheet ? 'text-white/60' : 'text-muted-foreground')}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
PillField.displayName = 'PillField';

/** "— OR —" divider. */
export const OrDivider: React.FC<{ label?: string; className?: string }> = ({ label = 'or', className }) => (
  <div className={cn('flex items-center gap-3 w-full', className)} role="separator">
    <span className="flex-1 h-px bg-border" />
    <span className="bw-label-sm text-muted-foreground">{label}</span>
    <span className="flex-1 h-px bg-border" />
  </div>
);

/** Inline error banner for form-level errors (wrong password, network…). */
export const FormError: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div role="alert" className={cn('flex items-start gap-3 p-4 rounded-[20px] border-2 border-destructive text-destructive', className)}>
    <AlertCircle className="w-5 h-5 shrink-0 mt-px" />
    <p className="text-[14px] leading-[1.4] font-medium">{children}</p>
  </div>
);

/**
 * Full-height screen with safe areas. `footer` is pinned to the bottom
 * (Figma "CTA" block) and the body scrolls above it.
 */
export const AuthScreen: React.FC<{
  children: React.ReactNode;
  footer?: React.ReactNode;
  top?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}> = ({ children, footer, top, className, bodyClassName }) => (
  <div
    className={cn('min-h-[100dvh] bg-background text-foreground flex flex-col', className)}
    style={{ paddingTop: 'var(--safe-top)' }}
  >
    {top && <div className="h-14 shrink-0 flex items-center px-4 bw-status-clear">{top}</div>}
    <div className={cn('flex-1 flex flex-col px-4 pt-4 pb-6', bodyClassName)}>{children}</div>
    {footer && (
      <div className="shrink-0 px-4 pt-3 flex flex-col gap-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        {footer}
      </div>
    )}
  </div>
);

/**
 * Selector pill (Figma "Selector"): SM 28pt for inline choices, MD 36pt for
 * filter tabs. Without onClick it renders as a static label.
 */
export const Selector: React.FC<{
  children: React.ReactNode;
  selected?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
  count?: number | string;
  className?: string;
}> = ({ children, selected = true, size = 'sm', onClick, count, className }) => {
  const cls = cn(
    'inline-flex items-center gap-1.5 rounded-full bw-label-sm whitespace-nowrap shrink-0 transition-colors',
    size === 'sm' ? 'h-7 px-3' : 'h-9 px-4',
    selected ? 'bg-surface-inverse text-surface-inverse-foreground' : 'border border-foreground/25 text-foreground',
    onClick && 'active:scale-[var(--press-scale,0.97)] transition-transform',
    className,
  );
  const body = (
    <>
      {children}
      {count != null && <span className="opacity-60">{count}</span>}
    </>
  );
  return onClick ? (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <span className={cls}>{body}</span>
  );
};
