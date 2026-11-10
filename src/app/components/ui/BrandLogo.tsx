import React from 'react';
import { BrandMark, BrandWordmark } from '../bw/BrandMark';
import { cn } from './utils';

export interface BrandLogoProps {
  /** Kept for API compatibility; there is a single mark. */
  variant?: 'waveform' | 'capsule' | 'connect';
  lockup?: 'icon-only' | 'horizontal' | 'wordmark-only' | 'vertical';
  /** Draw everything in the text colour (no accent on the mark and WITH). */
  monochrome?: boolean;
  /** Sizes the logo; mark and logotype fill its height. */
  className?: string;
  /** Logotype size/colour when shown alone or stacked (e.g. "text-2xl"); the logotype is 0.75em tall. */
  textClassName?: string;
  style?: React.CSSProperties;
}

/**
 * BandWith logo (Figma: Logo/Mark, Logo/Wordmark). Colour follows the current
 * text colour; mark and WITH use --accent-ink unless `monochrome`.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  lockup = 'horizontal',
  monochrome = false,
  className = 'h-8',
  textClassName = '',
  style,
}) => {
  const accent = monochrome ? 'currentColor' : 'var(--accent-ink)';
  const mark = <BrandMark title="" color={accent} className="h-full w-auto" />;
  const sizedLogotype = (
    <span aria-hidden className={cn('inline-flex leading-none', textClassName || 'text-[22px]')}>
      <BrandWordmark accent={accent} style={{ height: '0.75em', width: 'auto' }} />
    </span>
  );

  if (lockup === 'icon-only') {
    return (
      <span role="img" aria-label="BandWith" className={cn('inline-flex items-center justify-center select-none text-foreground', className)} style={style}>
        {mark}
      </span>
    );
  }

  if (lockup === 'wordmark-only') {
    return (
      <span role="img" aria-label="BandWith" className={cn('inline-flex items-center select-none text-foreground', className)} style={style}>
        {sizedLogotype}
      </span>
    );
  }

  if (lockup === 'vertical') {
    return (
      <span role="img" aria-label="BandWith" className={cn('inline-flex flex-col items-start gap-3 select-none text-foreground', className)} style={style}>
        <span className="h-[65%]">{mark}</span>
        {sizedLogotype}
      </span>
    );
  }

  // Horizontal lockup: mark and logotype share the same height (brand file ratio).
  return (
    <span role="img" aria-label="BandWith" className={cn('inline-flex items-center gap-[0.28em] select-none text-foreground', className)} style={style}>
      {mark}
      <BrandWordmark accent={accent} className="h-full w-auto" />
    </span>
  );
};

export default BrandLogo;
