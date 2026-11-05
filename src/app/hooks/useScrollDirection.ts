import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * Tracks scroll direction within a given scrollable container element using
 * pivot-based directional hysteresis to prevent jitter, bounce, or tremor oscillation.
 * Returns `true` when scrolling down, `false` when scrolling up or at top.
 * 
 * @param scrollContainerRef - A ref to the scrollable container element
 * @param threshold - Minimum continuous directional travel (px) before state flips (default: 18)
 */
export function useScrollDirection(
  scrollContainerRef: RefObject<HTMLElement | null>,
  threshold: number = 18
): boolean {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const stateRef = useRef({
    isDown: false,
    pivotTop: 0,
    lastTop: 0,
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        // Clamp to valid scroll bounds to ignore iOS/Android elastic overscroll bounce
        const currentTop = Math.max(0, Math.min(container.scrollTop, maxScroll));
        const s = stateRef.current;

        // Always expand when near the very top
        if (currentTop <= 12) {
          if (s.isDown) {
            s.isDown = false;
            setIsScrollingDown(false);
          }
          s.pivotTop = currentTop;
          s.lastTop = currentTop;
          return;
        }

        if (!s.isDown) {
          // Currently expanded: track highest upward point (minimum scrollTop)
          if (currentTop < s.pivotTop) {
            s.pivotTop = currentTop;
          } else if (currentTop > 32 && currentTop - s.pivotTop >= threshold) {
            s.isDown = true;
            s.pivotTop = currentTop;
            setIsScrollingDown(true);
          }
        } else {
          // Currently shrunk: track lowest downward point (maximum scrollTop)
          if (currentTop > s.pivotTop) {
            s.pivotTop = currentTop;
          } else if (s.pivotTop - currentTop >= threshold) {
            s.isDown = false;
            s.pivotTop = currentTop;
            setIsScrollingDown(false);
          }
        }

        s.lastTop = currentTop;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [scrollContainerRef, threshold]);

  return isScrollingDown;
}

export default useScrollDirection;

