import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/app/components/ui/utils';

/**
 * Returns the semantic accent color with subtle variations for event sub-types.
 */
export function getEventAccentColor(
  eventType?: string | null,
  category?: 'gig' | 'quote' | 'rehearsal'
): string {
  if (category === 'rehearsal' || eventType === 'rehearsal') {
    return 'var(--accent-rehearsal)';
  }

  const type = eventType?.toLowerCase() || '';

  // Subtle tonal variations for event sub-types while respecting high-contrast theme
  switch (type) {
    case 'wedding':
      return '#F59E0B'; // Warm champagne amber
    case 'corporate':
      return '#3B82F6'; // Professional sapphire blue
    case 'festival':
      return '#F97316'; // Vibrant festival sunset orange
    case 'club':
      return '#EC4899'; // Electric neon magenta
    case 'private':
      return '#10B981'; // Refined emerald teal
    case 'quote':
      return 'var(--accent-quote)'; // Electric blue
    case 'other':
    case 'gig':
    default:
      if (category === 'quote') return 'var(--accent-quote)';
      return 'var(--accent-gig)'; // High-contrast action teal
  }
}

/**
 * Returns subtle tonal variations for rehearsal session sub-types.
 */
export function getRehearsalAccentColor(rehearsalType?: string | null): string {
  switch (rehearsalType?.toLowerCase()) {
    case 'vocals':
      return '#A855F7'; // Vocal violet
    case 'rhythm':
      return '#06B6D4'; // Rhythm cyan
    case 'acoustic':
      return '#F59E0B'; // Acoustic warm amber
    case 'custom':
      return '#6366F1'; // Custom indigo
    case 'full_band':
    default:
      return 'var(--accent-rehearsal)'; // Accessible royal blue
  }
}

interface WizardAccentRailProps {
  color: string;
  className?: string;
  width?: string;
}

/**
 * Option A: Subtle vertical accent rail along the left edge of wizard pages.
 */
export const WizardAccentRail: React.FC<WizardAccentRailProps> = ({
  color,
  className,
  width = 'w-[3.5px]',
}) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute left-1.5 top-6 bottom-6 z-50 pointer-events-none flex flex-col justify-center',
        width,
        className
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <motion.div
        className="w-full h-full rounded-full"
        animate={{
          backgroundColor: color,
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          boxShadow: `0 0 10px 1px ${color}`,
          opacity: 0.85,
        }}
      />
    </div>
  );
};
