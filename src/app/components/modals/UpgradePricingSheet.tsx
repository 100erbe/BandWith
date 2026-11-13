import React from 'react';
import { IS_BETA } from '@/lib/beta';
import { cn } from '@/app/components/ui/utils';
import { BwSheet, Tag } from '@/app/components/bw/Screen';
import { t, useT } from '@/lib/i18n';

interface UpgradePricingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string | null;
  /** Opened because the user already manages as many bands as their plan allows. */
  limitReached?: boolean;
}

interface PricingTier {
  id: string;
  name: string;
  price: string;
  badgeLabel?: string;
  isPopular?: boolean;
  /** One-line summary (Figma: Plans / Upgrade sheet). */
  summary: string;
}

/** Plan names are product names and stay English; the rest follows the language. */
const tiers = (): PricingTier[] => [
  {
    id: 'single_band',
    name: 'Indie Act',
    price: t('{price}/mo', { price: '€0' }),
    summary: IS_BETA
      ? t('Every feature unlocked during the beta')
      : t('1 band admin · unlimited gigs & quotes'),
  },
  {
    id: 'multi_band',
    name: 'Multi-Band Maestro',
    price: t('{price}/mo', { price: '€12' }),
    isPopular: true,
    badgeLabel: t('Most popular'),
    summary: t('Up to 5 bands · shared calendar · co-admins'),
  },
  {
    id: 'unlimited',
    name: 'Talent Agency OS',
    price: t('{price}/mo', { price: '€29' }),
    badgeLabel: t('Agency scale'),
    summary: t('Unlimited bands · roster pool · branded PDFs'),
  },
];

export const UpgradePricingSheet: React.FC<UpgradePricingSheetProps> = ({
  isOpen,
  onClose,
  currentTier = 'single_band',
  limitReached = false,
}) => {
  const tr = useT();
  // Everyone without a paid plan is on the free Indie Act plan.
  const activeTierId =
    !currentTier || currentTier === 'free_member' ? 'single_band' : currentTier;

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      zIndex={121}
      overline={limitReached && !IS_BETA ? tr('Free plan limit') : tr('Plans')}
      title={<span id="upgrade-sheet-title">{limitReached && !IS_BETA ? tr('One band on free') : tr('BandWith plans')}</span>}
    >
      <div className="max-w-xl mx-auto flex flex-col gap-4 pb-4">
        <p className="bw-body-md text-sheet-foreground/85">
          {IS_BETA
            ? tr('BandWith is in beta: the free plan has every feature, as your role allows. Paid plans are on the way.')
            : tr('The free plan includes one band you admin. Multi-band plans are on the way.')}
          {limitReached && !IS_BETA && ' ' + tr('You can still join any number of bands as a member.')}
        </p>

        <ul className="flex flex-col gap-3">
          {tiers().map((tier) => {
            const isCurrent = activeTierId === tier.id;
            const lime = tier.isPopular && !isCurrent;
            const tag = isCurrent ? tr('Current plan') : tier.badgeLabel;
            return (
              <li
                key={tier.id}
                className={cn(
                  'p-4 rounded-[16px] flex flex-col gap-3',
                  lime ? 'bg-accent text-accent-foreground' : 'bg-sheet-foreground/[0.08]',
                )}
              >
                <div className="flex items-baseline gap-3">
                  <h3 className="flex-1 min-w-0 bw-h3">{tier.name}</h3>
                  <span className="bw-h3 shrink-0">{tier.price}</span>
                </div>
                <div className="flex items-start gap-2">
                  {tag && (
                    <Tag
                      variant="subtle"
                      className={cn('mt-0.5', lime ? 'bg-white text-black' : 'bg-sheet-foreground/[0.12] text-sheet-foreground')}
                    >
                      {tag}
                    </Tag>
                  )}
                  <p className={cn('flex-1 min-w-0 bw-body-sm', !lime && 'text-sheet-foreground/85')}>{tier.summary}</p>
                </div>
                {/* Paid plans aren't on sale yet: say so instead of a button that does nothing. */}
                <div
                  className={cn(
                    'h-9 rounded-full flex items-center justify-center bw-button-sm',
                    lime ? 'bg-white text-black' : 'border-[1.5px] border-sheet-foreground/50 text-sheet-foreground/70',
                  )}
                >
                  {isCurrent ? tr('Your plan') : tr('Coming soon')}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="bw-body-sm text-sheet-foreground/70">
          {tr('Paid plans aren’t available yet. We’ll let you know when they launch.')}
        </p>
      </div>
    </BwSheet>
  );
};

export default UpgradePricingSheet;
