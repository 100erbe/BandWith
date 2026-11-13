import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { eventKindOf, PillButton, Tag } from '@/app/components/bw';
import { MapsLink } from '@/app/components/ui/MapsLink';
import { LineupPersonRow } from '@/app/components/event/LineupSoFar';
import { useT, intlLocale } from '@/lib/i18n';
import type { ChatEventContext } from '@/lib/chatEventContext';
import type { LineupSummary } from '@/lib/lineupSoFar';

/**
 * The event beside its chat thread (Figma "Duo · Next / Chat – event context",
 * "iPad · 07 / Chat / Inbox & thread · Landscape"): when and where, the
 * times, and who is in the chat with their answer. Logistics only: no fee,
 * no client. Rendered as a pane by ChatDetailModal on the open Duo (trailing
 * page) and on a landscape tablet (third column).
 */
export const ChatEventContextPane: React.FC<{
  context: ChatEventContext;
  lineup: LineupSummary | null;
  /** People in the chat who are online now (viewer included). */
  onlineCount: number | null;
  onOpen?: () => void;
  /**
   * `duo`: the trailing page of the open Duo. The pinned strip on the left
   * already opens the gig, so no button here, and three times in a row
   * (load in, soundcheck, show). `tablet`: a column of its own, with Open gig
   * and the end time too.
   */
  variant?: 'duo' | 'tablet';
}> = ({ context, lineup, onlineCount, onOpen, variant = 'duo' }) => {
  const t = useT();
  const kind = eventKindOf({ eventType: context.eventType });
  const d = context.details;
  const kindLabel = { gig: t('Gig'), rehearsal: t('Rehearsal'), quote: t('Quote'), personal: t('Personal'), past: t('Past event') }[kind] ?? t('Gig');
  const statusLabel = context.cancelled ? t('Cancelled') : d.status === 'confirmed' ? t('Confirmed') : d.status === 'tentative' ? t('Tentative') : null;
  const dayLabel = context.day
    ? new Date(`${context.day}T12:00:00`).toLocaleDateString(intlLocale('en-GB'), { weekday: 'short', day: 'numeric', month: 'short' })
    : null;
  const whenLine = [dayLabel, d.start].filter(Boolean).join(' · ');
  const times = [
    d.loadIn && { k: t('Load in'), v: d.loadIn },
    d.soundcheck && { k: t('Soundcheck'), v: d.soundcheck },
    d.start && { k: t('Show'), v: d.start },
    variant === 'tablet' && d.end && { k: t('Out'), v: d.end },
  ].filter(Boolean) as { k: string; v: string }[];
  const inCount = lineup?.counts.in ?? 0;

  return (
    <div className="flex flex-col min-h-full">
      {/* Hero in the event colour */}
      <section
        className="px-4 pt-4 pb-10 flex flex-col gap-3"
        style={{ backgroundColor: `var(--accent-${kind})`, color: `var(--accent-${kind}-fg)` }}
        aria-label={[kindLabel, context.title, whenLine, context.place].filter(Boolean).join(', ')}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag variant="solid">{kindLabel}</Tag>
          {statusLabel && <Tag variant="solid">{statusLabel}</Tag>}
        </div>
        <h2 className={cn('bw-display-lg [overflow-wrap:anywhere]', context.cancelled && 'line-through')}>{context.title || t('Event')}</h2>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1 min-w-0">
            {d.venue && (
              <MapsLink query={[d.venue, d.address].filter(Boolean).join(', ')} className="bw-label-md uppercase">
                {d.venue}
              </MapsLink>
            )}
            {d.address && <span className="bw-label-xs uppercase opacity-80 [overflow-wrap:anywhere]">{d.address}</span>}
          </div>
          {whenLine && (
            <span className="bw-label-xs uppercase px-2 py-1 rounded-[8px] bg-black/[0.08] whitespace-nowrap">{whenLine}</span>
          )}
        </div>
        {onOpen && variant === 'tablet' && (
          <PillButton
            variant="dark"
            size="md"
            className="mt-1"
            trailingIcon={<ArrowUpRight className="w-4 h-4" />}
            onClick={onOpen}
          >
            {t('Open gig')}
          </PillButton>
        )}
      </section>

      {/* Times and lineup on a raised sheet over the hero */}
      <div className="-mt-6 flex-1 rounded-t-[28px] bg-background px-4 pt-4 pb-6 flex flex-col gap-3">
        {times.length > 0 && (
          <div className={cn('grid gap-2', times.length >= 4 ? 'grid-cols-2' : times.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
            {times.map((x, i) => (
              <motion.div
                key={x.k}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.04 }}
                className="flex flex-col gap-1 px-3 py-3 rounded-[20px] bg-card text-card-foreground min-w-0"
              >
                <span className="bw-label-xs text-muted-foreground uppercase truncate">{x.k}</span>
                <span className="bw-num tabular-nums">{x.v}</span>
              </motion.div>
            ))}
          </div>
        )}

        {lineup && lineup.people.length > 0 && (
          <section
            className="flex flex-col px-4 pt-3 pb-1 rounded-[24px] bg-card text-card-foreground"
            aria-label={t('In this chat · Lineup {count}/{total}', { count: inCount, total: lineup.total })}
          >
            <div className="flex items-center justify-between gap-3 pb-1">
              <span className="bw-label-xs uppercase text-muted-foreground">
                {t('In this chat · Lineup {count}/{total}', { count: inCount, total: lineup.total })}
              </span>
              {onlineCount !== null && onlineCount > 0 && (
                <span className="bw-label-xs uppercase text-muted-foreground shrink-0">{t('{count} online', { count: onlineCount })}</span>
              )}
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {lineup.people.map((p) => (
                <LineupPersonRow key={p.userId} person={p} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};
