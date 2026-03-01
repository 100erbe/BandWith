import React, { useState } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { CheckSquare, Plus, User, Users, Music, AlertCircle, Check } from 'lucide-react';
import { RehearsalMember, RehearsalSong, RehearsalTask } from './types';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: RehearsalMember[];
  songs: RehearsalSong[];
  onAdd: (task: RehearsalTask) => void;
}

export const RehearsalAddTaskModal: React.FC<Props> = ({ isOpen, onClose, members, songs, onAdd }) => {
  const [text, setText] = useState('');
  const [type, setType] = useState<RehearsalTask['type']>('prepare');
  
  const [assignMode, setAssignMode] = useState<'all' | 'single' | 'multiple'>('single');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const handleToggleMember = (id: string) => {
      if (assignMode === 'single') {
          setSelectedMemberIds([id]);
      } else if (assignMode === 'multiple') {
          setSelectedMemberIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
      }
  };

  const handleAdd = () => {
    if (!text) return;

    // Logic for creating tasks based on mode
    if (assignMode === 'multiple' && selectedMemberIds.length > 0) {
        // Create multiple individual tasks
        selectedMemberIds.forEach(memberId => {
             const newTask: RehearsalTask = {
                id: `task-${Date.now()}-${Math.random()}`,
                text,
                completed: false,
                assignedTo: [memberId], // Single ID array for individual assignment
                type
            };
            onAdd(newTask);
        });
    } else {
        // Create single task (either 'all' or 'single' or 'multiple' with 1 selected)
        let assignedTo: string[] = ['all'];
        
        if (assignMode === 'single' && selectedMemberIds.length > 0) {
            assignedTo = selectedMemberIds;
        } else if (assignMode === 'multiple' && selectedMemberIds.length === 0) {
            // Fallback if nothing selected in multiple mode? Default to all? Or block?
            // Let's assume validation prevents this, but as fallback:
            assignedTo = ['all'];
        }

        const newTask: RehearsalTask = {
            id: `task-${Date.now()}`,
            text,
            completed: false,
            assignedTo,
            type
        };
        onAdd(newTask);
    }
    
    // Reset & Close
    setText('');
    setType('prepare');
    setAssignMode('all');
    setSelectedMemberIds([]);
    onClose();
  };

  // Helper text
  const getButtonText = () => {
      if (assignMode === 'multiple' && selectedMemberIds.length > 1) {
          return `Create ${selectedMemberIds.length} Tasks`;
      }
      return "Add Task";
  };

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Add New Task" icon={CheckSquare}>
        <div className="space-y-6">
            
            {/* Description Input */}
            <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Task Description</label>
                <input 
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-black/10 py-2 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
                    placeholder="e.g. Learn the bridge part"
                />
            </div>

            {/* Assignment Mode Selector */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Assign To</label>
                
                {/* Mode Tabs */}
                <div className="flex p-1 bg-black/5 rounded-[10px] mb-2">
                    <button onClick={() => { setAssignMode('all'); setSelectedMemberIds([]); }} className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all", assignMode === 'all' ? "bg-black text-white shadow-sm" : "text-black/40")}>Entire Band</button>
                    <button onClick={() => { setAssignMode('single'); setSelectedMemberIds([]); }} className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all", assignMode === 'single' ? "bg-black text-white shadow-sm" : "text-black/40")}>One Member</button>
                    <button onClick={() => { setAssignMode('multiple'); setSelectedMemberIds([]); }} className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all", assignMode === 'multiple' ? "bg-black text-white shadow-sm" : "text-black/40")}>Multiple</button>
                </div>

                {/* Member Selection Grid (Only if not All) */}
                {assignMode !== 'all' && (
                    <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
                        {members.map(m => {
                            const isSelected = selectedMemberIds.includes(m.id);
                            return (
                                <button 
                                    key={m.id}
                                    onClick={() => handleToggleMember(m.id)}
                                    className={cn(
                                        "flex flex-col items-start justify-start gap-[10px] px-3 py-2 rounded-[10px] border transition-all text-left group",
                                        isSelected ? "bg-black border-black text-white" : "bg-white border-black/10 hover:border-black/30 text-black/60"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold", isSelected ? "bg-white text-black" : "bg-black/10 text-black/40")}>{m.initials}</div>
                                        <span className="text-xs font-bold">{m.name}</span>
                                    </div>
                                    <DotCheckbox checked={isSelected} activeColor={isSelected ? '#FFFFFF' : '#000000'} inactiveColor={isSelected ? 'rgba(255,255,255,0.3)' : undefined} />
                                </button>
                            );
                        })}
                    </div>
                )}
                
                {/* Helper Note for Multiple */}
                {assignMode === 'multiple' && selectedMemberIds.length > 0 && (
                     <div className="flex items-center gap-2 p-2 bg-black/5 rounded-lg text-[10px] text-black/50 font-medium">
                         <AlertCircle className="w-3 h-3" />
                         Creates {selectedMemberIds.length} separate tasks (one for each member).
                     </div>
                )}
            </div>

            {/* Task Type */}
            <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Category</label>
                <div className="flex flex-wrap gap-2">
                    {['study', 'bring', 'fix', 'prepare', 'other'].map(t => (
                        <button 
                            key={t}
                            onClick={() => setType(t as any)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all",
                                type === t ? "bg-black text-white border-black" : "bg-transparent border-black/10 text-black/40 hover:border-black/30"
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer Action */}
            <div className="pt-4 mt-4 border-t border-black/10">
                <button 
                    onClick={handleAdd}
                    disabled={!text || (assignMode !== 'all' && selectedMemberIds.length === 0)}
                    className="w-full py-4 bg-black text-white rounded-[10px] font-bold text-sm uppercase tracking-wider hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-4 h-4" /> {getButtonText()}
                </button>
            </div>
        </div>
    </RehearsalModalWrapper>
  );
};
