import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Sparkles, Music, Layers, Infinity } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

interface UpgradePricingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string | null;
}

const TIERS = [
  {
    id: 'single_band',
    name: 'Indie Act Plan',
    tagline: '1 Managed Band',
    price: '$0',
    period: '/mo forever',
    icon: Music,
    accent: '#D4FB46',
    bgGradient: 'from-[#D4FB46] to-[#bff53a]',
    textColor: 'text-black',
    description: 'Basic operations',
    features: [
      'Manage 1 band',
      'Event calendar & RSVPs',
      'Basic setlist management',
      'Band chat & messaging',
      'Standard support',
    ],
    cta: 'Current Plan',
    ctaStyle: 'bg-white/30 text-black border-white/30 cursor-default',
  },
  {
    id: 'multi_band',
    name: 'Multi-Band Maestro',
    tagline: 'Up to 5 Managed Bands',
    price: '$12',
    period: '/mo',
    icon: Layers,
    accent: '#8B5CF6',
    bgGradient: 'from-[#8B5CF6] to-[#7C3AED]',
    textColor: 'text-white',
    description: 'Cross-band availability calendars',
    features: [
      'Manage up to 5 bands',
      'Cross-band availability calendar',
      'Advanced setlists & repertoire',
      'Priority chat & messaging',
      'Shared document & contract templates',
      'Priority support',
    ],
    cta: 'Upgrade',
    ctaStyle: 'bg-white text-[#8B5CF6] hover:scale-[1.02]',
  },
  {
    id: 'unlimited',
    name: 'Talent Agency OS',
    tagline: 'Unlimited Bands',
    price: '$29',
    period: '/mo',
    icon: Infinity,
    accent: '#F59E0B',
    bgGradient: 'from-[#F59E0B] to-[#D97706]',
    textColor: 'text-white',
    description: 'Multi-agent management tools',
    features: [
      'Unlimited bands',
      'Multi-agent management tools',
      'White-label invoicing & quotes',
      'Advanced analytics & reporting',
      'Custom branding & templates',
      'Dedicated account manager',
      'API access & webhooks',
    ],
    cta: 'Upgrade',
    ctaStyle: 'bg-white text-[#F59E0B] hover:scale-[1.02]',
  },
];

export const UpgradePricingSheet: React.FC<UpgradePricingSheetProps> = ({
  isOpen,
  onClose,
  currentTier,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[8px]"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[81] bg-[#E6E5E1] rounded-t-[26px] max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Pill handle */}
            <div className="sticky top-0 z-10 bg-[#E6E5E1] pt-4 pb-2 flex flex-col items-center">
              <div className="w-10 h-1 rounded-full bg-black/20 mb-4" />
              <button
                onClick={onClose}
                className="absolute right-4 top-4 w-9 h-9 rounded-full border border-black/10 flex items-center justify-center text-black/50 hover:text-black hover:bg-black/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pb-6">
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 bg-black/5 rounded-full px-4 py-1.5 mb-4">
                  <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                    Unlock More Power
                  </span>
                </div>
                <h2 className="text-[28px] font-black text-black leading-tight uppercase tracking-tight">
                  Choose Your Plan
                </h2>
                <p className="text-sm font-medium text-black/50 mt-2 max-w-xs mx-auto">
                  Scale your music operations with the right plan for your needs.
                </p>
              </div>

              {/* Tiers */}
              <div className="flex flex-col gap-4">
                {TIERS.map((tier, index) => {
                  const isCurrentPlan = currentTier === tier.id;
                  const Icon = tier.icon;

                  return (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.08 }}
                      className={cn(
                        'relative rounded-[20px] p-5 bg-gradient-to-br overflow-hidden',
                        tier.bgGradient,
                        isCurrentPlan && 'ring-2 ring-black/20'
                      )}
                    >
                      {/* Current Plan Badge */}
                      {isCurrentPlan && (
                        <div className="absolute top-3 right-3 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1">
                          <span className="text-[10px] font-bold uppercase text-black/70">
                            Current
                          </span>
                        </div>
                      )}

                      <div className="flex items-start gap-4 mb-4">
                        <div className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                          tier.textColor === 'text-black' ? 'bg-black/10' : 'bg-white/20'
                        )}>
                          <Icon className={cn(
                            'w-6 h-6',
                            isCurrentPlan ? 'text-black' : tier.textColor
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={cn(
                            'text-[18px] font-black uppercase leading-tight',
                            tier.textColor
                          )}>
                            {tier.name}
                          </h3>
                          <p className={cn(
                            'text-[12px] font-bold mt-0.5',
                            tier.textColor === 'text-black' ? 'text-black/60' : 'text-white/70'
                          )}>
                            {tier.tagline}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            'text-[24px] font-black',
                            tier.textColor
                          )}>
                            {tier.price}
                          </span>
                          <span className={cn(
                            'text-[10px] font-bold ml-0.5',
                            tier.textColor === 'text-black' ? 'text-black/50' : 'text-white/60'
                          )}>
                            {tier.period}
                          </span>
                        </div>
                      </div>

                      <p className={cn(
                        'text-[11px] font-medium mb-4',
                        tier.textColor === 'text-black' ? 'text-black/60' : 'text-white/70'
                      )}>
                        {tier.description}
                      </p>

                      {/* Features */}
                      <div className="space-y-2 mb-5">
                        {tier.features.map((feature, fi) => (
                          <div key={fi} className="flex items-start gap-2.5">
                            <Check className={cn(
                              'w-4 h-4 mt-0.5 shrink-0',
                              tier.textColor === 'text-black' ? 'text-black/70' : 'text-white/80'
                            )} />
                            <span className={cn(
                              'text-[12px] font-medium',
                              tier.textColor === 'text-black' ? 'text-black/70' : 'text-white/80'
                            )}>
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <button
                        disabled={isCurrentPlan}
                        className={cn(
                          'w-full py-3.5 rounded-full font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.97]',
                          tier.ctaStyle,
                          isCurrentPlan && 'opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => {
                          if (!isCurrentPlan) {
                            // Future: open checkout/upgrade flow
                            console.log(`Upgrade to ${tier.id}`);
                          }
                        }}
                      >
                        {isCurrentPlan ? 'Current Plan' : tier.cta}
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer */}
              <p className="text-center text-[10px] font-medium text-black/30 mt-6">
                Upgrade anytime. Cancel anytime. Plans are per account.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UpgradePricingSheet;
