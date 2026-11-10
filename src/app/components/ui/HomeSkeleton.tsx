import React from 'react';
import { cn } from './utils';

/**
 * Figma "State / Loading skeleton" for Home:
 * a 2×2 grid of metric placeholders (no cards: label bar, value pill, meter bar),
 * then two radius-24 cards, each with a label, title and meta bar.
 *
 * Pulse is dropped under prefers-reduced-motion (motion-reduce:animate-none),
 * on top of the global reduced-motion rule in styles/index.css.
 */
const Bar: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={cn('bg-muted rounded-full animate-pulse motion-reduce:animate-none', className)}
  />
);

const MetricSkeleton: React.FC<{ labelWidth: string; valueWidth: string }> = ({ labelWidth, valueWidth }) => (
  <div className="flex flex-col gap-3 min-w-0">
    <Bar className={cn('h-3.5', labelWidth)} />
    <Bar className={cn('h-[34px]', valueWidth)} />
    <Bar className="h-[52px] w-full rounded-[12px]" />
  </div>
);

const CardSkeleton: React.FC<{ titleWidth: string; metaWidth: string }> = ({ titleWidth, metaWidth }) => (
  <div className="bg-card rounded-[24px] p-4 flex flex-col gap-3">
    <Bar className="h-3.5 w-20" />
    <Bar className={cn('h-5', titleWidth)} />
    <Bar className={cn('h-3', metaWidth)} />
  </div>
);

export const HomeSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-8 relative z-10" aria-busy="true" aria-label="Loading dashboard" role="status">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-8 gap-y-8">
        <MetricSkeleton labelWidth="w-24" valueWidth="w-14" />
        <MetricSkeleton labelWidth="w-28" valueWidth="w-14" />
        <MetricSkeleton labelWidth="w-20" valueWidth="w-14" />
        <MetricSkeleton labelWidth="w-16" valueWidth="w-20" />
      </div>
      <div className="flex flex-col gap-4">
        <CardSkeleton titleWidth="w-3/4" metaWidth="w-1/2" />
        <CardSkeleton titleWidth="w-2/3" metaWidth="w-2/5" />
      </div>
    </div>
  );
};
