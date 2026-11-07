import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Clock } from '@/app/components/icons';
import { cn } from './utils';
import { Popover, PopoverTrigger, PopoverContent } from './popover';

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
}

// 0-11 for Outer Circle (0 at 12 o'clock, 1 at 1 o'clock, etc.)
export const HOURS_OUTER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
// 12-23 for Inner Circle (12 at 12 o'clock, 13 at 1 o'clock, etc.)
export const HOURS_INNER = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;

export const MINUTES_5 = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'] as const;

export const TimePicker: React.FC<TimePickerProps> = ({
  value = '',
  onChange,
  className,
  disabled = false,
  allowEmpty = false,
  emptyLabel = '--:--',
  textSize = 'text-base',
  showIcon = true,
  accentColor,
  placeholder = 'Select time...',
  id,
  align = 'start',
  side = 'bottom',
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
  const isDraggingRef = useRef(false);
  const dialRef = useRef<HTMLDivElement>(null);

  const resolvedAccent = accentColor || 'var(--wizard-accent, #8b5cf6)';

  // Parse 24h string e.g. "20:00"
  const [rawH = '20', rawM = '00'] = (value || '20:00').split(':');
  const numH24 = parseInt(rawH, 10) || 0;
  const numM = parseInt(rawM, 10) || 0;

  // Whenever popover opens, default to hours view
  useEffect(() => {
    if (open) {
      setMode('hours');
    }
  }, [open]);

  const updateTime = useCallback(
    (newH: number, newM: number) => {
      const hStr = String(newH).padStart(2, '0');
      const mStr = String(newM).padStart(2, '0');
      onChange(`${hStr}:${mStr}`);
    },
    [onChange]
  );

  const handleHourSelect = useCallback(
    (hourVal: number, autoAdvance = true) => {
      updateTime(hourVal, numM);
      if (autoAdvance) {
        setMode('minutes');
      }
    },
    [numM, updateTime]
  );

  const handleMinuteSelect = useCallback(
    (minVal: number) => {
      updateTime(numH24, minVal);
    },
    [numH24, updateTime]
  );

  // Geometry: 220 x 220 dial
  const CENTER = 110;
  const R_OUTER = 86;
  const R_INNER = 54;
  const R_THRESHOLD = (R_OUTER + R_INNER) / 2; // 70px

  // Compute angle and radius from pointer event
  const getCoordinatesFromEvent = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!dialRef.current) return { deg: 0, dist: 0 };
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = e.clientX - cx;
    const y = e.clientY - cy;

    const dist = Math.sqrt(x * x + y * y);
    // Clockwise angle from 12 o'clock [0, 360)
    let deg = Math.atan2(x, -y) * (180 / Math.PI);
    if (deg < 0) deg += 360;

    return { deg, dist };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const { deg, dist } = getCoordinatesFromEvent(e);
    if (mode === 'hours') {
      const sector = Math.round(deg / 30) % 12;
      const isInner = dist < R_THRESHOLD;
      const h = isInner ? sector + 12 : sector;
      handleHourSelect(h, false);
    } else {
      let m = Math.round(deg / 30) * 5;
      if (m === 60) m = 0;
      handleMinuteSelect(m);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const { deg, dist } = getCoordinatesFromEvent(e);

    if (mode === 'hours') {
      const sector = Math.round(deg / 30) % 12;
      const isInner = dist < R_THRESHOLD;
      const h = isInner ? sector + 12 : sector;
      handleHourSelect(h, false);
    } else {
      let m = Math.round(deg / 30) * 5;
      if (m === 60) m = 0;
      handleMinuteSelect(m);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (mode === 'hours') {
      const { deg, dist } = getCoordinatesFromEvent(e);
      const sector = Math.round(deg / 30) % 12;
      const isInner = dist < R_THRESHOLD;
      const h = isInner ? sector + 12 : sector;
      handleHourSelect(h, true);
    }
  };

  // Clock Hand calculations
  const isSelectedInnerHour = mode === 'hours' && numH24 >= 12;
  const handRadius = mode === 'hours' ? (isSelectedInnerHour ? R_INNER : R_OUTER) : R_OUTER;

  const handAngle = useMemo(() => {
    if (mode === 'hours') {
      return (numH24 % 12) * 30;
    }
    return (numM % 60) * 6;
  }, [mode, numH24, numM]);

  const handRad = (handAngle * Math.PI) / 180;
  const handX = CENTER + handRadius * Math.sin(handRad);
  const handY = CENTER - handRadius * Math.cos(handRad);

  const displayTime = value ? `${String(numH24).padStart(2, '0')}:${String(numM).padStart(2, '0')}` : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          style={accentColor ? ({ '--wizard-accent': accentColor } as React.CSSProperties) : undefined}
          className={cn(
            'w-full flex items-center justify-between border-b border-border/40 pb-1.5 font-medium text-[var(--fg)] hover:border-[var(--wizard-accent)] focus:outline-none focus:border-[var(--wizard-accent)] transition-colors cursor-pointer group text-left',
            textSize,
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className={cn('truncate font-bold', !displayTime && 'text-muted-foreground/60 font-normal')}>
              {displayTime || (allowEmpty ? emptyLabel : placeholder)}
            </span>
          </div>
          {showIcon && (
            <div className="flex items-center gap-1 shrink-0 text-muted-foreground group-hover:text-[var(--wizard-accent)] transition-colors">
              <Clock className="w-4 h-4" />
            </div>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        avoidCollisions={true}
        collisionPadding={16}
        style={{
          '--wizard-accent': resolvedAccent,
          '--wizard-accent-fg': '#ffffff',
        } as React.CSSProperties}
        className="z-[150] w-[280px] max-w-[calc(100vw-32px)] p-3 rounded-2xl border border-border/40 bg-card shadow-2xl backdrop-blur-md space-y-3 select-none animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header: "SELECT TIME" on top left + Clean Digital Display on right */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg)]">
            SELECT TIME
          </span>

          {/* Interactive Digital Display */}
          <div className="flex items-center bg-muted/60 px-1 py-0.5 rounded-lg border border-border/30">
            <button
              type="button"
              onClick={() => setMode('hours')}
              className={cn(
                'px-2 py-0.5 rounded-md text-base font-black tabular-nums transition-all cursor-pointer',
                mode === 'hours'
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] shadow-xs'
                  : 'text-muted-foreground hover:text-[var(--fg)] hover:bg-muted'
              )}
            >
              {String(numH24).padStart(2, '0')}
            </button>

            <span className="text-sm font-black text-muted-foreground/60 px-0.5 select-none">:</span>

            <button
              type="button"
              onClick={() => setMode('minutes')}
              className={cn(
                'px-2 py-0.5 rounded-md text-base font-black tabular-nums transition-all cursor-pointer',
                mode === 'minutes'
                  ? 'bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] shadow-xs'
                  : 'text-muted-foreground hover:text-[var(--fg)] hover:bg-muted'
              )}
            >
              {String(numM).padStart(2, '0')}
            </button>
          </div>
        </div>

        {/* Circular Clock Dial (220 x 220) */}
        <div
          ref={dialRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-[220px] h-[220px] mx-auto rounded-full bg-muted/40 border border-border/30 touch-none cursor-pointer flex items-center justify-center transition-colors"
        >
          {/* SVG Clock Hand & Halo Indicator */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 220 220">
            {/* Center Pivot */}
            <circle cx={CENTER} cy={CENTER} r="3.5" fill="var(--wizard-accent)" />
            {/* Hand Line */}
            <line
              x1={CENTER}
              y1={CENTER}
              x2={handX}
              y2={handY}
              stroke="var(--wizard-accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Selected Tip Halo */}
            <circle cx={handX} cy={handY} r={isSelectedInnerHour ? 12 : 13.5} fill="var(--wizard-accent)" />
            {/* Contrasting center dot */}
            <circle cx={handX} cy={handY} r="1.5" fill="var(--wizard-accent-fg)" />
          </svg>

          {/* Clock Numbers Overlay */}
          {mode === 'hours' ? (
            <>
              {/* Outer Circle: 0 - 11 */}
              {HOURS_OUTER.map((h, idx) => {
                const angle = (idx * 30 * Math.PI) / 180;
                const x = CENTER + R_OUTER * Math.sin(angle);
                const y = CENTER - R_OUTER * Math.cos(angle);
                const isSelected = h === numH24;

                return (
                  <button
                    key={`outer-${h}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHourSelect(h, true);
                    }}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={cn(
                      'absolute w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all pointer-events-auto cursor-pointer',
                      isSelected
                        ? 'text-[var(--wizard-accent-fg)] font-black z-10'
                        : 'text-foreground/80 hover:text-foreground'
                    )}
                  >
                    {h}
                  </button>
                );
              })}

              {/* Inner Circle: 12 - 23 */}
              {HOURS_INNER.map((h, idx) => {
                const angle = (idx * 30 * Math.PI) / 180;
                const x = CENTER + R_INNER * Math.sin(angle);
                const y = CENTER - R_INNER * Math.cos(angle);
                const isSelected = h === numH24;

                return (
                  <button
                    key={`inner-${h}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHourSelect(h, true);
                    }}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={cn(
                      'absolute w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-semibold transition-all pointer-events-auto cursor-pointer',
                      isSelected
                        ? 'text-[var(--wizard-accent-fg)] font-black z-10'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </>
          ) : (
            /* Minutes View: 00 to 55 on Outer Ring */
            MINUTES_5.map((mStr, idx) => {
              const angle = (idx * 30 * Math.PI) / 180;
              const x = CENTER + R_OUTER * Math.sin(angle);
              const y = CENTER - R_OUTER * Math.cos(angle);
              const isSelected = Math.round(numM / 5) * 5 % 60 === parseInt(mStr, 10);

              return (
                <button
                  key={mStr}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMinuteSelect(parseInt(mStr, 10));
                  }}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={cn(
                    'absolute w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all pointer-events-auto cursor-pointer',
                    isSelected
                      ? 'text-[var(--wizard-accent-fg)] font-black z-10'
                      : 'text-foreground/80 hover:text-foreground'
                  )}
                >
                  {mStr}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-2">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-[var(--fg)] px-2 py-1 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[var(--wizard-accent)] text-[var(--wizard-accent-fg)] hover:opacity-90 transition-opacity cursor-pointer text-center"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
