import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, CheckCircle2, Crown, DollarSign, FileText, X } from '@/app/components/icons';
import { PillButton, Selector } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { useT } from '@/lib/i18n';

interface AdminGuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPricing?: () => void;
}

interface TourStep {
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  content: string;
  highlights: string[];
}

// Built per render so the text follows the app language.
const tourSteps = (t: (source: string) => string): TourStep[] => [
  {
    title: t('WELCOME TO BANDWITH'),
    subtitle: t('YOUR ADMIN COMMAND CENTER'),
    badge: t('OVERVIEW'),
    icon: Crown,
    content: t('Run gigs, rehearsals and quotes for the whole band from one place.'),
    highlights: [
      t('Schedule gigs & rehearsals for everyone'),
      t('Send branded quotes in minutes'),
      t('Track fees, payouts and revenue'),
    ],
  },
  {
    title: t('PRICING & SERVICES'),
    subtitle: t('NEUTRAL FORMULA & CUSTOM ADD-ONS'),
    badge: t('CORE ENGINE'),
    icon: DollarSign,
    content:
      t('Every band operates with unique fees. The Pricing & Services section gives you a neutral base where you configure your musicians’ pay and client rates.'),
    highlights: [
      t('Core vs. Session Musician tiers (set core threshold and session player rates)'),
      t('Production packages: Standard PA (≤150 guests) and Pro rigs (≤250 guests)'),
      t('Custom add-ons: Create extra services like cocktail sets, DJs, or extra sound zones'),
    ],
  },
  {
    title: t('AUTOMATED QUOTES'),
    subtitle: t('INSTANT PROPOSALS IN SECONDS'),
    badge: t('WORKFLOW'),
    icon: FileText,
    content:
      t('When an inquiry comes in, tap "+ NEW QUOTE". The system calculates travel, lineup compensation, taxes, and deposit schedules automatically.'),
    highlights: [
      t('Seasonal pricing adjustment automatically calculated from the event date'),
      t('Travel rate per km (or mile) per musician from your home base'),
      t('One-click breakdown of client total, VAT, deposit, and contingency buffer'),
    ],
  },
  {
    title: t('READY TO CONFIGURE'),
    subtitle: t('PERSONALIZE YOUR BAND PROFILE'),
    badge: t('GET STARTED'),
    icon: CheckCircle2,
    content:
      t('You are all set! You can visit "Pricing & Services" at any time from the More drawer to set your currency, rates, and services.'),
    highlights: [
      t('Access anytime from the More menu → Pricing & Services'),
      t('All active services will immediately appear in your Quote Wizard'),
      t('Invite your band members and start booking gigs'),
    ],
  },
];

export const AdminGuidedTourModal: React.FC<AdminGuidedTourModalProps> = ({
  isOpen,
  onClose,
  onOpenPricing,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const t = useT();
  const TOUR_STEPS = tourSteps(t);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const StepIcon = step.icon;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((p) => p + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((p) => p - 1);
    }
  };

  const handleOpenPricing = () => {
    onClose();
    if (onOpenPricing) onOpenPricing();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bw-pane-dialog fixed inset-0 z-[120] bg-black/65 flex items-center justify-center p-4"
      style={{ paddingTop: 'calc(var(--safe-top) + 16px)', paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-tour-title"
        initial={{ scale: 0.94, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 15 }}
        className="dark w-full max-w-[420px] max-h-full overflow-y-auto bg-sheet text-sheet-foreground rounded-[24px] p-6 flex flex-col gap-4 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <Selector className="bg-accent text-accent-foreground">
            {t('Step {step} of {total}', { step: currentStep + 1, total: TOUR_STEPS.length })}
          </Selector>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close tour')}
            className="-m-1 p-1 rounded-full active:scale-[var(--press-scale,0.97)] transition-transform"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-full border-[1.5px] border-foreground text-foreground">
              <X className="w-4 h-4" strokeWidth={2} />
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="w-16 h-16 rounded-[16px] bg-accent text-accent-foreground flex items-center justify-center shrink-0">
          <StepIcon className="w-[29px] h-[29px]" />
        </div>

        <p className="bw-label-sm text-muted-foreground">
          {step.title}
          <span className="sr-only"> · {step.badge}</span>
        </p>
        <h2 id="admin-tour-title" className="bw-h1 text-foreground">
          {step.subtitle}
        </h2>
        <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground">{step.content}</p>

        <p className="bw-label-sm text-muted-foreground">{t('Key capabilities')}</p>
        <ul className="flex flex-col gap-4">
          {step.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-3 text-[16px] leading-[1.45] tracking-[-0.003em] text-foreground">
              <Check className="w-4 h-4 mt-[5px] shrink-0 text-accent" strokeWidth={2.5} aria-hidden />
              <span>{h}</span>
            </li>
          ))}
        </ul>

        {isLast && onOpenPricing && (
          <PillButton variant="outline" size="md" onClick={handleOpenPricing}>
            {t('Configure rates')}
          </PillButton>
        )}

        {/* Footer (stays in view when the card scrolls, e.g. Laptop pose) */}
        <div className="bw-dialog-footer flex items-center justify-between gap-3">
          <div className="flex items-center gap-1" aria-hidden>
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2.5 rounded-full transition-all duration-300',
                  i === currentStep ? 'w-6 bg-accent' : 'w-2.5 bg-dot-off',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <PillButton variant="outline" size="md" fullWidth={false} onClick={handlePrev}>
                {t('Back')}
              </PillButton>
            )}
            <PillButton size="md" fullWidth={false} onClick={handleNext}>
              {isLast ? t('Done') : t('Next')}
            </PillButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
