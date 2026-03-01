import React, { useState, useEffect } from 'react';
import { RehearsalModalWrapper } from './RehearsalModalWrapper';
import { CheckSquare, Users, User, Plus, MessageCircle } from 'lucide-react';
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
      newAssigned = isAssignedToAll ? [] : ['all'];
    } else {
      if (isAssignedToAll) {
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

  const assignedNames = isAssignedToAll
    ? 'Entire Band'
    : editedTask.assignedTo.map(id => members.find(m => m.id === id)?.name).filter(Boolean).join(', ');

  return (
    <RehearsalModalWrapper isOpen={isOpen} onClose={onClose} title="Task Details">
      <div className="flex flex-col gap-[40px]">
        {/* Status badges */}
        <div className="flex flex-wrap gap-[4px]">
          <div className="px-[10px] py-[4px] bg-white rounded-[6px]">
            <span className="text-[12px] font-bold uppercase text-[#0147FF] flex items-center gap-[4px]">
              {isAssignedToAll ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {isAssignedToAll ? 'BAND TASK' : 'ASSIGNED'}
            </span>
          </div>
          <div className={cn(
            "px-[10px] py-[4px] rounded-[6px]",
            editedTask.completed ? "bg-white" : "bg-white/20"
          )}>
            <span className={cn(
              "text-[12px] font-bold uppercase",
              editedTask.completed ? "text-[#0147FF]" : "text-white"
            )}>
              {editedTask.completed ? 'COMPLETED' : 'OPEN'}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-[8px]">
          <span className="text-[12px] font-bold text-white uppercase">DESCRIPTION</span>
          {readOnly ? (
            <span className="text-[22px] font-bold text-white">{editedTask.text}</span>
          ) : (
            <input
              value={editedTask.text}
              onChange={(e) => setEditedTask({ ...editedTask, text: e.target.value })}
              className="bg-transparent border-b-2 border-white/30 py-[8px] text-[22px] font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-all"
            />
          )}
        </div>

        {/* Assigned To */}
        <div className="flex flex-col gap-[12px]">
          <span className="text-[12px] font-bold text-white uppercase">ASSIGNED TO</span>
          {readOnly ? (
            <span className="text-[22px] font-bold text-white">{assignedNames || 'Unassigned'}</span>
          ) : (
            <div className="flex flex-col gap-[8px]">
              <button
                onClick={() => handleToggleMember('all')}
                className={cn(
                  "w-full px-[16px] py-[12px] rounded-[10px] text-[14px] font-bold flex items-center justify-between transition-all",
                  isAssignedToAll
                    ? "bg-white text-[#0147FF]"
                    : "bg-white/20 text-white"
                )}
              >
                <span>ENTIRE BAND</span>
                <div className={cn(
                  "w-[20px] h-[20px] rounded-full border-2",
                  isAssignedToAll ? "bg-[#0147FF] border-[#0147FF]" : "border-white/50"
                )} />
              </button>

              <div className="grid grid-cols-2 gap-[8px]">
                {members.map(m => {
                  const isSelected = editedTask.assignedTo.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleToggleMember(m.id)}
                      disabled={isAssignedToAll}
                      className={cn(
                        "px-[12px] py-[10px] rounded-[10px] text-[12px] font-bold flex items-center justify-between transition-all text-left",
                        isSelected ? "bg-white text-[#0147FF]" : "bg-white/20 text-white",
                        isAssignedToAll && "opacity-40"
                      )}
                    >
                      <span>{m.name}</span>
                      <div className={cn(
                        "w-[16px] h-[16px] rounded-full border-2",
                        isSelected ? "bg-[#0147FF] border-[#0147FF]" : "border-white/50"
                      )} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-col gap-[12px]">
          <span className="text-[12px] font-bold text-white uppercase">CATEGORY</span>
          {readOnly ? (
            <span className="text-[22px] font-bold text-white capitalize">{editedTask.type}</span>
          ) : (
            <div className="flex flex-wrap gap-[8px]">
              {['study', 'bring', 'fix', 'prepare', 'other'].map(t => (
                <button
                  key={t}
                  onClick={() => setEditedTask({ ...editedTask, type: t as RehearsalTask['type'] })}
                  className={cn(
                    "px-[16px] py-[8px] rounded-[10px] text-[12px] font-bold uppercase transition-all",
                    editedTask.type === t
                      ? "bg-white text-[#0147FF]"
                      : "bg-white/20 text-white"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!readOnly && (
        <div className="fixed bottom-0 left-0 right-0 rounded-t-[26px] px-[16px] pt-[20px] pb-[30px] z-[102]"
          style={{ backgroundColor: '#0147FF', boxShadow: '0px -4px 20px rgba(0,0,0,0.15)' }}
        >
          <div className="flex flex-col gap-[20px] items-center">
            <div className="grid grid-cols-2 gap-[10px] w-full">
              <button
                onClick={handleDelete}
                className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-white/20"
              >
                <span className="text-[16px] font-bold text-white uppercase">DELETE</span>
              </button>
              <button
                onClick={handleSave}
                className="rounded-[10px] py-[16px] flex items-center justify-center gap-[8px] bg-white"
              >
                <Plus className="w-[18px] h-[18px] text-[#0147FF]" />
                <span className="text-[16px] font-bold text-[#0147FF] uppercase">SAVE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </RehearsalModalWrapper>
  );
};
