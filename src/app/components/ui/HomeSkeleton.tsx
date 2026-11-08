import React from 'react';
import { Skeleton } from './skeleton';

export const HomeSkeleton: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = true }) => {
  return (
    <div className="flex flex-col gap-8 sm:gap-10 relative z-10 animate-fade-in" aria-busy="true" aria-label="Loading dashboard">
      {/* 2×2 Stats Grid */}
      <div className="flex flex-col gap-3.5 sm:gap-4">
        {/* Row 1 */}
        <div className="flex gap-3.5 sm:gap-4">
          <div className="flex-1 flex rounded-[16px] border border-foreground/10 bg-card shadow-sm overflow-hidden p-4 min-h-[110px]">
            <div className="w-[5px] h-full rounded-full bg-foreground/15 mr-3 shrink-0" />
            <div className="flex-1 flex flex-col justify-between">
              <Skeleton className="h-3.5 w-24 bg-foreground/10" />
              <Skeleton className="h-10 w-16 bg-foreground/10 mt-2" />
            </div>
          </div>
          <div className="flex-1 flex rounded-[16px] border border-foreground/10 bg-card shadow-sm overflow-hidden p-4 min-h-[110px]">
            <div className="w-[5px] h-full rounded-full bg-foreground/15 mr-3 shrink-0" />
            <div className="flex-1 flex flex-col justify-between">
              <Skeleton className="h-3.5 w-28 bg-foreground/10" />
              <Skeleton className="h-10 w-16 bg-foreground/10 mt-2" />
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex gap-3.5 sm:gap-4">
          <div className="flex-1 flex rounded-[16px] border border-foreground/10 bg-card shadow-sm overflow-hidden p-4 min-h-[110px]">
            <div className="w-[5px] h-full rounded-full bg-foreground/15 mr-3 shrink-0" />
            <div className="flex-1 flex flex-col justify-between">
              <Skeleton className="h-3.5 w-24 bg-foreground/10" />
              <Skeleton className="h-10 w-20 bg-foreground/10 mt-2" />
            </div>
          </div>
          <div className="flex-1 flex rounded-[16px] border border-foreground/10 bg-card shadow-sm overflow-hidden p-4 min-h-[110px]">
            <div className="w-[5px] h-full rounded-full bg-foreground/15 mr-3 shrink-0" />
            <div className="flex-1 flex flex-col justify-between">
              <Skeleton className="h-3.5 w-20 bg-foreground/10" />
              <Skeleton className="h-10 w-28 bg-foreground/10 mt-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Schedule Card */}
      <div className="rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col gap-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-32 bg-foreground/10" />
          <Skeleton className="h-3.5 w-14 bg-foreground/10" />
        </div>

        <div className="flex flex-col divide-y divide-foreground/8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-3 first:pt-1">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-5 rounded-[5px] bg-foreground/10" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36 sm:w-48 bg-foreground/10" />
                  <Skeleton className="h-3 w-28 bg-foreground/10" />
                </div>
              </div>
              <Skeleton className="h-4 w-16 bg-foreground/10" />
            </div>
          ))}
        </div>
      </div>

      {/* Operations Overview Card */}
      <div className="rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col gap-4 shadow-2xs">
        <Skeleton className="h-3.5 w-40 bg-foreground/10" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Skeleton className="h-20 rounded-[12px] bg-foreground/10" />
          <Skeleton className="h-20 rounded-[12px] bg-foreground/10" />
        </div>
      </div>
    </div>
  );
};
