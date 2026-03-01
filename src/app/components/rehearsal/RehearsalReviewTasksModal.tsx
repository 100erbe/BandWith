import React from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { CheckSquare, Users, User, CheckCircle2 } from 'lucide-react';
import { RehearsalTask, RehearsalMember } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: RehearsalTask[];
  members: RehearsalMember[];
}

export const RehearsalReviewTasksModal: React.FC<Props> = ({ isOpen, onClose, tasks, members }) => {
  const bandTasks = tasks.filter(t => Array.isArray(t.assignedTo) ? t.assignedTo.includes('all') : t.assignedTo === 'all');
  const assignedTasks = tasks.filter(t => Array.isArray(t.assignedTo) ? !t.assignedTo.includes('all') : t.assignedTo !== 'all');
  
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Rehearsal Tasks" icon={CheckSquare}>
        <div className="flex flex-col h-[60vh]">
             {/* Swiss Summary Row */}
             <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-black/5 shrink-0">
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <CheckSquare className="w-3 h-3" /> Total: {tasks.length}
                 </div>
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <Users className="w-3 h-3" /> Band: {bandTasks.length}
                 </div>
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <User className="w-3 h-3" /> Assigned: {assignedTasks.length}
                 </div>
                 {completedCount > 0 && (
                     <div className="px-2 py-1 bg-green-50 text-green-800 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                         <CheckCircle2 className="w-3 h-3" /> Done: {completedCount}
                     </div>
                 )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                
                {/* Band Tasks */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Band Tasks ({bandTasks.length})
                    </h4>
                    {bandTasks.length === 0 ? (
                        <div className="text-xs text-black/30 italic pl-1">No band tasks</div>
                    ) : (
                        <div className="space-y-2">
                            {bandTasks.map(task => (
                                <div key={task.id} className="p-3 bg-[#F2F2F0] rounded-xl flex items-start gap-3">
                                    <div className={cn("mt-0.5 w-4 h-4 rounded border flex items-center justify-center", task.completed ? "bg-black border-black text-white" : "border-black/20")}>
                                        {task.completed && <CheckCircle2 className="w-3 h-3" />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold leading-tight">{task.text}</div>
                                        <div className="mt-1 text-[10px] font-bold uppercase text-black/40 bg-white px-1.5 py-0.5 rounded inline-block">
                                            {task.type}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Assigned Tasks */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2 flex items-center gap-1">
                        <User className="w-3 h-3" /> Assigned Tasks ({assignedTasks.length})
                    </h4>
                    {assignedTasks.length === 0 ? (
                        <div className="text-xs text-black/30 italic pl-1">No assigned tasks</div>
                    ) : (
                        <div className="space-y-2">
                            {assignedTasks.map(task => {
                                const assignee = members.find(m => Array.isArray(task.assignedTo) ? task.assignedTo.includes(m.id) : m.id === task.assignedTo);
                                return (
                                    <div key={task.id} className="p-3 bg-[#F2F2F0] rounded-xl flex items-start gap-3">
                                         <div className="mt-0.5 w-5 h-5 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                                            {assignee?.initials || '?'}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                            <div className="flex justify-between">
                                                <div className="text-xs font-bold text-black/50 uppercase mb-0.5">{assignee?.name}</div>
                                                {task.completed && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                            </div>
                                            <div className="text-sm font-bold leading-tight">{task.text}</div>
                                         </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
