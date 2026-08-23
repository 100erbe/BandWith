import React from 'react';
import { motion } from 'motion/react';
import {
  Music,
  CalendarDays,
  FileText,
  Mic,
  Sparkles,
  Users,
  Clock,
  DollarSign,
  FileCheck,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import type { EventData } from '@/app/components/dashboard/EventCard';

/* ══════════════════════════════════════════════════════════════════
   Event-Type → Accent Palette + Icon Map
   Uses ONLY semantic theme tokens — no hardcoded hex
   ══════════════════════════════════════════════════════════════════ */

export type EventAccent = 'gig' | 'rehearsal' | 'quote' | 'draft';

export const EVENT_ACCENT_MAP: Record<
  EventAccent,
  { icon: LucideIcon; accentClass: string; accentBgClass: string; label: string }
> = {
  gig: {
    icon: Music,
    accentClass: 'text-accent-gig',
    accentBgClass: 'bg-accent-gig/10',
    label: 'GIG',
  },
  rehearsal: {
    icon: CalendarDays,
    accentClass: 'text-accent-rehearsal',
    accentBgClass: 'bg-accent-rehearsal/10',
    label: 'REHEARSAL',
  },
  quote: {
    icon: FileText,
    accentClass: 'text-accent-quote',
    accentBgClass: 'bg-accent-quote/10',
    label: 'QUOTE',
  },
  draft: {
    icon: FileText,
    accentClass: 'text-muted-foreground',
    accentBgClass: 'bg-muted/30',
    label: 'DRAFT',
  },
};

/** Derive the accent key from an EventData object */
export function getEventAccent(event: EventData): EventAccent {
  const status = event.status?.toUpperCase();
  if (status === 'CONFIRMED' || status === 'COMPLETED') return 'gig';
  if (status === 'REHEARSAL') return 'rehearsal';
  if (status === 'QUOTED' || status === 'QUOTE') return 'quote';
  return 'draft';
}

/* ══════════════════════════════════════════════════════════════════
   CalendarEventCard — 2-Row Layout Architecture
   ══════════════════════════════════════════════════════════════════ */

export interface CalendarEventCardProps {
  event: EventData;
  onClick: () => void;
  /** Top-left metadata: category label + optional icon override */
  accentKey?: EventAccent;
  topLeftIcon?: LucideIcon;
  topLeftLabel?: string;
  /** Top-right metadata: date / context / status badge */
  topRightContent: React.ReactNode;
  /** Bottom hero row — left: primary identifier (large text) */
  heroLeftContent: React.ReactNode;
  /** Bottom hero row — right: secondary title / day label */
  heroRightContent: React.ReactNode;
  /** Optional icon buttons / actions placed in the top-right area */
  topRightActions?: React.ReactNode;
  /** Additional content rendered below the hero row */
  children?: React.ReactNode;
  className?: string;
}

export const CalendarEventCard: React.FC<CalendarEventCardProps> = ({
  event,
  onClick,
  accentKey,
  topLeftIcon: propIcon,
  topLeftLabel: propLabel,
  topRightContent,
  heroLeftContent,
  heroRightContent,
  topRightActions,
  children,
  className,
}) => {
  const derivedAccent = accentKey ?? getEventAccent(event);
  const accent = EVENT_ACCENT_MAP[derivedAccent];
  const Icon = propIcon ?? accent.icon;
  const label = propLabel ?? accent.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        // Container geometry — use semantic surface tokens
        'p-5 rounded-2xl shadow-sm',
        'bg-card text-card-foreground',
        'border border-border/40',
        // Touch target — minimum 44×44 for interactive regions
        'cursor-pointer',
        // Prevent descender clipping on 375px viewports
        'pb-6 sm:pb-5',
        className,
      )}
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${event.title}`}
    >
      {/* ═══ Top Metadata Row ═══ */}
      <div className="flex justify-between items-center gap-2">
        {/* Left: category / location label */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon
            className={cn('w-3.5 h-3.5 shrink-0', accent.accentClass)}
            aria-hidden="true"
          />
          <span
            className={cn(
              'font-mono text-xs font-semibold uppercase tracking-widest truncate',
              accent.accentClass,
            )}
          >
            {label}
          </span>
        </div>

        {/* Right: date / context + optional action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {topRightContent}
          {topRightActions}
        </div>
      </div>

      {/* ═══ Bottom Hero Row ═══ */}
      <div className="mt-3 flex justify-between items-baseline gap-2">
        {/* Left: primary identifier — large bold text, tight tracking */}
        <div className="min-w-0 shrink">
          {heroLeftContent}
        </div>

        {/* Right: secondary title / day label — baseline-aligned */}
        <div className="shrink-0 text-right">
          {heroRightContent}
        </div>
      </div>

      {/* ═══ Additional Content ═══ */}
      {children && <div className="mt-4">{children}</div>}
    </motion.div>
  );
};
