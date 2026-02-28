import React from 'react';
import { cn } from './utils';

/**
 * Swiss Brutalist dot-grid radio indicator.
 * Renders a 4×3 grid of rounded pills forming a "V" (checkmark) pattern when selected.
 * Unselected: all dots uniform light color. Disabled: all dots even lighter, no pattern.
 */

const V_PATTERN = new Set([3, 4, 6, 9]);
// Grid layout (4 cols × 3 rows, indices 0-11):
//  0  1  2  3       ○ ○ ○ ●
//  4  5  6  7  →    ● ○ ● ○
//  8  9 10 11       ○ ● ○ ○

interface DotRadioProps {
  selected: boolean;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
  onClick?: () => void;
}

export const DotRadio: React.FC<DotRadioProps> = ({
  selected,
  disabled = false,
  activeColor = '#000000',
  inactiveColor,
  className,
  onClick,
}) => {
  const inactive = disabled
    ? 'rgba(0,0,0,0.06)'
    : inactiveColor || 'rgba(0,0,0,0.15)';
  const active = disabled ? 'rgba(0,0,0,0.06)' : activeColor;

  const gridClasses = cn(
    'grid grid-cols-4 grid-rows-3 gap-1 w-[100px] h-[64px] shrink-0',
    onClick && 'focus:outline-none',
    onClick && (disabled ? 'cursor-not-allowed' : 'cursor-pointer'),
    !onClick && 'pointer-events-none',
    className,
  );

  const dots = Array.from({ length: 12 }).map((_, i) => (
    <div
      key={i}
      className="rounded-[10px]"
      style={{
        backgroundColor: selected && V_PATTERN.has(i) ? active : inactive,
      }}
    />
  ));

  if (onClick) {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onClick}
        className={gridClasses}
      >
        {dots}
      </button>
    );
  }

  return (
    <div role="radio" aria-checked={selected} className={gridClasses}>
      {dots}
    </div>
  );
};
