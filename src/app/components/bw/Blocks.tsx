import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { t } from '@/lib/i18n';
import { ArrowUpRight } from '@/app/components/icons';
import { EventMark, type EventKind } from './EventMark';

/* ─────────────────────────── Section Header ─────────────────────────── */

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  className?: string;
}

// The default label is read at render; the screens using this header re-render on a language change.
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, onSeeAll, seeAllLabel = t('See all'), className }) => (
  <div className={cn('flex items-center gap-2.5', className)}>
    <h2 className="bw-h1 flex-1 min-w-0 truncate">{title}</h2>
    {onSeeAll && (
      <button
        type="button"
        onClick={onSeeAll}
        className="flex items-center gap-2.5 shrink-0 text-foreground cursor-pointer group"
        aria-label={`${seeAllLabel}: ${title}`}
      >
        <ArrowUpRight className="w-6 h-6" />
        <span className="bw-button-sm text-muted-foreground group-hover:text-foreground transition-colors">
          {seeAllLabel}
        </span>
      </button>
    )}
  </div>
);

/* ─────────────────────────────── Step Pad ─────────────────────────────── */

interface StepPadProps {
  day: string;
  date: string | number;
  time?: string;
  /** One entry per member; true = available. */
  votes?: boolean[];
  selected?: boolean;
  /** Pad sits on a dark (sheet) card. */
  onDark?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

/** A step-sequencer pad: one option of a rehearsal poll. */
export const StepPad: React.FC<StepPadProps> = ({ day, date, time, votes = [], selected, onDark, onClick, disabled }) => {
  const fg = selected ? 'var(--accent-fg)' : onDark ? '#FFFFFF' : 'var(--fg)';
  const bg = selected ? 'var(--accent)' : onDark ? 'rgba(255,255,255,0.08)' : 'var(--muted)';
  const dotOn = selected ? '#000000' : onDark ? '#FFFFFF' : 'var(--dot-on)';
  const dotOff = selected ? 'rgba(0,0,0,0.18)' : onDark ? 'rgba(255,255,255,0.18)' : 'var(--dot-off)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={!!selected}
      className="@container flex-1 min-w-0 flex flex-col gap-1.5 rounded-[16px] px-3 py-2.5 text-left cursor-pointer active:scale-[0.97] transition-[transform,background-color] disabled:cursor-default"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="flex items-center justify-between">
        <span className="bw-label-sm">{day}</span>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selected ? '#000' : dotOff }} />
      </span>
      <span className="bw-num">{date}</span>
      {time && (() => {
        // On narrow pads only the start time fits; the end time hides
        // through a container query instead of overflowing the pad.
        const [start, end] = time.split('–');
        return (
          <span className="bw-label-xs opacity-70 whitespace-nowrap" aria-label={time}>
            {start}
            {end && <span className="@max-[70px]:hidden">–{end}</span>}
          </span>
        );
      })()}
      {votes.length > 0 && (
        <span className="flex justify-between pt-1" aria-label={`${votes.filter(Boolean).length} of ${votes.length} available`}>
          {votes.map((v, i) => (
            <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: v ? dotOn : dotOff }} />
          ))}
        </span>
      )}
    </button>
  );
};

/* ────────────────────────────── Action Tile ───────────────────────────── */

interface ActionTileProps {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

/** Quick-action tile: label + ↗, and a 4-row "list" glyph. */
export const ActionTile: React.FC<ActionTileProps> = ({ label, onClick, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex-1 min-w-0 flex flex-col gap-3 text-left text-foreground cursor-pointer active:scale-[0.97] transition-transform group"
  >
    <span className="flex items-center justify-between gap-2 w-full">
      <span className="bw-label-md truncate">{label}</span>
      {icon ?? <ArrowUpRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
    </span>
    <span className="flex flex-col gap-1 w-full" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--dot-on)' }} />
          <span className="h-2.5 flex-1 rounded-full" style={{ backgroundColor: 'var(--dot-mid)' }} />
        </span>
      ))}
    </span>
  </button>
);

/* ────────────────────────── Date Tile + Upcoming Row ──────────────────── */

interface DateTileProps {
  day: string | number;
  month: string;
  kind: EventKind;
}

export const DateTile: React.FC<DateTileProps> = ({ day, month, kind }) => (
  <span
    className="w-14 h-[60px] rounded-full flex flex-col items-center justify-center shrink-0"
    style={{ backgroundColor: `var(--accent-${kind})`, color: `var(--accent-${kind}-fg)` }}
  >
    <span className="bw-num">{day}</span>
    <span className="bw-label-xs mt-0.5">{month}</span>
  </span>
);

interface UpcomingRowProps {
  kind: EventKind;
  typeLabel: string;
  title: string;
  meta?: string;
  day: string | number;
  month: string;
  value?: string;
  onClick?: () => void;
}

export const UpcomingRow: React.FC<UpcomingRowProps> = ({ kind, typeLabel, title, meta, day, month, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 text-left text-foreground cursor-pointer active:scale-[0.99] transition-transform"
  >
    <DateTile day={day} month={month} kind={kind} />
    <span className="flex-1 min-w-0 flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <EventMark kind={kind} size={20} />
        <span className="bw-label-sm">{typeLabel}</span>
      </span>
      <span className="bw-h3 truncate">{title}</span>
      {meta && <span className="bw-label-sm text-muted-foreground truncate">{meta}</span>}
    </span>
    {value && <span className="bw-num shrink-0 whitespace-nowrap">{value}</span>}
  </button>
);
