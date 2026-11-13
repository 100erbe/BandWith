import React from 'react';
import { ArrowUpRight } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw';
import { Tag } from '@/app/components/bw/Screen';
import { money } from '@/lib/currency';
import { useT, intlLocale } from '@/lib/i18n';
import { parseLocalDate } from '@/lib/dates';
import type { GigPayouts } from '@/lib/payoutsDue';

/** Most gigs shown on Home; the rest are counted. */
const MAX_GIGS = 3;

/**
 * Home action center (Figma "Phone · Next"): payouts still due for gigs that
 * are over. Admins see who is owed and the total, and "Review payouts" opens
 * the gig's Fee & payouts sheet. Members see only what they are owed.
 */
export const PayoutsDueCard: React.FC<{
  gigs: GigPayouts[];
  isAdmin: boolean;
  /** user id → { name, initials } from the band roster. */
  people: Record<string, { name: string; initials: string }>;
  onReview?: (eventId: string) => void;
}> = ({ gigs, isAdmin, people, onReview }) => {
  const t = useT();
  const shown = gigs.slice(0, MAX_GIGS);
  const dayOf = (date: string) => {
    const d = parseLocalDate(date);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(intlLocale('en-US'), { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex flex-col gap-3">
      {shown.map((gig) => {
        const count = gig.payouts.length;
        return (
          <section
            key={gig.eventId}
            className="rounded-[24px] p-4 flex flex-col gap-3 bg-card text-card-foreground min-w-0"
            aria-label={isAdmin ? t('Payouts due · {title}', { title: gig.title }) : t('Your payout · {title}', { title: gig.title })}
          >
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="bw-label-sm text-muted-foreground line-clamp-2 break-words">
                  {gig.title}
                  {dayOf(gig.date) && (
                    <>
                      {gig.title ? ' · ' : ''}
                      <span className="whitespace-nowrap">{dayOf(gig.date)}</span>
                    </>
                  )}
                </span>
                <span className="bw-h3 truncate">
                  {isAdmin ? t('Payouts due') : t("You're owed {amount}", { amount: money(gig.total, 'auto') })}
                </span>
              </div>
              {isAdmin ? (
                <span className="bw-num shrink-0 whitespace-nowrap">{money(gig.total, 'auto')}</span>
              ) : (
                <Tag variant="accent">{t('Not paid yet')}</Tag>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex -space-x-2 shrink-0" aria-hidden>
                  {gig.payouts.slice(0, 5).map((p) => (
                    <span
                      key={p.userId}
                      className="w-8 h-8 rounded-full bg-surface-inverse text-surface-inverse-foreground border-2 border-card flex items-center justify-center bw-label-xs"
                    >
                      {people[p.userId]?.initials ?? '?'}
                    </span>
                  ))}
                </span>
                <span className="bw-body-sm text-muted-foreground min-w-0">
                  {count === 1
                    ? t('{name} · paid after the show', { name: people[gig.payouts[0].userId]?.name ?? t('1 musician') })
                    : t('{count} musicians · paid after the show', { count })}
                </span>
              </div>
            )}
            {onReview && (
              <PillButton
                size="sm"
                variant={isAdmin ? 'dark' : 'outline'}
                fullWidth={false}
                className="self-start"
                trailingIcon={<ArrowUpRight className="w-4 h-4" />}
                onClick={() => onReview(gig.eventId)}
              >
                {isAdmin ? t('Review payouts') : t('View payout')}
              </PillButton>
            )}
          </section>
        );
      })}
      {gigs.length > MAX_GIGS && (
        <span className="bw-label-sm text-muted-foreground">
          {t('And {count} more gigs with payouts due', { count: gigs.length - MAX_GIGS })}
        </span>
      )}
    </div>
  );
};
