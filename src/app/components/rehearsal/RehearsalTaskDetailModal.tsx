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
      <div className="flex flex-col gap-10">
        {/* Status badges */}
        <div className="flex flex-wrap gap-1">
          <div className="px-2.5 py-1 bg-card rounded-full">
            <span className="text-xs font-bold uppercase text-accent-rehearsal flex items-center gap-1">
              {isAssignedToAll ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {isAssignedToAll ? 'BAND TASK' : 'ASSIGNED'}
            </span>
          </div>
          <div className={cn(
            "px-2.5 py-1 rounded-full",
            editedTask.completed ? "bg-card" : "bg-muted/20"
          )}>
            <span className={cn(
              "text-xs font-bold uppercase",
              editedTask.completed ? "text-accent-rehearsal" : "text-accent-foreground"
            )}>
              {editedTask.completed ? 'COMPLETED' : 'OPEN'}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-accent-foreground uppercase">DESCRIPTION</span>
          {readOnly ? (
            <span className="text-xl font-bold text-accent-foreground">{editedTask.text}</span>
          ) : (
            <input
              value={editedTask.text}
              onChange={(e) => setEditedTask({ ...editedTask, text: e.target.value })}
              className="bg-transparent border-b-2 border-border/30 py-2 text-xl font-bold text-accent-foreground placeholder:text-accent-foreground/30 focus:outline-none focus:border-border transition-all"
            />
          )}
        </div>

        {/* Assigned To */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold text-accent-foreground uppercase">ASSIGNED TO</span>
          {readOnly ? (
            <span className="text-xl font-bold text-accent-foreground">{assignedNames || 'Unassigned'}</span>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleToggleMember('all')}
                className={cn(
                  "w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-all",
                  isAssignedToAll
                    ? "bg-card text-accent-rehearsal"
                    : "bg-muted/20 text-accent-rehearsal"
                )}
              >
                <span>ENTIRE BAND</span>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2",
                  isAssignedToAll ? "bg-accent-rehearsal border-accent-rehearsal" : "border-border/50"
                )} />
              </button>

              <div className="grid grid-cols-2 gap-2">
                {members.map(m => {
                  const isSelected = editedTask.assignedTo.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleToggleMember(m.id)}
                      disabled={isAssignedToAll}
                      className={cn(
                        "px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all text-left",
                        isSelected ? "bg-card text-accent-rehearsal" : "bg-muted/20 text-accent-rehearsal",
                        isAssignedToAll && "opacity-40"
                      )}
                    >
                      <span>{m.name}</span>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2",
                        isSelected ? "bg-accent-rehearsal border-accent-rehearsal" : "border-border/50"
                      )} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold text-accent-foreground uppercase">CATEGORY</span>
          {readOnly ? (
            <span className="text-xl font-bold text-accent-foreground capitalize">{editedTask.type}</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {['study', 'bring', 'fix', 'prepare', 'other'].map(t => (
                <button
                  key={t}
                  onClick={() => setEditedTask({ ...editedTask, type: t as RehearsalTask['type'] })}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all",
                    editedTask.type === t
                      ? "bg-card text-accent-rehearsal"
                      : "bg-muted/20 text-accent-rehearsal"
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
        <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl px-4 pt-5 pb-8 z-[102]"
          style={{ backgroundColor: 'var(--accent-rehearsal)', boxShadow: '0px -4px 20px var(--dot-inactive)' }}
        >
          <div className="flex flex-col gap-5 items-center">
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <button
                onClick={handleDelete}
                className="rounded-xl py-4 flex items-center justify-center gap-2 bg-muted/20"
              >
                <span className="text-base font-bold text-accent-foreground uppercase">DELETE</span>
              </button>
              <button
                onClick={handleSave}
                className="rounded-xl py-4 flex items-center justify-center gap-2 bg-card"
              >
                <Plus className="w-4.5 h-4.5 text-accent-rehearsal" />
                <span className="text-base font-bold text-accent-rehearsal uppercase">SAVE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </RehearsalModalWrapper>
  );
};
