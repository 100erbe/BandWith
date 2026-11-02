import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from './utils';

export interface TimePickerProps {
  value?: string; // "HH:mm" (e.g. "20:00") or ""
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  textSize?: string;
  showIcon?: boolean;
  id?: string;
}

export const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
export const MINUTE_OPTIONS = ['00', '15', '30', '45'] as const;

export const TimePicker: React.FC<TimePickerProps> = ({
  value = '',
  onChange,
  className,
  disabled = false,
  allowEmpty = false,
  emptyLabel = '--',
  textSize = 'text-[20px]',
  showIcon = true,
  id,
}) => {
  const [rawHour = '', rawMinute = ''] = (value || '').split(':');

  // Normalize initial minute to nearest 15-minute slot only if an odd legacy minute exists
  const normalizedMinute = rawMinute && !MINUTE_OPTIONS.includes(rawMinute as any)
    ? MINUTE_OPTIONS[Math.min(3, Math.max(0, Math.round(parseInt(rawMinute, 10) / 15)) % 4)]
    : rawMinute;

  const hour = rawHour ? rawHour.padStart(2, '0') : '';
  const minute = normalizedMinute || '';

  const handleHourChange = (newHour: string) => {
    if (!newHour) {
      if (allowEmpty) onChange('');
      return;
    }
    const targetMin = minute || '00';
    onChange(`${newHour}:${targetMin}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    if (!newMinute) {
      if (allowEmpty) onChange('');
      return;
    }
    const targetHr = hour || '20';
    onChange(`${targetHr}:${newMinute}`);
  };

  return (
    <div className={cn('relative inline-flex items-center gap-1.5 w-full bg-transparent group', className)}>
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Hour Select */}
        <div className="relative inline-flex items-center">
          <select
            id={id ? `${id}-hour` : undefined}
            value={hour}
            disabled={disabled}
            onChange={(e) => handleHourChange(e.target.value)}
            className={cn(
              'bg-transparent font-bold focus:outline-none cursor-pointer appearance-none uppercase text-center px-1.5 py-0.5 rounded transition-colors hover:bg-foreground/10',
              textSize,
              disabled && 'cursor-not-allowed opacity-50'
            )}
            style={{ minWidth: '2.4ch' }}
            aria-label="Hour"
          >
            {allowEmpty && <option value="" className="text-black bg-white">{emptyLabel}</option>}
            {HOURS.map((h) => (
              <option key={h} value={h} className="text-black bg-white text-base font-medium">
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* Colon separator */}
        <span
          className={cn('font-bold select-none opacity-40 px-0.5 pointer-events-none', textSize)}
          aria-hidden="true"
        >
          :
        </span>

        {/* Minute Select - STRICTLY 4 OPTIONS: 00, 15, 30, 45 */}
        <div className="relative inline-flex items-center">
          <select
            id={id ? `${id}-minute` : undefined}
            value={minute}
            disabled={disabled}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className={cn(
              'bg-transparent font-bold focus:outline-none cursor-pointer appearance-none uppercase text-center px-1.5 py-0.5 rounded transition-colors hover:bg-foreground/10',
              textSize,
              disabled && 'cursor-not-allowed opacity-50'
            )}
            style={{ minWidth: '2.4ch' }}
            aria-label="Minute"
          >
            {allowEmpty && <option value="" className="text-black bg-white">{emptyLabel}</option>}
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m} className="text-black bg-white text-base font-medium">
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showIcon && (
        <Clock className="w-4 h-4 opacity-30 shrink-0 ml-auto pointer-events-none group-focus-within:opacity-60 transition-opacity" />
      )}
    </div>
  );
};
