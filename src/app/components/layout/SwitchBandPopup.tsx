import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, ArrowUpRight } from 'lucide-react';
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

const TOTAL_SLOTS = 12;
const COLUMNS = 6;

const MemberPills: React.FC<{ count: number; accentColor: string }> = ({ count, accentColor }) => {
  const capped = Math.min(count, TOTAL_SLOTS);
  return (
    <div className="grid grid-cols-6 gap-1 w-full">
      {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
        <div
          key={i}
          className="h-[15px] rounded-[10px]"
          style={{ backgroundColor: i < capped ? accentColor : 'rgba(255,255,255,0.2)' }}
        />
      ))}
    </div>
  );
};

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
            className="fixed bottom-0 left-0 right-0 z-[71] bg-black rounded-t-[26px] px-4 pt-4 pb-[60px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
            style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Pill handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>

            {/* Header */}
            <div className="flex items-end justify-between mb-8">
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider"
                 style={{ fontFamily: "'neue-haas-grotesk-display', sans-serif" }}>
                YOUR BANDS
              </p>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bands list */}
            <div className="flex flex-col gap-10 mb-10">
              {bands.map((band) => {
                const isActive = selectedBand.id === band.id;
                const isAdmin = band.role === 'ADMIN';
                const accentColor = isAdmin ? '#D5FB46' : '#FF0066';

                return (
                  <motion.button
                    key={band.id}
                    onClick={() => {
                      onSelectBand(band);
                      onClose();
                    }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left flex flex-col gap-2"
                  >
                    {/* Role + Active badge row */}
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-bold uppercase"
                          style={{
                            fontFamily: "'neue-haas-grotesk-display', sans-serif",
                            color: accentColor,
                          }}
                        >
                          {band.role}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      </div>
                      {isActive && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-[#00FF59]"
                                style={{ fontFamily: "'neue-haas-grotesk-display', sans-serif" }}>
                            ACTIVE
                          </span>
                          <div className="w-2.5 h-2.5 rounded-full bg-[#00FF59]" />
                        </div>
                      )}
                    </div>

                    {/* Band name */}
                    <h3
                      className="text-[22px] font-bold text-white uppercase leading-tight"
                      style={{ fontFamily: "'neue-haas-grotesk-display', sans-serif" }}
                    >
                      {band.name}
                    </h3>

                    {/* Member pills */}
                    <MemberPills count={band.members} accentColor={accentColor} />
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
              className="w-full py-[18px] px-1.5 border-2 border-dashed border-white/20 rounded-[10px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Plus className="w-3.5 h-3.5 text-white/50" />
              <span
                className="text-base font-medium text-white/50 uppercase"
                style={{ fontFamily: "'neue-haas-grotesk-display', sans-serif" }}
              >
                ADD NEW BAND
              </span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
