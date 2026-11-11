import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/app/components/ui/utils';
import { usePosture } from '@/lib/posture';

/**
 * Laptop pose layout (Figma "Duo · 11 Laptop pose"): when the phone stands
 * half folded with a horizontal fold, `display` fills the upright top half
 * and `deck` the flat bottom half. The 44pt band at the fold stays empty and
 * each half scrolls on its own.
 *
 * Rules the content should follow:
 * - Display: glanceable, no primary control; hero cards run edge to edge
 *   (wrap text in `.bw-fold-pad` to keep it clear of the system column).
 *   Type is one step bigger there (index.css).
 * - Deck: every control, sheet and menu; navigation on its bottom edge.
 *
 * Outside Laptop pose (or with it switched off in Settings › iPhone Duo) this
 * renders nothing, so callers keep their normal screen underneath. Entering
 * the pose never navigates: the normal screen stays mounted below.
 */
export interface FoldSplitProps {
  display: React.ReactNode;
  deck: React.ReactNode;
  /** `stage`: dark (OLED black) Display for Stage / Floor wedge, above Stage mode. */
  variant?: 'default' | 'stage';
  displayLabel?: string;
  deckLabel?: string;
  className?: string;
  /**
   * Stacking order. Default 70: over the page, under the floating tab bar
   * (80), full-screen layers (100+), sheets (184+) and the Duo rail (190).
   * A mode shown over a modal layer passes a value just above that layer.
   * The stage variant defaults to 125, above Stage mode (120).
   */
  zIndex?: number;
}

export const FoldSplit: React.FC<FoldSplitProps> = ({
  display,
  deck,
  variant = 'default',
  displayLabel = 'Display',
  deckLabel = 'Deck',
  className,
  zIndex,
}) => {
  const { posture, fold } = usePosture();
  const active = posture === 'tabletop' && !!fold && fold.orientation === 'horizontal';
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  // Mount next to the caller's own layers. iOS WebKit makes the app scroller
  // (#root, -webkit-overflow-scrolling) its own stacking context, so a split
  // on <body> would sit above every layer inside it: the Duo rail, sheets,
  // event detail. Callers that already render at the top of the document
  // (portals to <body>) keep the split there.
  useLayoutEffect(() => {
    if (!active) return;
    const anchor = anchorRef.current;
    const root = document.getElementById('root');
    setHost(anchor && root && root.contains(anchor) ? root : document.body);
  }, [active]);
  if (!active || typeof document === 'undefined') return null;
  const stage = variant === 'stage';
  return (
    <>
      <span ref={anchorRef} hidden />
      {host &&
        createPortal(
          <div
            className={cn('bw-fold-split', stage && 'bw-fold-split--stage dark', className)}
            data-variant={variant}
            style={zIndex !== undefined ? { zIndex } : undefined}
          >
            <section className="bw-fold-display" aria-label={displayLabel}>
              {display}
            </section>
            <div className="bw-fold-band" aria-hidden="true" />
            <section className="bw-fold-deck" aria-label={deckLabel}>
              {deck}
            </section>
          </div>,
          host,
        )}
    </>
  );
};

/** True while Laptop pose is on screen (posture settled, preference on). */
export function useLaptopPose(): boolean {
  const { posture, fold } = usePosture();
  return posture === 'tabletop' && !!fold && fold.orientation === 'horizontal';
}

export default FoldSplit;
