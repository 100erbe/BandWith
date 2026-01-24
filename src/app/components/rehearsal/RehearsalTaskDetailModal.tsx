import React, { useState, useEffect } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { CheckSquare, Trash2, Save, User, Users, Clock, Check } from 'lucide-react';
import { RehearsalTask, RehearsalMember } from './types';
import { cn } from '@/app/components/ui/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: RehearsalTask | null;
  members: RehearsalMember[];
  onSave: (task: RehearsalTask) => void;
  onDelete: (taskId: string) => void;
  readOnly?: boolean;
}

export const RehearsalTaskDetailModal: React.FC<Props> = ({ 
  isOpen, onClose, task, members, onSave, onDelete, readOnly = false 
}) => {
  const [editedTask, setEditedTask] = useState<RehearsalTask | null>(null);

  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  if (!editedTask) return null;

  const handleSave = () => {
    if (editedTask) {
      onSave(editedTask);
      onClose();
    }
  };

  const handleDelete = () => {
      if (task) {
          onDelete(task.id);
          onClose();
      }
  };

  const isAssignedToAll = editedTask.assignedTo.includes('all');
  
  const handleToggleMember = (memberId: string) => {
      if (readOnly) return;
      
      let newAssigned = [...editedTask.assignedTo];
      
      if (memberId === 'all') {
          // If toggling All, clear everything else and set All
          if (isAssignedToAll) {
              // If already All, do nothing or clear? Let's say we can't clear everything easily, but for now allow unselecting All
              newAssigned = [];
          } else {
              newAssigned = ['all'];
          }
      } else {
          // If specific member
          if (isAssignedToAll) {
              // If was All, remove All and add specific
              newAssigned = [memberId];
          } else {
              if (newAssigned.includes(memberId)) {
                  newAssigned = newAssigned.filter(id => id !== memberId);
              } else {
                  newAssigned.push(memberId);
              }
          }
      }
      
      setEditedTask({ ...editedTask, assignedTo: newAssigned });
  };

  // Helper to get names
  const assignedNames = isAssignedToAll 
        ? 'Entire Band' 
        : editedTask.assignedTo.map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(', ');

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Task Details" icon={CheckSquare}>
        <div className="flex flex-col h-auto">
            {/* Swiss Summary Row */}
            <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-black/5">
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     {isAssignedToAll ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                     {isAssignedToAll ? 'Band Task' : 'Assigned Task'}
                 </div>
                 <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-bold uppercase text-black/60 flex items-center gap-1">
                     <Clock className="w-3 h-3" /> Due Rehearsal
                 </div>
                 <div className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1", editedTask.completed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                     {editedTask.completed ? "Completed" : "Open"}
                 </div>
            </div>

            <div className="space-y-4">
                {/* Description */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Description</label>
                    {readOnly ? (
                        <div className="text-sm font-bold text-black">{editedTask.text}</div>
                    ) : (
                        <input 
                            value={editedTask.text}
                            onChange={(e) => setEditedTask({...editedTask, text: e.target.value})}
                            className="w-full bg-[#F2F2F0] rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-1 focus:ring-black"
                        />
                    )}
                </div>

                {/* Assignee */}
                <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Assigned To</label>
                     {readOnly ? (
                         <div className="text-sm font-medium text-black">{assignedNames || 'Unassigned'}</div>
                     ) : (
                         <div className="space-y-2">
                             {/* All Button */}
                             <button 
                                onClick={() => handleToggleMember('all')}
                                className={cn(
                                    "w-full px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-between transition-all",
                                    isAssignedToAll ? "bg-black text-white border-black" : "bg-white border-black/10 text-black/40 hover:border-black/30"
                                )}
                             >
                                 <span>Entire Band</span>
                                 {isAssignedToAll && <Check className="w-3 h-3" />}
                             </button>
                             
                             {/* Specific Members Grid */}
                             <div className="grid grid-cols-2 gap-2">
                                 {members.map(m => {
                                     const isSelected = editedTask.assignedTo.includes(m.id);
                                     return (
                                         <button 
                                            key={m.id}
                                            onClick={() => handleToggleMember(m.id)}
                                            className={cn(
                                                "px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-between transition-all text-left",
                                                isSelected ? "bg-black text-white border-black" : "bg-white border-black/10 text-black/40 hover:border-black/30",
                                                isAssignedToAll ? "opacity-50 cursor-not-allowed" : ""
                                            )}
                                            disabled={isAssignedToAll}
                                         >
                                             <span>{m.name}</span>
                                             {isSelected && <Check className="w-3 h-3" />}
                                         </button>
                                     );
                                 })}
                             </div>
                         </div>
                     )}
                     {!readOnly && (
                         <div className="text-[9px] font-bold text-black/30 mt-1 uppercase text-right">
                             {isAssignedToAll ? 'Assigned to everyone' : `Assigned to ${editedTask.assignedTo.length} members`}
                         </div>
                     )}
                </div>

                {/* Type */}
                 <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Category</label>
                     {readOnly ? (
                         <div className="text-sm font-medium text-black capitalize">{editedTask.type}</div>
                     ) : (
                         <div className="flex flex-wrap gap-2">
                             {['study', 'bring', 'fix', 'prepare', 'other'].map(t => (
                                 <button 
                                    key={t}
                                    onClick={() => setEditedTask({...editedTask, type: t as any})}
                                    className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all", editedTask.type === t ? "bg-black text-[#D4FB46] border-black" : "bg-white border-black/10 text-black/40")}
                                 >
                                     {t}
                                 </button>
                             ))}
                         </div>
                     )}
                </div>
            </div>

            {/* Actions */}
            {!readOnly && (
                <div className="pt-6 mt-6 border-t border-black/10 flex gap-3">
                    <button 
                        onClick={handleDelete}
                        className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-100 transition-colors"
                    >
                        Delete
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-[2] py-3 bg-black text-[#D4FB46] rounded-xl font-bold text-xs uppercase tracking-wider hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Save Changes
                    </button>
                </div>
            )}
        </div>
    </RehearsalModalWrapper>
  );
};
