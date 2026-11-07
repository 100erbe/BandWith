import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Sparkles, Music, Layers, Infinity } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { usePeekingScroll } from '@/app/components/ui/PeekingScrollContainer';

interface UpgradePricingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string | null;
}

interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  price: string;
  period: string;
  icon: React.ComponentType<{ className?: string }>;
  isPopular?: boolean;
  badgeLabel?: string;
  accentBadgeClass: string;
  iconBgClass: string;
  checkIconClass: string;
  description: string;
  features: string[];
  ctaLabel: string;
}

const TIERS: PricingTier[] = [
  {
    id: 'single_band',
    name: 'Indie Act Plan',
    tagline: '1 Managed Band',
    price: '$0',
    period: '/mo forever',
    icon: Music,
    accentBadgeClass: 'bg-muted text-muted-foreground border-border',
    iconBgClass: 'bg-muted/70 text-foreground border-border/40',
    checkIconClass: 'text-muted-foreground',
    description: 'Essential management toolkit for solo artists and single-group acts.',
    features: [
      'Manage 1 active band',
      'Event calendar & member RSVPs',
      'Setlist & song repertoire management',
      'Band chat & announcements',
      'Standard community support',
    ],
    ctaLabel: 'Current Plan',
  },
  {
    id: 'multi_band',
    name: 'Multi-Band Maestro',
    tagline: 'Up to 5 Managed Bands',
    price: '$12',
    period: '/mo',
    icon: Layers,
    isPopular: true,
    badgeLabel: 'Most Popular',
    accentBadgeClass: 'bg-primary/15 text-primary border-primary/30',
    iconBgClass: 'bg-primary/15 text-primary border-primary/25',
    checkIconClass: 'text-primary',
    description: 'Cross-band availability and tools for active musicians & bandleaders.',
    features: [
      'Manage up to 5 bands simultaneously',
      'Cross-band availability & conflict calendar',
      'Advanced repertoire tracking & song keys',
      'Gig quote creator & client PDFs',
      'Priority rehearsal polls & notifications',
      'Priority developer support',
    ],
    ctaLabel: 'Upgrade to Maestro',
  },
  {
    id: 'unlimited',
    name: 'Talent Agency OS',
    tagline: 'Unlimited Bands',
    price: '$29',
    period: '/mo',
    icon: Infinity,
    badgeLabel: 'Agency Scale',
    accentBadgeClass: 'bg-accent-gig/15 text-accent-gig border-accent-gig/30',
    iconBgClass: 'bg-accent-gig/15 text-accent-gig border-accent-gig/25',
    checkIconClass: 'text-accent-gig',
    description: 'Comprehensive roster and multi-manager tools for agencies and studios.',
    features: [
      'Unlimited managed bands & acts',
      'Multi-manager & booking agent tools',
      'White-label quotes & contract templates',
      'Financial tracking, payouts & mileage logs',
      'Cross-roster scheduling intelligence',
      'Dedicated account support',
    ],
    ctaLabel: 'Upgrade to Agency',
  },
];

export const UpgradePricingSheet: React.FC<UpgradePricingSheetProps> = ({
  isOpen,
  onClose,
  currentTier = 'single_band',
}) => {
  const activeTierId = currentTier || 'single_band';
  const { containerRef, maskStyle } = usePeekingScroll<HTMLDivElement>();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom Sheet Modal with 90% Viewport Peeking Elements Affordance */}
          <motion.div
            ref={containerRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[121] bg-background border-t border-border rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
            style={{
              paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
              ...maskStyle,
            }}
          >
            {/* Top Bar with Grab Handle & Close Button */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pt-3.5 pb-2 px-4 flex items-center justify-between border-b border-border/30">
              <div className="w-9" /> {/* Spacer for symmetry */}
              <div className="w-10 h-1.5 rounded-full bg-foreground/20" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full border border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 sm:px-6 pt-5 pb-8 max-w-xl mx-auto">
              {/* Header Title Section */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/25 rounded-full px-3.5 py-1 text-primary mb-3">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-extrabold uppercase tracking-widest">
                    Unlock More Power
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tight leading-tight">
                  Choose Your Plan
                </h2>

                <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  Scale your music operations with the right plan for your needs.
                </p>
              </div>

              {/* Tiers List */}
              <div className="flex flex-col gap-4">
                {TIERS.map((tier, index) => {
                  const isCurrent = activeTierId === tier.id;
                  const Icon = tier.icon;

                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + index * 0.06 }}
                      className={cn(
                        'relative rounded-2xl p-5 sm:p-6 transition-all border bg-card shadow-2xs',
                        tier.isPopular && !isCurrent
                          ? 'border-primary/50 ring-1 ring-primary/30'
                          : 'border-border/60',
                        isCurrent && 'ring-2 ring-foreground/20'
                      )}
                    >
                      {/* Top Badges (Popular or Current Plan) */}
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                        {tier.isPopular && !isCurrent && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
                            {tier.badgeLabel || 'Popular'}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="bg-muted text-muted-foreground border border-border text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                            Current Plan
                          </span>
                        )}
                      </div>

                      {/* Header Row: Icon, Name & Tagline */}
                      <div className="flex items-start gap-3.5 mb-3.5 pr-20">
                        <div className={cn(
                          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border',
                          tier.iconBgClass
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black uppercase text-foreground leading-tight tracking-tight">
                            {tier.name}
                          </h3>
                          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                            {tier.tagline}
                          </p>
                        </div>
                      </div>

                      {/* Pricing Block */}
                      <div className="flex items-baseline gap-1 my-3 pb-3 border-b border-border/40">
                        <span className="text-3xl font-black text-foreground tracking-tight">
                          {tier.price}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {tier.period}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs font-medium text-foreground/80 mb-4">
                        {tier.description}
                      </p>

                      {/* Features List */}
                      <div className="space-y-2.5 mb-5">
                        {tier.features.map((feature, fi) => (
                          <div key={fi} className="flex items-start gap-2.5">
                            <Check className={cn('w-4 h-4 mt-0.5 shrink-0', tier.checkIconClass)} />
                            <span className="text-xs font-medium text-foreground/90 leading-snug">
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* CTA Action Button */}
                      <button
                        type="button"
                        disabled={isCurrent}
                        onClick={() => {
                          if (!isCurrent) {
                            console.log(`[UpgradePricingSheet] Selected tier: ${tier.id}`);
                          }
                        }}
                        className={cn(
                          'w-full py-3 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all',
                          isCurrent
                            ? 'bg-muted text-muted-foreground border border-border cursor-default opacity-80'
                            : tier.isPopular
                              ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] shadow-sm cursor-pointer'
                              : 'bg-foreground text-background hover:opacity-90 active:scale-[0.98] shadow-sm cursor-pointer'
                        )}
                      >
                        {isCurrent ? 'Current Plan' : tier.ctaLabel}
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer Guarantee */}
              <p className="text-center text-[11px] font-medium text-muted-foreground/70 mt-6">
                Upgrade anytime • Cancel anytime • Plans are billed per user account
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UpgradePricingSheet;
