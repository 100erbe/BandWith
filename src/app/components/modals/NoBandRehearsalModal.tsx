import React from 'react';
import { IS_BETA } from '@/lib/beta';
import { motion, AnimatePresence } from 'motion/react';
import { RailCover } from '@/lib/railActions';
import { Users, Plus } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw';

interface NoBandRehearsalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpgrade: () => void;
}

/** Figma "Rehearsal / No band – modal" (27:551): centred canvas card over a dark scrim. */
export const NoBandRehearsalModal: React.FC<NoBandRehearsalModalProps> = ({
  isOpen,
  onClose,
  onOpenUpgrade,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* iPhone Duo: on the open display the dialog sits on the trailing pane;
          its scrim stops at the rail (Figma "Rehearsal / No band – modal"). */}
      <div className="bw-pane-detail fixed inset-0 z-[180]">
      <RailCover pane />
      <div className="relative h-full flex items-center justify-center p-6">
        {/* Scrim (clickable to close) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 z-0 bg-black/60 cursor-pointer"
        />

        {/* Modal card */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-band-rehearsal-title"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-[342px] bg-background text-foreground rounded-[24px] p-6 flex flex-col gap-4 select-none"
        >
          <span className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
            <Users className="w-6 h-6" />
          </span>

          <div className="flex flex-col gap-2">
            <h2 id="no-band-rehearsal-title" className="bw-h1 uppercase">
              Band required
            </h2>
            <p className="bw-body-md text-muted-foreground">
              Proposing a rehearsal is only available when you’re in a band. Create one or ask an admin for an invite.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-col gap-2">
              <PillButton
                onClick={() => {
                  onClose();
                  onOpenUpgrade();
                }}
                icon={<Plus className="w-[18px] h-[18px]" />}
              >
                Create a band
              </PillButton>
              <p className="bw-label-xs text-muted-foreground">
                {IS_BETA ? 'Free during the beta' : 'Requires a Pro subscription'}
              </p>
            </div>

            <PillButton variant="outline" onClick={onClose}>
              Maybe later
            </PillButton>
          </div>
        </motion.div>
      </div>
      </div>
    </AnimatePresence>
  );
};
