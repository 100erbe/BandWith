/**
 * The gig's gear kit (Figma "Event detail / Gig – Rider & stage": "GEAR KIT ·
 * FROM INVENTORY", the kit chip, how many items need a look, each item's
 * status). Self-contained: loads its own data (migration 094), so the event
 * detail only places it. Admins pick or change the kit here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Check, Loader2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { BwSheet, FormError, PillButton } from '@/app/components/bw';
import { SectionTitle } from './parts';
import { KitItemRow, KitReadyMeter, kitCountsLine } from '@/app/components/gear/KitParts';
import { summarizeKit, type KitSummary } from '@/lib/gearKits';
import { loadGigKits, removeKitFromGig, useKitForGig, type GigKits } from '@/lib/services/gearKits';
import { useT } from '@/lib/i18n';

const SHOWN = 6;

export const GigKitSection: React.FC<{ eventId: string; bandId: string; canEdit: boolean }> = ({ eventId, bandId, canEdit }) => {
  const t = useT();
  const [data, setData] = useState<GigKits | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const { data: next, error } = await loadGigKits(eventId, bandId);
    if (error) setLoadError(error.message);
    else {
      setLoadError(null);
      setData(next);
    }
  }, [eventId, bandId]);

  useEffect(() => {
    load();
  }, [load]);

  const inventoryById = useMemo(() => new Map((data?.inventory ?? []).map((i) => [i.id, i])), [data]);
  const summaries = useMemo(() => {
    const m = new Map<string, KitSummary>();
    for (const k of data?.kits ?? []) m.set(k.id, summarizeKit(k.id, data!.links, inventoryById));
    return m;
  }, [data, inventoryById]);
  const linkedIds = useMemo(() => new Set((data?.uses ?? []).map((u) => u.kit_id)), [data]);
  const gigKits = (data?.kits ?? []).filter((k) => linkedIds.has(k.id));

  const toggle = async (kitId: string) => {
    if (busyId) return;
    const linked = linkedIds.has(kitId);
    setBusyId(kitId);
    setPickError(null);
    const { error } = linked ? await removeKitFromGig(kitId, eventId) : await useKitForGig(kitId, eventId);
    setBusyId(null);
    if (error) {
      setPickError(error.message);
      return;
    }
    setData((prev) =>
      prev
        ? { ...prev, uses: linked ? prev.uses.filter((u) => u.kit_id !== kitId) : [...prev.uses, { kit_id: kitId, event_id: eventId }] }
        : prev,
    );
  };

  // Nothing to show: no kit on this gig and no way to add one.
  if (!data && !loadError) return null;
  if (loadError) return null;
  if (gigKits.length === 0 && (!canEdit || (data?.kits.length ?? 0) === 0)) return null;

  return (
    <section className="flex flex-col gap-6" aria-label={t('Gear kit')}>
      <SectionTitle
        title={t('GEAR KIT')}
        actionLabel={canEdit ? (gigKits.length > 0 ? t('CHANGE') : t('PICK A KIT')) : undefined}
        onAction={canEdit ? () => setPicking(true) : undefined}
      />

      {gigKits.length === 0 ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="rounded-[16px] border-[1.5px] border-dashed border-border p-4 flex items-center gap-3 text-left text-muted-foreground hover:text-foreground"
        >
          <Box className="w-5 h-5 shrink-0" />
          <span className="bw-body-sm">{t('Pick a kit from your inventory: its items go with the band on this date.')}</span>
        </button>
      ) : (
        gigKits.map((kit) => {
          const s = summaries.get(kit.id)!;
          const needs = s.total - s.ready;
          const items = expanded ? s.items : s.items.slice(0, SHOWN);
          return (
            <div key={kit.id} className="bg-card rounded-[16px] p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center h-7 px-3 rounded-full bg-foreground text-background bw-label-xs max-w-full truncate">{kit.name}</span>
                <span className={cn('bw-label-xs', needs > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {needs === 0 ? t('All ready') : needs === 1 ? t('1 needs a look') : t('{count} need a look', { count: needs })}
                </span>
                <span className="flex-1" />
                <span className="bw-label-xs text-muted-foreground">{kitCountsLine(s)}</span>
              </div>
              <KitReadyMeter items={s.items} ready={s.ready} total={s.total} />
              {s.items.length > 0 && (
                <ul className="flex flex-col divide-y divide-border">
                  {items.map((item) => (
                    <KitItemRow key={item.id} item={item} compact />
                  ))}
                </ul>
              )}
              {s.items.length > SHOWN && (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start h-9 bw-button-sm text-muted-foreground hover:text-foreground">
                  {expanded ? t('Show less') : t('+ {count} MORE ITEMS', { count: s.items.length - SHOWN })}
                </button>
              )}
            </div>
          );
        })
      )}

      <BwSheet
        portal
        open={picking}
        onClose={() => setPicking(false)}
        overline={t('Gear kit')}
        title={t('Kit for this gig')}
        zIndex={120}
        footer={<PillButton variant="white" onClick={() => setPicking(false)}>{t('Done')}</PillButton>}
      >
        <div className="flex flex-col gap-4">
          {pickError && <FormError>{pickError}</FormError>}
          <ul className="flex flex-col rounded-[24px] bg-white/[0.06] px-4 divide-y divide-white/10">
            {(data?.kits ?? []).map((kit) => {
              const on = linkedIds.has(kit.id);
              const s = summaries.get(kit.id)!;
              return (
                <li key={kit.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={!!busyId}
                    onClick={() => toggle(kit.id)}
                    className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-60"
                  >
                    <span className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="bw-body-md font-semibold leading-tight truncate">{kit.name}</span>
                      <span className="bw-label-xs opacity-60">{kitCountsLine(s)} · {t('{ready}/{total} ready', { ready: s.ready, total: s.total })}</span>
                    </span>
                    {busyId === kit.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className={cn('h-8 px-3 rounded-full inline-flex items-center gap-1.5 bw-label-xs shrink-0', on ? 'bg-accent text-accent-foreground' : 'border border-white/40')}>
                        {on && <Check className="w-3.5 h-3.5" />}
                        {on ? t('Kit added') : t('Add kit')}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </BwSheet>
    </section>
  );
};

export default GigKitSection;
