/**
 * Free-slot heatmap pieces (Figma "Next": "Free-slot heatmap from band
 * calendars"): heat colours for a day, the free-member dots, the "4/5 free"
 * line and the legend. Counts come from src/lib/bandAvailability.ts.
 */
import React from 'react';
import { cn } from './utils';
import { heatLevel, type FreeCount } from '@/lib/freeSlots';
import { useT } from '@/lib/i18n';

const HEAT_MIX = [0, 22, 45, 72, 100] as const;

/**
 * Background / text colours for a heat level (green = everyone free). Level 0
 * (nobody free) returns no colours: keep the element's own neutral background.
 */
export const heatStyle = (c: FreeCount | null | undefined): React.CSSProperties => {
  const level = heatLevel(c);
  if (level === 0) return {};
  return {
    backgroundColor: `color-mix(in srgb, var(--success) ${HEAT_MIX[level]}%, transparent)`,
    color: level >= 3 ? 'var(--success-fg)' : undefined,
  };
};

/** Tone of a free count: everyone → success, most → warning-ish, few → muted. */
export const freeTone = (c: FreeCount | null | undefined): string => {
  const level = heatLevel(c);
  return level === 4 ? 'text-success' : level >= 2 ? 'text-warning' : 'text-muted-foreground';
};

/** ●●●○○ — one dot per member, filled for the free ones. */
export const FreeDots: React.FC<{
  count: FreeCount;
  className?: string;
  /** Dot size in px (default 6). */
  size?: number;
  onColor?: string;
  offColor?: string;
}> = ({ count, className, size = 6, onColor = 'var(--success)', offColor }) => (
  <span aria-hidden className={cn('inline-flex items-center gap-[3px]', className)}>
    {Array.from({ length: Math.min(count.total, 8) }).map((_, i) => (
      <span
        key={i}
        className="rounded-full shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: i < count.free ? onColor : offColor ?? 'color-mix(in srgb, currentColor 22%, transparent)',
        }}
      />
    ))}
  </span>
);

/** "4/5 free" (short) — mono label. */
export const FreeLabel: React.FC<{ count: FreeCount; className?: string }> = ({ count, className }) => {
  const t = useT();
  return (
    <span className={cn('bw-label-xs whitespace-nowrap', className)}>
      {t('{free}/{total} free', { free: count.free, total: count.total })}
    </span>
  );
};

/** "From band calendars" + the colour scale (nobody → everyone). */
export const FreeHeatLegend: React.FC<{ className?: string; total?: number }> = ({ className, total }) => {
  const t = useT();
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <span className="bw-label-xs text-muted-foreground truncate flex-1 min-w-0">
        {total ? t('Free in band calendars · {n} members', { n: total }) : t('Free in band calendars')}
      </span>
      <span aria-hidden className="flex items-center gap-[3px] shrink-0">
        {[0, 1, 2, 3, 4].map(l => (
          <span
            key={l}
            className={cn('w-3 h-2 rounded-full', l === 0 && 'bg-foreground/[0.08]')}
            style={heatStyle({ free: l, total: 4 })}
          />
        ))}
      </span>
    </div>
  );
};
