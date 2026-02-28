import React from 'react';
import { cn } from './utils';

interface LogoProps {
  variant?: 'full' | 'icon' | 'wordmark';
  colorMode?: 'default' | 'white' | 'lime' | 'black';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Size mappings
const sizeMap = {
  sm: { icon: 24, wordmark: 80, full: 120 },
  md: { icon: 40, wordmark: 120, full: 180 },
  lg: { icon: 56, wordmark: 160, full: 240 },
  xl: { icon: 80, wordmark: 200, full: 320 },
};

// Color mappings
const colorMap = {
  default: { band: '#FFFFFF', with: '#D4FB46', icon: '#D4FB46' },
  white: { band: '#FFFFFF', with: '#FFFFFF', icon: '#FFFFFF' },
  lime: { band: '#D4FB46', with: '#D4FB46', icon: '#D4FB46' },
  black: { band: '#000000', with: '#000000', icon: '#000000' },
};

// Icon SVG Component (Equalizer pattern)
const IconMark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Left column - 3 small squares */}
    <rect x="8" y="8" width="18" height="18" rx="5" fill={color} />
    <rect x="8" y="41" width="18" height="18" rx="5" fill={color} />
    <rect x="8" y="74" width="18" height="18" rx="5" fill={color} />
    
    {/* Middle column - tall bar */}
    <rect x="41" y="8" width="18" height="51" rx="5" fill={color} />
    <rect x="41" y="74" width="18" height="18" rx="5" fill={color} />
    
    {/* Right column - 3 squares */}
    <rect x="74" y="8" width="18" height="18" rx="5" fill={color} />
    <rect x="74" y="41" width="18" height="18" rx="5" fill={color} />
    <rect x="74" y="74" width="18" height="18" rx="5" fill={color} />
  </svg>
);

// Wordmark SVG Component
const Wordmark: React.FC<{ width: number; bandColor: string; withColor: string }> = ({
  width,
  bandColor,
  withColor,
}) => {
  const height = width * 0.25; // Aspect ratio
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* BAND */}
      <text
        x="0"
        y="75"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="80"
        fontWeight="900"
        fontStyle="italic"
        fill={bandColor}
        letterSpacing="-4"
      >
        BAND
      </text>
      {/* WITH */}
      <text
        x="195"
        y="75"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="80"
        fontWeight="900"
        fontStyle="italic"
        fill={withColor}
        letterSpacing="-4"
      >
        WITH
      </text>
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  colorMode = 'default',
  size = 'md',
  className,
}) => {
  const colors = colorMap[colorMode];
  const sizes = sizeMap[size];

  if (variant === 'icon') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <IconMark size={sizes.icon} color={colors.icon} />
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <div className={cn('flex items-center', className)}>
        <Wordmark
          width={sizes.wordmark}
          bandColor={colors.band}
          withColor={colors.with}
        />
      </div>
    );
  }

  // Full logo (icon + wordmark)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <IconMark size={sizes.icon} color={colors.icon} />
      <Wordmark
        width={sizes.wordmark}
        bandColor={colors.band}
        withColor={colors.with}
      />
    </div>
  );
};

// App Icon Component (for use in splash screens, etc.)
export const AppIcon: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 96, className }) => (
  <div
    className={cn(
      'flex items-center justify-center rounded-[22%]',
      className
    )}
    style={{
      width: size,
      height: size,
      background: '#D4FB46',
      boxShadow: `0 ${size * 0.1}px ${size * 0.4}px rgba(212, 251, 70, 0.4)`,
    }}
  >
    <svg
      width={size * 0.65}
      height={size * 0.65}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left column */}
      <rect x="8" y="8" width="18" height="18" rx="5" fill="#000000" />
      <rect x="8" y="41" width="18" height="18" rx="5" fill="#000000" />
      <rect x="8" y="74" width="18" height="18" rx="5" fill="#000000" />
      
      {/* Middle column */}
      <rect x="41" y="8" width="18" height="51" rx="5" fill="#000000" />
      <rect x="41" y="74" width="18" height="18" rx="5" fill="#000000" />
      
      {/* Right column */}
      <rect x="74" y="8" width="18" height="18" rx="5" fill="#000000" />
      <rect x="74" y="41" width="18" height="18" rx="5" fill="#000000" />
      <rect x="74" y="74" width="18" height="18" rx="5" fill="#000000" />
    </svg>
  </div>
);

export default Logo;
