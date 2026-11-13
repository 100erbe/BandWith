import React, { useRef, useState } from 'react';
import { Plus, Trash2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { moveItem, newId, stageSize, type PlotItem, type PlotItemKind, type StagePlot } from '@/lib/stagePlot';

/**
 * Stage plot (Figma "iPad · 03 Rider & stage", "Phone · Next"): a dashed
 * stage seen from above, players as circles with their code, wedges, side
 * speakers and DI boxes; the audience is below. Read-only everywhere; on
 * tablets admins can drag items, add and remove them (`editable`).
 */
export const StagePlotView: React.FC<{
  plot: StagePlot;
  /** Smaller circles (Duo thumbnail, gig card). */
  size?: 'md' | 'sm' | 'xs';
  editable?: boolean;
  onChange?: (plot: StagePlot) => void;
  /** Caption under the stage ("AUDIENCE · stage 6 × 4 m"). */
  caption?: boolean;
  className?: string;
}> = ({ plot, size = 'md', editable = false, onChange, caption = true, className }) => {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const size2 = stageSize(plot);
  // Wider stages draw wider; the box never gets too flat or too tall.
  const ratio = plot.widthM && plot.depthM ? Math.min(2.1, Math.max(1.3, plot.widthM / plot.depthM)) : 1.6;

  const placeFromEvent = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !drag.current) return;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    drag.current.moved = true;
    onChange?.(moveItem(plot, drag.current.id, x, y));
  };

  const selectedItem = plot.items.find((i) => i.id === selected) || null;
  const update = (patch: Partial<PlotItem>) =>
    selectedItem && onChange?.({ ...plot, items: plot.items.map((i) => (i.id === selectedItem.id ? { ...i, ...patch } : i)) });
  const add = (kind: PlotItemKind) => {
    const item: PlotItem = {
      id: newId(),
      kind,
      x: kind === 'speaker' ? 0.97 : 0.5,
      y: kind === 'wedge' ? 0.9 : kind === 'speaker' ? 0.8 : 0.5,
      ...(kind === 'player' ? { code: '??', label: '' } : {}),
    };
    onChange?.({ ...plot, items: [...plot.items, item] });
    setSelected(item.id);
    haptic.tap();
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={box}
        role="img"
        aria-label={t('Stage plot: {names}', {
          names:
            plot.items
              .filter((i) => i.kind === 'player')
              .map((i) => i.label || i.code)
              .filter(Boolean)
              .join(', ') || t('empty'),
        })}
        className={cn(
          'relative w-full rounded-[16px] border-[1.5px] border-dashed border-foreground/25 bg-white dark:bg-white/[0.06] select-none',
          editable && 'touch-none',
        )}
        style={{ aspectRatio: String(ratio) }}
        onPointerMove={editable ? (e) => drag.current && placeFromEvent(e) : undefined}
        onPointerUp={
          editable
            ? () => {
                if (drag.current && !drag.current.moved) setSelected(drag.current.id);
                drag.current = null;
              }
            : undefined
        }
        onClick={editable ? (e) => e.target === box.current && setSelected(null) : undefined}
      >
        {plot.items.map((item) => (
          <PlotMark
            key={item.id}
            item={item}
            size={size}
            selected={editable && selected === item.id}
            onPointerDown={
              editable
                ? (e) => {
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    drag.current = { id: item.id, moved: false };
                  }
                : undefined
            }
          />
        ))}
      </div>
      {caption && (
        <p className="bw-label-xs text-muted-foreground text-center">
          {[t('AUDIENCE'), size2 ? t('stage {size}', { size: size2 }) : ''].filter(Boolean).join(' · ')}
        </p>
      )}

      {editable && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['player', t('Musician')],
                ['wedge', t('Wedge')],
                ['speaker', t('Speaker')],
                ['di', t('DI box')],
              ] as [PlotItemKind, string][]
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => add(kind)}
                className="h-8 px-3 rounded-full border border-foreground/30 bw-label-sm inline-flex items-center gap-1.5 cursor-pointer active:scale-[var(--press-scale)]"
              >
                <Plus className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          {selectedItem ? (
            <div className="rounded-[16px] bg-background p-3 flex flex-wrap items-center gap-2">
              {selectedItem.kind === 'player' && (
                <>
                  <input
                    aria-label={t('Code')}
                    value={selectedItem.code ?? ''}
                    maxLength={3}
                    onChange={(e) => update({ code: e.target.value.toUpperCase() })}
                    className="w-14 h-9 rounded-full bg-card px-3 bw-label-md text-center outline-none focus:ring-2 focus:ring-foreground"
                  />
                  <input
                    aria-label={t('Caption')}
                    placeholder={t('Caption')}
                    value={selectedItem.label ?? ''}
                    maxLength={40}
                    onChange={(e) => update({ label: e.target.value })}
                    className="flex-1 min-w-[120px] h-9 rounded-full bg-card px-3 bw-body-sm outline-none focus:ring-2 focus:ring-foreground"
                  />
                  <button
                    type="button"
                    aria-pressed={!!selectedItem.lead}
                    onClick={() => update({ lead: !selectedItem.lead || undefined })}
                    className={cn(
                      'h-9 px-3 rounded-full bw-label-sm cursor-pointer',
                      selectedItem.lead ? 'bg-accent text-accent-foreground' : 'border border-foreground/30',
                    )}
                  >
                    {t('Lead')}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  onChange?.({ ...plot, items: plot.items.filter((i) => i.id !== selectedItem.id) });
                  setSelected(null);
                }}
                className="h-9 px-3 rounded-full bw-label-sm text-destructive-solid inline-flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <Trash2 className="w-4 h-4" />
                {t('Remove')}
              </button>
            </div>
          ) : (
            <p className="bw-body-sm text-muted-foreground">{t('Drag to move. Tap an item to rename or remove it.')}</p>
          )}
        </div>
      )}
    </div>
  );
};

const DIAMETER = { md: 44, sm: 34, xs: 18 } as const;

const PlotMark: React.FC<{
  item: PlotItem;
  size: 'md' | 'sm' | 'xs';
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}> = ({ item, size, selected, onPointerDown }) => {
  const d = DIAMETER[size];
  const style: React.CSSProperties = { left: `${item.x * 100}%`, top: `${item.y * 100}%` };
  const ring = selected ? 'ring-2 ring-offset-2 ring-foreground ring-offset-white' : '';
  const grab = onPointerDown ? 'cursor-grab active:cursor-grabbing' : '';
  if (item.kind === 'player') {
    return (
      <div
        className={cn('absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1', grab)}
        style={{ ...style, width: d }}
        onPointerDown={onPointerDown}
      >
        <span
          className={cn(
            'rounded-full flex items-center justify-center font-semibold shrink-0',
            item.lead ? 'bg-accent text-accent-foreground' : 'bg-black text-white',
            size === 'xs' ? 'text-[0px]' : size === 'sm' ? 'text-[11px]' : 'text-[13px]',
            ring,
          )}
          style={{ width: d, height: d, fontFamily: 'var(--font-sans)' }}
        >
          {size !== 'xs' && item.code}
        </span>
        {item.label && size !== 'xs' && (
          <span className="absolute top-full mt-1 bw-label-xs text-muted-foreground whitespace-nowrap normal-case text-[10px]">
            {item.label}
          </span>
        )}
      </div>
    );
  }
  if (item.kind === 'speaker') {
    const w = size === 'xs' ? 4 : size === 'sm' ? 12 : 16;
    return (
      <span
        className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded-[4px] bg-black', ring, grab)}
        style={{ ...style, width: w, height: w * 2.8 }}
        onPointerDown={onPointerDown}
        aria-hidden
      />
    );
  }
  if (item.kind === 'di') {
    return (
      <span
        className={cn(
          'absolute -translate-x-1/2 -translate-y-1/2 rounded-[3px] border-[1.5px] border-black text-black flex items-center justify-center font-mono',
          ring,
          grab,
        )}
        style={{ ...style, width: size === 'xs' ? 6 : 22, height: size === 'xs' ? 6 : 14, fontSize: 7 }}
        onPointerDown={onPointerDown}
        aria-hidden
      >
        {size !== 'xs' && 'DI'}
      </span>
    );
  }
  // Wedge monitor.
  const w = size === 'xs' ? 8 : size === 'sm' ? 22 : 30;
  return (
    <span
      className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded-[5px] border-[1.5px] border-black bg-white', ring, grab)}
      style={{ ...style, width: w, height: Math.round(w * 0.45) }}
      onPointerDown={onPointerDown}
      aria-hidden
    />
  );
};
