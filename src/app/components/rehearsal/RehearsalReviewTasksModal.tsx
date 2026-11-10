import React from 'react';
import { CheckSquare, Users, User, CheckCircle2 } from '@/app/components/icons';
import { BwSheet, Tag } from '@/app/components/bw';
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
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}${completedCount > 0 ? ` · ${completedCount} done` : ''}`}
      title="Rehearsal tasks"
      zIndex={110}
    >
      <div className="dark flex flex-col gap-5">
        {/* Summary */}
        <div className="flex flex-wrap gap-1.5">
          <Tag variant="outline" icon={<CheckSquare />}>
            Total {tasks.length}
          </Tag>
          <Tag variant="outline" icon={<Users />}>
            Band {bandTasks.length}
          </Tag>
          <Tag variant="outline" icon={<User />}>
            Assigned {assignedTasks.length}
          </Tag>
          {completedCount > 0 && (
            <Tag variant="accent" icon={<CheckCircle2 />}>
              Done {completedCount}
            </Tag>
          )}
        </div>

        {/* Band tasks */}
        <section className="flex flex-col gap-2">
          <h4 className="bw-label-sm text-sheet-foreground/70">Band tasks ({bandTasks.length})</h4>
          {bandTasks.length === 0 ? (
            <EmptyNote>No band tasks</EmptyNote>
          ) : (
            bandTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-4 rounded-[16px] bg-white/[0.08]">
                <DotCheck checked={task.completed} className={task.completed ? undefined : 'text-sheet-foreground/70'} />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5 items-start">
                  <span className={cn('bw-body-lg', task.completed && 'line-through text-sheet-foreground/60')}>{task.text}</span>
                  <Tag variant="outline">{task.type}</Tag>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Assigned tasks */}
        <section className="flex flex-col gap-2">
          <h4 className="bw-label-sm text-sheet-foreground/70">Assigned tasks ({assignedTasks.length})</h4>
          {assignedTasks.length === 0 ? (
            <EmptyNote>No assigned tasks</EmptyNote>
          ) : (
            assignedTasks.map(task => {
              const assignee = members.find(m => Array.isArray(task.assignedTo) ? task.assignedTo.includes(m.id) : m.id === task.assignedTo);
              return (
                <div key={task.id} className="flex items-center gap-3 p-4 rounded-[16px] bg-white/[0.08]">
                  <span className="w-7 h-7 rounded-full border border-sheet-foreground/40 bw-label-xs flex items-center justify-center shrink-0">
                    {assignee?.initials || '?'}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="bw-label-sm text-sheet-foreground/60 truncate">{assignee?.name || 'Unassigned'}</span>
                    <span className={cn('bw-body-lg', task.completed && 'line-through text-sheet-foreground/60')}>{task.text}</span>
                  </div>
                  {task.completed && <CheckCircle2 className="w-5 h-5 text-accent shrink-0" aria-label="Done" />}
                </div>
              );
            })
          )}
        </section>
      </div>
    </BwSheet>
  );
};

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="p-4 rounded-[16px] border-[1.5px] border-dashed border-sheet-foreground/25 bw-body-sm text-sheet-foreground/60 text-center">
    {children}
  </p>
);

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
