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
             <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border shrink-0">
                 <div className="px-2 py-1 bg-surface-inverse/5 rounded text-xs font-bold uppercase text-foreground/60 flex items-center gap-1">
                     <Users className="w-3 h-3" /> Total: {members.length}
                 </div>
                 <div className="px-2 py-1 bg-success/10 text-success rounded text-xs font-bold uppercase flex items-center gap-1">
                     <CheckCircle2 className="w-3 h-3" /> Confirmed: {confirmed.length}
                 </div>
                 {pending.length > 0 && (
                     <div className="px-2 py-1 bg-amber/10 text-amber rounded text-xs font-bold uppercase flex items-center gap-1">
                         <Clock className="w-3 h-3" /> Pending: {pending.length}
                     </div>
                 )}
                 {declined.length > 0 && (
                     <div className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-bold uppercase flex items-center gap-1">
                         <XCircle className="w-3 h-3" /> Declined: {declined.length}
                     </div>
                 )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-inverse text-surface-inverse-foreground text-xs font-bold flex items-center justify-center border-2 border-border shadow-sm">
                                {m.initials}
                            </div>
                            <div>
                                <div className="text-sm font-bold">{m.name}</div>
                                <div className="text-xs font-bold text-foreground/40 uppercase">{m.role}</div>
                            </div>
                        </div>
                        <div className={cn(
                            "px-2 py-1 rounded text-xs font-black uppercase tracking-wider",
                            m.status === 'confirmed' ? "bg-success/10 text-success" :
                            m.status === 'declined' ? "bg-destructive/10 text-destructive" : "bg-amber/10 text-amber"
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
