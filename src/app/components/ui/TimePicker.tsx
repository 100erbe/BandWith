import React, { useState, useRef, useCallback } from 'react';
import { Clock, Check } from '@/app/components/icons';
import { cn } from './utils';
import { PickerSheet, PickerChip } from './DatePicker';
import { DotText } from '@/app/components/bw/DotText';
import { PillButton } from '@/app/components/bw/Form';

export interface TimePickerProps {
  value?: string; // "HH:mm" (e.g. "20:00") or ""
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  textSize?: string;
  showIcon?: boolean;
  showShortcuts?: boolean;
  accentColor?: string;
  placeholder?: string;
  id?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  /** Sheet overline (Figma "Picker / Time"), e.g. "Gig · Sat 12 Dec". */
  overline?: string;
}

// 0-11 for Outer Circle (0 at 12 o'clock, 1 at 1 o'clock, etc.)
export const HOURS_OUTER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
// 12-23 for Inner Circle (12 at 12 o'clock, 13 at 1 o'clock, etc.)
export const HOURS_INNER = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;

export const MINUTES_5 = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'] as const;

/** Figma "Picker / Time" quick picks (Selector SM row under the wheel). */
const TIME_SHORTCUTS = ['18:00', '19:00', '19:30', '20:30'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');
const mod = (n: number, m: number) => ((n % m) + m) % m;

/* ─────────────────────────────── Wheel column ───────────────────────────────
 * One column of the Figma "Wheel": two muted neighbours above and below
 * (Numeric/LG) and the current value in dot-matrix glyphs. Tap a neighbour,
 * drag vertically, use the mouse wheel or arrow keys to step.
 * ───────────────────────────────────────────────────────────────────────── */

const STEP_PX = 32; // one row (24 text + 8 gap)

const WheelColumn: React.FC<{
  label: string;
  /** Text shown in the centre (dot-matrix). */
  display: string;
  /** Neighbour labels for offsets -2, -1, +1, +2. */
  neighbour: (offset: number) => string;
  onStep: (delta: number) => void;
  valueNow: number;
  valueMin: number;
  valueMax: number;
}> = ({ label, display, neighbour, onStep, valueNow, valueMin, valueMax }) => {
  // The whole column (all five rows, the gaps and its full height in the
  // card) drags; a touch that doesn't move taps the row under it.
  const dragRef = useRef<{ y: number; acc: number; moved: number; tap: number | null } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const row = (e.target as HTMLElement).closest('[data-offset]') as HTMLElement | null;
    dragRef.current = { y: e.clientY, acc: 0, moved: 0, tap: row ? Number(row.dataset.offset) : null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // Dragging up brings later values into the centre.
    const dy = d.y - e.clientY;
    d.acc += dy;
    d.moved += Math.abs(dy);
    d.y = e.clientY;
    while (Math.abs(d.acc) >= STEP_PX) {
      const dir = d.acc > 0 ? 1 : -1;
      onStep(dir);
      d.acc -= dir * STEP_PX;
    }
  };
  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.moved < 6 && d.tap) onStep(d.tap);
  };
  const cancelDrag = () => {
    dragRef.current = null;
  };
  const wheelAcc = useRef(0);
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Accumulate so trackpads step one row per ~row of scroll, not per event.
    wheelAcc.current += e.deltaY;
    if (Math.abs(wheelAcc.current) < STEP_PX) return;
    onStep(wheelAcc.current > 0 ? 1 : -1);
    wheelAcc.current = 0;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onStep(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onStep(1);
    }
  };

  const ghost = (offset: number) => (
    <span data-offset={offset} aria-hidden className="h-6 flex items-center bw-num text-muted-foreground cursor-pointer">
      {neighbour(offset)}
    </span>
  );

  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuetext={display}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      className="flex-1 self-stretch flex flex-col items-center justify-center gap-2 px-5 py-2 touch-none cursor-ns-resize rounded-2xl focus-visible:outline-2 focus-visible:outline-foreground"
    >
      {ghost(-2)}
      {ghost(-1)}
      <span className="h-8 flex items-center text-foreground">
        <DotText text={display} size={32} label={display} />
      </span>
      {ghost(1)}
      {ghost(2)}
    </div>
  );
};

export const TimePicker: React.FC<TimePickerProps> = ({
  value = '',
  onChange,
  className,
  disabled = false,
  allowEmpty = false,
  emptyLabel = '--:--',
  textSize = 'bw-body-lg',
  showIcon = true,
  showShortcuts = true,
  accentColor,
  placeholder = 'Select time...',
  id,
  overline = 'Pick a time',
}) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Time');

  // Parse 24h string e.g. "20:00"
  const [rawH = '20', rawM = '00'] = (value || '20:00').split(':');
  const numH24 = parseInt(rawH, 10) || 0;
  const numM = parseInt(rawM, 10) || 0;

  const updateTime = useCallback(
    (newH: number, newM: number) => {
      onChange(`${pad2(newH)}:${pad2(newM)}`);
    },
    [onChange]
  );

  // Minutes move on the 5-minute grid (same granularity as before).
  const minuteIndex = mod(Math.round(numM / 5), 12);
  const stepHour = (delta: number) => updateTime(mod(numH24 + delta, 24), numM);
  const stepMinute = (delta: number) => updateTime(numH24, parseInt(MINUTES_5[mod(minuteIndex + delta, 12)], 10));

  const handleOpenChange = (next: boolean) => {
    if (next && id) {
      // Reuse the field's visible label ("Start time", "End time") as the sheet title.
      const text = document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim();
      setTitle(text || 'Time');
    }
    setOpen(next);
  };

  const displayTime = value ? `${pad2(numH24)}:${pad2(numM)}` : '';
  const currentTime = `${pad2(numH24)}:${pad2(numM)}`;

  const trigger = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      style={accentColor ? ({ '--wizard-accent': accentColor } as React.CSSProperties) : undefined}
      className={cn(
        'w-full flex items-center gap-3 text-foreground text-left cursor-pointer focus:outline-none transition-colors',
        textSize,
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {showIcon && <Clock className="w-5 h-5 shrink-0" aria-hidden />}
      <span className={cn('flex-1 min-w-0 truncate tabular-nums', !displayTime && 'text-muted-foreground/60')}>
        {displayTime || (allowEmpty ? emptyLabel : placeholder)}
      </span>
    </button>
  );

  return (
    <PickerSheet
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      overline={overline}
      title={title}
      footer={
        <div className="flex items-center gap-2">
          {allowEmpty && (
            <PillButton
              variant="outline"
              fullWidth={false}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </PillButton>
          )}
          <PillButton
            icon={<Check className="w-5 h-5" />}
            className="flex-1"
            onClick={() => {
              // An empty optional field takes the time shown on the wheel.
              if (!value) onChange(currentTime);
              setOpen(false);
            }}
          >
            Set {currentTime}
          </PillButton>
        </div>
      }
    >
      {/* Wheel */}
      <div className="flex items-center justify-center p-3 rounded-2xl bg-card text-card-foreground select-none">
        <WheelColumn
          label="Hours"
          display={pad2(numH24)}
          neighbour={o => pad2(mod(numH24 + o, 24))}
          onStep={stepHour}
          valueNow={numH24}
          valueMin={0}
          valueMax={23}
        />
        <span className="text-foreground" aria-hidden>
          <DotText text=":" size={40} label="" />
        </span>
        <WheelColumn
          label="Minutes"
          display={pad2(numM)}
          neighbour={o => MINUTES_5[mod(minuteIndex + o, 12)]}
          onStep={stepMinute}
          valueNow={numM}
          valueMin={0}
          valueMax={59}
        />
      </div>

      {/* Quick picks (Figma Selector SM, Accent = current) */}
      {showShortcuts && (
        <div className="flex flex-wrap items-center gap-2">
          {TIME_SHORTCUTS.map(t => (
            <PickerChip key={t} selected={displayTime === t} onClick={() => onChange(t)}>
              {t}
            </PickerChip>
          ))}
        </div>
      )}
    </PickerSheet>
  );
};
