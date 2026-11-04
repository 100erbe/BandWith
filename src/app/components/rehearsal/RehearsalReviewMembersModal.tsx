import React from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { Users, CheckCircle2, XCircle, Clock } from '@/app/components/icons';
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
             <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border/40 shrink-0">
                 <div className="px-2.5 py-1 bg-muted rounded text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                     <Users className="w-3.5 h-3.5" /> Total: {members.length}
                 </div>
                 <div className="px-2.5 py-1 bg-[var(--success)]/15 text-[var(--success)] rounded text-xs font-semibold uppercase flex items-center gap-1.5">
                     <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed: {confirmed.length}
                 </div>
                 {pending.length > 0 && (
                     <div className="px-2.5 py-1 bg-[var(--warning)]/15 text-[var(--warning)] rounded text-xs font-semibold uppercase flex items-center gap-1.5">
                         <Clock className="w-3.5 h-3.5" /> Pending: {pending.length}
                     </div>
                 )}
                 {declined.length > 0 && (
                     <div className="px-2.5 py-1 bg-[var(--error)]/15 text-[var(--error)] rounded text-xs font-semibold uppercase flex items-center gap-1.5">
                         <XCircle className="w-3.5 h-3.5" /> Declined: {declined.length}
                     </div>
                 )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-card text-card-foreground rounded-xl border border-border/40 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center border-2 border-border/40 shadow-sm">
                                {m.initials}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-[var(--fg)]">{m.name}</div>
                                <div className="text-xs font-semibold text-muted-foreground uppercase">{m.role}</div>
                            </div>
                        </div>
                        <div className={cn(
                            "px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider",
                            m.status === 'confirmed' ? "bg-[var(--success)]/15 text-[var(--success)]" :
                            m.status === 'declined' ? "bg-[var(--error)]/15 text-[var(--error)]" : "bg-[var(--warning)]/15 text-[var(--warning)]"
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
