import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { useT } from '@/lib/i18n';
import type { LineupPerson, LineupStatus, LineupSummary } from '@/lib/lineupSoFar';

const DOT: Record<LineupStatus, string> = {
  in: 'bg-success',
  maybe: 'bg-warning',
  pending: 'bg-warning',
  out: 'bg-destructive',
};

/** Status dot + label ("● IN", "● PENDING"). */
export const LineupStatusTag: React.FC<{ status: LineupStatus; className?: string }> = ({ status, className }) => {
  const t = useT();
  const label = { in: t('In', { context: 'rsvp' }), maybe: t('Maybe'), pending: t('Pending'), out: t('Declined') }[status];
  return (
    <span className={cn('flex items-center gap-1.5 shrink-0 bw-label-xs uppercase', className)}>
      <span aria-hidden className={cn('w-2 h-2 rounded-full', DOT[status])} />
      {label}
    </span>
  );
};

/** One person: initials, "Name · Instrument", status. */
export const LineupPersonRow: React.FC<{ person: LineupPerson; tone?: 'card' | 'sheet' }> = ({ person, tone = 'card' }) => (
  <li className="flex items-center gap-3 py-2.5 min-w-0">
    <span
      aria-hidden
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center bw-label-xs shrink-0',
        tone === 'sheet' ? 'bg-sheet-foreground text-sheet' : 'bg-background text-foreground',
      )}
    >
      {person.initials}
    </span>
    <span className="flex-1 min-w-0 truncate bw-body-md">
      <span className="font-semibold">{person.name}</span>
      {person.instrument && (
        <span className={tone === 'sheet' ? 'text-sheet-foreground/70' : 'text-muted-foreground'}> · {person.instrument}</span>
      )}
    </span>
    <LineupStatusTag status={person.status} />
  </li>
);

/**
 * Figma "Phone · Next / Notifications / Gig invitation – lineup so far":
 * who else is on the gig and whether they answered. No fees, ever.
 */
export const LineupSoFar: React.FC<{
  lineup: LineupSummary;
  /** `sheet`: on the dark RSVP sheet. */
  tone?: 'card' | 'sheet';
}> = ({ lineup, tone = 'card' }) => {
  const t = useT();
  if (lineup.others.length === 0) return null;
  const { counts } = lineup;
  // The strip sums up the others (the rows below); the heading counts everyone.
  const others: Record<string, number> = { in: 0, maybe: 0, pending: 0, out: 0 };
  for (const p of lineup.others) others[p.status] += 1;
  const summary = [
    others.in > 0 && t('{count} in', { count: others.in }),
    others.maybe > 0 && t('{count} maybe', { count: others.maybe }),
    others.pending > 0 && t('{count} pending', { count: others.pending }),
    others.out > 0 && t('{count} out', { count: others.out }),
  ]
    .filter(Boolean)
    .join(' · ');
  const heading = t('Lineup so far · {count} of {total} in', { count: counts.in, total: lineup.total });
  const muted = tone === 'sheet' ? 'text-sheet-foreground/70' : 'text-muted-foreground';

  return (
    <section className="flex flex-col gap-3 min-w-0" aria-label={heading}>
      <h3 className={cn('bw-label-sm', muted)}>{heading}</h3>
      <div
        className={cn(
          'flex flex-col px-4 pt-3 pb-1 rounded-[24px] min-w-0',
          tone === 'sheet' ? 'bg-sheet-foreground/[0.08]' : 'bg-card text-card-foreground',
        )}
      >
        <div className="flex items-center justify-between gap-3 pb-2 min-w-0">
          <span className="flex -space-x-2 shrink-0" aria-hidden>
            {lineup.others.slice(0, 5).map((p) => (
              <span
                key={p.userId}
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center bw-label-xs',
                  tone === 'sheet' ? 'bg-sheet-foreground text-sheet border-sheet' : 'bg-background text-foreground border-card',
                )}
              >
                {p.initials}
              </span>
            ))}
          </span>
          <span className={cn('bw-label-xs uppercase text-right min-w-0', muted)}>{summary}</span>
        </div>
        <ul className={cn('flex flex-col divide-y', tone === 'sheet' ? 'divide-sheet-foreground/10' : 'divide-border')}>
          {lineup.others.map((p) => (
            <LineupPersonRow key={p.userId} person={p} tone={tone} />
          ))}
        </ul>
      </div>
    </section>
  );
};
