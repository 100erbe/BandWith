import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Users } from 'lucide-react';

interface IntentSelectorProps {
  onSelectSolo: () => void;
  onSelectBand: () => void;
  onBack: () => void;
}

export const IntentSelector: React.FC<IntentSelectorProps> = ({
  onSelectSolo,
  onSelectBand,
  onBack,
}) => {
  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-6 pt-14 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-[15px] font-medium"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-muted-foreground">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 justify-center -mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-2"
        >
          <p className="text-muted-foreground text-[13px] font-semibold uppercase tracking-widest mb-3">
            Step 2 of 5
          </p>
          <h1 className="text-[32px] font-black text-foreground leading-tight mb-3">
            What brings you here today?
          </h1>
          <p className="text-muted-foreground text-[15px] font-medium leading-relaxed max-w-[300px]">
            Choose how you want to use BandWith. You can always change this later.
          </p>
        </motion.div>

        {/* Card selection */}
        <motion.div
          className="space-y-3 mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          {/* Solo Card */}
          <button
            onClick={onSelectSolo}
            className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-[#D5FB46]/50 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#D5FB46]/10 flex items-center justify-center shrink-0 group-hover:bg-[#D5FB46]/20 transition-colors">
                <Calendar className="w-6 h-6 text-[#D5FB46]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[18px] font-bold text-foreground mb-1">
                  Organize My Schedule
                </h3>
                <p className="text-muted-foreground text-[14px] leading-relaxed">
                  Manage personal gigs, sync private rehearsals.{' '}
                  <span className="text-[#D5FB46] font-semibold">Free to use.</span>
                </p>
              </div>
            </div>
          </button>

          {/* Band Admin Card */}
          <button
            onClick={onSelectBand}
            className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-[#D5FB46]/50 active:scale-[0.98] transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#D5FB46]/10 flex items-center justify-center shrink-0 group-hover:bg-[#D5FB46]/20 transition-colors">
                <Users className="w-6 h-6 text-[#D5FB46]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[18px] font-bold text-foreground mb-1">
                  Manage My Band
                </h3>
                <p className="text-muted-foreground text-[14px] leading-relaxed">
                  Coordinate shared schedules, automate quotes, and track finances.
                </p>
              </div>
            </div>
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default IntentSelector;
