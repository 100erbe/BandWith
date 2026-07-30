import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * Tracks scroll direction within a given scrollable container element.
 * Returns `true` when scrolling down, `false` when scrolling up or at top.
 * 
 * @param scrollContainerRef - A ref to the scrollable container element
 * @param threshold - Minimum scroll distance (px) before direction changes (default: 5)
 */
export function useScrollDirection(
  scrollContainerRef: RefObject<HTMLElement | null>,
  threshold: number = 5
): boolean {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const diff = currentScrollTop - lastScrollTopRef.current;

      // Only update if past threshold to avoid jitter
      if (Math.abs(diff) > threshold) {
        setIsScrollingDown(diff > 0 && currentScrollTop > 0);
      }

      // Reset if at the top
      if (currentScrollTop <= 0) {
        setIsScrollingDown(false);
      }

      lastScrollTopRef.current = currentScrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, threshold]);

  return isScrollingDown;
}

export default useScrollDirection;
