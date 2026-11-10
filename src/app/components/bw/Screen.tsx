import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ChevronRight, Search, X } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';

/* ─────────────────────────────────────────────────────────────────────────
 * Screen building blocks, 1:1 with the Figma components:
 *   Icon Button · Badge (Tag) · Screen header (Row + Kicker) · Input (search)
 *   · Sheet + Sheet Header · List Row · Card.
 * Use these instead of ad-hoc classes so every screen stays on the system.
 * ───────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────── Icon Button ────────────────────────────── */

export type IconButtonStyle = 'outline' | 'filled' | 'ghost' | 'event' | 'sheet';

const ICON_BTN_STYLE: Record<IconButtonStyle, string> = {
  outline: 'border-[1.5px] border-foreground text-foreground',
  filled: 'bg-surface-inverse text-surface-inverse-foreground',
  ghost: 'text-foreground',
  event: 'border-[1.5px] border-current',
  sheet: 'border-[1.5px] border-sheet-foreground/85 text-sheet-foreground',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (required: the button has no visible text). */
  label: string;
  icon: React.ReactNode;
  variant?: IconButtonStyle;
  /** SM 36 (icon 16) · MD 44 (icon 20). SM keeps a 44 hit area. */
  size?: 'sm' | 'md';
}

/** Figma "Icon Button" (Outline / Filled / Ghost / Event, SM / MD). */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, variant = 'outline', size = 'md', className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full shrink-0 transition-[transform,opacity]',
        'active:scale-[var(--press-scale,0.97)] disabled:opacity-40',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        size === 'md' ? 'w-11 h-11 [&_svg]:w-5 [&_svg]:h-5' : 'w-9 h-9 [&_svg]:w-4 [&_svg]:h-4',
        size === 'sm' && "after:absolute after:-inset-1 after:content-['']",
        ICON_BTN_STYLE[variant],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  ),
);
IconButton.displayName = 'IconButton';

/* ───────────────────────────────── Tag ───────────────────────────────── */

export type TagStyle = 'solid' | 'outline' | 'accent' | 'subtle' | 'gig' | 'rehearsal' | 'quote' | 'personal' | 'past';

const TAG_STYLE: Record<TagStyle, string> = {
  solid: 'bg-surface-inverse text-surface-inverse-foreground',
  outline: 'border border-foreground text-foreground',
  accent: 'bg-accent text-accent-foreground',
  subtle: 'bg-foreground/[0.08] text-foreground',
  gig: 'bg-accent-gig text-accent-gig-foreground',
  rehearsal: 'bg-accent-rehearsal text-accent-rehearsal-foreground',
  quote: 'bg-accent-quote text-accent-quote-foreground',
  personal: 'bg-accent-personal text-accent-personal-foreground',
  past: 'bg-accent-past text-accent-past-foreground',
};

/** Figma "Badge": 16pt pill, Label/XS. Event styles use the event colours. */
export const Tag: React.FC<{ children: React.ReactNode; variant?: TagStyle; icon?: React.ReactNode; className?: string }> = ({
  children,
  variant = 'subtle',
  icon,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 h-4 px-1.5 rounded-full bw-label-xs whitespace-nowrap shrink-0 [&_svg]:w-2.5 [&_svg]:h-2.5',
      TAG_STYLE[variant],
      className,
    )}
  >
    {icon}
    {children}
  </span>
);

/* ──────────────────────────── Screen header ──────────────────────────── */

export interface ScreenHeaderProps {
  /** Back action; omit on root screens. */
  onBack?: () => void;
  backLabel?: string;
  /** Right-hand controls (IconButtons), e.g. a Filled "+" for create. */
  actions?: React.ReactNode;
  /** Micro-caps line above the title (Label/SM). */
  overline?: React.ReactNode;
  title?: React.ReactNode;
  /** Display/LG (default) · Display/XL for hero screens · H1 for dense ones. */
  titleSize?: 'xl' | 'lg' | 'h1';
  /** Extra content under the title (filters, segmented control…). */
  children?: React.ReactNode;
  /** Stick the control row to the top while the page scrolls. */
  sticky?: boolean;
  className?: string;
}

/**
 * Figma screen "Header": a 44pt row with the back button (Outline MD) and
 * actions on the right, then the Kicker (overline + display title).
 * Pads for the status bar itself.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  onBack,
  backLabel = 'Back',
  actions,
  overline,
  title,
  titleSize = 'lg',
  children,
  sticky = false,
  className,
}) => (
  <header
    className={cn('px-4 flex flex-col gap-3 bg-background', sticky && 'sticky top-0 z-30', className)}
    style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}
  >
    {(onBack || actions) && (
      <div className="flex items-center gap-3 min-h-11">
        {onBack && <IconButton label={backLabel} icon={<ArrowLeft />} onClick={onBack} />}
        <div className="flex-1" />
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    )}
    {(overline || title) && (
      <div className="flex flex-col gap-1 min-w-0">
        {overline && <p className="bw-label-sm text-muted-foreground">{overline}</p>}
        {title && (
          <h1
            className={cn(
              'text-foreground [overflow-wrap:anywhere]',
              titleSize === 'xl' && 'bw-display-xl',
              titleSize === 'lg' && 'bw-display-lg',
              titleSize === 'h1' && 'bw-h1',
            )}
          >
            {title}
          </h1>
        )}
      </div>
    )}
    {children}
  </header>
);

/* ───────────────────────────── Search field ───────────────────────────── */

export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name (visually hidden, like the Figma search Input). */
  label?: string;
}

/** Figma "Input" used as a search: 52pt white pill, search icon, Body/LG. */
export const SearchField: React.FC<SearchFieldProps> = ({ value, onChange, label = 'Search', placeholder, className, ...rest }) => (
  <label
    className={cn(
      'flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border text-foreground',
      'focus-within:border-2 focus-within:border-foreground transition-[border-color]',
      className,
    )}
  >
    <span className="sr-only">{label}</span>
    <Search className="w-5 h-5 shrink-0" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg placeholder:text-muted-foreground/60 [&::-webkit-search-cancel-button]:hidden"
      {...rest}
    />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="-m-2 p-2 shrink-0 text-muted-foreground">
        <X className="w-4 h-4" />
      </button>
    )}
  </label>
);

/* ──────────────────────────────── Card ──────────────────────────────── */

/** Figma content card: bg/card, radius 24, padding 16, gap 12. */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={cn('bg-card text-card-foreground rounded-[24px] p-4 flex flex-col gap-3', className)} {...rest} />
);

/* ─────────────────────────────── List Row ─────────────────────────────── */

export interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 20pt icon shown in a 40pt subtle circle (Type=Navigation). */
  icon?: React.ReactNode;
  /** Right side: a value (Numeric/LG), a Toggle, or nothing for a chevron. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Figma "List Row" (Navigation / Value / Toggle). */
export const ListRow: React.FC<ListRowProps> = ({ title, subtitle, icon, trailing, onClick, className }) => {
  const body = (
    <>
      {icon && (
        <span className="w-10 h-10 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0 [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0 flex flex-col gap-1 text-left">
        <span className="bw-body-lg text-foreground truncate">{title}</span>
        {subtitle && <span className="bw-body-sm text-muted-foreground truncate">{subtitle}</span>}
      </span>
      {trailing ?? (onClick ? <ChevronRight className="w-5 h-5 shrink-0" aria-hidden /> : null)}
    </>
  );
  const cls = cn('w-full flex items-center gap-3 p-4 rounded-[16px] bg-card text-foreground', className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, 'active:scale-[0.99] transition-transform')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

/* ──────────────────────────────── Sheet ──────────────────────────────── */

export interface BwSheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  overline?: React.ReactNode;
  /** Dark (default, Figma Sheet Header Style=Dark) or Light. */
  tone?: 'dark' | 'light';
  /** Pinned bottom area (primary action). */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  closeLabel?: string;
  zIndex?: number;
}

/**
 * Bottom sheet with the Figma "Sheet Header" (grabber, overline, H1 title,
 * Outline SM close). Dark tone uses bg/sheet; content inherits the sheet colours.
 */
export const BwSheet: React.FC<BwSheetProps> = ({
  open,
  onClose,
  title,
  overline,
  tone = 'dark',
  footer,
  children,
  closeLabel = 'Close',
  zIndex = 90,
}) => {
  const dark = tone === 'dark';
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bw-sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60"
            style={{ zIndex: zIndex - 1 }}
            onClick={onClose}
          />
          <motion.div
            key="bw-sheet"
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              'fixed inset-x-0 bottom-0 max-h-[88vh] flex flex-col rounded-t-[32px]',
              dark ? 'bg-sheet text-sheet-foreground' : 'bg-background text-foreground',
            )}
            style={{ zIndex }}
          >
            <div className="shrink-0 px-5 pt-3 pb-2 flex flex-col gap-3">
              <span className={cn('mx-auto w-10 h-[5px] rounded-full', dark ? 'bg-sheet-foreground/85' : 'bg-muted-foreground/55')} />
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  {overline && <p className={cn('bw-label-sm', dark ? 'text-sheet-foreground/85' : 'text-muted-foreground')}>{overline}</p>}
                  <h2 className="bw-h1 [overflow-wrap:anywhere]">{title}</h2>
                </div>
                <IconButton label={closeLabel} icon={<X />} size="sm" variant={dark ? 'sheet' : 'outline'} onClick={onClose} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4">{children}</div>
            {footer && (
              <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
                {footer}
              </div>
            )}
            {!footer && <div style={{ height: 'var(--safe-bottom)' }} />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
