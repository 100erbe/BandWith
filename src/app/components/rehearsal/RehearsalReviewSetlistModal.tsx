import React, { useState, useCallback } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { ListMusic, Clock, Layers, AlertCircle, GripVertical, Trash2, Plus, Check, X } from 'lucide-react';
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

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Rehearsal Setlist" icon={ListMusic}>
        <div className="flex flex-col h-[70vh]">
             {/* Summary Row */}
             <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-black/5 shrink-0">
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <ListMusic className="w-3 h-3" /> Songs: {snapshot.songs.length}
                 </div>
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <Clock className="w-3 h-3" /> Duration: {totalDuration}
                 </div>
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <Layers className="w-3 h-3" /> Sources: {snapshot.sources.length}
                 </div>
                 {snapshot.mergeReport.totalDuplicatesSkipped > 0 && (
                     <div className="px-2 py-1 bg-amber-50 text-amber-800 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                         <AlertCircle className="w-3 h-3" /> Skipped: {snapshot.mergeReport.totalDuplicatesSkipped}
                     </div>
                 )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                
                {/* Sources Info */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Built from Templates</h4>
                    <div className="space-y-2">
                        {snapshot.sources.map((src, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-[#F2F2F0] rounded-lg">
                                <span className="text-xs font-bold text-black">{src.templateName}</span>
                                <span className="text-[10px] font-mono text-black/40">v{src.templateVersion}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Draggable Song List */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Final Tracklist</h4>
                    <p className="text-[10px] text-black/30 mb-3">Drag to reorder • Swipe to remove</p>
                    <div className="bg-[#F2F2F0] rounded-2xl p-2 space-y-1">
                        {snapshot.songs.map((song, i) => (
                            <div
                                key={`${song.songId}-${i}`}
                                draggable
                                onDragStart={() => handleDragStart(i)}
                                onDragOver={(e) => handleDragOver(e, i)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                    "flex items-center gap-2 p-2 bg-white rounded-xl shadow-sm border transition-all cursor-grab active:cursor-grabbing select-none",
                                    draggedIndex === i && "opacity-40 scale-95",
                                    dragOverIndex === i && draggedIndex !== null && draggedIndex !== i && "border-[#0147FF] border-2",
                                    draggedIndex === null && "border-transparent hover:border-black/10"
                                )}
                            >
                                <GripVertical className="w-4 h-4 text-black/20 shrink-0" />
                                <span className="text-[10px] font-mono font-bold text-black/30 w-5 text-center shrink-0">{i+1}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-sm font-bold truncate">{song.titleAtSnapshot}</div>
                                        <div className="text-[10px] font-medium text-black/40 shrink-0 ml-2">{song.durationAtSnapshot}</div>
                                    </div>
                                    <div className="text-[10px] text-black/50 uppercase truncate">{song.artistAtSnapshot}</div>
                                </div>
                                {onUpdateSnapshot && (
                                    <button
                                        onClick={() => handleRemoveSong(i)}
                                        className="p-1.5 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer: Confirm / Deselect */}
            {(onConfirmSetlist || onDeselectSetlist) && (
                <div className="pt-4 mt-4 border-t border-black/10 shrink-0 flex gap-3">
                    {isConfirmed ? (
                        <>
                            <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-bold">
                                <Check className="w-4 h-4" /> Setlist Confirmed
                            </div>
                            {onDeselectSetlist && (
                                <button
                                    onClick={onDeselectSetlist}
                                    className="px-5 py-3 bg-black/5 hover:bg-black/10 rounded-xl text-sm font-bold uppercase tracking-wider text-black/60 transition-colors flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" /> Deselect
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {onDeselectSetlist && (
                                <button
                                    onClick={onDeselectSetlist}
                                    className="px-5 py-3 bg-black/5 hover:bg-black/10 rounded-xl text-sm font-bold uppercase tracking-wider text-black/60 transition-colors"
                                >
                                    Deselect
                                </button>
                            )}
                            {onConfirmSetlist && (
                                <button
                                    onClick={onConfirmSetlist}
                                    className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-black/80 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Confirm Setlist
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    </RehearsalModalWrapper>
  );
};
