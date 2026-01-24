import React from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { RehearsalMember } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: RehearsalMember[];
}

export const RehearsalReviewMembersModal: React.FC<Props> = ({ isOpen, onClose, members }) => {
  const confirmed = members.filter(m => m.status === 'confirmed');
  const pending = members.filter(m => m.status === 'pending');
  const declined = members.filter(m => m.status === 'declined');

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Rehearsal Members" icon={Users}>
        <div className="flex flex-col h-[50vh]">
             {/* Swiss Summary Row */}
             <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-black/5 shrink-0">
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <Users className="w-3 h-3" /> Total: {members.length}
                 </div>
                 <div className="px-2 py-1 bg-green-50 text-green-800 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                     <CheckCircle2 className="w-3 h-3" /> Confirmed: {confirmed.length}
                 </div>
                 {pending.length > 0 && (
                     <div className="px-2 py-1 bg-amber-50 text-amber-800 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                         <Clock className="w-3 h-3" /> Pending: {pending.length}
                     </div>
                 )}
                 {declined.length > 0 && (
                     <div className="px-2 py-1 bg-red-50 text-red-800 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                         <XCircle className="w-3 h-3" /> Declined: {declined.length}
                     </div>
                 )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-black/5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-sm">
                                {m.initials}
                            </div>
                            <div>
                                <div className="text-sm font-bold">{m.name}</div>
                                <div className="text-[10px] font-bold text-black/40 uppercase">{m.role}</div>
                            </div>
                        </div>
                        <div className={cn(
                            "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider",
                            m.status === 'confirmed' ? "bg-green-100 text-green-800" :
                            m.status === 'declined' ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        )}>
                            {m.status}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
