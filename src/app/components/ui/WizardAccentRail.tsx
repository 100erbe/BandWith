import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/app/components/ui/utils';

/**
 * Returns the exact semantic accent color per event type (no sub-types).
 */
export function getEventAccentColor(
  eventType?: string | null,
  category?: 'gig' | 'quote' | 'rehearsal'
): string {
  if (category === 'rehearsal' || eventType === 'rehearsal') {
    return 'var(--accent-rehearsal)';
  }
  if (category === 'quote' || eventType === 'quote') {
    return 'var(--accent-quote)';
  }
  return 'var(--accent-gig)';
}

/**
 * Returns the exact rehearsal accent color.
 */
export function getRehearsalAccentColor(_rehearsalType?: string | null): string {
  return 'var(--accent-rehearsal)';
}

interface WizardAccentRailProps {
  color: string;
  className?: string;
  width?: string;
}

/**
 * Visual Styling Positioned along the left edge of wizard pages.
 */
export const WizardAccentRail: React.FC<WizardAccentRailProps> = ({
  color,
  className,
  width = 'w-1 sm:w-1.5',
}) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute left-0 top-0 bottom-0 z-50 pointer-events-none flex flex-col justify-stretch',
        width,
        className
      )}
    >
      <motion.div
        className="w-full h-full rounded-r-md"
        animate={{
          backgroundColor: color,
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          boxShadow: `0 0 14px 2px ${color}, 0 0 4px 1px ${color}`,
        }}
      />
    </div>
  );
};
