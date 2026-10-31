import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  DollarSign,
  FileText,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

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
  color: string;
  content: string;
  highlights: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'WELCOME TO BANDWITH',
    subtitle: 'YOUR ADMIN COMMAND CENTER',
    badge: 'OVERVIEW',
    icon: Sparkles,
    color: '#D4FB46',
    content:
      'BandWith centralizes your entire live music operation. From lineup availability and rehearsals to automated client quotes and finances.',
    highlights: [
      'Dashboard with live stats for Gigs, Rehearsals, and Revenue',
      'One-tap switcher across multiple bands and solo projects',
      'Direct sync between member RSVPs and setlist assignments',
    ],
  },
  {
    title: 'PRICING & SERVICES',
    subtitle: 'NEUTRAL FORMULA & CUSTOM ADD-ONS',
    badge: 'CORE ENGINE',
    icon: DollarSign,
    color: '#3B82F6',
    content:
      'Every band operates with unique fees. The Pricing & Services section gives you a neutral base where you configure your musicians’ pay and client rates.',
    highlights: [
      'Core vs. Session Musician tiers (set core threshold and session player rates)',
      'Production packages: Standard PA (≤150 guests) and Pro rigs (≤250 guests)',
      'Custom add-ons: Create extra services like cocktail sets, DJs, or extra sound zones',
    ],
  },
  {
    title: 'AUTOMATED QUOTES',
    subtitle: 'INSTANT PROPOSALS IN SECONDS',
    badge: 'WORKFLOW',
    icon: FileText,
    color: 'var(--accent-quote)',
    content:
      'When an inquiry comes in, tap "+ NEW QUOTE". The system calculates travel, lineup compensation, taxes, and deposit schedules automatically.',
    highlights: [
      'Seasonal pricing adjustment automatically calculated from the event date',
      'Travel rate applied per KM per musician from your home base',
      'One-click breakdown of client total, VAT, deposit, and contingency buffer',
    ],
  },
  {
    title: 'READY TO CONFIGURE',
    subtitle: 'PERSONALIZE YOUR BAND PROFILE',
    badge: 'GET STARTED',
    icon: CheckCircle2,
    color: '#22C55E',
    content:
      'You are all set! You can visit "Pricing & Services" at any time from the More drawer to set your currency, rates, and services.',
    highlights: [
      'Access anytime from the More menu → Pricing & Services',
      'All active services will immediately appear in your Quote Wizard',
      'Invite your band members and start booking gigs',
    ],
  },
];

export const AdminGuidedTourModal: React.FC<AdminGuidedTourModalProps> = ({
  isOpen,
  onClose,
  onOpenPricing,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

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
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      <motion.div
        initial={{ scale: 0.94, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 15 }}
        className="w-full max-w-lg bg-card border border-border rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === currentStep ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${step.color}15`,
                borderColor: `${step.color}35`,
                color: step.color,
              }}
            >
              <StepIcon className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {step.badge} • STEP {currentStep + 1} OF {TOUR_STEPS.length}
              </span>
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight leading-none mt-0.5">
                {step.title}
              </h2>
              <span className="text-xs font-semibold text-primary uppercase mt-0.5">
                {step.subtitle}
              </span>
            </div>
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed">{step.content}</p>

          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-muted/30 border border-border/80">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              KEY CAPABILITIES
            </span>
            <div className="flex flex-col gap-1.5">
              {step.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-foreground/90 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-3 border-t border-border/60 flex items-center justify-between bg-muted/10">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded-full border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {isLast && onOpenPricing && (
              <button
                type="button"
                onClick={handleOpenPricing}
                className="px-4 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
              >
                Configure Rates
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1 shadow-sm"
            >
              {isLast ? 'Done' : 'Next'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
