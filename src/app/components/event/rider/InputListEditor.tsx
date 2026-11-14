import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useRailBack } from '@/lib/railActions';
import { springs } from '@/styles/motion';
import { channelLabel, moveInput, newId, LIMITS, type InputChannel } from '@/lib/stagePlot';

/**
 * Input list editor (Figma "Phone Next / Rider & stage – Edit input list"):
 * one row per channel, drag the grip to reorder, tap the pencil to edit the
 * source, mic and who plays it. Canvas editing of the plot stays on tablets.
 */
export const InputListEditor: React.FC<{
  eventTitle: string;
  inputs: InputChannel[];
  /** First names on the lineup, offered for WHO. */
  people: string[];
  /** The plot can be edited here too (tablets). */
  plotOnTablet?: boolean;
  onCancel: () => void;
  onSave: (inputs: InputChannel[]) => Promise<boolean>;
}> = ({ eventTitle, inputs: initial, people, plotOnTablet = true, onCancel, onSave }) => {
  const t = useT();
  const [list, setList] = useState<InputChannel[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const railBack = useRailBack(onCancel, t('Close'), true, true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = list.findIndex((c) => c.id === e.active.id);
    const to = list.findIndex((c) => c.id === e.over!.id);
    setList((l) => moveInput(l, from, to));
    haptic.tap();
  };
  const patch = (id: string, p: Partial<InputChannel>) => setList((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const add = () => {
    const c: InputChannel = { id: newId(), source: '', mic: 'SM58', kind: 'mic', who: '' };
    setList((l) => [...l, c]);
    setEditing(c.id);
  };
  const save = async () => {
    setSaving(true);
    const ok = await onSave(list.filter((c) => c.source.trim() || c.mic.trim()));
    setSaving(false);
    if (ok) haptic.confirm();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={springs.smooth}
      className="bw-rail-sheet bw-picker fixed top-0 bottom-0 left-0 right-0 z-[130] bg-background text-foreground flex flex-col"
      data-state="open"
      role="dialog"
      aria-modal="true"
      aria-label={t('Edit input list')}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div
          className="max-w-[640px] mx-auto w-full px-4 flex flex-col gap-4"
          style={{ paddingTop: 'calc(max(var(--safe-top), 44px) + 4px)', paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}
        >
          <div className="flex items-center justify-between h-11">
            {!railBack ? <IconButton label={t('Close')} icon={<X />} size="sm" variant="outline" onClick={onCancel} /> : <span />}
            <button type="button" onClick={save} disabled={saving} className="bw-button-sm h-11 px-1 cursor-pointer disabled:opacity-50">
              {t('DONE')}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="bw-label-sm text-muted-foreground truncate">
              {t('RIDER & STAGE · {event}', { event: eventTitle.toUpperCase() })}
            </span>
            <h1 className="bw-display-lg">{t('EDIT INPUT LIST')}</h1>
          </div>
          <div className="flex items-center justify-between bw-label-xs text-muted-foreground">
            <span>{t('{count} CHANNELS', { count: list.length })}</span>
            <span>{t('DRAG TO REORDER')}</span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2" aria-label={t('Channels')}>
                {list.map((c, i) => (
                  <ChannelRow
                    key={c.id}
                    channel={c}
                    index={i}
                    editing={editing === c.id}
                    people={people}
                    onEdit={() => setEditing(editing === c.id ? null : c.id)}
                    onChange={(p) => patch(c.id, p)}
                    onRemove={() => {
                      setList((l) => l.filter((x) => x.id !== c.id));
                      setEditing(null);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {list.length < LIMITS.inputs && (
            <button
              type="button"
              onClick={add}
              className="h-14 w-full rounded-full border-[1.5px] border-dashed border-foreground bw-button-sm inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[var(--press-scale)]"
            >
              <Plus className="w-4 h-4" />
              {t('ADD CHANNEL')}
            </button>
          )}
          {plotOnTablet && <p className="bw-label-xs text-muted-foreground text-center">{t('STAGE PLOT EDITING IS ON IPAD')}</p>}

          <div className="grid grid-cols-[1fr_1.4fr] gap-3 pt-2">
            <PillButton variant="outline" size="lg" onClick={onCancel} disabled={saving}>
              {t('CANCEL')}
            </PillButton>
            <PillButton variant="primary" size="lg" onClick={save} loading={saving} icon={<Check className="w-[18px] h-[18px]" />}>
              {t('SAVE LIST')}
            </PillButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ChannelRow: React.FC<{
  channel: InputChannel;
  index: number;
  editing: boolean;
  people: string[];
  onEdit: () => void;
  onChange: (p: Partial<InputChannel>) => void;
  onRemove: () => void;
}> = ({ channel: c, index, editing, people, onEdit, onChange, onRemove }) => {
  const t = useT();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: c.id });
  const field = 'h-12 w-full rounded-full bg-card px-4 bw-body-md outline-none focus:ring-2 focus:ring-foreground';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('rounded-[20px] bg-white dark:bg-card px-3 py-3 flex flex-col gap-3', isDragging && 'opacity-60 z-10 relative')}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t('Reorder {title}', { title: c.source || channelLabel(index) })}
          className="relative after:absolute after:-inset-x-2.5 after:-inset-y-0.5 after:content-[''] w-6 h-10 -ml-1 flex items-center justify-center text-muted-foreground cursor-grab touch-none shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center bw-label-sm shrink-0 tabular-nums',
            editing ? 'bg-black text-[var(--accent)]' : 'bg-card dark:bg-background',
          )}
        >
          {channelLabel(index)}
        </span>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="bw-h3 truncate normal-case">
            {editing ? t('Editing channel {n}', { n: index + 1 }) : c.source || t('New channel')}
          </span>
          {!editing && (
            <span className="bw-label-xs text-muted-foreground truncate">
              {[c.mic.toUpperCase(), c.who.toUpperCase()].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        {editing ? (
          <IconButton
            label={t('Remove channel')}
            icon={<Trash2 />}
            size="sm"
            variant="ghost"
            className="text-destructive-solid"
            onClick={onRemove}
          />
        ) : (
          <IconButton label={t('Edit channel {n}', { n: index + 1 })} icon={<Pencil />} size="sm" variant="ghost" onClick={onEdit} />
        )}
      </div>
      {editing && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="bw-label-xs text-muted-foreground">{t('SOURCE')}</span>
              <input className={field} value={c.source} maxLength={40} autoFocus onChange={(e) => onChange({ source: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="bw-label-xs text-muted-foreground">{t('MIC / DI')}</span>
              <input
                className={field}
                value={c.mic}
                maxLength={30}
                onChange={(e) => onChange({ mic: e.target.value, kind: /^di\b/i.test(e.target.value) ? 'di' : c.kind })}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['mic', 'di'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={c.kind === k}
                onClick={() => onChange({ kind: k, ...(k === 'di' ? { mic: 'DI' } : c.mic === 'DI' ? { mic: 'SM58' } : {}) })}
                className={cn(
                  'h-8 px-4 rounded-full bw-label-sm cursor-pointer',
                  c.kind === k ? 'bg-black text-white' : 'border border-foreground/30',
                )}
              >
                {k === 'mic' ? t('MIC') : t('DI')}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 bw-body-sm text-muted-foreground min-w-0">
              {t('Who')}
              <input
                list="bw-input-people"
                value={c.who}
                maxLength={30}
                onChange={(e) => onChange({ who: e.target.value })}
                className="w-28 h-8 rounded-full bg-card px-3 bw-body-sm text-foreground outline-none focus:ring-2 focus:ring-foreground"
              />
              <datalist id="bw-input-people">
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
          </div>
          <button type="button" onClick={onEdit} className="self-end bw-button-sm h-8 px-1 cursor-pointer">
            {t('DONE')}
          </button>
        </div>
      )}
    </li>
  );
};
