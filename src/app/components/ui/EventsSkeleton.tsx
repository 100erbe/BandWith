import React from 'react';
import { Skeleton } from './skeleton';
import { useT } from '@/lib/i18n';

export const EventsSkeleton: React.FC = () => {
  const tr = useT();
  return (
    <div className="flex flex-col gap-6 relative z-10 animate-fade-in" aria-busy="true" aria-label={tr('Loading events')}>
      {/* Search & Filter Bar Skeleton */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-full bg-foreground/10" />
        <div className="flex items-center gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-[10px] bg-foreground/10 shrink-0" />
          ))}
        </div>
      </div>

      {/* Section Header */}
      <div className="flex flex-col gap-1 mt-2">
        <Skeleton className="h-3 w-20 bg-foreground/10" />
        <Skeleton className="h-8 w-44 bg-foreground/10" />
      </div>

      {/* Event Cards Skeleton */}
      <div className="flex flex-col gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="relative flex flex-col rounded-[16px] bg-card border border-foreground/10 overflow-hidden shadow-sm p-4 pl-5 sm:p-5 sm:pl-6 gap-3.5"
          >
            {/* Left Accent Rail */}
            <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-foreground/15" />

            {/* Header: Tags + Date */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-[6px] bg-foreground/10" />
                <Skeleton className="h-6 w-14 rounded-[6px] bg-foreground/10" />
              </div>
              <Skeleton className="h-6 w-24 rounded-[8px] bg-foreground/10" />
            </div>

            {/* Body: Title + Venue */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-3/4 sm:w-1/2 bg-foreground/10" />
              <Skeleton className="h-4 w-1/2 sm:w-1/3 bg-foreground/10" />
            </div>

            {/* Footer Strip */}
            <div className="border-t border-foreground/8 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-20 bg-foreground/10" />
                <Skeleton className="h-4 w-24 bg-foreground/10" />
              </div>
              <Skeleton className="h-4 w-16 bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
