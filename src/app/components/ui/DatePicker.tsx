import { motion } from 'motion/react';
import { useSheetDrag } from '@/app/components/bw/useSheetDrag';
import React, { useState, useMemo, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Calendar, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, X, AlertTriangle } from '@/app/components/icons';
import { cn } from './utils';
import { IconButton } from '@/app/components/bw/Screen';
import { RailSheet } from '@/lib/railActions';
import { PillButton } from '@/app/components/bw/Form';
import { t, useT, intlLocale, weekdayInitials } from '@/lib/i18n';
import { useBandFreeDays } from '@/lib/bandAvailability';
import { FreeHeatLegend, heatStyle, freeTone } from './FreeHeat';

export type DatePickerEventKind = 'gig' | 'rehearsal' | 'personal' | 'quote';

/** An existing event shown on the calendar (dot on the day + conflict hint). */
export interface DatePickerEvent {
  /** "YYYY-MM-DD" (a longer ISO string is truncated to the day). */
  date: string;
  kind: DatePickerEventKind;
}

/** Minimal event shape (structurally compatible with EventCard's EventData). */
interface PickerSourceEvent {
  eventId?: string;
  date?: string;
  status?: string;
  eventType?: string;
  band_id?: string;
}

/**
 * Maps app events to DatePicker events. Same kind rules as the calendar
 * (EventsView `calendarKind`). `excludeEventId` drops the event being edited.
 */
export const toDatePickerEvents = (
  list: PickerSourceEvent[] | undefined,
  excludeEventId?: string,
): DatePickerEvent[] =>
  (list || [])
    .filter(e => !!e.date && (!excludeEventId || e.eventId !== excludeEventId))
    .map(e => {
      const s = (e.status || '').toUpperCase();
      const kind: DatePickerEventKind =
        s === 'REHEARSAL' || e.eventType === 'rehearsal'
          ? 'rehearsal'
          : s === 'QUOTE' || s === 'QUOTED' || e.eventType === 'quote'
            ? 'quote'
            : !e.band_id
              ? 'personal'
              : 'gig';
      return { date: String(e.date).slice(0, 10), kind };
    });

const kindNoun = (kind: DatePickerEventKind): string => {
  switch (kind) {
    case 'gig': return t('gig');
    case 'rehearsal': return t('rehearsal');
    case 'quote': return t('quote');
    case 'personal': return t('personal event');
  }
};

/** "Dec 12 has a gig" (whole sentence per kind, so each language can word it). */
const dayHasKind = (day: string, kind: DatePickerEventKind): string => {
  switch (kind) {
    case 'gig': return t('{day} has a gig', { day });
    case 'rehearsal': return t('{day} has a rehearsal', { day });
    case 'quote': return t('{day} has a quote', { day });
    case 'personal': return t('{day} has a personal event', { day });
  }
};

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
  /** Existing events: each day gets a small kind dot, and a busy day shows a hint above the CTA. */
  events?: DatePickerEvent[];
  /**
   * Free-slot heatmap: each day shows how many members of the band are free
   * in their calendars (counts only, bw_band_free_slots). With start/end only
   * events overlapping that window count.
   */
  availability?: DatePickerAvailability | null;
}

export interface DatePickerAvailability {
  bandId?: string | null;
  /** "HH:MM" window (optional). */
  start?: string | null;
  end?: string | null;
  /** The event being edited does not count as busy. */
  excludeEventId?: string | null;
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

  const formatted = d.toLocaleDateString(intlLocale('en-US'), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (dateStr === todayStr) {
    return t('Today • {date}', { date: formatted });
  }
  if (dateStr === tomorrowStr) {
    return t('Tomorrow • {date}', { date: formatted });
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
}) => {
  const t = useT();
  const drag = useSheetDrag(() => onOpenChange(false));
  return (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="bw-rail-sheet fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        style={{ zIndex: zIndex - 1 }}
      />
      <DialogPrimitive.Content asChild aria-describedby={undefined}>
      <motion.div
        {...drag.sheet}
        className={cn(
          // bw-picker: on the iPhone Duo open the form that asked moves to the
          // leading page while the picker is open (src/styles/duo-panes.css).
          'bw-rail-sheet bw-picker bw-sheet-card fixed inset-x-0 bottom-0 mx-auto max-w-[520px] max-h-[88dvh] flex flex-col',
          'bg-background text-foreground rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.35)] outline-none select-none',
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom duration-300',
        )}
        style={{ zIndex, ...contentStyle }}
      >
        {/* Sheet Header (Style=Light): swipe it down to close */}
        <div className="shrink-0 px-5 pt-3 pb-2 flex flex-col gap-3" {...drag.handle}>
          <span className="bw-grabber mx-auto w-10 h-[5px] rounded-full bg-muted-foreground/55" aria-hidden />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {overline && <p className="bw-label-sm text-muted-foreground truncate">{overline}</p>}
              <DialogPrimitive.Title className="bw-h1 text-foreground [overflow-wrap:anywhere]">{title}</DialogPrimitive.Title>
            </div>
            {/* iPhone Duo: an existing rail Back closes the picker first
                (Figma "Closed · Picker / Date"). */}
            <RailSheet onClose={() => onOpenChange(false)} />
            <DialogPrimitive.Close asChild>
              <IconButton label={t('Close')} icon={<X />} size="sm" variant="outline" />
            </DialogPrimitive.Close>
          </div>
        </div>

        {/* Sheet body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 flex flex-col gap-3">{children}</div>
        <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom, 0px) + 24px)' }}>
          {footer}
        </div>
      </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
  );
};

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
  placeholder: placeholderProp,
  id,
  showIcon = true,
  showShortcuts = true,
  accentColor,
  events,
  availability,
}) => {
  const t = useT();
  const placeholder = placeholderProp ?? t('Select event date...');
  const [open, setOpen] = useState(false);

  // "YYYY-MM-DD" → kinds on that day (first one wins for the dot colour).
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DatePickerEventKind[]>();
    (events || []).forEach(ev => {
      const key = (ev.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const list = map.get(key);
      if (list) {
        if (!list.includes(ev.kind)) list.push(ev.kind);
      } else map.set(key, [ev.kind]);
    });
    return map;
  }, [events]);

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

  // Free-slot heatmap for the month on screen (fetched while the sheet is open).
  const monthFrom = ymd(calYear, calMonth, 1);
  const monthTo = ymd(calYear, calMonth, daysInMonth);
  const freeDays = useBandFreeDays({
    bandId: availability?.bandId || undefined,
    from: monthFrom,
    to: monthTo,
    start: availability?.start,
    end: availability?.end,
    excludeEventId: availability?.excludeEventId,
    enabled: open && !!availability?.bandId,
  });
  const freeTotal = freeDays ? freeDays.values().next().value?.total : undefined;
  const selectedFree = value && freeDays ? freeDays.get(value) : undefined;

  const calMonthName = new Date(calYear, calMonth, 1).toLocaleDateString(intlLocale('en-US'), { month: 'long' });

  // A busy day keeps the sheet open so the conflict hint is visible.
  const handleSelectDay = (day: number) => {
    const key = ymd(calYear, calMonth, day);
    onChange(key);
    if (!eventsByDay.has(key)) setOpen(false);
  };

  const handleSelectShortcut = (dateStr: string) => {
    onChange(dateStr);
    if (!eventsByDay.has(dateStr)) setOpen(false);
  };

  // Hint: "⚠ Dec 12 has a gig — Dec 13 is free."
  const conflict = useMemo(() => {
    if (!value) return null;
    const kinds = eventsByDay.get(value);
    if (!kinds?.length) return null;
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    let nextFree: string | null = null;
    const cursor = new Date(d);
    for (let i = 0; i < 366; i++) {
      cursor.setDate(cursor.getDate() + 1);
      const key = ymd(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      if (!eventsByDay.has(key)) {
        nextFree = key;
        break;
      }
    }
    const short = (key: string) =>
      new Date(key + 'T00:00:00').toLocaleDateString(intlLocale('en-US'), { month: 'short', day: 'numeric' });
    return { day: short(value), kind: kinds[0], nextFree, nextFreeLabel: nextFree ? short(nextFree) : null };
  }, [value, eventsByDay]);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString(intlLocale('en-GB'), { weekday: 'short', day: 'numeric', month: 'short' });
  }, [value]);

  const shortcuts: { label: string; date: string }[] = [
    { label: t('Today'), date: getTodayStr() },
    { label: t('Tomorrow'), date: getTomorrowStr() },
    { label: t('Weekend'), date: getNextWeekendStr() },
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
      overline={t('Pick a day')}
      title={titleFromPlaceholder(placeholder, t('Date'))}
      footer={
        <div className="flex flex-col gap-3">
          {selectedFree && (
            <p role="status" className={cn('flex items-center gap-2 bw-label-sm', freeTone(selectedFree))}>
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
              {selectedFree.free >= selectedFree.total
                ? t('{free} of {total} free · no conflicts', { free: selectedFree.free, total: selectedFree.total })
                : t('{free} of {total} free', { free: selectedFree.free, total: selectedFree.total })}
            </p>
          )}
          {conflict && (
            <p role="status" className="flex items-start gap-2 bw-body-sm text-foreground">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-warning" aria-hidden />
              <span>
                {dayHasKind(conflict.day, conflict.kind)}
                {conflict.nextFree && conflict.nextFreeLabel && (
                  <>
                    {' — '}
                    <button
                      type="button"
                      onClick={() => handleSelectShortcut(conflict.nextFree!)}
                      className="underline underline-offset-2 cursor-pointer"
                    >
                      {conflict.nextFreeLabel}
                    </button>{' '}
                    {t('is free.')}
                  </>
                )}
                {!conflict.nextFree && '.'}
              </span>
            </p>
          )}
          <PillButton icon={<Check className="w-5 h-5" />} disabled={!value} onClick={() => setOpen(false)}>
            {value ? t('Select {date}', { date: selectedLabel }) : t('Select a day')}
          </PillButton>
        </div>
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
          <IconButton label={t('Previous month')} icon={<ArrowLeft />} size="sm" onClick={prevMonth} />
          <IconButton label={t('Next month')} icon={<ArrowRight />} size="sm" onClick={nextMonth} />
          <span className="bw-h3 text-foreground truncate" aria-live="polite">
            {calMonthName} {calYear}
          </span>
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 gap-x-1 py-1 rounded-full bg-foreground/[0.08]" aria-hidden>
          {weekdayInitials().map((d, i) => (
            <span key={i} className="text-center bw-label-xs text-muted-foreground">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Day cells */}
        <div className="grid grid-cols-7 gap-x-1 gap-y-2" data-bw-heatmap={freeDays ? '' : undefined}>
          {cells.map(({ day, inMonth }, i) => {
            if (!inMonth) {
              return (
                <span
                  key={i}
                  aria-hidden
                  className={cn(
                    freeDays ? 'bw-heat-cell h-9 rounded-xl' : 'h-6 rounded-full',
                    'bg-foreground/[0.08] flex items-center justify-center bw-label-md text-muted-foreground',
                  )}
                >
                  {day}
                </span>
              );
            }
            const isSelected = calMonth === selectedMonth && calYear === selectedYear && day === selectedDay;
            const dayKey = ymd(calYear, calMonth, day);
            const isToday = dayKey === todayStr;
            const dayKinds = eventsByDay.get(dayKey);
            const free = dayKey >= todayStr ? freeDays?.get(dayKey) : undefined;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectDay(day)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${new Date(calYear, calMonth, day).toLocaleDateString(intlLocale('en-GB'), {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}${dayKinds ? `, ${t('has {events}', { events: dayKinds.map(kindNoun).join(` ${t('and')} `) })}` : ''}${
                  free ? `, ${t('{free} of {total} free', { free: free.free, total: free.total })}` : ''
                }`}
                className={cn(
                  "relative rounded-full flex items-center justify-center bw-label-md transition-colors cursor-pointer after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
                  freeDays ? 'bw-heat-cell h-9 flex-col gap-0.5 rounded-xl' : 'h-6',
                  isSelected
                    ? 'bg-surface-inverse text-surface-inverse-foreground'
                    : free && free.free > 0
                      ? 'text-foreground hover:brightness-95'
                      : 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14]',
                  isToday && !isSelected && 'ring-[1.5px] ring-inset ring-foreground'
                )}
                style={free && !isSelected ? heatStyle(free) : undefined}
              >
                <span className="leading-none">{day}</span>
                {free && (
                  <span aria-hidden className="bw-heat-count text-[9px] leading-none font-mono opacity-80">
                    {free.free}/{free.total}
                  </span>
                )}
                {dayKinds && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 right-0.5 w-2 h-2 rounded-full ring-[1.5px] ring-background"
                    style={{ backgroundColor: `var(--accent-${dayKinds[0]})` }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {freeDays && <FreeHeatLegend total={freeTotal} className="pt-1" />}
      </div>
    </PickerSheet>
  );
};

/* ─────────────────────────── Inline month calendar ───────────────────────────
 * The month grid without a sheet, for the tablet composers (Figma iPad · 04
 * "New gig · Date & time"): month name with ‹ ›, weekday initials, plain day
 * numbers; the chosen day in the event colour, a grey dot on busy days.
 * ───────────────────────────────────────────────────────────────────────── */

export interface InlineMonthCalendarProps {
  value: string;
  onChange: (value: string) => void;
  events?: DatePickerEvent[];
  /** Selected-day colour and its foreground. */
  accent?: string;
  accentFg?: string;
  className?: string;
}

export const InlineMonthCalendar: React.FC<InlineMonthCalendarProps> = ({
  value,
  onChange,
  events,
  accent = 'var(--wizard-accent)',
  accentFg = 'var(--wizard-accent-fg, #000)',
  className,
}) => {
  const t = useT();
  const start = value ? new Date(value + 'T00:00:00') : new Date();
  const [month, setMonth] = useState(() => (isNaN(start.getTime()) ? new Date().getMonth() : start.getMonth()));
  const [year, setYear] = useState(() => (isNaN(start.getTime()) ? new Date().getFullYear() : start.getFullYear()));
  useEffect(() => {
    if (!value) return;
    const d = new Date(value + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    }
  }, [value]);
  const busy = useMemo(() => new Set((events || []).map(e => (e.date || '').slice(0, 10))), [events]);
  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = getTodayStr();
  const monthName = new Date(year, month, 1).toLocaleDateString(intlLocale('en-US'), { month: 'long', year: 'numeric' });
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <span className="bw-body-lg font-semibold text-foreground flex-1 min-w-0 truncate capitalize" aria-live="polite">
          {monthName}
        </span>
        <button
          type="button"
          aria-label={t('Previous month')}
          onClick={() => shift(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/[0.08] cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label={t('Next month')}
          onClick={() => shift(1)}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/[0.08] cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7" aria-hidden>
        {weekdayInitials().map((d, i) => (
          <span key={i} className="text-center bw-label-xs text-muted-foreground">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day == null) return <span key={i} aria-hidden />;
          const key = ymd(year, month, day);
          const on = key === value;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={on}
              aria-current={key === today ? 'date' : undefined}
              aria-label={`${new Date(year, month, day).toLocaleDateString(intlLocale('en-GB'), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}${busy.has(key) ? `, ${t('busy')}` : ''}`}
              className={cn(
                'relative h-8 mx-auto w-full max-w-[52px] rounded-full flex items-center justify-center bw-body-md tabular-nums cursor-pointer transition-colors',
                on ? 'font-semibold' : 'text-foreground hover:bg-foreground/[0.08]',
                key === today && !on && 'ring-1 ring-inset ring-foreground/40',
              )}
              style={on ? { backgroundColor: accent, color: accentFg } : undefined}
            >
              {day}
              {busy.has(key) && !on && (
                <span aria-hidden className="absolute top-0.5 right-[18%] w-1.5 h-1.5 rounded-full bg-muted-foreground/70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
