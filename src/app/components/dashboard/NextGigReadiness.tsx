import React from 'react';
import { Play } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw';
import { cn } from '@/app/components/ui/utils';
import { useT } from '@/lib/i18n';
import { useGigReadiness, type ReadinessGig } from '@/app/hooks/useGigReadiness';
import { readinessItemLabel } from '@/app/components/event/ReadinessSection';

/**
 * Under Home's next gig (Figma "Phone · Next"): how ready the show is and a
 * "Go live" button that opens the gig in Stage mode. Same checks as the gig
 * screen's "Show readiness".
 */
export const NextGigReadiness: React.FC<{
  gig: ReadinessGig;
  lineup: { status?: string | null }[] | undefined;
  isAdmin: boolean;
  onOpen: () => void;
  onGoLive?: () => void;
}> = ({ gig, lineup, isAdmin, onOpen, onGoLive }) => {
  const t = useT();
  const readiness = useGigReadiness(gig, lineup, isAdmin);
  const ready = readiness ? readiness.done === readiness.total : false;
  return (
    <div className="flex items-center gap-3 pl-[68px] min-h-9">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 flex flex-col gap-1.5 text-left cursor-pointer"
        aria-label={
          readiness
            ? t('Show readiness: {done} of {total}', { done: readiness.done, total: readiness.total })
            : t('Show readiness')
        }
      >
        <span className="bw-label-sm truncate">
          {readiness ? t('Show readiness · {done}/{total}', { done: readiness.done, total: readiness.total }) : t('Show readiness')}
        </span>
        <span className="flex gap-1" aria-hidden>
          {(readiness?.items ?? []).map((item) => (
            <span
              key={item.key}
              className={cn('h-1 flex-1 rounded-full', item.done ? 'bg-foreground' : 'bg-foreground/15')}
            />
          ))}
        </span>
        {readiness?.next && !ready && (
          <span className="bw-label-xs text-muted-foreground truncate">{readinessItemLabel(readiness.next, t)}</span>
        )}
      </button>
      {onGoLive && (
        <PillButton variant="dark" size="sm" fullWidth={false} icon={<Play className="w-4 h-4" />} onClick={onGoLive}>
          {t('Go live')}
        </PillButton>
      )}
    </div>
  );
};
