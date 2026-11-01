import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Plus,
  Sparkles,
  Bell
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
  onOpenNotifications?: () => void;
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
  onOpenNotifications,
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
                <span className="text-xs font-bold text-[var(--muted-fg)] uppercase tracking-wider">All caught up</span>
                <Sparkles className="w-3 h-3 text-accent fill-accent" />
              </div>
            </motion.div>
          ) : activeTab === 'Events' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">
              <h1 className="text-5xl font-black tracking-tighter leading-[0.9] text-foreground uppercase">Events</h1>
              <span className="text-xs font-bold text-[var(--muted-fg)] uppercase tracking-wider mt-2">
                {filteredEventsCount} of {totalEventsCount} events
              </span>
            </motion.div>
          ) : (
            <>
              <motion.div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "w-2 h-2 rounded-full", 
                  selectedBand.role === 'ADMIN' ? "bg-accent" : "bg-[var(--warning)]"
                )} />
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500 group-hover:text-foreground transition-colors">
                  {selectedBand.role}
                </span>
              </motion.div>

              {/* Band name — clickable only for admins to switch bands */}
              {profile?.role === 'admin' ? (
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
                  
                  <div className="flex items-center gap-1.5 mt-2 text-foreground/50 group-hover:text-foreground transition-colors">
                    <span className="text-xs font-bold uppercase tracking-wider">Change Band</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                  </div>
                </button>
              ) : (
                <div className="text-left">
                  <AnimatePresence mode="wait">
                    <motion.h1 
                      key={selectedBand.id}
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -15, opacity: 0 }}
                      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                      className="text-5xl font-black tracking-tighter leading-[0.9] text-foreground uppercase max-w-[280px]"
                    >
                      {selectedBand.name}
                    </motion.h1>
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Right: Actions / Identity */}
        <div className="flex items-center gap-2.5">
          {/* Bell / Notifications */}
          <motion.button 
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={onOpenNotifications}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            className="relative shrink-0 w-11 h-11 rounded-[14px] bg-card border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/5 text-foreground flex items-center justify-center transition-colors shadow-2xs focus:outline-none"
          >
            <Bell className="w-5 h-5 text-foreground" />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-black flex items-center justify-center border-2 border-background z-30 shadow-xs"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Identity Trigger */}
          <motion.button 
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={onOpenIdentity}
            aria-label="Open Identity and Account Hub"
            className="relative shrink-0 w-11 h-11 rounded-[14px] bg-card border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/5 text-foreground flex items-center justify-center font-bold text-sm tracking-wide transition-colors shadow-2xs focus:outline-none overflow-hidden"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
};
