import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { BackButton } from '@/app/components/bw/Form';
import type { OnboardingPath } from '@/lib/OnboardingContext';

/* ─────────────────────────────────────────────────────────────────────────
 * Onboarding wizard chrome (Figma "01 · Auth & Onboarding"): Wizard top bar
 * (back icon button · step indicator · "STEP N OF M"), plus a few small
 * primitives the onboarding screens share (choice pill, dot-matrix radio,
 * bottom sheet).
 * ───────────────────────────────────────────────────────────────────────── */

export type WizardScreen = 'account' | 'intent' | 'band' | 'profile' | 'invite' | 'songs';

const CREATOR_ORDER: WizardScreen[] = ['account', 'intent', 'band', 'profile', 'invite', 'songs'];
const SOLO_ORDER: WizardScreen[] = ['account', 'intent', 'profile'];
const JOINER_ORDER: WizardScreen[] = ['account', 'profile'];

/** Step number and total for a screen, depending on the onboarding path. */
export function wizardStep(path: OnboardingPath | null | undefined, screen: WizardScreen): { step: number; total: number } {
  const order = path === 'joiner' ? JOINER_ORDER : path === 'solo' ? SOLO_ORDER : CREATOR_ORDER;
  const i = order.indexOf(screen);
  return { step: i < 0 ? 1 : i + 1, total: order.length };
}

/** Figma "Step Indicator": done = fg, current = 40pt lime pill, upcoming = dot-off. */
export const StepIndicator: React.FC<{ step: number; total: number; className?: string }> = ({ step, total, className }) => (
  <div className={cn('flex items-center gap-1', className)} aria-hidden="true">
    {Array.from({ length: total }).map((_, i) => {
      const n = i + 1;
      return (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full shrink-0 transition-[width,background-color] duration-300',
            n === step ? 'w-10 bg-accent' : 'w-4',
            n < step && 'bg-foreground',
            n > step && 'bg-dot-off',
          )}
        />
      );
    })}
  </div>
);

/** Figma "Wizard top": back · step indicator · step label. Pass to AuthScreen `top`. */
export const WizardTop: React.FC<{ onBack: () => void; step: number; total: number; backLabel?: string }> = ({
  onBack,
  step,
  total,
  backLabel,
}) => (
  <div className="w-full flex items-center justify-between gap-3">
    <BackButton onClick={onBack} label={backLabel} />
    <StepIndicator step={step} total={total} />
    <p className="bw-label-sm text-muted-foreground whitespace-nowrap" aria-label={`Step ${step} of ${total}`}>
      Step {step} of {total}
    </p>
  </div>
);

/**
 * Selector SM pill (28pt) for inline multi-choices. `tone` sets the selected
 * look: accent (lime, instruments) or inverse (black, songs).
 */
export const ChoicePill: React.FC<{
  selected: boolean;
  onClick: () => void;
  tone?: 'accent' | 'inverse';
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}> = ({ selected, onClick, tone = 'accent', children, className, ...rest }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    aria-label={rest['aria-label']}
    className={cn(
      'inline-flex items-center gap-1.5 h-7 px-3 rounded-full bw-label-sm whitespace-nowrap shrink-0',
      'transition-[transform,background-color,color] active:scale-[var(--press-scale,0.97)]',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
      selected
        ? tone === 'accent'
          ? 'bg-accent text-accent-foreground'
          : 'bg-surface-inverse text-surface-inverse-foreground'
        : 'border border-border text-muted-foreground',
      className,
    )}
  >
    {children}
  </button>
);

/**
 * Figma "Control / Radio": 4×4 dot matrix on a 6pt pitch with the corner dots
 * dropped. Off = outline ring in dot-mid; checked = every dot filled.
 */
export const DotMatrixRadio: React.FC<{ checked: boolean; className?: string }> = ({ checked, className }) => {
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const corner = (r === 0 || r === 3) && (c === 0 || c === 3);
      const inner = r > 0 && r < 3 && c > 0 && c < 3;
      dots.push(
        <span
          key={`${r}-${c}`}
          className="w-1 h-1 rounded-full"
          style={{
            backgroundColor: corner || (inner && !checked) ? 'transparent' : checked ? 'var(--dot-on)' : 'var(--dot-mid)',
          }}
        />,
      );
    }
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid grid-cols-4 gap-0.5 place-items-center w-6 h-6 p-[3px] rounded-[6px] shrink-0',
        checked && 'ring-[1.5px] ring-inset ring-accent',
        className,
      )}
    >
      {dots}
    </span>
  );
};

/**
 * Dark bottom sheet used by the onboarding add/invite dialogs. Scopes the dark
 * theme so tokens (fields, borders, dots) read correctly on the sheet.
 */
export const OnboardingSheet: React.FC<{
  title: React.ReactNode;
  overline?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
  labelledBy?: string;
  closeIcon: React.ReactNode;
}> = ({ title, overline, onClose, children, closeLabel = 'Close', labelledBy, closeIcon }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledBy}
    className="dark relative w-full max-w-md bg-sheet text-foreground rounded-t-[24px] px-4 pt-2 max-h-[85vh] overflow-y-auto"
    style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
  >
    <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/40" aria-hidden />
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex flex-col gap-1 min-w-0">
        {overline && <p className="bw-label-sm text-muted-foreground truncate">{overline}</p>}
        <h3 id={labelledBy} className="bw-h2">
          {title}
        </h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-m-1 p-1 rounded-full shrink-0 active:scale-[var(--press-scale,0.97)] transition-transform"
      >
        <span className="flex items-center justify-center w-9 h-9 rounded-full border-[1.5px] border-foreground">{closeIcon}</span>
      </button>
    </div>
    {children}
  </div>
);
