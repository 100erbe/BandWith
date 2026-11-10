import React from 'react';
import { motion } from 'motion/react';
import { X, ArrowUpRight } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotMeter } from '@/app/components/bw/Metric';
import { Tag } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import { useOnboarding } from '@/lib/OnboardingContext';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

interface DashboardChecklistProps {
  onContinue?: () => void;
  onDismiss?: () => void;
}

export const DashboardChecklist: React.FC<DashboardChecklistProps> = ({
  onContinue,
  onDismiss,
}) => {
  const { checklistDismissed, dismissChecklist, bandData, invites, songs } =
    useOnboarding();

  // Don't render if dismissed
  if (checklistDismissed) return null;

  // Checklist items
  const items: ChecklistItem[] = [
    {
      id: 'band',
      label: 'Create band',
      completed: !!bandData?.name,
    },
    {
      id: 'songs',
      label: 'Add your first songs',
      completed: songs.length > 0,
    },
    {
      id: 'invite',
      label: 'Invite members',
      completed: invites.length > 0,
    },
    {
      id: 'setlist',
      label: 'Create your first setlist',
      completed: false, // Would check actual setlist data
    },
    {
      id: 'gig',
      label: 'Schedule your first gig',
      completed: false, // Would check actual events data
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  const handleDismiss = () => {
    dismissChecklist();
    onDismiss?.();
  };

  return (
    <motion.div
      className="bg-card text-card-foreground rounded-[24px] p-4 flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Header (Figma Card: overline + H3, count on the right) */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <p className="bw-label-sm text-muted-foreground">Setup · {progressPercent}% done</p>
          <h3 className="bw-h3 text-foreground">Complete your setup</h3>
        </div>
        <Tag variant="accent">
          {completedCount}/{items.length}
        </Tag>
      </div>

      {/* Progress as a dot meter */}
      <DotMeter value={completedCount / items.length} rows={1} cols={12} />

      {/* Checklist Items */}
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => (
          <motion.li
            key={item.id}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <DotCheckbox checked={item.completed} activeColor="var(--accent)" inactiveColor="var(--dot-off)" />
            <span
              className={cn(
                'bw-body-md',
                item.completed ? 'text-muted-foreground line-through' : 'text-foreground font-medium',
              )}
            >
              {item.label}
            </span>
          </motion.li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex flex-col gap-1">
        <PillButton size="md" onClick={onContinue} trailingIcon={<ArrowUpRight className="w-4 h-4" />}>
          Continue setup
        </PillButton>
        <PillButton size="sm" variant="ghost" onClick={handleDismiss} icon={<X className="w-3.5 h-3.5" />} className="text-muted-foreground">
          Dismiss
        </PillButton>
      </div>
    </motion.div>
  );
};

export default DashboardChecklist;
