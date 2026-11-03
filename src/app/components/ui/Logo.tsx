import React from 'react';
import { cn } from './utils';
import { BrandLogo } from './BrandLogo';

interface LogoProps {
  variant?: 'full' | 'icon' | 'wordmark';
  colorMode?: 'default' | 'white' | 'lime' | 'black';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const heightMap = {
  sm: 'h-6',
  md: 'h-9',
  lg: 'h-12',
  xl: 'h-16',
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  colorMode = 'default',
  size = 'md',
  className,
}) => {
  const lockup =
    variant === 'icon'
      ? 'icon-only'
      : variant === 'wordmark'
        ? 'wordmark-only'
        : 'horizontal';
  const monochrome = colorMode === 'white' || colorMode === 'black';
  const toneClass =
    colorMode === 'white'
      ? 'text-[var(--surface-inverse-fg)]'
      : colorMode === 'black'
        ? 'text-foreground'
        : '';

  return (
    <BrandLogo
      variant="waveform"
      lockup={lockup}
      monochrome={monochrome}
      className={cn(heightMap[size], toneClass, className)}
    />
  );
};

export const AppIcon: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 96, className }) => (
  <div
    className={cn(
      'flex items-center justify-center rounded-[22%] bg-card border border-foreground/10',
      className
    )}
    style={{
      width: size,
      height: size,
      boxShadow: `0 ${Math.round(size * 0.1)}px ${Math.round(size * 0.35)}px rgba(200, 67, 26, 0.25)`,
    }}
  >
    <BrandLogo
      variant="waveform"
      lockup="icon-only"
      style={{ height: Math.round(size * 0.56) }}
    />
  </div>
);

export default Logo;
