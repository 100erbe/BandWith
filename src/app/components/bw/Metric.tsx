import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { DotText } from './DotText';

interface DotMeterProps {
  /** 0–1 share of lit dots. */
  value: number;
  rows?: number;
  cols?: number;
  /** Dot diameter in px. */
  dot?: number;
  className?: string;
  /** Colour overrides, e.g. on an event-coloured card. */
  onColor?: string;
  offColor?: string;
  peakColor?: string;
}

/**
 * Dot meter: a grid of dots filled row-major. The last lit dot is the
 * "peak" in accent ink; when the meter is full every dot is peak.
 */
export const DotMeter: React.FC<DotMeterProps> = ({ value, rows = 4, cols = 12, dot = 10, className, onColor = 'var(--dot-on)', offColor = 'var(--dot-off)', peakColor = 'var(--accent-ink)' }) => {
  const total = rows * cols;
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const lit = clamped > 0 ? Math.max(1, Math.round(clamped * total)) : 0;
  const full = lit >= total;

  return (
    <div
      className={cn('flex flex-col gap-1 w-full', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex justify-between">
          {Array.from({ length: cols }).map((__, c) => {
            const i = r * cols + c;
            const on = i < lit;
            const peak = full || i === lit - 1;
            return (
              <span
                key={c}
                className="rounded-full shrink-0"
                style={{
                  width: dot,
                  height: dot,
                  backgroundColor: peak ? peakColor : on ? onColor : offColor,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

interface MetricProps {
  label: string;
  value: string | number;
  /** 0–1 share shown by the meter. */
  fill: number;
  /** "dashboard" = 34px digits and a 4×12 meter; "card" = 24px digits and 2×6. */
  variant?: 'dashboard' | 'card';
  onClick?: () => void;
  className?: string;
}

export const Metric: React.FC<MetricProps> = ({ label, value, fill, variant = 'dashboard', onClick, className }) => {
  const dashboard = variant === 'dashboard';
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-3 text-left min-w-0 text-foreground',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className,
      )}
    >
      <span className="bw-label-md truncate">{label}</span>
      <DotText text={value} size={dashboard ? 34 : 24} label={`${label}: ${value}`} />
      <DotMeter value={fill} rows={dashboard ? 4 : 2} cols={dashboard ? 12 : 6} dot={10} />
    </Comp>
  );
};
