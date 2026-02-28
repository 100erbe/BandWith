import React from 'react';
import { cn } from './utils';

/**
 * Swiss Brutalist dot-grid checkbox indicator.
 * Renders a 3×3 grid of rounded pills forming an "X" pattern when checked.
 * Unchecked: all dots uniform light color. Disabled: all dots even lighter, no pattern.
 */

const X_PATTERN = new Set([0, 2, 4, 6, 8]);
// Grid layout (3 cols × 3 rows, indices 0-8):
//  0  1  2       ● ○ ●
//  3  4  5  →    ○ ● ○
//  6  7  8       ● ○ ●

interface DotCheckboxProps {
  checked: boolean;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
  onClick?: () => void;
}

export const DotCheckbox: React.FC<DotCheckboxProps> = ({
  checked,
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
    'grid grid-cols-3 grid-rows-3 gap-1 w-[100px] h-[64px] shrink-0',
    onClick && 'focus:outline-none',
    onClick && (disabled ? 'cursor-not-allowed' : 'cursor-pointer'),
    !onClick && 'pointer-events-none',
    className,
  );

  const dots = Array.from({ length: 9 }).map((_, i) => (
    <div
      key={i}
      className="rounded-[10px]"
      style={{
        backgroundColor: checked && X_PATTERN.has(i) ? active : inactive,
      }}
    />
  ));

  if (onClick) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={onClick}
        className={gridClasses}
      >
        {dots}
      </button>
    );
  }

  return (
    <div role="checkbox" aria-checked={checked} className={gridClasses}>
      {dots}
    </div>
  );
};
