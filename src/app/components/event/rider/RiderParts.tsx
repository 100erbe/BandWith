import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, ScrollText } from '@/app/components/icons';
import { Tag } from '@/app/components/bw/Screen';
import { cn } from '@/app/components/ui/utils';
import { intlLocale, useT } from '@/lib/i18n';
import { channelLabel, playersOf, type InputChannel, type StageData, type StagePlot } from '@/lib/stagePlot';
import type { EventRider } from '@/lib/services/eventStage';
import { StagePlotView } from './StagePlotView';

type T = ReturnType<typeof useT>;

/** "2 Dec" in the app language. */
export const shortDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(intlLocale('en-GB'), { day: 'numeric', month: 'short' }) : '';

/** "Sent 1 Dec · seen by the venue 2 Dec", "Not sent yet". */
export function riderStatusLine(rider: EventRider | null, t: T): string {
  if (!rider) return t('No rider linked to this gig yet');
  if (rider.viewedAt && rider.sentAt) {
    return t('Sent {sent} · seen by the venue {seen}', { sent: shortDate(rider.sentAt), seen: shortDate(rider.viewedAt) });
  }
  if (rider.viewedAt) return t('Seen by the venue {seen}', { seen: shortDate(rider.viewedAt) });
  if (rider.sentAt) return t('Sent {sent} · not seen yet', { sent: shortDate(rider.sentAt) });
  return t('Not sent yet');
}

/** Section heading inside a card: "STAGE PLOT", right-hand meta. */
export const CardHead: React.FC<{ title: string; meta?: React.ReactNode; className?: string }> = ({ title, meta, className }) => (
  <div className={cn('flex items-center justify-between gap-3 min-w-0', className)}>
    <h3 className="bw-h2 min-w-0 truncate">{title}</h3>
    {meta != null && meta !== '' && <span className="bw-label-xs text-muted-foreground shrink-0">{meta}</span>}
  </div>
);

/** "Full band" / "Trio" chips. */
export const PlotTabs: React.FC<{ plots: StagePlot[]; active: string | undefined; onPick: (id: string) => void }> = ({
  plots,
  active,
  onPick,
}) => {
  const t = useT();
  if (plots.length < 2) return null;
  return (
    <div role="tablist" aria-label={t('Stage layouts')} className="flex flex-wrap gap-1.5">
      {plots.map((p) => {
        const on = p.id === active;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(p.id)}
            className={cn(
              'h-8 px-3.5 rounded-full bw-label-sm uppercase cursor-pointer transition-colors',
              on ? 'bg-foreground text-background' : 'border border-foreground/30 text-foreground',
            )}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
};

/** Input list (CH · SOURCE · MIC / DI · WHO). Shows `limit` rows with "Show all". */
export const InputListTable: React.FC<{ inputs: InputChannel[]; limit?: number; compact?: boolean }> = ({
  inputs,
  limit,
  compact = false,
}) => {
  const t = useT();
  const [all, setAll] = useState(false);
  const rows = !all && limit && inputs.length > limit + 1 ? inputs.slice(0, limit) : inputs;
  if (inputs.length === 0) {
    return <p className="bw-body-sm text-muted-foreground py-2">{t('No channels yet.')}</p>;
  }
  return (
    <div className="flex flex-col">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bw-label-xs text-muted-foreground text-left">
            <th scope="col" className="font-normal py-2 pr-2 w-9">{t('CH')}</th>
            <th scope="col" className="font-normal py-2 pr-2">{t('SOURCE')}</th>
            <th scope="col" className={cn('font-normal py-2 pr-2', compact && 'text-right')}>{t('MIC / DI')}</th>
            {!compact && <th scope="col" className="font-normal py-2 text-right">{t('WHO')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.id} className="border-t border-border">
              <td className="bw-label-sm text-muted-foreground py-2.5 pr-2 tabular-nums">{channelLabel(i)}</td>
              <td className="bw-body-md font-medium py-2.5 pr-2 [overflow-wrap:anywhere]">{c.source}</td>
              <td className={cn('py-2.5 pr-2', compact && 'text-right')}>
                {compact ? (
                  <span
                    className={cn(
                      'inline-flex h-5 px-1.5 items-center rounded-[4px] bw-label-xs',
                      c.kind === 'di' ? 'bg-foreground text-background' : 'bg-background',
                    )}
                  >
                    {c.mic.toUpperCase()}
                  </span>
                ) : (
                  <span className="bw-label-xs">{c.mic.toUpperCase()}</span>
                )}
              </td>
              {!compact && <td className="bw-body-sm text-muted-foreground py-2.5 text-right [overflow-wrap:anywhere]">{c.who}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length < inputs.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-3 h-12 w-full rounded-full border-[1.5px] border-foreground bw-button-sm inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[var(--press-scale)]"
        >
          {t('SHOW ALL {count} CHANNELS', { count: inputs.length })}
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

/** Band brings (dark card, lime ticks) | Venue provides (light card). */
export const WhoBringsWhat: React.FC<{ stage: StageData; className?: string }> = ({ stage, className }) => {
  const t = useT();
  const list = (items: string[], tick: string) =>
    items.length > 0 ? (
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 bw-body-md">
            <Check className={cn('w-4 h-4 mt-[3px] shrink-0', tick)} aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{it}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="bw-body-sm opacity-60">{t('Nothing listed yet')}</p>
    );
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <div className="rounded-[20px] bg-black text-white p-4 flex flex-col gap-3 min-w-0">
        <span className="bw-label-xs text-white/70">{t('BAND BRINGS')}</span>
        {list(stage.bandBrings, 'text-accent')}
      </div>
      <div className="rounded-[20px] bg-white text-black p-4 flex flex-col gap-3 min-w-0">
        <span className="bw-label-xs text-black/60">{t('VENUE PROVIDES')}</span>
        {list(stage.venueProvides, 'text-black')}
      </div>
    </div>
  );
};

export const VenueAgreedTag: React.FC<{ agreed: boolean }> = ({ agreed }) => {
  const t = useT();
  return agreed ? (
    <Tag className="bg-success/15 text-success h-5 px-2">{t('VENUE AGREED')}</Tag>
  ) : (
    <Tag variant="subtle" className="h-5 px-2">{t('TO AGREE')}</Tag>
  );
};

/** Dark rider card on the Rider & stage screen: version, sent, seen. */
export const RiderStatusCard: React.FC<{
  rider: EventRider | null;
  eventTitle: string;
  action?: React.ReactNode;
}> = ({ rider, eventTitle, action }) => {
  const t = useT();
  const tile = (label: string, value: string) => (
    <div className="rounded-[12px] bg-white/[0.08] px-3 py-2.5 flex flex-col gap-1 min-w-0">
      <span className="bw-label-xs text-white/60">{label}</span>
      <span className="bw-label-md truncate">{value || '—'}</span>
    </div>
  );
  return (
    <section className="rounded-[24px] bg-black text-white p-5 flex flex-col gap-4" aria-label={t('Technical rider')}>
      <div className="flex items-center justify-between gap-3">
        <span className="bw-label-sm min-w-0 truncate">
          {rider ? t('TECHNICAL RIDER · V{version}', { version: rider.version }) : t('TECHNICAL RIDER')}
        </span>
        {rider?.viewedAt ? (
          <Tag variant="accent" className="h-5 px-2">{t('SEEN')}</Tag>
        ) : rider?.sentAt ? (
          <Tag className="bg-white/15 text-white h-5 px-2">{t('SENT')}</Tag>
        ) : null}
      </div>
      {rider ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {tile(t('VERSION'), `v${rider.version}`)}
            {tile(t('SENT'), shortDate(rider.sentAt))}
            {tile(t('SEEN'), shortDate(rider.viewedAt))}
          </div>
          <p className="bw-body-sm text-white/70">{t('Linked to {event}.', { event: eventTitle })}</p>
        </>
      ) : (
        <p className="bw-body-sm text-white/70">{t('No rider linked to this gig yet')}</p>
      )}
      {action}
    </section>
  );
};

/**
 * "Rider & stage" card on the gig screen (Figma "Phone · Next"): rider
 * version and sent / seen, then the plot and inputs at a glance. On the
 * iPhone Duo a small plot thumbnail replaces the tiles (Figma "Duo · Next").
 */
export const RiderStageCard: React.FC<{
  rider: EventRider | null;
  stage: StageData | null;
  thumb?: boolean;
  onOpen: () => void;
}> = ({ rider, stage, thumb = false, onOpen }) => {
  const t = useT();
  const plot = stage?.plots[0];
  const inputs = stage?.inputs.length ?? 0;
  const title = rider ? t('TECHNICAL RIDER · V{version}', { version: rider.version }) : t('RIDER & STAGE');
  if (thumb) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full bg-card rounded-[20px] p-4 flex items-center gap-4 text-left cursor-pointer active:scale-[0.99] transition-transform"
      >
        <span className="w-[84px] shrink-0">
          {plot ? (
            <StagePlotView plot={plot} size="xs" caption={false} />
          ) : (
            <span className="block aspect-[1.6] rounded-[10px] border-[1.5px] border-dashed border-foreground/25" />
          )}
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="bw-label-xs text-muted-foreground">{t('RIDER & STAGE')}</span>
          <span className="bw-h3 truncate">
            {[rider ? t('Rider v{version}', { version: rider.version }) : null, inputs ? t('{count} inputs', { count: inputs }) : null]
              .filter(Boolean)
              .join(' · ') || t('Set up the stage')}
          </span>
          <span className="bw-label-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {rider?.viewedAt && (
              <span className="inline-flex items-center gap-1 text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
                {t('SEEN {date}', { date: shortDate(rider.viewedAt).toUpperCase() })}
              </span>
            )}
            {rider?.sentAt && <span>{t('SENT {date}', { date: shortDate(rider.sentAt).toUpperCase() })}</span>}
            {!rider && <span>{t('No rider linked to this gig yet')}</span>}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 shrink-0" />
      </button>
    );
  }
  const tile = (label: string, value: string) => (
    <span className="rounded-[12px] bg-background px-3 py-2.5 flex flex-col gap-1 min-w-0">
      <span className="bw-label-xs text-muted-foreground truncate">{label}</span>
      <span className="bw-label-md truncate normal-case">{value}</span>
    </span>
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full bg-card rounded-[20px] p-4 flex flex-col gap-4 text-left cursor-pointer active:scale-[0.99] transition-transform"
    >
      <span className="flex items-center gap-3 w-full min-w-0">
        <span className="w-12 h-12 rounded-[12px] bg-black text-[var(--accent)] flex items-center justify-center shrink-0" aria-hidden>
          <ScrollText className="w-6 h-6" />
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="bw-label-sm truncate">{title}</span>
          <span className="bw-body-sm text-muted-foreground line-clamp-2">{riderStatusLine(rider, t)}</span>
        </span>
        <span className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center shrink-0" aria-hidden>
          <ChevronRight className="w-5 h-5" />
        </span>
      </span>
      <span className="grid grid-cols-3 gap-2 w-full">
        {tile(t('STAGE PLOT'), plot ? plot.name : '—')}
        {tile(t('INPUTS'), inputs ? t('{count} ch', { count: inputs }) : '—')}
        {tile(t('PLAYERS'), plot ? String(playersOf(plot).length) : '—')}
      </span>
    </button>
  );
};
