import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/app/components/ui/utils';

/**
 * Fit tiers — the type steps a long name walks down before it is clamped.
 * Each step is a Figma variant (Components › Fit Text), so the app and the
 * file always show the same size for the same text.
 */
export const FIT = {
  /** Band name in the app header (single line). */
  header: [36, 30, 24, 20],
  /** Event hero title (Event detail). */
  display: [36, 30, 24],
  /** Stage mode title. */
  stage: [44, 36, 28],
  /** Section / list titles set in H1. */
  h1: [32, 26, 22],
} as const;

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

export interface FitTextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  as?: Tag;
  text: string;
  /** Font sizes in px, largest first. */
  sizes: readonly number[];
  /** Lines allowed before the next step down; the last step clamps here. */
  maxLines?: number;
  /** When clamped, a tap shows the whole text (detail screens). */
  expandable?: boolean;
}

/**
 * Text that steps down through `sizes` until it fits in `maxLines`, then
 * clamps with an ellipsis. Measures the real rendered text (font, width,
 * language) instead of guessing from the character count. The full text is
 * always in the DOM, so screen readers read all of it.
 */
export const FitText: React.FC<FitTextProps> = ({
  as: Tag = 'span',
  text,
  sizes,
  maxLines = 2,
  expandable = false,
  className,
  style,
  onClick,
  ...rest
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [tier, setTier] = useState(0);
  const [clamped, setClamped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const key = sizes.join(',');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = -1;

    const fit = () => {
      const width = el.clientWidth;
      if (width === 0 || width === lastWidth) return;
      lastWidth = width;
      const saved = el.getAttribute('style');
      el.style.display = 'block';
      el.style.webkitLineClamp = 'unset';
      el.style.overflow = 'visible';
      el.style.whiteSpace = 'normal';
      let chosen = sizes.length - 1;
      let fits = false;
      for (let i = 0; i < sizes.length; i++) {
        el.style.fontSize = `${sizes[i]}px`;
        const lh = parseFloat(getComputedStyle(el).lineHeight) || sizes[i];
        const lines = Math.round(el.scrollHeight / lh);
        if (lines <= maxLines && el.scrollWidth <= el.clientWidth + 1) {
          chosen = i;
          fits = true;
          break;
        }
      }
      if (saved === null) el.removeAttribute('style');
      else el.setAttribute('style', saved);
      setTier(chosen);
      setClamped(!fits);
    };

    setExpanded(false);
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      lastWidth = -1;
      fit();
    });
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [text, key, maxLines]);

  const clamp = clamped && !expanded;
  const canExpand = expandable && clamped;

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-fit-tier={tier}
      className={cn('min-w-0 [overflow-wrap:anywhere]', canExpand && 'cursor-pointer', className)}
      style={{
        fontSize: sizes[tier],
        ...(clamp
          ? { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: maxLines, overflow: 'hidden' }
          : null),
        ...style,
      }}
      title={clamp ? text : undefined}
      aria-expanded={canExpand ? expanded : undefined}
      onClick={(e: React.MouseEvent<HTMLElement>) => {
        if (canExpand) setExpanded((v) => !v);
        onClick?.(e);
      }}
      {...rest}
    >
      {text}
    </Tag>
  );
};
