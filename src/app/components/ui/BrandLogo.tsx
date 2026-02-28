import React from 'react';
import { motion } from 'motion/react';

interface AppIconProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * BandWith App Icon - Equalizer grid pattern
 */
export const AppIcon: React.FC<AppIconProps> = ({ 
  size = 96, 
  className = '',
  animated = false 
}) => {
  const scale = size / 100;
  const barWidth = 18 * scale;
  const barRadius = 5 * scale;
  const gap = 6 * scale;
  const padding = 12 * scale;
  
  // Column positions
  const col1 = padding;
  const col2 = padding + barWidth + gap;
  const col3 = padding + (barWidth + gap) * 2;
  
  // Row heights for each column (equalizer pattern)
  const bars = [
    // Column 1: 3 separate bars
    { x: col1, y: padding, h: barWidth },
    { x: col1, y: padding + barWidth + gap, h: barWidth },
    { x: col1, y: size - padding - barWidth, h: barWidth },
    // Column 2: 1 tall bar + 1 small bar
    { x: col2, y: padding, h: barWidth * 2 + gap },
    { x: col2, y: size - padding - barWidth, h: barWidth },
    // Column 3: 3 separate bars
    { x: col3, y: padding, h: barWidth },
    { x: col3, y: padding + barWidth + gap, h: barWidth },
    { x: col3, y: size - padding - barWidth, h: barWidth },
  ];

  const barVariants = {
    initial: { scaleY: 0.8, opacity: 0.8 },
    animate: (i: number) => ({
      scaleY: [0.8, 1, 0.9, 1],
      opacity: 1,
      transition: {
        duration: 0.8,
        delay: i * 0.05,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
  };

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: 'linear-gradient(145deg, #D4FB46 0%, #C8F040 100%)',
        boxShadow: `0 ${size * 0.15}px ${size * 0.5}px rgba(212, 251, 70, 0.35)`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
      >
        {bars.map((bar, i) => (
          animated ? (
            <motion.rect
              key={i}
              x={bar.x}
              y={bar.y}
              width={barWidth}
              height={bar.h}
              rx={barRadius}
              fill="#000"
              custom={i}
              variants={barVariants}
              initial="initial"
              animate="animate"
              style={{ originY: 0.5 }}
            />
          ) : (
            <rect
              key={i}
              x={bar.x}
              y={bar.y}
              width={barWidth}
              height={bar.h}
              rx={barRadius}
              fill="#000"
            />
          )
        ))}
      </svg>
    </div>
  );
};

interface LogoTextProps {
  variant?: 'lime' | 'white' | 'black' | 'mixed-dark' | 'mixed-light';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * BandWith Logo Text - BANDWITH in bold italic
 */
export const LogoText: React.FC<LogoTextProps> = ({
  variant = 'mixed-dark',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  };

  const colors = {
    lime: { band: '#D4FB46', with: '#D4FB46' },
    white: { band: '#FFFFFF', with: '#FFFFFF' },
    black: { band: '#000000', with: '#000000' },
    'mixed-dark': { band: '#000000', with: '#D4FB46' },
    'mixed-light': { band: '#FFFFFF', with: '#D4FB46' },
  };

  const { band, with: withColor } = colors[variant];

  return (
    <h1
      className={`font-black italic tracking-tight ${sizeClasses[size]} ${className}`}
      style={{ fontStyle: 'italic' }}
    >
      <span style={{ color: band }}>BAND</span>
      <span style={{ color: withColor }}>WITH</span>
    </h1>
  );
};

interface FullLogoProps {
  variant?: 'horizontal' | 'vertical';
  colorMode?: 'dark' | 'light' | 'lime';
  iconSize?: number;
  className?: string;
  animated?: boolean;
}

/**
 * Full BandWith Logo with icon and text
 */
export const FullLogo: React.FC<FullLogoProps> = ({
  variant = 'vertical',
  colorMode = 'dark',
  iconSize = 80,
  className = '',
  animated = false,
}) => {
  const textVariant = colorMode === 'dark' ? 'mixed-dark' : colorMode === 'light' ? 'mixed-light' : 'lime';

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <AppIcon size={iconSize} animated={animated} />
        <LogoText variant={textVariant} size="lg" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <AppIcon size={iconSize} animated={animated} />
      <LogoText variant={textVariant} size="lg" />
    </div>
  );
};

export default { AppIcon, LogoText, FullLogo };
