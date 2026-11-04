import React from 'react';
import { cn } from './utils';
import { Check } from '@/app/components/icons';

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
  activeColor = 'var(--wizard-accent, var(--fg))',
  inactiveColor,
  className,
  onClick,
}) => {
  const borderColor = disabled
    ? 'rgba(0,0,0,0.1)'
    : inactiveColor || 'rgba(0,0,0,0.2)';
  const bg = disabled ? 'rgba(0,0,0,0.04)' : checked ? activeColor : 'transparent';
  const fg = disabled
    ? 'rgba(0,0,0,0.2)'
    : checked
      ? 'var(--wizard-accent-fg, var(--surface-inverse-fg))'
      : 'transparent';

  const boxClasses = cn(
    'w-[32px] h-[32px] rounded-[8px] border-2 flex items-center justify-center shrink-0 transition-all',
    onClick && 'focus:outline-none',
    onClick && (disabled ? 'cursor-not-allowed' : 'cursor-pointer'),
    !onClick && 'pointer-events-none',
    className,
  );

  const box = (
    <div
      className={boxClasses}
      style={{
        backgroundColor: bg,
        borderColor,
      }}
    >
      <Check
        className="w-[18px] h-[18px] transition-all"
        style={{ color: fg, opacity: checked ? 1 : 0 }}
        strokeWidth={3}
      />
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={onClick}
        className="shrink-0"
      >
        {box}
      </button>
    );
  }

  return (
    <div role="checkbox" aria-checked={checked} className="shrink-0">
      {box}
    </div>
  );
};