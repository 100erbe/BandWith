import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Plus,
  Sparkles
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { Band } from '@/app/data/bands';
import { TabName } from '@/app/types';
import { useAuth } from '@/lib/AuthContext';

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
  const { profile } = useAuth();
  
  // Calculate initials from actual profile or fallback
  const getInitials = () => {
    if (profile?.full_name) {
      const parts = profile.full_name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return profile.full_name.substring(0, 2).toUpperCase();
    }
    
    if (profile?.email) {
      return profile.email.substring(0, 2).toUpperCase();
    }
    
    return 'GB'; // ultimate fallback
  };

  const initials = getInitials();

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
              <h1 className="text-5xl font-black tracking-tighter leading-[0.9] text-foreground uppercase">Messages</h1>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">All caught up</span>
                <Sparkles className="w-3 h-3 text-accent fill-accent" />
              </div>
            </motion.div>
          ) : activeTab === 'Events' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">
              <h1 className="text-5xl font-black tracking-tighter leading-[0.9] text-foreground uppercase">Events</h1>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider mt-2">
                {filteredEventsCount} of {totalEventsCount} events
              </span>
            </motion.div>
          ) : (
            <>
              <motion.div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "w-2 h-2 rounded-full", 
                  selectedBand.role === 'ADMIN' ? "bg-accent" : "bg-[#FF0066]"
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
                    className="text-5xl font-black tracking-tighter leading-[0.9] text-foreground uppercase max-w-[280px] hover:text-foreground/70"
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
            <div className="w-14 h-14 rounded-[1.2rem] bg-background flex items-center justify-center text-foreground font-bold text-lg border-2 border-white shadow-lg relative z-20">
              {initials}
            </div>
            {/* Notification Badge */}
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent text-accent-foreground text-[10px] font-black flex items-center justify-center border-2 border-[#E6E5E1] z-30 shadow-md"
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
