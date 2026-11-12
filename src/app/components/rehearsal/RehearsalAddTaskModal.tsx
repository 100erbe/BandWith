import React, { useState } from 'react';
import { Plus, AlertCircle } from '@/app/components/icons';
import { RehearsalMember, RehearsalSong, RehearsalTask } from './types';
import { cn } from '@/app/components/ui/utils';
import { BwSheet, PillButton, PillField, Selector } from '@/app/components/bw';
import { useT } from '@/lib/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: RehearsalMember[];
  songs: RehearsalSong[];
  onAdd: (task: RehearsalTask) => void;
}

export const RehearsalAddTaskModal: React.FC<Props> = ({ isOpen, onClose, members, songs, onAdd }) => {
  const t = useT();
  // Task categories as shown (the ids stay English).
  const categoryLabels: Record<string, string> = {
    study: t('study'), bring: t('bring'), fix: t('fix'), prepare: t('prepare'), other: t('other'),
  };
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
          return t('Create {count} Tasks', { count: selectedMemberIds.length });
      }
      return t('Add Task');
  };

  return (
    <BwSheet
      open={isOpen}
      onClose={onClose}
      overline={t('Rehearsal prep')}
      title={t('Add task')}
      zIndex={110}
      footer={
        <div className="dark">
          <PillButton
            onClick={handleAdd}
            disabled={!text || (assignMode !== 'all' && selectedMemberIds.length === 0)}
            icon={<Plus className="w-[18px] h-[18px]" />}
          >
            {getButtonText()}
          </PillButton>
        </div>
      }
    >
      <div className="dark flex flex-col gap-5">
        {/* Description */}
        <PillField
          tone="sheet"
          label={t('Task description')}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('e.g. Learn the bridge part')}
        />

        {/* Assignment */}
        <fieldset className="flex flex-col gap-2">
          <legend className="bw-label-sm text-sheet-foreground/70 mb-2">{t('Assign to')}</legend>
          <div role="tablist" aria-label={t('Assign to')} className="flex p-1 gap-1 rounded-full bg-white/[0.08]">
            {([
              ['all', t('Entire band')],
              ['single', t('One member')],
              ['multiple', t('Multiple')],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={assignMode === mode}
                onClick={() => {
                  setAssignMode(mode);
                  setSelectedMemberIds([]);
                }}
                className={cn(
                  'flex-1 h-9 px-2 rounded-full bw-button-sm transition-colors',
                  assignMode === mode ? 'bg-accent text-accent-foreground' : 'text-sheet-foreground/70'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {assignMode !== 'all' && (
            <div className="flex flex-col gap-2 pt-2">
              {members.map((m) => {
                const isSelected = selectedMemberIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleToggleMember(m.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-[16px] text-left transition-colors cursor-pointer',
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

          {assignMode === 'multiple' && selectedMemberIds.length > 0 && (
            <p className="flex items-center gap-2 bw-body-sm text-sheet-foreground/70">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {selectedMemberIds.length === 1
                ? t('Creates {count} separate task (one per member).', { count: selectedMemberIds.length })
                : t('Creates {count} separate tasks (one per member).', { count: selectedMemberIds.length })}
            </p>
          )}
        </fieldset>

        {/* Category */}
        <fieldset className="flex flex-col gap-2">
          <legend className="bw-label-sm text-sheet-foreground/70 mb-2">{t('Category')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['study', 'bring', 'fix', 'prepare', 'other'] as const).map((cat) => (
              <Selector key={cat} selected={type === cat} onClick={() => setType(cat)}>
                {categoryLabels[cat] ?? cat}
              </Selector>
            ))}
          </div>
        </fieldset>
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
