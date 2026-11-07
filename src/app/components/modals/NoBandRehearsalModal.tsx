import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Music, Plus } from '@/app/components/icons';

interface NoBandRehearsalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpgrade: () => void;
}

export const NoBandRehearsalModal: React.FC<NoBandRehearsalModalProps> = ({
  isOpen,
  onClose,
  onOpenUpgrade,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop (clickable to close) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-sm bg-background border border-foreground/15 rounded-3xl shadow-2xl p-6 text-center select-none"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full border border-border bg-card/80 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/30 text-[var(--accent-rehearsal)] flex items-center justify-center mx-auto mb-4">
            <Music className="w-7 h-7" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight mb-2">
            Band Required
          </h2>

          {/* Description */}
          <p className="text-xs font-medium text-muted-foreground leading-relaxed mb-6">
            Proposing a rehearsal is only available when you are in a band. Create your own band or accept an invite to coordinate dates, poll bandmates, and plan rehearsals together.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUpgrade();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-[var(--accent-rehearsal)] text-[var(--accent-rehearsal-fg)] hover:opacity-95 active:scale-[0.98] transition-all shadow-md flex flex-col items-center justify-center cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                <Plus className="w-4 h-4 shrink-0" />
                <span>Create a Band</span>
              </div>
              <span className="text-[10px] font-semibold text-[var(--accent-rehearsal-fg)]/80 mt-0.5 tracking-wide">
                Requires a Pro Subscription
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
