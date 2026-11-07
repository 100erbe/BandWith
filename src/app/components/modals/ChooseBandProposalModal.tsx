import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Music } from '@/app/components/icons';

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

export const ChooseBandProposalModal: React.FC<ChooseBandProposalModalProps> = ({
  isOpen,
  onClose,
  bands,
  onSelectBand,
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
          className="relative z-10 w-full max-w-md bg-background border border-foreground/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-foreground/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/30 text-[var(--accent-rehearsal)] flex items-center justify-center shrink-0">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground uppercase tracking-tight leading-tight">
                  Choose Band
                </h2>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Select band for rehearsal proposal
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List of Bands */}
          <div className="p-6 overflow-y-auto flex flex-col gap-2.5">
            {bands.map((band) => {
              const initials = band.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => onSelectBand(band)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/80 hover:border-[var(--accent-rehearsal)] hover:bg-muted/50 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-foreground/10 border border-foreground/15 flex items-center justify-center font-black text-xs text-foreground shrink-0 group-hover:scale-105 transition-transform">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black uppercase text-foreground truncate">
                        {band.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {band.user_role && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {band.user_role}
                          </span>
                        )}
                        {band.member_count != null && (
                          <span className="text-[10px] text-muted-foreground/60">
                            • {band.member_count} members
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[var(--accent-rehearsal)] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
