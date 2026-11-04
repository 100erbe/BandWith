import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ArrowLeft, ArrowRight, ChevronDown } from '@/app/components/icons';
import { cn } from './utils';
import { Popover, PopoverTrigger, PopoverContent } from './popover';

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
  const resolvedAccent = accentColor || 'var(--wizard-accent, #8b5cf6)';

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

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const adjustedFirstDay = (firstDayOfMonth + 6) % 7; // Monday as first day
  const calDays: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) calDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calDays.push(i);

  const calMonthName = new Date(calYear, calMonth, 1)
    .toLocaleDateString('en-US', { month: 'long' })
    .toUpperCase();

  const handleSelectDay = (day: number) => {
    const selectedDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(selectedDateStr);
    setOpen(false);
  };

  const handleSelectShortcut = (dateStr: string) => {
    onChange(dateStr);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          style={accentColor ? ({ '--wizard-accent': accentColor } as React.CSSProperties) : undefined}
          className={cn(
            'w-full flex items-center justify-between border-b border-border/40 pb-1.5 text-base font-medium text-[var(--fg)] hover:border-[var(--wizard-accent)] focus:outline-none focus:border-[var(--wizard-accent)] transition-colors cursor-pointer group text-left',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className={cn('truncate', !value && 'text-muted-foreground/60 font-normal')}>
              {value ? formatDisplayDate(value) : placeholder}
            </span>
          </div>
          {showIcon && (
            <div className="flex items-center gap-1 shrink-0 text-muted-foreground group-hover:text-[var(--wizard-accent)] transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        style={{
          '--wizard-accent': resolvedAccent,
          '--wizard-accent-fg': '#ffffff',
        } as React.CSSProperties}
        className="z-[120] w-[290px] p-3 rounded-2xl border border-border/40 bg-card shadow-2xl backdrop-blur-md space-y-2.5"
      >
        {/* Quick shortcut pills */}
        {showShortcuts && (
          <div className="flex items-center gap-1 pb-1 border-b border-border/30">
            <button
              type="button"
              onClick={() => handleSelectShortcut(getTodayStr())}
              className="flex-1 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-[var(--fg)] text-center transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleSelectShortcut(getTomorrowStr())}
              className="flex-1 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-[var(--fg)] text-center transition-colors cursor-pointer"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleSelectShortcut(getNextWeekendStr())}
              className="flex-1 py-1 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-[var(--fg)] text-center transition-colors cursor-pointer"
            >
              Weekend
            </button>
          </div>
        )}

        {/* Month Navigation */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-bold uppercase text-[var(--fg)] tracking-wider">
            {calMonthName} {calYear}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center text-[var(--fg)] transition-colors cursor-pointer"
              aria-label="Previous Month"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 rounded-full border border-border/40 bg-card hover:bg-muted flex items-center justify-center text-[var(--fg)] transition-colors cursor-pointer"
              aria-label="Next Month"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Weekday abbreviations */}
        <div className="grid grid-cols-7 gap-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-xs font-bold text-muted-foreground py-0.5">
              {d}
            </div>
          ))}
          {/* Calendar day cells */}
          {calDays.map((day, i) => {
            const isSelected =
              day !== null &&
              calMonth === selectedMonth &&
              calYear === selectedYear &&
              day === selectedDay;

            const isToday =
              day !== null &&
              calMonth === todayMonth &&
              calYear === todayYear &&
              day === todayDay;

            return (
              <button
                key={i}
                type="button"
                onClick={() => day && handleSelectDay(day)}
                disabled={!day}
                className={cn(
                  'h-8 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center',
                  !day && 'invisible',
                  isSelected
                    ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] shadow-xs font-extrabold'
                    : isToday
                      ? 'border border-[var(--wizard-accent)] text-[var(--fg)] font-bold'
                      : day
                        ? 'text-muted-foreground hover:bg-muted hover:text-[var(--fg)]'
                        : ''
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
