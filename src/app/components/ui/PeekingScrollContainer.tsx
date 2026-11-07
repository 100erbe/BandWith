import React, {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
} from 'react';
import { cn } from './utils';

export interface PeekingScrollOptions {
  /**
   * The height in pixels of the bottom fade mask that signals peeking elements.
   * Defaults to 56px so the bottom ~10% of the scroll viewport clearly slices
   * through the peeking element.
   */
  fadeHeight?: number;
  /**
   * Margin threshold from bottom (in px) at which the content is considered
   * fully scrolled and the fade mask clears completely. Defaults to 8px.
   */
  threshold?: number;
  /**
   * Whether to disable the peeking fade mask behavior.
   */
  disabled?: boolean;
}

export interface PeekingScrollContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    PeekingScrollOptions {}

function buildPeekingMaskStyle(
  canScrollDown: boolean,
  disabled: boolean,
  fadeHeight: number
): React.CSSProperties {
  if (!canScrollDown || disabled) {
    return {
      WebkitMaskImage: 'none',
      maskImage: 'none',
      transition: 'mask-image 0.2s ease, -webkit-mask-image 0.2s ease',
    };
  }
  const midStop = Math.round(fadeHeight * 0.38);
  const gradient = `linear-gradient(to bottom, black 0%, black calc(100% - ${fadeHeight}px), rgba(0, 0, 0, 0.38) calc(100% - ${midStop}px), transparent 100%)`;
  return {
    WebkitMaskImage: gradient,
    maskImage: gradient,
    transition: 'mask-image 0.2s ease, -webkit-mask-image 0.2s ease',
  };
}

/**
 * Hook that tracks whether a scrollable container has scrollable content
 * remaining below the visible viewport (peeking element affordance).
 * Returns ref, state, and CSS maskStyle for direct attachment.
 */
export function usePeekingScroll<T extends HTMLElement = HTMLDivElement>(
  options?: PeekingScrollOptions
) {
  const { fadeHeight = 56, threshold = 8, disabled = false } = options || {};
  const containerRef = useRef<T | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || disabled) {
      setCanScrollDown(false);
      return;
    }
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    const shouldPeek = hasOverflow && !isAtBottom;

    setCanScrollDown(prev => (prev !== shouldPeek ? shouldPeek : prev));
  }, [disabled, threshold]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    checkScroll();
    const rafId = requestAnimationFrame(checkScroll);

    el.addEventListener('scroll', checkScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkScroll();
      });
      resizeObserver.observe(el);
      Array.from(el.children).forEach(child => {
        resizeObserver?.observe(child);
      });
    }

    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        Array.from(el.children).forEach(child => {
          resizeObserver?.observe(child);
        });
        requestAnimationFrame(checkScroll);
      });
      mutationObserver.observe(el, { childList: true, subtree: true });
    }

    window.addEventListener('resize', checkScroll);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', checkScroll);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, disabled]);

  const maskStyle = buildPeekingMaskStyle(canScrollDown, disabled, fadeHeight);

  return { containerRef, canScrollDown, checkScroll, maskStyle };
}

/**
 * PeekingScrollContainer applies the 90% Viewport Rule / Peeking Elements affordance.
 * When the content inside exceeds the visible scroll area, a bottom alpha mask
 * renders above the bottom bar, cutting off the next element naturally (~10% peek)
 * to prevent false bottoms and guide the user to scroll.
 */
export const PeekingScrollContainer = forwardRef<
  HTMLDivElement,
  PeekingScrollContainerProps
>(
  (
    {
      className,
      children,
      fadeHeight = 56,
      threshold = 8,
      disabled = false,
      style,
      onScroll,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLDivElement | null>(null);
    const [canScrollDown, setCanScrollDown] = useState(false);

    useImperativeHandle(ref, () => internalRef.current as HTMLDivElement);

    const checkScroll = useCallback(() => {
      const el = internalRef.current;
      if (!el || disabled) {
        setCanScrollDown(false);
        return;
      }
      const hasOverflow = el.scrollHeight > el.clientHeight + 4;
      const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      const shouldPeek = hasOverflow && !isAtBottom;

      setCanScrollDown(prev => (prev !== shouldPeek ? shouldPeek : prev));
    }, [disabled, threshold]);

    useEffect(() => {
      const el = internalRef.current;
      if (!el || disabled) return;

      checkScroll();
      const rafId = requestAnimationFrame(checkScroll);

      const handleScroll = () => {
        checkScroll();
      };

      el.addEventListener('scroll', handleScroll, { passive: true });

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          checkScroll();
        });
        resizeObserver.observe(el);
        Array.from(el.children).forEach(child => {
          resizeObserver?.observe(child);
        });
      }

      let mutationObserver: MutationObserver | null = null;
      if (typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver(() => {
          Array.from(el.children).forEach(child => {
            resizeObserver?.observe(child);
          });
          requestAnimationFrame(checkScroll);
        });
        mutationObserver.observe(el, { childList: true, subtree: true });
      }

      window.addEventListener('resize', checkScroll);

      return () => {
        cancelAnimationFrame(rafId);
        el.removeEventListener('scroll', handleScroll);
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
        window.removeEventListener('resize', checkScroll);
      };
    }, [checkScroll, disabled, children]);

    const maskStyle = buildPeekingMaskStyle(canScrollDown, disabled, fadeHeight);

    return (
      <div
        ref={internalRef}
        className={cn('overflow-y-auto overscroll-contain min-h-0', className)}
        style={{
          ...maskStyle,
          ...style,
        }}
        onScroll={e => {
          checkScroll();
          onScroll?.(e);
        }}
        data-peeking-scroll={canScrollDown ? 'active' : 'idle'}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PeekingScrollContainer.displayName = 'PeekingScrollContainer';
