import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from '@/app/components/icons';
import { DotText, PillButton } from '@/app/components/bw';
import { money } from '@/lib/currency';
import { useT } from '@/lib/i18n';
import { markEventPaid } from '@/lib/services/eventMemberMoney';
import { PAYOUTS_CHANGED, type GigPayouts } from '@/lib/payoutsDue';

export interface PayoutPerson {
  name: string;
  initials: string;
  instrument?: string | null;
}

/**
 * Analytics "Payouts due" (Figma "Phone · Next / Analytics", "Duo · Next /
 * Analytics – revenue by type & payouts"): one dark card per gig that is over
 * and still owes its musicians, with who is owed what and "Mark all as paid".
 *
 * Admins only: the parent renders it for admins, and the fee rows behind
 * `gigs` (usePayoutsDue → bw_event_member_money) are every musician's only
 * for admins anyway.
 */
export const AnalyticsPayoutsCard: React.FC<{
  gigs: GigPayouts[];
  people: Record<string, PayoutPerson>;
  /** "Mark all as paid" in the band's accent (Duo open trailing page). */
  accentButton?: boolean;
}> = ({ gigs, people, accentButton }) => {
  const t = useT();
  const [marking, setMarking] = useState<string | null>(null);
  const [errorFor, setErrorFor] = useState<string | null>(null);

  const markAll = async (eventId: string) => {
    if (marking) return;
    setMarking(eventId);
    setErrorFor(null);
    const { error } = await markEventPaid(eventId);
    setMarking(null);
    if (error) {
      setErrorFor(eventId);
      return;
    }
    // Home and this card reload (usePayoutsDue listens).
    window.dispatchEvent(new Event(PAYOUTS_CHANGED));
  };

  return (
    <div className="flex flex-col gap-3">
      {gigs.map((gig, gi) => {
        const total = money(gig.total, 'auto');
        return (
          <motion.section
            key={gig.eventId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + gi * 0.05 }}
            className="rounded-[24px] p-5 flex flex-col gap-4 bg-surface-inverse text-surface-inverse-foreground min-w-0"
            aria-label={t('Payouts due · {title}', { title: gig.title })}
          >
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-start justify-between gap-3 min-w-0">
                <span className="bw-label-sm line-clamp-2 break-words min-w-0">
                  {t('Payouts due')}
                  {gig.title ? ` · ${gig.title}` : ''}
                </span>
                <span
                  className="shrink-0 min-w-6 h-6 px-2 rounded-full bg-accent text-accent-foreground bw-label-xs flex items-center justify-center"
                  aria-label={t('{count} pending', { count: gig.payouts.length })}
                >
                  {gig.payouts.length}
                </span>
              </div>
              <span className="text-accent">
                <DotText text={total} size={32} label={t('Total due: {amount}', { amount: total })} />
              </span>
            </div>

            <ul className="flex flex-col" aria-label={t('Who is owed')}>
              {gig.payouts.map((p) => {
                const who = people[p.userId];
                return (
                  <li
                    key={p.userId}
                    className="flex items-center gap-3 py-2.5 min-w-0 border-t border-white/10"
                  >
                    <span
                      className="w-8 h-8 rounded-full bg-background text-foreground flex items-center justify-center bw-label-xs shrink-0"
                      aria-hidden
                    >
                      {who?.initials ?? '?'}
                    </span>
                    <span className="bw-body-md flex-1 min-w-0 truncate">
                      {who?.name ?? t('Member')}
                      {who?.instrument ? <span className="opacity-60"> · {who.instrument}</span> : null}
                    </span>
                    <span className="bw-label-md shrink-0 tabular-nums">{money(p.fee, 'auto')}</span>
                  </li>
                );
              })}
            </ul>

            {errorFor === gig.eventId && (
              <p role="alert" className="bw-body-sm text-destructive">
                {t('Could not mark the payouts as paid. Try again.')}
              </p>
            )}
            <PillButton
              variant={accentButton ? 'primary' : 'white'}
              size="md"
              disabled={marking !== null && marking !== gig.eventId}
              loading={marking === gig.eventId}
              icon={<Check className="w-4 h-4" />}
              onClick={() => void markAll(gig.eventId)}
            >
              {t('MARK ALL AS PAID')}
            </PillButton>
          </motion.section>
        );
      })}
    </div>
  );
};
