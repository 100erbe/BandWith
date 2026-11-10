import React, { useState, useEffect } from 'react';
import { Users, User, Check, Trash2 } from '@/app/components/icons';
import { BwSheet, PillButton, PillField, Selector, Tag } from '@/app/components/bw';
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
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline={isAssignedToAll ? 'Band task' : 'Assigned task'}
      title="Task details"
      zIndex={110}
      footer={
        readOnly ? undefined : (
          <div className="dark grid grid-cols-[2fr_3fr] gap-3">
            <PillButton variant="outline" onClick={handleDelete} icon={<Trash2 className="w-4 h-4" />}>
              Delete
            </PillButton>
            <PillButton onClick={handleSave} icon={<Check className="w-[18px] h-[18px]" />}>
              Save
            </PillButton>
          </div>
        )
      }
    >
      <div className="dark flex flex-col gap-5">
        {/* Status */}
        <div className="flex flex-wrap gap-1.5">
          <Tag variant="outline" icon={isAssignedToAll ? <Users /> : <User />}>
            {isAssignedToAll ? 'Band task' : 'Assigned'}
          </Tag>
          <Tag variant={editedTask.completed ? 'accent' : 'outline'}>{editedTask.completed ? 'Completed' : 'Open'}</Tag>
        </div>

        {/* Description */}
        {readOnly ? (
          <div className="flex flex-col gap-2">
            <span className="bw-label-sm text-sheet-foreground/70">Description</span>
            <p className="bw-h2">{editedTask.text}</p>
          </div>
        ) : (
          <PillField
            tone="sheet"
            label="Description"
            value={editedTask.text}
            onChange={(e) => setEditedTask({ ...editedTask, text: e.target.value })}
          />
        )}

        {/* Assigned To */}
        <section className="flex flex-col gap-2">
          <h3 className="bw-label-sm text-sheet-foreground/70">Assigned to</h3>
          {readOnly ? (
            <p className="bw-body-lg">{assignedNames || 'Unassigned'}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-pressed={isAssignedToAll}
                onClick={() => handleToggleMember('all')}
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-[16px] text-left transition-colors cursor-pointer',
                  isAssignedToAll ? 'bg-white/[0.08]' : 'bg-transparent'
                )}
              >
                <DotCheck checked={isAssignedToAll} />
                <span className="flex-1 bw-label-md">Entire band</span>
                <Users className="w-5 h-5 text-sheet-foreground/70" />
              </button>
              {members.map((m) => {
                const isSelected = editedTask.assignedTo.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleToggleMember(m.id)}
                    disabled={isAssignedToAll}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-[16px] text-left transition-[background-color,opacity] cursor-pointer disabled:opacity-40 disabled:cursor-default',
                      isSelected ? 'bg-white/[0.08]' : 'bg-transparent'
                    )}
                  >
                    <DotCheck checked={isSelected} />
                    <span className="w-7 h-7 rounded-full border border-sheet-foreground/40 bw-label-xs flex items-center justify-center shrink-0">
                      {m.initials}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-label-md truncate">{m.name}</span>
                      {m.role && <span className="bw-body-sm text-sheet-foreground/70 truncate">{m.role}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Category */}
        <section className="flex flex-col gap-2">
          <h3 className="bw-label-sm text-sheet-foreground/70">Category</h3>
          {readOnly ? (
            <p className="bw-body-lg capitalize">{editedTask.type}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(['study', 'bring', 'fix', 'prepare', 'other'] as const).map((t) => (
                <Selector key={t} selected={editedTask.type === t} onClick={() => setEditedTask({ ...editedTask, type: t })}>
                  {t}
                </Selector>
              ))}
            </div>
          )}
        </section>
      </div>
    </BwSheet>
  );
};

/** Figma "Control": 24pt dot-grid check — solid dots on, a dotted outline off. */
const DotCheck: React.FC<{ checked: boolean; className?: string }> = ({ checked, className }) => (
  <span aria-hidden className={cn('grid grid-cols-4 gap-[2.67px] w-6 h-6 shrink-0', className)}>
    {Array.from({ length: 16 }).map((_, i) => {
      const r = Math.floor(i / 4);
      const c = i % 4;
      const edge = r === 0 || r === 3 || c === 0 || c === 3;
      return (
        <span
          key={i}
          className={cn('w-1 h-1 rounded-full bg-current transition-opacity', !checked && (edge ? 'opacity-35' : 'opacity-0'))}
        />
      );
    })}
  </span>
);
