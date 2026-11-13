/**
 * Shared pieces of the gear kit screens (Figma "Gear / Inventory – Kits",
 * "Kit detail – status & Use for a gig", "Duo Next / Gear – kits", iPad
 * "Gear & kits"): status dots, the ready meter, the kit card.
 */
import React from 'react';
import { Box, Calendar, ChevronRight } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { canonicalCategory, type InventoryItem } from '@/lib/services/inventory';
import { isItemReady, type KitGig, type KitSummary } from '@/lib/gearKits';
import { intlLocale, t, useT } from '@/lib/i18n';
import { parseLocalDate } from '@/lib/dates';

/** Figma "Status": a dot + Label/XS (same colours as the item list). */
export const GEAR_STATUS_DOT: Record<string, string> = {
  available: 'bg-success',
  in_use: 'bg-warning',
  maintenance: 'bg-destructive',
  lost: 'bg-muted-foreground',
};

export const gearStatusLabel = (status: string): string =>
  ({ available: t('Available'), in_use: t('In use'), maintenance: t('Maintenance'), lost: t('Lost') })[status] ?? status;

export const gearCategoryLabel = (category: string): string => {
  const c = canonicalCategory(category);
  return (
    {
      Instruments: t('Instruments'),
      Cables: t('Cables'),
      Microphones: t('Microphones'),
      Stands: t('Stands'),
      Lighting: t('Lighting'),
      Cases: t('Cases'),
      Other: t('Other'),
    } as Record<string, string>
  )[c] ?? c;
};

export const GearStatus: React.FC<{ status: string; className?: string }> = ({ status, className }) => (
  <span className={cn('flex items-center gap-1.5 shrink-0', className)}>
    <span className={cn('w-2 h-2 rounded-full', GEAR_STATUS_DOT[status] ?? 'bg-muted-foreground')} aria-hidden />
    <span className="bw-label-xs">{gearStatusLabel(status)}</span>
  </span>
);

/** "Sat 12 Dec" in the app language; '' when the date isn't set. */
export const kitGigDate = (date: string, withMonth = true): string => {
  if (!date) return '';
  const d = parseLocalDate(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(intlLocale('en-GB'), withMonth ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' });
};

export const kitGigLine = (gig: KitGig, withMonth = true): string => [gig.title, kitGigDate(gig.date, withMonth)].filter(Boolean).join(' · ');

/** "14 items · 6 cases" */
export const kitCountsLine = (s: Pick<KitSummary, 'total' | 'cases'>): string => {
  const items = s.total === 1 ? t('{count} item', { count: 1 }) : t('{count} items', { count: s.total });
  if (s.cases === 0) return items;
  const cases = s.cases === 1 ? t('{count} case', { count: 1 }) : t('{count} cases', { count: s.cases });
  return `${items} · ${cases}`;
};

/**
 * Ready meter (Figma Duo kit card): one dot per item, ready ones in ink, the
 * ones that need a look in red, then "13/14 READY". Large kits share dots.
 */
export const KitReadyMeter: React.FC<{ items: InventoryItem[]; ready: number; total: number; className?: string; inverse?: boolean }> = ({
  items,
  ready,
  total,
  className,
  inverse,
}) => {
  const t = useT();
  const MAX = 22;
  const dots: boolean[] =
    items.length <= MAX
      ? [...items.filter((i) => isItemReady(i.status)).map(() => true), ...items.filter((i) => !isItemReady(i.status)).map(() => false)]
      : Array.from({ length: MAX }, (_, i) => i < Math.round((ready / Math.max(1, total)) * MAX));
  return (
    <span className={cn('flex items-center gap-2 min-w-0', className)} role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={ready} aria-label={t('{ready} of {total} ready', { ready, total })}>
      {dots.length > 0 && (
        <span className="flex items-center gap-[3px] shrink min-w-0 overflow-hidden" aria-hidden>
          {dots.map((ok, i) => (
            <span key={i} className={cn('w-[6px] h-[6px] rounded-full shrink-0', ok ? (inverse ? 'bg-background' : 'bg-foreground') : 'bg-destructive')} />
          ))}
        </span>
      )}
      <span className={cn('bw-label-xs shrink-0', inverse ? 'opacity-70' : 'text-muted-foreground')}>{t('{ready}/{total} ready', { ready, total })}</span>
    </span>
  );
};

/** Kit icon in a circle (Figma: cube; black with an accent cube when selected). */
export const KitIcon: React.FC<{ selected?: boolean; className?: string }> = ({ selected, className }) => (
  <span
    className={cn(
      'w-11 h-11 rounded-full flex items-center justify-center shrink-0',
      selected ? 'bg-foreground text-accent' : 'bg-background text-foreground',
      className,
    )}
    aria-hidden
  >
    <Box className="w-5 h-5" />
  </span>
);

/** Repair tag on a kit card ("1 REPAIR"). */
export const RepairTag: React.FC<{ count: number }> = ({ count }) => {
  const t = useT();
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-full bg-destructive text-white bw-label-xs shrink-0">
      {t('{count} repair', { count })}
    </span>
  );
};

/** One kit in the Kits list (Figma "Duo Next / Gear – kits"). */
export const KitCard: React.FC<{ name: string; summary: KitSummary; selected?: boolean; onOpen: () => void }> = ({ name, summary, selected, onOpen }) => {
  const t = useT();
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'w-full flex items-center gap-3 p-4 pr-3 rounded-[24px] text-left active:scale-[var(--press-scale,0.98)] transition-[transform,background-color]',
          selected ? 'bg-field text-foreground ring-1 ring-border' : 'bg-card text-card-foreground',
        )}
      >
        <KitIcon selected={selected} />
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
            <span className="bw-label-md min-w-0 [overflow-wrap:anywhere]">{name}</span>
            <RepairTag count={summary.repair} />
          </span>
          <span className="bw-body-sm text-muted-foreground truncate">{kitCountsLine(summary)}</span>
          <span className="flex items-center gap-1.5 bw-body-sm min-w-0">
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">{summary.nextGig ? t('Next: {gig}', { gig: kitGigLine(summary.nextGig, false) }) : t('Not booked')}</span>
          </span>
          <KitReadyMeter items={summary.items} ready={summary.ready} total={summary.total} className="mt-1" />
        </span>
        <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
};

/** iPad "Gear & kits" strip tile: a compact kit card. */
export const KitTile: React.FC<{ name: string; summary: KitSummary; selected?: boolean; onOpen: () => void }> = ({ name, summary, selected, onOpen }) => {
  const t = useT();
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'w-full h-full flex flex-col gap-2 p-4 rounded-[24px] text-left active:scale-[var(--press-scale,0.98)] transition-[transform,background-color]',
          selected ? 'bg-surface-inverse text-surface-inverse-foreground' : 'bg-card text-card-foreground',
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <Box className={cn('w-5 h-5', selected && 'text-accent')} />
          <span className="flex items-center gap-2">
            <RepairTag count={summary.repair} />
            <span className="bw-label-xs opacity-70">{t('Kit')}</span>
          </span>
        </span>
        <span className="bw-body-lg font-bold leading-tight [overflow-wrap:anywhere]">{name}</span>
        <span className="bw-label-xs opacity-70">{kitCountsLine(summary)}</span>
        <span className="flex items-center gap-1.5 bw-body-sm min-w-0">
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="truncate">{summary.nextGig ? kitGigLine(summary.nextGig, false) : t('Not booked')}</span>
        </span>
        <KitReadyMeter items={summary.items} ready={summary.ready} total={summary.total} inverse={selected} />
      </button>
    </li>
  );
};

/** One item row in a kit (detail and gig card). */
export const KitItemRow: React.FC<{ item: InventoryItem; compact?: boolean }> = ({ item, compact }) => {
  const qty = Number(item.quantity) || 0;
  return (
    <li className={cn('flex items-center gap-3 min-w-0', compact ? 'py-2.5' : 'py-3')}>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="bw-body-md font-semibold leading-tight truncate">
          {item.name}
          {qty > 1 && <span className="text-muted-foreground font-normal"> ×{qty}</span>}
        </span>
        <span className="bw-label-xs text-muted-foreground truncate">{[gearCategoryLabel(item.category), item.location].filter(Boolean).join(' · ')}</span>
      </span>
      <GearStatus status={item.status} />
    </li>
  );
};
