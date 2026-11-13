import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { moveSongBy, moveSongTo, playNumber, projectedOrder } from '@/lib/setlistOrder';

/**
 * A set's songs in play order (01, 02, …). For the band admin each row can
 * be reordered:
 * - touch / Apple Pencil: long-press the row (~0.4 s, haptic tick), then drag;
 *   a quick swipe still scrolls the page;
 * - mouse: drag the row;
 * - keyboard: focus the grip and press the up/down arrows.
 * The dragged row is drawn in an overlay portalled to <body> (a fixed layer
 * inside a scrolling box gets clipped in WKWebView), above the z-100 edit
 * sheets and below the Duo rail (z-190). The list auto-scrolls near its
 * scroll area's edges. Members get the same rows without any of this.
 */
export interface SortableSong {
  uid: string;
  title?: string;
  artist?: string;
}

interface SortableSongListProps<S extends SortableSong> {
  songs: S[];
  /** Play number of the first song (numbers run across sets). */
  startNumber?: number;
  canReorder: boolean;
  onReorder: (songs: S[]) => void;
  onRemove?: (uid: string) => void;
  /** Accessible name of the list, e.g. the set name. */
  label?: string;
  className?: string;
}

const LONG_PRESS_MS = 400;
/** Overlay layer: above full-screen sheets (z-100), under the Duo rail (z-190). */
const OVERLAY_Z = 150;

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const SongRowBody: React.FC<{ number: string; title: string; artist?: string }> = ({ number, title, artist }) => (
  <>
    <span className="bw-label-sm text-muted-foreground min-w-5 shrink-0 tabular-nums">{number}</span>
    <span className="flex-1 min-w-0 flex flex-col">
      <span className="bw-body-md text-foreground truncate">{title}</span>
      {artist && <span className="bw-label-xs text-muted-foreground truncate mt-1">{artist}</span>}
    </span>
  </>
);

const ROW = 'relative flex items-center gap-3 min-h-11 min-w-0 rounded-[12px] pl-1';

function SortableRow({
  song,
  number,
  title,
  canReorder,
  describedBy,
  onRemove,
  onKeyMove,
  handleRef,
}: {
  song: SortableSong;
  number: string;
  title: string;
  canReorder: boolean;
  describedBy: string;
  onRemove?: () => void;
  onKeyMove: (delta: number) => void;
  handleRef: (el: HTMLButtonElement | null) => void;
}) {
  const t = useT();
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: song.uid,
    disabled: !canReorder,
  });
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <li
      ref={setNodeRef}
      {...(canReorder ? listeners : {})}
      onContextMenu={canReorder ? (e) => e.preventDefault() : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        ROW,
        canReorder &&
          'select-none [-webkit-touch-callout:none] cursor-grab active:bg-foreground/[0.06] transition-colors duration-300',
        isDragging && 'opacity-30'
      )}
    >
      <SongRowBody number={number} title={title} artist={song.artist} />
      {onRemove && (
        <IconButton
          label={t('Remove song')}
          variant="ghost"
          size="sm"
          icon={<X />}
          className="w-8 h-8 -my-1 shrink-0"
          onMouseDown={stop}
          onTouchStart={stop}
          onClick={onRemove}
        />
      )}
      {canReorder && (
        <button
          ref={handleRef}
          type="button"
          aria-label={t('Reorder {title}', { title })}
          aria-describedby={describedBy}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              onKeyMove(e.key === 'ArrowUp' ? -1 : 1);
            }
          }}
          className="w-8 h-11 -mr-1 flex items-center justify-center shrink-0 rounded-full text-muted-foreground cursor-grab focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

export function SortableSongList<S extends SortableSong>({
  songs,
  startNumber = 1,
  canReorder,
  onReorder,
  onRemove,
  label,
  className,
}: SortableSongListProps<S>) {
  const t = useT();
  const instructionsId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [liveText, setLiveText] = useState('');
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } })
  );

  const uids = useMemo(() => songs.map((s) => s.uid), [songs]);
  const order = useMemo(() => projectedOrder(uids, activeId, overId), [uids, activeId, overId]);
  const numberOf = (uid: string) => playNumber(startNumber + Math.max(0, order.indexOf(uid)));
  const titleOf = useCallback(
    (uid: string | number | null | undefined) => {
      const s = songs.find((x) => x.uid === uid);
      return s?.title || t('Untitled song');
    },
    [songs, t]
  );
  const positionOf = (uid: string, list: string[]) => list.indexOf(uid) + 1;

  // Keyboard moves re-render the list; keep focus on the moved song's grip.
  useEffect(() => {
    const uid = refocus.current;
    if (!uid) return;
    refocus.current = null;
    const el = handles.current.get(uid);
    if (el && document.activeElement !== el) el.focus();
  }, [songs]);

  const keyMove = (uid: string, delta: number) => {
    const next = moveSongBy(songs, uid, delta);
    if (next === songs) return;
    refocus.current = uid;
    onReorder(next);
    haptic.selection();
    setLiveText(
      t('{title} moved to position {position} of {total}', {
        title: titleOf(uid),
        position: next.findIndex((s) => s.uid === uid) + 1,
        total: next.length,
      })
    );
  };

  const reset = () => {
    setActiveId(null);
    setOverId(null);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(String(active.id));
    haptic.pickUp();
  };
  const onDragOver = ({ over }: DragOverEvent) => {
    const next = over ? String(over.id) : null;
    if (next && next !== overId) haptic.dragTick();
    setOverId(next);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    reset();
    haptic.drop();
    if (over && active.id !== over.id) onReorder(moveSongTo(songs, String(active.id), String(over.id)));
  };
  const onDragCancel = () => {
    reset();
    haptic.drop();
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('Picked up {title}', { title: titleOf(active.id as string) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('{title} moved to position {position} of {total}', {
            title: titleOf(active.id as string),
            position: positionOf(String(over.id), uids),
            total: uids.length,
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      t('{title} moved to position {position} of {total}', {
        title: titleOf(active.id as string),
        position: positionOf(String(over?.id ?? active.id), uids),
        total: uids.length,
      }),
    onDragCancel: ({ active }) => t('Reordering cancelled: {title} stays where it was', { title: titleOf(active.id as string) }),
  };

  const activeSong = activeId ? songs.find((s) => s.uid === activeId) : undefined;

  if (!canReorder) {
    return (
      <ol aria-label={label} className={cn('flex flex-col', className)}>
        {songs.map((song, i) => (
          <li key={song.uid} className={ROW}>
            <SongRowBody number={playNumber(startNumber + i)} title={song.title || t('Untitled song')} artist={song.artist} />
            {onRemove && (
              <IconButton
                label={t('Remove song')}
                variant="ghost"
                size="sm"
                icon={<X />}
                className="w-8 h-8 -my-1 shrink-0"
                onClick={() => onRemove(song.uid)}
              />
            )}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 12 }}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('Long-press a song and drag it to change the order. With a keyboard, focus the grip and use the up and down arrow keys.') },
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={uids} strategy={verticalListSortingStrategy}>
        <ol aria-label={label} className={cn('flex flex-col', className)}>
          {songs.map((song) => (
            <SortableRow
              key={song.uid}
              song={song}
              number={numberOf(song.uid)}
              title={song.title || t('Untitled song')}
              canReorder
              describedBy={instructionsId}
              onRemove={onRemove ? () => onRemove(song.uid) : undefined}
              onKeyMove={(delta) => keyMove(song.uid, delta)}
              handleRef={(el) => {
                if (el) handles.current.set(song.uid, el);
                else handles.current.delete(song.uid);
              }}
            />
          ))}
        </ol>
      </SortableContext>
      <span id={instructionsId} className="sr-only">
        {t('Long-press a song and drag it to change the order. With a keyboard, focus the grip and use the up and down arrow keys.')}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {liveText}
      </span>
      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay zIndex={OVERLAY_Z} modifiers={[verticalOnly]}>
            {activeSong ? (
              <div
                className={cn(
                  ROW,
                  '-mx-2 px-3 bg-card text-card-foreground shadow-[0_12px_32px_rgba(0,0,0,0.28)] ring-1 ring-border scale-[1.02] cursor-grabbing'
                )}
              >
                <SongRowBody
                  number={numberOf(activeSong.uid)}
                  title={activeSong.title || t('Untitled song')}
                  artist={activeSong.artist}
                />
                <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground" />
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
