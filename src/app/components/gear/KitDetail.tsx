/**
 * Kit detail (Figma "Phone Next / Gear / Kit detail – status & Use for a gig",
 * right page of "Duo Next / Gear – kits"): counts, what needs a look, the
 * next gig with this kit, every item with its status, Edit and Use for a gig.
 * A trailing-pane detail: full screen on phones, the right page on the Duo
 * open, beside the list on tablets.
 */
import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowUpRight, Calendar, Pencil } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotText, PillButton, ScreenHeader } from '@/app/components/bw';
import { attentionItems, type GearKit, type KitSummary } from '@/lib/gearKits';
import { useT } from '@/lib/i18n';
import { KitItemRow, kitGigLine } from './KitParts';

const Stat: React.FC<{ label: string; value: number; inverse?: boolean }> = ({ label, value, inverse }) => (
  <div className={cn('flex-1 min-w-0 flex flex-col gap-2 px-4 py-3 rounded-[20px]', inverse ? 'bg-surface-inverse text-surface-inverse-foreground' : 'bg-card text-card-foreground')}>
    <span className="bw-label-xs truncate">{label}</span>
    <DotText text={value} size={24} label={`${label}: ${value}`} />
  </div>
);

export const KitDetail: React.FC<{
  kit: GearKit;
  summary: KitSummary;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onUseForGig: () => void;
  onOpenGig?: (eventId: string) => void;
}> = ({ kit, summary, canEdit, onBack, onEdit, onUseForGig, onOpenGig }) => {
  const t = useT();
  const attention = attentionItems(summary.items);
  const needsLook = attention.length;
  const next = summary.nextGig;

  const alertTitle =
    summary.repair > 0 && summary.lost === 0
      ? summary.repair === 1
        ? t('1 item in maintenance')
        : t('{count} items in maintenance', { count: summary.repair })
      : needsLook === 1
        ? t('1 item needs a look')
        : t('{count} items need a look', { count: needsLook });
  const names = attention.slice(0, 3).map((i) => i.name).join(', ');
  const alertBody = next ? t('{items} · check it before {gig}.', { items: names, gig: next.title }) : t('{items} · check it before the next gig.', { items: names });

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
      className="bw-pane-detail fixed inset-0 z-[100] bg-background text-foreground flex flex-col"
      role="region"
      aria-label={kit.name}
    >
      <div className="flex-1 overflow-y-auto">
        <ScreenHeader pane onBack={onBack} backLabel={t('Back to kits')} overline={t('Kit · from inventory')} title={kit.name} />

        <div className="flex flex-col gap-4 px-4 pt-4 pb-6 max-w-2xl mx-auto w-full">
          <div className="flex gap-2">
            <Stat label={t('Items')} value={summary.total} inverse />
            <Stat label={t('Cases')} value={summary.cases} />
            <Stat label={t('Ready', { context: 'kit' })} value={summary.ready} />
          </div>

          {needsLook > 0 && (
            <div className="flex gap-3 p-4 rounded-[20px] bg-destructive/15 text-destructive" role="status">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="bw-label-sm">{alertTitle}</span>
                <span className="bw-body-md [overflow-wrap:anywhere]">{alertBody}</span>
              </div>
            </div>
          )}

          {next && (
            <button
              type="button"
              onClick={onOpenGig ? () => onOpenGig(next.id) : undefined}
              disabled={!onOpenGig}
              className="flex items-center gap-3 p-4 rounded-[20px] bg-accent text-accent-foreground text-left active:scale-[var(--press-scale,0.98)] transition-transform"
            >
              <Calendar className="w-5 h-5 shrink-0" />
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="bw-label-xs">{t('Next gig with this kit')}</span>
                <span className="bw-body-md font-semibold leading-tight truncate">{kitGigLine(next)}</span>
              </span>
              {onOpenGig && <ArrowUpRight className="w-5 h-5 shrink-0" />}
            </button>
          )}

          <div className="flex items-end justify-between gap-3 pt-4">
            <h2 className="bw-h1">{t('Items')}</h2>
            <span className="bw-label-sm text-muted-foreground">{summary.total}</span>
          </div>

          {summary.items.length === 0 ? (
            <p className="bw-body-sm text-muted-foreground px-1">{canEdit ? t('No items in this kit yet. Tap Edit to pick them from your inventory.') : t('No items in this kit yet.')}</p>
          ) : (
            <ul className="flex flex-col rounded-[24px] bg-card text-card-foreground px-4 py-1 divide-y divide-border">
              {summary.items.map((item) => (
                <KitItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}

          {kit.notes && <p className="bw-body-sm text-muted-foreground whitespace-pre-line [overflow-wrap:anywhere] px-1">{kit.notes}</p>}
        </div>
      </div>

      {canEdit && (
        <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
          <div className="flex gap-3 max-w-2xl mx-auto w-full">
            <PillButton variant="outline" icon={<Pencil className="w-4 h-4" />} onClick={onEdit} className="flex-1">
              {t('Edit')}
            </PillButton>
            <PillButton icon={<Calendar className="w-4 h-4" />} onClick={onUseForGig} className="flex-1">
              {t('Use for a gig')}
            </PillButton>
          </div>
        </div>
      )}
    </motion.div>
  );
};
