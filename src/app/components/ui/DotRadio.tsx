import React from 'react';
import { cn } from './utils';

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
  activeColor = 'var(--fg)',
  inactiveColor,
  className,
  onClick,
}) => {
  const borderColor = disabled
    ? 'rgba(0,0,0,0.1)'
    : selected
      ? activeColor
      : inactiveColor || 'rgba(0,0,0,0.2)';

  const circleClasses = cn(
    'w-[32px] h-[32px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
    onClick && 'focus:outline-none',
    onClick && (disabled ? 'cursor-not-allowed' : 'cursor-pointer'),
    !onClick && 'pointer-events-none',
    className,
  );

  const innerDot = (
    <div
      className="w-[14px] h-[14px] rounded-full transition-all"
      style={{
        backgroundColor: selected ? activeColor : 'transparent',
        opacity: selected ? 1 : 0,
        transform: selected ? 'scale(1)' : 'scale(0)',
      }}
    />
  );

  const circle = (
    <div
      className={circleClasses}
      style={{ borderColor }}
    >
      {innerDot}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onClick}
        className="shrink-0"
      >
        {circle}
      </button>
    );
  }

  return (
    <div role="radio" aria-checked={selected} className="shrink-0">
      {circle}
    </div>
  );
};