import React, { useEffect, useRef } from 'react';
import { motion, animate, useMotionValue, useTransform } from 'motion/react';
import { Trash2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';

const ACTION_W = 80;
const ACTION_GAP = 16;
/** How far the row slides: the action plus clear space before date/ticks. */
const REVEAL = ACTION_W + ACTION_GAP;

/** iOS-style row: swipe left to reveal Delete, tap elsewhere to close. */
export const SwipeRow: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  /** Accessible name of the Delete button ("Delete chat with Marta"). */
  deleteLabel: string;
  /** Background behind the row while it slides (the screen's own). */
  surfaceClassName?: string;
  children: React.ReactNode;
}> = ({ open, onOpenChange, onDelete, deleteLabel, surfaceClassName = 'bg-background', children }) => {
  const x = useMotionValue(0);
  // Hidden at rest so no red edge peeks out next to the row.
  const actionOpacity = useTransform(x, [-REVEAL, -6, 0], [1, 1, 0]);
  const dragged = useRef(false);

  useEffect(() => {
    const controls = animate(x, open ? -REVEAL : 0, { type: 'spring', stiffness: 520, damping: 42 });
    return () => controls.stop();
  }, [open, x]);

  return (
    <div className="relative overflow-hidden">
      <motion.button
        type="button"
        onClick={onDelete}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        aria-label={deleteLabel}
        className="absolute top-2 bottom-2 right-0 flex flex-col items-center justify-center gap-1 rounded-[20px] bg-destructive-solid text-white bw-label-xs active:scale-95 transition-transform"
        style={{ width: ACTION_W, opacity: actionOpacity }}
      >
        <Trash2 className="w-5 h-5" aria-hidden />
        Delete
      </motion.button>
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={{ left: 0.12, right: 0 }}
        style={{ x, touchAction: 'pan-y' }}
        onDragStart={() => { dragged.current = true; }}
        onDragEnd={(_, info) => {
          const next = open
            ? !(info.offset.x > REVEAL / 3 || info.velocity.x > 400)
            : info.offset.x < -REVEAL / 2 || info.velocity.x < -400;
          animate(x, next ? -REVEAL : 0, { type: 'spring', stiffness: 520, damping: 42 });
          if (next && !open) haptic.tap();
          onOpenChange(next);
          setTimeout(() => { dragged.current = false; }, 0);
        }}
        onClickCapture={(e) => {
          // A swipe is not a tap; a tap on an open row just closes it.
          if (dragged.current || open) {
            e.stopPropagation();
            e.preventDefault();
            if (!dragged.current) onOpenChange(false);
          }
        }}
        className={cn('relative', surfaceClassName)}
      >
        {children}
      </motion.div>
    </div>
  );
};
