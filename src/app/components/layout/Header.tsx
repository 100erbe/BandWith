import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Plus,
  Sparkles
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { Band } from '@/app/data/bands';
import { USER } from '@/app/data/user';
import { TabName } from '@/app/types';

interface HeaderProps {
  activeTab: TabName;
  selectedBand: Band;
  bands: Band[];
  onOpenBandSwitcher: () => void;
  filteredEventsCount: number;
  totalEventsCount: number;
  eventView: 'list' | 'calendar';
  setEventView: (view: 'list' | 'calendar') => void;
  onCreateEvent: () => void;
  onOpenIdentity: () => void;
  unreadCount: number;
  isHidden: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  selectedBand,
  bands,
  onOpenBandSwitcher,
  filteredEventsCount,
  totalEventsCount,
  eventView,
  setEventView,
  onCreateEvent,
  onOpenIdentity,
  unreadCount,
  isHidden
}) => {
  return (
    <motion.header 
      className="mb-8 relative z-50"
      animate={{ 
        opacity: isHidden ? 0 : 1, 
        y: isHidden ? -20 : 0 
      }}
      style={{ pointerEvents: isHidden ? 'none' : 'auto' }}
    >
      <div className="flex justify-between items-start">
        {/* Left: Dynamic Title based on Tab */}
        <div className="flex flex-col relative group">
          {activeTab === 'Chat' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">
              <h1 className="text-5xl font-black tracking-tighter leading-[0.9] text-[#1A1A1A] uppercase">Messages</h1>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">All caught up</span>
                <Sparkles className="w-3 h-3 text-[#D4FB46] fill-[#D4FB46]" />
              </div>
            </motion.div>
          ) : activeTab === 'Events' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">
              <h1 className="text-5xl font-black tracking-tighter leading-[0.9] text-[#1A1A1A] uppercase">Events</h1>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider mt-2">
                {filteredEventsCount} of {totalEventsCount} events
              </span>
            </motion.div>
          ) : (
            <>
              <motion.div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "w-2 h-2 rounded-full", 
                  selectedBand.role === 'ADMIN' ? "bg-[#D5FB46]" : "bg-[#FF0066]"
                )} />
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500 group-hover:text-black transition-colors">
                  {selectedBand.role}
                </span>
              </motion.div>

              <button 
                onClick={onOpenBandSwitcher}
                className="text-left outline-none"
              >
                <AnimatePresence mode="wait">
                  <motion.h1 
                    key={selectedBand.id}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                    className="text-5xl font-black tracking-tighter leading-[0.9] text-[#1A1A1A] uppercase max-w-[280px] hover:text-black/70"
                  >
                    {selectedBand.name}
                  </motion.h1>
                </AnimatePresence>
                
                <div className="flex items-center gap-2 mt-2 text-stone-400 group-hover:text-[#FF4F28] transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider">Switch Profile</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>
            </>
          )}
        </div>
        
        {/* Right: Actions / Identity */}
        <div className="flex items-center gap-3">
          {/* Removed redundant + button — use BottomNavigation + instead */}

          {/* Identity Trigger */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            onClick={onOpenIdentity}
            className="relative shrink-0 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-[1.2rem] bg-[#E6E5E1] flex items-center justify-center text-[#1A1A1A] font-bold text-lg border-2 border-white shadow-lg relative z-20">
              {USER.initials}
            </div>
            {/* Notification Badge */}
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#D4FB46] text-black text-[10px] font-black flex items-center justify-center border-2 border-[#E6E5E1] z-30 shadow-md"
                >
                  {unreadCount}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
};
