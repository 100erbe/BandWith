import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { parseLocalDate } from '@/lib/dates';

/* Small pieces shared by the Laptop pose modes. */

const validDate = (d: Date) => !Number.isNaN(d.getTime());

/** "Sat, Dec 14" from YYYY-MM-DD (local day), or the raw value when unparseable. */
export function dayLabel(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  if (!date) return '';
  const d = parseLocalDate(date);
  return validDate(d) ? d.toLocaleDateString('en-US', opts) : date;
}

/** Whole days from today to `date` (negative in the past), or null. */
export function daysFromToday(date: string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const d = parseLocalDate(date);
  if (!validDate(d)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

export function relativeDays(n: number | null): string | null {
  if (n === null) return null;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1) return `In ${n} days`;
  if (n === -1) return 'Yesterday';
  return `${-n} days ago`;
}

/** "19:00" from "19:00", "19:00:00" or "7:00"; null when empty. */
export function hhmm(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t.trim() || null;
}

/** Seconds from "3:45", "1:02:30" or a number of seconds; null when unknown. */
export function durationSeconds(d: string | number | null | undefined): number | null {
  if (d === null || d === undefined || d === '') return null;
  if (typeof d === 'number') return Number.isFinite(d) && d > 0 ? Math.round(d) : null;
  const parts = d.trim().split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/** "4:05" or "1:04:05". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const initialsOf = (name?: string | null) =>
  name
    ? name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

/** Section heading on the Deck. */
export const DeckHeading: React.FC<{ children: React.ReactNode; trailing?: React.ReactNode; className?: string }> = ({
  children,
  trailing,
  className,
}) => (
  <div className={cn('flex items-center justify-between gap-3', className)}>
    <h2 className="bw-label-md uppercase text-muted-foreground">{children}</h2>
    {trailing}
  </div>
);

/** Empty state for either half. */
export const ModeEmpty: React.FC<{ title: string; detail?: string; className?: string }> = ({ title, detail, className }) => (
  <div className={cn('flex flex-col items-start justify-center gap-1 py-6', className)}>
    <p className="bw-h3">{title}</p>
    {detail && <p className="bw-body-sm text-muted-foreground">{detail}</p>}
  </div>
);

/** A big Deck button (56pt, or 72pt+ pads for `size="pad"`). */
export const DeckButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'muted' | 'accent' | 'inverse' | 'outline';
    size?: 'md' | 'pad';
  }
> = ({ tone = 'muted', size = 'md', className, children, type = 'button', ...rest }) => (
  <button
    type={type}
    className={cn(
      'flex items-center justify-center gap-2 rounded-[20px] cursor-pointer select-none',
      'transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-default',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
      size === 'pad' ? 'min-h-[72px] px-5 bw-button-md' : 'min-h-14 px-4 bw-button-sm',
      tone === 'accent' && 'bg-accent text-accent-foreground',
      tone === 'inverse' && 'bg-surface-inverse text-surface-inverse-foreground',
      tone === 'muted' && 'bg-muted text-foreground',
      tone === 'outline' && 'border-[1.5px] border-foreground text-foreground',
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);
