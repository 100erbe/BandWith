import React, { useState } from 'react';
import { ListMusic, Clock, Layers, AlertCircle, GripVertical, Trash2, Check, X } from '@/app/components/icons';
import { BwSheet, IconButton, PillButton, Tag } from '@/app/components/bw';
import { RehearsalSetlistSnapshotFinal } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  snapshot: RehearsalSetlistSnapshotFinal | undefined;
  totalDuration: string;
  onUpdateSnapshot?: (snapshot: RehearsalSetlistSnapshotFinal) => void;
  onConfirmSetlist?: () => void;
  onDeselectSetlist?: () => void;
  isConfirmed?: boolean;
}

export const RehearsalReviewSetlistModal: React.FC<Props> = ({
  isOpen, onClose, snapshot, totalDuration,
  onUpdateSnapshot, onConfirmSetlist, onDeselectSetlist, isConfirmed = false
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!snapshot) return null;

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSongs = [...snapshot.songs];
    const [moved] = newSongs.splice(draggedIndex, 1);
    newSongs.splice(dragOverIndex, 0, moved);

    onUpdateSnapshot?.({
      ...snapshot,
      songs: newSongs,
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleRemoveSong = (index: number) => {
    const newSongs = snapshot.songs.filter((_, i) => i !== index);
    onUpdateSnapshot?.({
      ...snapshot,
      songs: newSongs,
    });
  };

  const hasFooter = !!(onConfirmSetlist || onDeselectSetlist);
  const footer = hasFooter ? (
    <div className="dark flex flex-col gap-3">
      {isConfirmed && (
        <p className="flex items-center gap-2 bw-label-sm text-success">
          <Check className="w-4 h-4" /> Setlist confirmed
        </p>
      )}
      <div className="flex gap-3">
        {onDeselectSetlist && (
          <PillButton
            variant="outline"
            onClick={onDeselectSetlist}
            icon={isConfirmed ? <X className="w-4 h-4" /> : undefined}
            className={!isConfirmed && onConfirmSetlist ? 'flex-[2]' : undefined}
          >
            Deselect
          </PillButton>
        )}
        {!isConfirmed && onConfirmSetlist && (
          <PillButton onClick={onConfirmSetlist} icon={<Check className="w-[18px] h-[18px]" />} className="flex-[3]">
            Confirm setlist
          </PillButton>
        )}
      </div>
    </div>
  ) : undefined;

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline={`${snapshot.songs.length} ${snapshot.songs.length === 1 ? 'song' : 'songs'} · ${totalDuration}`}
      title="Rehearsal setlist"
      footer={footer}
      zIndex={110}
    >
      <div className="dark flex flex-col gap-5">
        {/* Summary */}
        <div className="flex flex-wrap gap-1.5">
          <Tag variant="outline" icon={<ListMusic />}>
            {snapshot.songs.length} {snapshot.songs.length === 1 ? 'song' : 'songs'}
          </Tag>
          <Tag variant="outline" icon={<Clock />}>
            {totalDuration}
          </Tag>
          <Tag variant="outline" icon={<Layers />}>
            {snapshot.sources.length} {snapshot.sources.length === 1 ? 'source' : 'sources'}
          </Tag>
          {snapshot.mergeReport.totalDuplicatesSkipped > 0 && (
            <Tag variant="accent" icon={<AlertCircle />}>
              {snapshot.mergeReport.totalDuplicatesSkipped} skipped
            </Tag>
          )}
        </div>

        {/* Sources */}
        {snapshot.sources.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className="bw-label-sm text-sheet-foreground/70">Built from templates</h4>
            {snapshot.sources.map((src, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-[16px] bg-white/[0.08]">
                <span className="bw-body-md truncate">{src.templateName}</span>
                <span className="bw-label-sm text-sheet-foreground/60 shrink-0">v{src.templateVersion}</span>
              </div>
            ))}
          </section>
        )}

        {/* Draggable song list */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="bw-label-sm text-sheet-foreground/70">Final tracklist</h4>
            {onUpdateSnapshot && <span className="bw-label-xs text-sheet-foreground/50">Drag to reorder</span>}
          </div>
          <ol className="flex flex-col gap-2">
            {snapshot.songs.map((song, i) => (
              <li
                key={`${song.songId}-${i}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-3 pl-3 pr-1 py-2 rounded-[16px] bg-white/[0.08] select-none cursor-grab active:cursor-grabbing transition-[opacity,transform,box-shadow]',
                  draggedIndex === i && 'opacity-40 scale-[0.97]',
                  dragOverIndex === i && draggedIndex !== null && draggedIndex !== i && 'ring-2 ring-accent'
                )}
              >
                <GripVertical className="w-4 h-4 text-sheet-foreground/40 shrink-0" />
                <span className="w-7 h-7 rounded-full border border-sheet-foreground/40 bw-label-sm flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="bw-label-md truncate">{song.titleAtSnapshot}</span>
                  <span className="bw-body-sm text-sheet-foreground/60 truncate">{song.artistAtSnapshot}</span>
                </div>
                <span className="bw-label-md shrink-0">{song.durationAtSnapshot}</span>
                {onUpdateSnapshot && (
                  <IconButton
                    label={`Remove ${song.titleAtSnapshot}`}
                    icon={<Trash2 />}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSong(i)}
                  />
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </BwSheet>
  );
};
