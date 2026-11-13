import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { Tag } from '@/app/components/bw/Screen';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { useT } from '@/lib/i18n';
import type { Readiness, ReadinessItem, ReadinessKey } from '@/lib/readiness';
import { SectionTitle } from './parts';

type T = ReturnType<typeof useT>;

/** One line per readiness item, worded for what is done or still open. */
export function readinessItemLabel(item: ReadinessItem, t: T): string {
  const c = item.count;
  switch (item.key) {
    case 'time':
      return item.done ? t('Start time set') : t('No start time yet');
    case 'venue':
      return item.done ? t('Venue set') : t('No venue yet');
    case 'lineup':
      return c && c.total > 0
        ? t('Lineup · {done} of {total} confirmed', { done: c.done, total: c.total })
        : t('No musicians on the lineup yet');
    case 'setlist':
      return c && c.total > 0 ? t('Setlist · {count} songs', { count: c.total }) : t('No setlist yet');
    case 'tasks':
      return t('To-dos · {done} of {total} done', { done: c?.done ?? 0, total: c?.total ?? 0 });
    case 'deposit':
      return item.done ? t('Deposit paid') : t('Deposit not paid yet');
  }
}

/**
 * "Show readiness" on the gig screen (Figma "iPad · 03"): every check with its
 * state. Rows with an action (lineup, setlist) open their sheet.
 */
export const ReadinessSection: React.FC<{
  readiness: Readiness;
  onOpen?: Partial<Record<ReadinessKey, () => void>>;
}> = ({ readiness, onOpen }) => {
  const t = useT();
  return (
    <section className="flex flex-col gap-6" aria-label={t('Show readiness')}>
      <SectionTitle title={t('SHOW READINESS · {done}/{total}', { done: readiness.done, total: readiness.total })} />
      <ul className="bg-card rounded-[16px] px-4 py-1 flex flex-col">
        {readiness.items.map((item, i) => {
          const open = onOpen?.[item.key];
          const content = (
            <>
              <DotCheckbox checked={item.done} activeColor="var(--fg)" inactiveColor="var(--border)" />
              <span className={cn('flex-1 min-w-0 bw-body-md [overflow-wrap:anywhere]', item.done && 'text-muted-foreground')}>
                {readinessItemLabel(item, t)}
              </span>
              {!item.done && <Tag variant="accent">{t('To do')}</Tag>}
            </>
          );
          return (
            <li key={item.key} className={cn(i > 0 && 'border-t border-border')}>
              {open ? (
                <button type="button" onClick={open} className="w-full flex items-center gap-3 py-3 text-left cursor-pointer">
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-3 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
