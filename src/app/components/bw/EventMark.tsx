import React from 'react';

export type EventKind = 'gig' | 'rehearsal' | 'quote' | 'personal' | 'past';

/** Lit cells of the 3×3 grid (row-major, 0–8) per event type. */
const PATTERNS: Record<EventKind, number[]> = {
  gig: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  rehearsal: [0, 2, 4, 6, 8],
  quote: [0, 1, 2, 3, 5, 6, 7, 8],
  personal: [4],
  past: [0, 4, 8],
};

interface EventMarkProps {
  kind: EventKind;
  /** 20 (SM), 24 (MD) or 32 (LG). Never smaller than 20. */
  size?: 20 | 24 | 32;
  className?: string;
  /** Dots only, in currentColor: for use on a tile already in the event colour. */
  bare?: boolean;
}

/**
 * Event Mark: a 3×3 dot pattern on a tile in the event colour, so the type
 * reads by shape as well as hue.
 */
export const EventMark: React.FC<EventMarkProps> = ({ kind, size = 20, className, bare = false }) => {
  const lit = new Set(PATTERNS[kind]);
  const step = size === 32 ? 8 : size / 4;
  const offset = size === 32 ? 8 : size === 24 ? 6 : 4;
  const r = size === 32 ? 2.5 : 2;
  const rx = size === 32 ? 8 : 6;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {!bare && <rect width={size} height={size} rx={rx} fill={`var(--accent-${kind})`} />}
      {Array.from({ length: 9 }).map((_, i) => {
        const cx = offset + (i % 3) * (size === 20 ? 6 : step);
        const cy = offset + Math.floor(i / 3) * (size === 20 ? 6 : step);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill={bare ? 'currentColor' : `var(--accent-${kind}-fg)`}
            opacity={lit.has(i) ? 1 : 0.22}
          />
        );
      })}
    </svg>
  );
};

/** Map an app event (event_type + status + date) to its Event Mark kind. */
export function eventKindOf(e: { event_type?: string; eventType?: string; status?: string }, isPast = false): EventKind {
  if (isPast) return 'past';
  const type = (e.event_type || e.eventType || '').toLowerCase();
  const status = (e.status || '').toLowerCase();
  if (type === 'rehearsal') return 'rehearsal';
  if (type === 'personal') return 'personal';
  if (status === 'quote' || status === 'pending' || status === 'tentative' || status === 'draft') return 'quote';
  return 'gig';
}
