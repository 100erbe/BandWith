import React from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { MessageCircle, ThumbsUp, ThumbsDown, CheckCircle2, Clock } from 'lucide-react';
import { SongProposal } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  proposals: SongProposal[];
}

export const RehearsalReviewProposalsModal: React.FC<Props> = ({ isOpen, onClose, proposals }) => {
  const approved = proposals.filter(p => p.status === 'approved');
  const pending = proposals.filter(p => p.status === 'pending' || p.status === 'new');

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Proposals Outcome" icon={MessageCircle}>
        <div className="flex flex-col h-[60vh]">
             {/* Swiss Summary Row */}
             <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-black/5 shrink-0">
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <MessageCircle className="w-3 h-3" /> Total: {proposals.length}
                 </div>
                 <div className="px-2 py-1 bg-green-50 text-green-800 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                     <CheckCircle2 className="w-3 h-3" /> Approved: {approved.length}
                 </div>
                 <div className="px-2 py-1 bg-amber-50 text-amber-800 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                     <Clock className="w-3 h-3" /> Pending: {pending.length}
                 </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                
                {/* Approved */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2 text-green-700">Approved</h4>
                    {approved.length === 0 ? <div className="text-xs text-black/30 italic">None</div> : (
                        <div className="space-y-2">
                            {approved.map(p => (
                                <div key={p.id} className="p-3 bg-white border border-green-100 rounded-xl shadow-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <div className="text-sm font-bold">{p.title}</div>
                                            <div className="text-[10px] text-black/50 uppercase">{p.artist}</div>
                                        </div>
                                        <div className="flex gap-2 text-[10px] font-bold text-black/40">
                                            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {p.votes.yes}</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-black/60 italic bg-[#F2F2F0] p-1.5 rounded mt-2">"{p.reason}"</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pending */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Pending</h4>
                    {pending.length === 0 ? <div className="text-xs text-black/30 italic">None</div> : (
                        <div className="space-y-2">
                            {pending.map(p => (
                                <div key={p.id} className="p-3 bg-[#F2F2F0] rounded-xl border border-transparent opacity-75">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <div className="text-sm font-bold text-black/70">{p.title}</div>
                                            <div className="text-[10px] text-black/40 uppercase">{p.artist}</div>
                                        </div>
                                        <div className="flex gap-2 text-[10px] font-bold text-black/30">
                                            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {p.votes.yes}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
