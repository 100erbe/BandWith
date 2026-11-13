import React from 'react';
import { LANGUAGES, useT, type Locale } from '@/lib/i18n';
import { Selector } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';

/** "Client language" chips (EN IT ES FR DE PT) for documents sent to a client. */
export const DocLanguagePicker: React.FC<{
  value: Locale;
  onChange: (l: Locale) => void;
  className?: string;
  labelClassName?: string;
  /** 'sheet' for the always-dark bottom sheets (white chips, whatever the theme). */
  tone?: 'default' | 'sheet';
}> = ({ value, onChange, className, labelClassName, tone = 'default' }) => {
  const t = useT();
  return (
    <div className={cn('flex flex-col gap-2', className)} role="group" aria-label={t('Client language')}>
      <span className={cn('bw-label-sm text-muted-foreground', labelClassName)}>{t('Client language')}</span>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((l) => (
          <Selector
            key={l.id}
            size="md"
            selected={value === l.id}
            ariaLabel={l.name}
            onClick={() => onChange(l.id)}
            className={tone === 'sheet' ? (value === l.id ? 'bg-white text-black' : 'border-white/30 text-white') : undefined}
          >
            {l.id.toUpperCase()}
          </Selector>
        ))}
      </div>
    </div>
  );
};

export default DocLanguagePicker;
