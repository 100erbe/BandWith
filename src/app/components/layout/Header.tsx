import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Sparkles,
  Bell
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Band } from '@/app/data/bands';
import { TabName } from '@/app/types';
import { useAuth } from '@/lib/AuthContext';
import { Capacitor } from '@capacitor/core';

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
  isScrolled?: boolean;
}

/* Critically-damped spring: silky iOS-grade deceleration, zero bounce/overshoot */
const HEADER_SPRING = {
  type: 'spring' as const,
  stiffness: 240,
  damping: 28,
  mass: 0.85,
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  selectedBand,
  bands,
  onOpenBandSwitcher,
  filteredEventsCount,
  totalEventsCount,
  onOpenIdentity,
  onOpenNotifications,
  unreadCount,
  isHidden,
  isScrolled = false,
}) => {
  const { profile } = useAuth();
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const isAndroid = typeof window !== 'undefined' && (Capacitor.getPlatform() === 'android' || /Android/i.test(navigator.userAgent));
  
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

  // 3D Welcome Flip: Initials -> Photo once when HomeView opens; flips back and forth on hover
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (activeTab === 'Home' && profile?.avatar_url) {
      setIsFlipped(false);
      const timer = setTimeout(() => {
        setIsFlipped(true);
      }, 1100);
      return () => clearTimeout(timer);
    } else if (profile?.avatar_url) {
      setIsFlipped(true);
    }
  }, [activeTab, profile?.avatar_url]);

  const targetRotation = (() => {
    if (!profile?.avatar_url) return 0;
    const showPicture = isFlipped ? !isHovered : isHovered;
    return showPicture ? 180 : 0;
  })();

  const isAdminRole = selectedBand.role === 'ADMIN' || profile?.role === 'admin';
  const canSwitchBands = bands.length > 1 || isAdminRole;

  const expandedContentHeight = (activeTab === 'Chat' || activeTab === 'Events') ? 72 : 92;
  const collapsedContentHeight = 54;

  return (
    <motion.header 
      className={cn(
        "sticky top-0 z-40 -mx-4 px-4 select-none transition-[background-color,border-color,box-shadow] duration-300",
        isScrolled 
          ? "bg-background/95 backdrop-blur-xl border-b border-foreground/10 shadow-2xs" 
          : "bg-background/80 backdrop-blur-md border-b border-transparent"
      )}
      animate={{ 
        opacity: isHidden ? 0 : 1, 
        y: isHidden ? -20 : 0 
      }}
      transition={HEADER_SPRING}
      style={{ 
        paddingTop: 'var(--safe-padding-top, 16px)',
        paddingBottom: '12px',
        marginBottom: '16px',
        pointerEvents: isHidden ? 'none' : 'auto',
        overflowAnchor: 'none',
      }}
    >
      <motion.div
        initial={false}
        animate={{
          height: isScrolled ? collapsedContentHeight : expandedContentHeight,
        }}
        transition={HEADER_SPRING}
        className="relative w-full overflow-hidden"
      >
          {/* ═══ LEFT: Single Unified Morphing Title Lockup (Zero duplicate DOM nodes) ═══ */}
          {activeTab === 'Chat' ? (
            <div className="flex flex-col pr-[104px]">
              <motion.h1
                initial={false}
                animate={{
                  scale: isScrolled ? 0.52 : 1,
                  y: isScrolled ? 5 : 2,
                }}
                transition={HEADER_SPRING}
                className="text-[40px] sm:text-[44px] font-black tracking-tighter leading-[0.9] text-foreground uppercase origin-top-left"
              >
                Messages
              </motion.h1>
              <motion.div
                initial={false}
                animate={{
                  y: isScrolled ? -10 : 8,
                  scale: isScrolled ? 0.9 : 1,
                  opacity: isScrolled ? 0.85 : 1,
                }}
                transition={HEADER_SPRING}
                className="flex items-center gap-1.5 origin-top-left"
              >
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider leading-none">
                  All caught up
                </span>
                <Sparkles className="w-3 h-3 text-primary fill-primary shrink-0" />
              </motion.div>
            </div>
          ) : activeTab === 'Events' ? (
            <div className="flex flex-col pr-[104px]">
              <motion.h1
                initial={false}
                animate={{
                  scale: isScrolled ? 0.52 : 1,
                  y: isScrolled ? 5 : 2,
                }}
                transition={HEADER_SPRING}
                className="text-[40px] sm:text-[44px] font-black tracking-tighter leading-[0.9] text-foreground uppercase origin-top-left"
              >
                Events
              </motion.h1>
              <motion.span
                initial={false}
                animate={{
                  y: isScrolled ? -10 : 8,
                  scale: isScrolled ? 0.9 : 1,
                  opacity: isScrolled ? 0.85 : 1,
                }}
                transition={HEADER_SPRING}
                className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider leading-none origin-top-left"
              >
                {filteredEventsCount} of {totalEventsCount} events
              </motion.span>
            </div>
          ) : (
            <div className="flex flex-col pr-[104px]">
              {/* Role Kicker */}
              <motion.div
                initial={false}
                animate={{
                  y: isScrolled ? 4 : 0,
                  scale: isScrolled ? 0.9 : 1,
                }}
                transition={HEADER_SPRING}
                className="flex items-center gap-1.5 h-[14px] origin-top-left"
              >
                <div className={cn(
                  "w-2 h-2 rounded-full shrink-0", 
                  selectedBand.role === 'ADMIN' ? "bg-primary" : "bg-[var(--accent-rehearsal)]"
                )} />
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
                  {selectedBand.role}
                </span>
              </motion.div>

              {/* Band Title + Switcher */}
              {canSwitchBands ? (
                <button 
                  type="button"
                  onClick={onOpenBandSwitcher}
                  className="text-left outline-none group cursor-pointer flex flex-col"
                >
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isScrolled ? 0.52 : 1,
                      y: isScrolled ? 6 : 5,
                    }}
                    transition={HEADER_SPRING}
                    className="flex items-center gap-2 origin-top-left"
                  >
                    <h1 className="text-[40px] sm:text-[44px] font-black tracking-tighter leading-[0.9] text-foreground uppercase truncate max-w-[260px] group-hover:text-foreground/75 transition-colors">
                      {selectedBand.name}
                    </h1>
                    <motion.div
                      initial={false}
                      animate={{
                        opacity: isScrolled ? 1 : 0,
                        scale: isScrolled ? 1.6 : 0.8,
                      }}
                      transition={HEADER_SPRING}
                      className="text-muted-foreground shrink-0"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </motion.div>

                  <motion.div
                    initial={false}
                    animate={{
                      y: isScrolled ? -14 : 11,
                      opacity: isScrolled ? 0 : 1,
                    }}
                    transition={HEADER_SPRING}
                    style={{ pointerEvents: isScrolled ? 'none' : 'auto' }}
                    className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors origin-top-left"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider leading-none">Change Band</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                  </motion.div>
                </button>
              ) : (
                <motion.h1
                  initial={false}
                  animate={{
                    scale: isScrolled ? 0.52 : 1,
                    y: isScrolled ? 6 : 5,
                  }}
                  transition={HEADER_SPRING}
                  className="text-[40px] sm:text-[44px] font-black tracking-tighter leading-[0.9] text-foreground uppercase truncate max-w-[260px] origin-top-left"
                >
                  {selectedBand.name}
                </motion.h1>
              )}
            </div>
          )}

          {/* ═══ RIGHT: Stationary Bell & Identity Actions (Pinned at top-right, 0px vertical shift) ═══ */}
          <div className="absolute top-[3px] right-0 flex items-center gap-2.5 z-20">
            {/* Bell / Notifications */}
            <motion.button 
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onOpenNotifications}
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              className="relative shrink-0 p-2 text-foreground/80 hover:text-foreground flex items-center justify-center transition-colors focus:outline-none cursor-pointer"
            >
              <Bell className="w-6 h-6 text-foreground" />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center border-2 border-background z-30 shadow-xs"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Identity Trigger with 3D Welcome Flip */}
            <motion.button 
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={onOpenIdentity}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              aria-label="Open Identity and Account Hub"
              className="relative shrink-0 w-11 h-11 rounded-[14px] bg-card border border-foreground/10 hover:border-foreground/20 hover:bg-foreground/5 text-foreground flex items-center justify-center font-bold text-sm tracking-wide transition-colors shadow-2xs focus:outline-none overflow-hidden cursor-pointer"
            >
              {profile?.avatar_url ? (
                <div 
                  className="w-full h-full relative" 
                  style={{ perspective: 600 }}
                >
                  <motion.div
                    className="w-full h-full relative"
                    style={{ transformStyle: 'preserve-3d' }}
                    animate={{ rotateY: targetRotation }}
                    transition={{ duration: 0.65, ease: [0.34, 1.25, 0.64, 1] }}
                  >
                    {/* Front Face: Initials */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center font-bold text-sm tracking-wide text-foreground select-none"
                      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    >
                      {initials}
                    </div>

                    {/* Back Face: Profile Photo */}
                    <div 
                      className="absolute inset-0 rounded-[13px] overflow-hidden"
                      style={{ 
                        backfaceVisibility: 'hidden', 
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)' 
                      }}
                    >
                      <img 
                        src={profile.avatar_url} 
                        alt="Profile" 
                        className="w-full h-full object-cover select-none pointer-events-none" 
                      />
                    </div>
                  </motion.div>
                </div>
              ) : (
                initials
              )}
            </motion.button>
          </div>
        </motion.div>
    </motion.header>
  );
};
