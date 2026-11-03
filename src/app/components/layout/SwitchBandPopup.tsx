import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, ArrowUpRight } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Band } from '@/app/data/bands';

interface SwitchBandPopupProps {
  isOpen: boolean;
  onClose: () => void;
  bands: Band[];
  selectedBand: Band;
  onSelectBand: (band: Band) => void;
  onAddNewBand: () => void;
}

export const SwitchBandPopup: React.FC<SwitchBandPopupProps> = ({
  isOpen,
  onClose,
  bands,
  selectedBand,
  onSelectBand,
  onAddNewBand,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[10px]"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-[71] bg-background text-foreground border-t border-foreground/10 rounded-t-[26px] px-4 pt-4 shadow-[0px_-4px_24px_rgba(0,0,0,0.15)]"
            style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Pill handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-end justify-between mb-6">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">
                  SELECT BAND
                </span>
                <h2 className="text-[24px] font-bold text-foreground uppercase leading-none">
                  YOUR BANDS
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full border border-foreground/20 flex items-center justify-center text-foreground hover:bg-foreground/10 active:scale-90 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bands list */}
            <div className="flex flex-col gap-3 mb-6 max-h-[50vh] overflow-y-auto">
              {bands.map((band) => {
                const isActive = selectedBand.id === band.id;
                const isAdmin = band.role === 'ADMIN';
                const accentColor = isAdmin ? 'var(--primary)' : 'var(--warning)';

                return (
                  <motion.button
                    key={band.id}
                    onClick={() => {
                      onSelectBand(band);
                      onClose();
                    }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "w-full text-left p-3.5 rounded-[14px] border transition-all flex flex-col gap-1.5",
                      isActive
                        ? "bg-card border-foreground/20 shadow-xs"
                        : "bg-transparent border-transparent hover:bg-foreground/5"
                    )}
                  >
                    {/* Role + Active badge row */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: accentColor }}
                        >
                          {band.role}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      </div>
                      {isActive && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
                          <span className="text-[10px] font-bold uppercase text-[var(--success)]">
                            ACTIVE
                          </span>
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                        </div>
                      )}
                    </div>

                    {/* Band name */}
                    <h3 className="text-[20px] font-bold text-foreground uppercase leading-tight truncate">
                      {band.name}
                    </h3>

                    {/* Member count */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                      <span>{band.members} {band.members === 1 ? 'member' : 'members'}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Add New Band */}
            <button
              onClick={() => {
                onAddNewBand();
                onClose();
              }}
              className="w-full py-3.5 px-3 border border-dashed border-foreground/25 hover:border-foreground/50 rounded-[12px] bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center gap-2 text-foreground/70 hover:text-foreground active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                CREATE OR JOIN BAND
              </span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
