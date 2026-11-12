import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { useOnboarding } from '@/lib/OnboardingContext';
import { AuthScreen, Kicker, PillButton } from '@/app/components/bw/Form';
import { DotMatrixRadio, WizardTop, wizardStep } from './OnboardingChrome';
import { useT } from '@/lib/i18n';

interface IntentSelectorProps {
  onSelectSolo: () => void;
  onSelectBand: () => void;
  onBack: () => void;
}

type Intent = 'solo' | 'band';

interface IntentOption {
  id: Intent;
  title: string;
  description: string;
  badge: string;
  /** Lit dots out of 5 (1 = just you, 5 = the whole band). */
  dots: number;
  /** Badge uses the lime accent pill instead of the outline pill. */
  accentBadge?: boolean;
}

export const IntentSelector: React.FC<IntentSelectorProps> = ({
  onSelectSolo,
  onSelectBand,
  onBack,
}) => {
  const t = useT();
  // Built here so the text follows the language; the ids are what gets used.
  const OPTIONS: IntentOption[] = [
    {
      id: 'solo',
      title: t('Solo schedule'),
      description: t('Manage personal gigs, sync private rehearsals and track your earnings.'),
      badge: t('Free'),
      dots: 1,
    },
    {
      id: 'band',
      title: t('Manage my band'),
      description: t('Coordinate shared schedules, automate quotes and track band finances.'),
      badge: t('Admin'),
      dots: 5,
      accentBadge: true,
    },
  ];
  const { path } = useOnboarding();
  const [choice, setChoice] = useState<Intent | null>(null);
  const { step, total } = wizardStep(path, 'intent');

  const handleContinue = () => {
    if (choice === 'solo') onSelectSolo();
    else if (choice === 'band') onSelectBand();
  };

  return (
    <AuthScreen
      top={<WizardTop onBack={onBack} step={step} total={total} />}
      bodyClassName="pt-2 gap-3"
      footer={
        <PillButton onClick={handleContinue} disabled={!choice} trailingIcon={<ArrowUpRight className="w-5 h-5" />}>
          {t('Continue')}
        </PillButton>
      }
    >
      <Kicker overline={t('Choose your path')} title={t('What brings you here?')} />
      <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground max-w-[340px]">
        {t('Choose how you want to use BandWith. You can change this later.')}
      </p>

      <div role="radiogroup" aria-label={t('Choose your path')} className="flex flex-col gap-3">
        {OPTIONS.map((opt, i) => {
          const selected = choice === opt.id;
          return (
            <motion.button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(opt.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.08, duration: 0.4 }}
              className={cn(
                'w-full text-left flex flex-col gap-3 p-5 rounded-[24px] transition-colors',
                'active:scale-[var(--press-scale,0.97)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                // Selected card is the dark Figma card; scoping `dark` flips the tokens inside it.
                selected ? 'dark bg-sheet text-foreground border border-transparent' : 'bg-card text-foreground border border-border',
              )}
            >
              <span className="flex items-center justify-between w-full">
                <span className="flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, d) => (
                    <span
                      key={d}
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        d < opt.dots ? (selected ? 'bg-accent' : 'bg-dot-on') : 'bg-dot-off',
                      )}
                    />
                  ))}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center h-7 px-3 rounded-full bw-label-sm',
                    opt.accentBadge ? 'bg-accent text-accent-foreground' : 'border border-border text-muted-foreground',
                  )}
                >
                  {opt.badge}
                </span>
              </span>
              <span className="bw-h1">{opt.title}</span>
              <span
                className={cn(
                  'text-[16px] leading-[1.45] tracking-[-0.003em]',
                  selected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {opt.description}
              </span>
              <span className="flex items-center gap-2">
                <DotMatrixRadio checked={selected} />
                <span className={cn('bw-label-sm', selected ? 'text-accent' : 'text-muted-foreground')}>
                  {selected ? t('Selected') : t('Select')}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </AuthScreen>
  );
};

export default IntentSelector;
