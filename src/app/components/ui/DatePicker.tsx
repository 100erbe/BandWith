import React, { useState, useMemo, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Calendar, ArrowLeft, ArrowRight, Check, X } from '@/app/components/icons';
import { cn } from './utils';
import { IconButton } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';

export interface DatePickerProps {
  value?: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  showIcon?: boolean;
  showShortcuts?: boolean;
  accentColor?: string;
}

export const getTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getTomorrowStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getNextWeekendStr = (): string => {
  const d = new Date();
  const day = d.getDay(); // 0 is Sunday, 6 is Saturday
  const daysUntilSaturday = day === 6 ? 7 : (6 - day || 7);
  d.setDate(d.getDate() + daysUntilSaturday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;

  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();

  const formatted = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (dateStr === todayStr) {
    return `Today • ${formatted}`;
  }
  if (dateStr === tomorrowStr) {
    return `Tomorrow • ${formatted}`;
  }
  return formatted;
};
/* ───────────────────────────── Picker sheet ─────────────────────────────
 * Bottom sheet used by the Date / Time pickers (Figma "Picker / Date" 26:762,
 * "Picker / Time" 26:930): light Sheet Header (grabber, overline, H1 title,
 * Outline SM close) over a scrim. Built on Radix Dialog so it portals out of
 * transformed wizard containers and keeps focus / Escape / outside-click
 * handling. Exported for TimePicker.
 * ───────────────────────────────────────────────────────────────────────── */

export interface PickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element that opens the sheet (rendered through Dialog.Trigger asChild). */
  trigger: React.ReactElement;
  overline?: React.ReactNode;
  title: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Stacking order of the sheet (scrim sits one below). */
  zIndex?: number;
  contentStyle?: React.CSSProperties;
}

export const PickerSheet: React.FC<PickerSheetProps> = ({
  open,
  onOpenChange,
  trigger,
  overline,
  title,
  footer,
  children,
  zIndex = 150,
  contentStyle,
}) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        style={{ zIndex: zIndex - 1 }}
      />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 mx-auto w-full max-w-[520px] max-h-[88dvh] flex flex-col',
          'bg-background text-foreground rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.35)] outline-none select-none',
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom duration-300',
        )}
        style={{ zIndex, ...contentStyle }}
      >
        {/* Sheet Header (Style=Light) */}
        <div className="shrink-0 px-5 pt-3 pb-2 flex flex-col gap-3">
          <span className="mx-auto w-10 h-[5px] rounded-full bg-muted-foreground/55" aria-hidden />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {overline && <p className="bw-label-sm text-muted-foreground truncate">{overline}</p>}
              <DialogPrimitive.Title className="bw-h1 text-foreground [overflow-wrap:anywhere]">{title}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close" icon={<X />} size="sm" variant="outline" />
            </DialogPrimitive.Close>
          </div>
        </div>

        {/* Sheet body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 flex flex-col gap-3">{children}</div>
        <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom, 0px) + 24px)' }}>
          {footer}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

/** "Select event date…" → "event date" (sheet title); falls back to "Date". */
const titleFromPlaceholder = (placeholder: string, fallback: string): string => {
  const m = placeholder.match(/^select\s+(.+?)[\s.…]*$/i);
  return m ? m[1] : fallback;
};

/** Figma "Selector" SM, Default / Accent states (time & date shortcuts). */
export const PickerChip: React.FC<{ selected?: boolean; onClick: () => void; children: React.ReactNode }> = ({
  selected = false,
  onClick,
  children,
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      'inline-flex items-center h-7 px-3 rounded-full bw-label-sm whitespace-nowrap shrink-0 transition-[transform,colors] active:scale-[var(--press-scale,0.97)]',
      selected ? 'bg-accent text-accent-foreground' : 'border border-border text-muted-foreground',
    )}
  >
    {children}
  </button>
);

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const DatePicker: React.FC<DatePickerProps> = ({
  value = '',
  onChange,
  className,
  disabled = false,
  placeholder = 'Select event date...',
  id,
  showIcon = true,
  showShortcuts = true,
  accentColor,
}) => {
  const [open, setOpen] = useState(false);

  // Month & year view state
  const [calMonth, setCalMonth] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  });
  const [calYear, setCalYear] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  });

  // Sync calendar view when value changes from outside
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setCalMonth(d.getMonth());
        setCalYear(d.getFullYear());
      }
    }
  }, [value]);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(y => y - 1);
    } else {
      setCalMonth(m => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(y => y + 1);
    } else {
      setCalMonth(m => m + 1);
    }
  };

  const dateParts = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-').map(Number);
    return parts.length === 3 && !parts.some(isNaN) ? parts : null;
  }, [value]);

  const selectedYear = dateParts ? dateParts[0] : null;
  const selectedMonth = dateParts ? dateParts[1] - 1 : null;
  const selectedDay = dateParts ? dateParts[2] : null;

  const todayStr = getTodayStr();

  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
  const adjustedFirstDay = (firstDayOfMonth + 6) % 7; // Monday as first day

  // Full weeks: leading/trailing days of the neighbouring months are shown muted (Figma Calendar Month).
  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = adjustedFirstDay; i > 0; i--) cells.push({ day: daysInPrevMonth - i + 1, inMonth: false });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, inMonth: true });
  for (let i = 1; cells.length % 7 !== 0; i++) cells.push({ day: i, inMonth: false });

  const calMonthName = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long' });

  const handleSelectDay = (day: number) => {
    onChange(ymd(calYear, calMonth, day));
    setOpen(false);
  };

  const handleSelectShortcut = (dateStr: string) => {
    onChange(dateStr);
    setOpen(false);
  };

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [value]);

  const shortcuts: { label: string; date: string }[] = [
    { label: 'Today', date: getTodayStr() },
    { label: 'Tomorrow', date: getTomorrowStr() },
    { label: 'Weekend', date: getNextWeekendStr() },
  ];

  const trigger = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      style={accentColor ? ({ '--wizard-accent': accentColor } as React.CSSProperties) : undefined}
      className={cn(
        'w-full flex items-center gap-3 bw-body-lg text-foreground text-left cursor-pointer focus:outline-none transition-colors',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {showIcon && <Calendar className="w-5 h-5 shrink-0" aria-hidden />}
      <span className={cn('flex-1 min-w-0 truncate', !value && 'text-muted-foreground/60')}>
        {value ? formatDisplayDate(value) : placeholder}
      </span>
    </button>
  );

  return (
    <PickerSheet
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      overline="Pick a day"
      title={titleFromPlaceholder(placeholder, 'Date')}
      footer={
        <PillButton icon={<Check className="w-5 h-5" />} disabled={!value} onClick={() => setOpen(false)}>
          {value ? `Select ${selectedLabel}` : 'Select a day'}
        </PillButton>
      }
    >
      {/* Quick shortcuts (Figma Selector SM) */}
      {showShortcuts && (
        <div className="flex items-center gap-2">
          {shortcuts.map(s => (
            <PickerChip key={s.label} selected={value === s.date} onClick={() => handleSelectShortcut(s.date)}>
              {s.label}
            </PickerChip>
          ))}
        </div>
      )}

      {/* Calendar Month */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <IconButton label="Previous month" icon={<ArrowLeft />} size="sm" onClick={prevMonth} />
          <IconButton label="Next month" icon={<ArrowRight />} size="sm" onClick={nextMonth} />
          <span className="bw-h3 text-foreground truncate" aria-live="polite">
            {calMonthName} {calYear}
          </span>
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 gap-x-1 py-1 rounded-full bg-foreground/[0.08]" aria-hidden>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="text-center bw-label-xs text-muted-foreground">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Day cells */}
        <div className="grid grid-cols-7 gap-x-1 gap-y-2">
          {cells.map(({ day, inMonth }, i) => {
            if (!inMonth) {
              return (
                <span
                  key={i}
                  aria-hidden
                  className="h-6 rounded-full bg-foreground/[0.08] flex items-center justify-center bw-label-md text-muted-foreground"
                >
                  {day}
                </span>
              );
            }
            const isSelected = calMonth === selectedMonth && calYear === selectedYear && day === selectedDay;
            const isToday = ymd(calYear, calMonth, day) === todayStr;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectDay(day)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={new Date(calYear, calMonth, day).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                className={cn(
                  "relative h-6 rounded-full flex items-center justify-center bw-label-md transition-colors cursor-pointer after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
                  isSelected
                    ? 'bg-surface-inverse text-surface-inverse-foreground'
                    : 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14]',
                  isToday && !isSelected && 'ring-[1.5px] ring-inset ring-foreground'
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </PickerSheet>
  );
};
