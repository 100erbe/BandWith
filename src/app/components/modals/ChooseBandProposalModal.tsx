import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RailCover } from '@/lib/railActions';
import { X, Users } from '@/app/components/icons';
import { IconButton, ListRow, PillButton } from '@/app/components/bw';

export interface BandOption {
  id: string;
  name: string;
  member_count?: number;
  user_role?: string;
  plan?: string;
}

interface ChooseBandProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  bands: BandOption[];
  onSelectBand: (band: BandOption) => void;
}

/**
 * Figma "Rehearsal / No band – modal" dialog: canvas card (radius 24), lime
 * icon disc, H1 title, Body/MD copy, then the choices and an outline CTA.
 */
export const ChooseBandProposalModal: React.FC<ChooseBandProposalModalProps> = ({
  isOpen,
  onClose,
  bands,
  onSelectBand,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* iPhone Duo: on the open display the dialog sits on the trailing pane;
          its scrim stops at the rail (Figma "Rehearsal / No band – modal"). */}
      <div className="bw-pane-detail fixed inset-0 z-[180]">
      <RailCover pane />
      <div className="relative h-full flex items-center justify-center p-4">
        {/* Backdrop (clickable to close) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 z-0 bg-black/60 cursor-pointer"
        />

        {/* Dialog card */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="choose-band-title"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-md bg-background text-foreground rounded-[24px] shadow-2xl flex flex-col max-h-[85vh] select-none"
        >
          <div className="p-6 pb-4 flex flex-col gap-4 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <span className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </span>
              <IconButton label="Close" icon={<X />} size="sm" onClick={onClose} />
            </div>
            <div className="flex flex-col gap-2">
              <h2 id="choose-band-title" className="bw-h1">
                Choose band
              </h2>
              <p className="bw-body-md text-muted-foreground">
                Pick the band this rehearsal proposal is for.
              </p>
            </div>
          </div>

          {/* List of Bands */}
          <div className="px-6 overflow-y-auto flex flex-col gap-2">
            {bands.map((band) => {
              const initials = band.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const meta = [
                band.user_role,
                band.member_count != null
                  ? `${band.member_count} ${band.member_count === 1 ? 'member' : 'members'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <ListRow
                  key={band.id}
                  onClick={() => onSelectBand(band)}
                  icon={<span className="bw-label-sm text-foreground">{initials}</span>}
                  title={band.name}
                  subtitle={meta || undefined}
                />
              );
            })}
          </div>

          <div className="p-6 pt-4 shrink-0">
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
