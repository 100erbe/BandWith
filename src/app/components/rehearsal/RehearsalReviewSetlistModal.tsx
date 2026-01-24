import React from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { ListMusic, Clock, Layers, AlertCircle } from 'lucide-react';
import { RehearsalSetlistSnapshotFinal } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  snapshot: RehearsalSetlistSnapshotFinal | undefined;
  totalDuration: string;
}

export const RehearsalReviewSetlistModal: React.FC<Props> = ({ isOpen, onClose, snapshot, totalDuration }) => {
  if (!snapshot) return null;

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Rehearsal Setlist" icon={ListMusic}>
        <div className="flex flex-col h-[70vh]">
             {/* Swiss Summary Row */}
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

                {/* Song List */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Final Tracklist</h4>
                    <div className="bg-[#F2F2F0] rounded-2xl p-2 space-y-1">
                        {snapshot.songs.map((song, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-xl shadow-sm border border-transparent">
                                <span className="text-[10px] font-mono font-bold text-black/30 w-5 text-center">{i+1}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-sm font-bold truncate">{song.titleAtSnapshot}</div>
                                        <div className="text-[10px] font-medium text-black/40">{song.durationAtSnapshot}</div>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-[10px] text-black/50 uppercase truncate">{song.artistAtSnapshot}</div>
                                        {/* Optional: Show source icon/indicator? Not strictly required by spec but nice */}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
