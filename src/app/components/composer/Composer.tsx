/**
 * One-screen composers for tablets (Figma iPad · 04 "New gig", iPad · 05
 * "Rehearsal / New", iPad · 06 "Quote / New"): every step of a wizard on one
 * screen in numbered cards, with a live preview beside them.
 *
 * Only on a tablet-sized window (`data-bw-wide`, never on the iPhone Duo):
 * phones and the Duo keep the step wizards. The wizards render these pieces
 * with their own state, so saving behaves exactly as in the steps.
 */
import React, { useEffect, useState } from 'react';
import { Check, X } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { IconButton, PillButton } from '@/app/components/bw';
import { useRailLayout } from '@/lib/deviceRegions';
import { useT } from '@/lib/i18n';

/** True when the wizard should open as a one-screen composer. */
export function useComposerLayout(): { composer: boolean; landscape: boolean } {
  const { wide, rail } = useRailLayout();
  const read = () => typeof window !== 'undefined' && window.innerWidth >= window.innerHeight * 1.15;
  const [landscape, setLandscape] = useState(read);
  useEffect(() => {
    const onResize = () => setLandscape(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { composer: wide && !rail, landscape };
}

/** ▬▬▬▬▬ 4 OF 5 READY */
export const ReadinessDashes: React.FC<{ done: number; total: number; color?: string; className?: string }> = ({
  done,
  total,
  color = 'var(--wizard-accent)',
  className,
}) => {
  const t = useT();
  return (
    <div className={cn('flex items-center gap-3 shrink-0', className)} role="status">
      <span aria-hidden className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="w-6 h-[5px] rounded-full"
            style={{ backgroundColor: i < done ? color : 'color-mix(in srgb, var(--foreground) 14%, transparent)' }}
          />
        ))}
      </span>
      <span className="bw-label-sm text-foreground whitespace-nowrap">
        {t('{done} of {total} ready', { done, total })}
      </span>
    </div>
  );
};

export interface ComposerShellProps {
  title: string;
  /** Mono line under the title ("Draft · saved 10:42"). */
  subline?: React.ReactNode;
  closeLabel: string;
  onClose: () => void;
  ready: { done: number; total: number };
  /** Centre of the header (e.g. Schedule directly | Poll availability). */
  headerCenter?: React.ReactNode;
  onSaveDraft?: () => void;
  /** Event colour for the readiness dashes and the primary buttons. */
  accent: string;
  accentFg?: string;
  children: React.ReactNode;
  /** data-wizard-type, kept for tests and scans. */
  kind: string;
  /** Stacking class; above the tab bar when opened outside the create flow (poll). */
  zClassName?: string;
}

export const ComposerShell: React.FC<ComposerShellProps> = ({
  title,
  subline,
  closeLabel,
  onClose,
  ready,
  headerCenter,
  onSaveDraft,
  accent,
  accentFg,
  children,
  kind,
  zClassName = 'z-[100]',
}) => {
  const t = useT();
  return (
    <div
      data-modal-open="true"
      data-wizard-type={kind}
      data-bw-composer=""
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={
        {
          '--wizard-accent': accent,
          '--wizard-accent-fg': accentFg ?? 'var(--accent-gig-fg)',
          paddingTop: 'calc(var(--safe-top, 0px) + 16px)',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + 24px)',
        } as React.CSSProperties
      }
      className={cn('fixed inset-0 bg-background text-foreground overflow-y-auto overscroll-contain animate-in fade-in duration-200', zClassName)}
    >
      <div className="mx-auto w-full max-w-[1280px] px-8 flex flex-col gap-5">
        <header className="flex items-center gap-4 min-h-[56px] flex-wrap">
          <IconButton label={closeLabel} icon={<X />} variant="outline" size="md" onClick={onClose} />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h1 className="bw-h1 truncate">{title}</h1>
            {subline && <p className="bw-label-xs text-muted-foreground truncate">{subline}</p>}
          </div>
          {headerCenter}
          <ReadinessDashes done={ready.done} total={ready.total} color={accent} />
          {onSaveDraft && (
            <PillButton variant="outline" size="md" fullWidth={false} onClick={onSaveDraft}>
              {t('Save draft')}
            </PillButton>
          )}
        </header>
        {children}
      </div>
    </div>
  );
};

/** A numbered card: ① EVENT ✓ */
export const ComposerCard: React.FC<{
  n?: number;
  title: string;
  done?: boolean;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ n, title, done, trailing, className, children }) => (
  <section className={cn('bg-card text-card-foreground rounded-[28px] p-5 flex flex-col gap-4 min-w-0', className)}>
    <div className="flex items-center gap-3 min-h-6">
      {n != null && (
        <span
          aria-hidden
          className="w-6 h-6 rounded-full bg-surface-inverse text-surface-inverse-foreground flex items-center justify-center bw-label-xs shrink-0"
        >
          {n}
        </span>
      )}
      <h2 className="bw-label-md text-foreground flex-1 min-w-0 truncate">{title}</h2>
      {trailing}
      {done && <Check aria-hidden className="w-5 h-5 text-success shrink-0" />}
    </div>
    {children}
  </section>
);

/** The live preview column: "LIVE PREVIEW · AS THE BAND SEES IT". */
export const ComposerPreview: React.FC<{
  label: string;
  caption: string;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ label, caption, className, children, footer }) => (
  <section
    className={cn('bg-card text-card-foreground rounded-[28px] p-5 flex flex-col gap-4 min-w-0', className)}
    aria-live="polite"
  >
    <div className="flex items-center justify-between gap-3">
      <h2 className="bw-label-md text-foreground truncate">{label}</h2>
      <span className="bw-label-xs text-muted-foreground truncate">{caption}</span>
    </div>
    {children}
    {footer && <div className="mt-auto pt-2 flex flex-col gap-3">{footer}</div>}
  </section>
);

/** ✓ Event & client — one line of the preview checklist. */
export const ComposerCheck: React.FC<{ done: boolean; children: React.ReactNode }> = ({ done, children }) => (
  <li className={cn('flex items-start gap-2 bw-body-sm', done ? 'text-foreground' : 'text-muted-foreground')}>
    <Check
      aria-hidden
      className={cn('w-4 h-4 shrink-0 mt-[2px]', done ? 'text-success' : 'text-muted-foreground/40')}
    />
    <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
  </li>
);

/** Small segmented control (Fixed | TBD, Peak | Standard | Off-peak…). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex items-center gap-1 p-1 rounded-full bg-field min-w-0', className)}
    >
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-full bw-label-sm whitespace-nowrap px-3 transition-colors cursor-pointer',
              size === 'md' ? 'h-11' : 'h-9',
              on ? 'bg-surface-inverse text-surface-inverse-foreground' : 'text-foreground hover:bg-foreground/[0.06]',
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
