import React from 'react';
import { cn } from './utils';
import { Check } from 'lucide-react';

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
  activeColor = 'var(--fg)',
  inactiveColor,
  className,
  onClick,
}) => {
  const borderColor = disabled
    ? 'var(--border)'
    : inactiveColor || 'var(--dot-inactive)';
  const bg = disabled ? 'var(--muted)' : checked ? activeColor : 'transparent';
  const fg = disabled
    ? 'var(--dot-inactive)'
    : checked
      ? 'var(--surface-inverse-fg)'
      : 'transparent';

  const boxClasses = cn(
    'w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all',
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
        className="w-4.5 h-4.5 transition-all"
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