import React from 'react';
import { Wallet as CreditCard } from '@/app/components/icons';
import { Tag } from '@/app/components/bw/Screen';
import { cn } from '@/app/components/ui/utils';
import { ONLINE_DEPOSITS_ENABLED } from '@/lib/services/pricing';
import { useT } from '@/lib/i18n';

/**
 * "Collect the deposit online" with Stripe (card) and PayPal. Shown on the
 * quote and its share sheet, but switched off for the whole alpha
 * (ONLINE_DEPOSITS_ENABLED): the buttons are visible and disabled.
 */
export const OnlineDepositLinks: React.FC<{ amount?: string; tone?: 'sheet' | 'card'; className?: string }> = ({
  amount,
  tone = 'card',
  className,
}) => {
  const t = useT();
  const sheet = tone === 'sheet';
  const button = cn(
    'flex-1 min-w-0 h-11 rounded-full px-4 flex items-center justify-center gap-2 bw-button-sm border',
    sheet ? 'border-sheet-foreground/25 text-sheet-foreground' : 'border-border text-foreground',
    !ONLINE_DEPOSITS_ENABLED && 'opacity-45 cursor-not-allowed',
  );
  return (
    <section
      aria-label={t('Online deposit')}
      className={cn('rounded-[24px] p-4 flex flex-col gap-3', sheet ? 'bg-white/[0.06]' : 'bg-card text-card-foreground', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 bw-label-sm">
          <CreditCard className="w-4 h-4" aria-hidden />
          {t('Collect the deposit online')}{amount ? ` · ${amount}` : ''}
        </span>
        {!ONLINE_DEPOSITS_ENABLED && <Tag variant="subtle">{t('Coming soon')}</Tag>}
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={!ONLINE_DEPOSITS_ENABLED} aria-disabled={!ONLINE_DEPOSITS_ENABLED} className={button}>
          {t('Card · Stripe')}
        </button>
        <button type="button" disabled={!ONLINE_DEPOSITS_ENABLED} aria-disabled={!ONLINE_DEPOSITS_ENABLED} className={button}>
          PayPal
        </button>
      </div>
      {!ONLINE_DEPOSITS_ENABLED && (
        <p className={cn('bw-body-sm', sheet ? 'text-sheet-foreground/70' : 'text-muted-foreground')}>
          {t('Payment links for clients turn on after the alpha. For now, use the bank transfer details.')}
        </p>
      )}
    </section>
  );
};
