import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Sparkles } from 'lucide-react';
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
      className="bg-card rounded-[2rem] p-6 border border-border"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-foreground font-bold text-[16px]">
              Complete Your Setup
            </h3>
            <p className="text-muted-foreground text-[13px]">{progressPercent}% done</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-card/80 rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full bg-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Checklist Items */}
      <div className="space-y-3 mb-5">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <DotCheckbox
              checked={item.completed}
              activeColor="var(--accent)"
              inactiveColor="rgba(255,255,255,0.15)"
            />
            <span
              className={`text-[14px] ${
                item.completed
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground font-medium'
              }`}
            >
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onContinue}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground font-bold text-[14px]"
        >
          Continue Setup
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="w-full mt-3 text-center text-muted-foreground/60 text-[13px] py-2 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1"
      >
        <X className="w-3 h-3" />
        Dismiss
      </button>
    </motion.div>
  );
};

export default DashboardChecklist;
