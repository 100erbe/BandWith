import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronDown, 
  Bell,
  Search,
  Plus,
  Edit,
} from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';
import { cn } from '@/app/components/ui/utils';
import { Band } from '@/app/data/bands';
import { TabName } from '@/app/types';
import { useAuth } from '@/lib/AuthContext';
import { RailHeaderActions, useRailOwnsChrome } from '@/lib/railActions';
import { HEADER_SPRING, durations } from '@/styles/motion';
import { FIT, FitText } from '@/app/components/bw/FitText';
import { primeKeyboard } from '@/lib/keyboardSafeTap';

export { HEADER_SPRING };

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


export const Header: React.FC<HeaderProps> = ({
  activeTab,
  selectedBand,
  bands,
  onOpenBandSwitcher,
  filteredEventsCount: _filteredEventsCount,
  totalEventsCount: _totalEventsCount,
  onOpenIdentity,
  onOpenNotifications,
  unreadCount,
  isHidden,
  isScrolled = false,
}) => {
  const { profile } = useAuth();
  // iPhone Duo: search and the profile live in the side rail (Figma "Duo/Side Actions").
  const railOwnsChrome = useRailOwnsChrome();
  
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

  // Long band names step down 36 → 30 → 24 → 20 (Figma: Fit Text / Header)
  // to fit beside the bell and avatar; only past 20px do they truncate.

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
        "sticky top-0 z-40 -mx-4 px-4 select-none transition-[background-color,border-color,box-shadow] duration-200",
        isScrolled 
          ? "bg-background/95 backdrop-blur-xl"
          : "bg-background/80 backdrop-blur-md"
      )}
      animate={{ 
        opacity: isHidden ? 0 : 1, 
        y: isHidden ? -20 : 0 
      }}
      transition={HEADER_SPRING}
      style={{ 
        paddingTop: 'calc(var(--safe-top) + 12px)',
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
        style={{ willChange: 'height' }}
        className="relative w-full overflow-hidden"
      >
          {/* ═══ LEFT: Single Unified Morphing Title Lockup (Zero duplicate DOM nodes) ═══ */}
          {activeTab === 'Chat' ? (
            /* Figma "Chat / Inbox" Kicker: "Messages" overline above the Display/LG title */
            <div className="flex flex-col gap-1 pr-[56px]">
              <motion.span
                initial={false}
                animate={{
                  y: isScrolled ? -6 : 0,
                  opacity: isScrolled ? 0 : 1,
                }}
                transition={HEADER_SPRING}
                style={{ willChange: 'transform, opacity' }}
                className="bw-label-sm text-muted-foreground leading-none origin-top-left truncate h-[13px]"
              >
                Messages
              </motion.span>
              <motion.h1
                initial={false}
                animate={{
                  scale: isScrolled ? 0.52 : 1,
                  y: isScrolled ? -12 : 0,
                }}
                transition={HEADER_SPRING}
                style={{ willChange: 'transform' }}
                className="bw-display-lg text-foreground origin-top-left"
              >
                Chat
              </motion.h1>
            </div>
          ) : activeTab === 'Events' ? (
            /* Figma "Calendar" Kicker: overline above the Display/LG title */
            <div className="flex flex-col gap-1 pr-[56px]">
              <motion.span
                initial={false}
                animate={{
                  y: isScrolled ? -6 : 0,
                  opacity: isScrolled ? 0 : 1,
                }}
                transition={HEADER_SPRING}
                style={{ willChange: 'transform, opacity' }}
                className="flex items-center gap-1.5 min-w-0 h-[15px] leading-none origin-top-left"
              >
                {/* Band eyebrow: which band's calendar this is, at a glance. */}
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full shrink-0',
                    selectedBand.role === 'ADMIN' ? 'bg-destructive-solid' : 'bg-accent',
                  )}
                  aria-hidden
                />
                <span className="bw-label-md text-foreground font-semibold truncate">{selectedBand.name}</span>
                <span className="bw-label-md text-muted-foreground shrink-0">· Schedule</span>
              </motion.span>
              <motion.h1
                initial={false}
                animate={{
                  scale: isScrolled ? 0.52 : 1,
                  y: isScrolled ? -12 : 0,
                }}
                transition={HEADER_SPRING}
                className="bw-display-lg text-foreground origin-top-left"
                style={{ willChange: 'transform', fontSize: 'min(44px, calc((100vw - 100px) / 4.9))' }}
              >
                Calendar
              </motion.h1>
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
                style={{ willChange: 'transform' }}
                className="flex items-center gap-1.5 h-[14px] origin-top-left"
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  selectedBand.role === 'ADMIN' ? "bg-destructive-solid" : "bg-accent"
                )} />
                <span className="bw-label-sm text-foreground leading-none">
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
                    style={{ willChange: 'transform' }}
                    className="flex items-center gap-2 origin-top-left"
                  >
                    <FitText
                      as="h1"
                      text={selectedBand.name}
                      sizes={FIT.header}
                      maxLines={1}
                      className="bw-display text-foreground max-w-[260px] group-hover:text-foreground/75 transition-colors"
                    />
                    <motion.div
                      initial={false}
                      animate={{
                        opacity: isScrolled ? 1 : 0,
                        scale: isScrolled ? 1.6 : 0.8,
                      }}
                      transition={HEADER_SPRING}
                      style={{ willChange: 'transform, opacity' }}
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
                    style={{ 
                      pointerEvents: isScrolled ? 'none' : 'auto',
                      willChange: 'transform, opacity',
                    }}
                    className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors origin-top-left"
                  >
                    <span className="bw-label-sm leading-none">Switch band</span>
                    <ChevronDown className="w-3 h-3 transition-transform group-hover:translate-y-0.5" />
                  </motion.div>
                </button>
              ) : (
                <motion.div
                  initial={false}
                  animate={{
                    scale: isScrolled ? 0.52 : 1,
                    y: isScrolled ? 6 : 5,
                  }}
                  transition={HEADER_SPRING}
                  className="origin-top-left"
                  style={{ willChange: 'transform' }}
                >
                  <FitText
                    as="h1"
                    text={selectedBand.name}
                    sizes={FIT.header}
                    maxLines={1}
                    className="bw-display text-foreground max-w-[260px]"
                  />
                </motion.div>
              )}
            </div>
          )}

          {/* iPhone Duo: the header's actions join the side rail (Figma "Duo/Side Actions"). */}
          {railOwnsChrome && (
            <RailHeaderActions base>
              {activeTab === 'Chat' ? (
                <IconButton
                  label="New chat"
                  variant="filled"
                  icon={<Plus />}
                  railIcon={<Edit />}
                  onClick={() => window.dispatchEvent(new CustomEvent('bw:new-chat'))}
                />
              ) : activeTab === 'Events' ? null : (
                <IconButton
                  label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  variant="ghost"
                  icon={<Bell />}
                  railBadge={unreadCount}
                  onClick={onOpenNotifications}
                />
              )}
            </RailHeaderActions>
          )}

          {/* ═══ RIGHT: Stationary Bell & Identity Actions (Pinned at top-right, 0px vertical shift) ═══ */}
          {!railOwnsChrome && <div className="absolute top-[3px] right-0 flex items-center gap-2 z-20">
            {activeTab === 'Chat' ? (
              /* Figma "Chat / Inbox": a single filled "+" starts a new conversation */
              <IconButton
                label="New chat"
                variant="filled"
                icon={<Plus />}
                onClick={() => window.dispatchEvent(new CustomEvent('bw:new-chat'))}
              />
            ) : activeTab === 'Events' ? (
              /* Figma "Calendar": a single Outline search button opens "Search events" */
              railOwnsChrome ? null : <IconButton
                label="Search events"
                icon={<Search />}
                onClick={() => {
                  primeKeyboard(); // keyboard up with the tap; the search field takes the focus
                  window.dispatchEvent(new CustomEvent('bw:open-event-search'));
                }}
              />
            ) : (
            <>
            {/* Bell / Notifications */}
            <motion.button 
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onOpenNotifications}
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              className="relative shrink-0 w-11 h-11 rounded-full border-[1.5px] border-foreground text-foreground flex items-center justify-center transition-colors hover:bg-foreground/[0.08] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground cursor-pointer"
            >
              <Bell className="w-5 h-5 text-foreground" />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-0.5 left-[26px] min-w-[20px] h-5 px-1 rounded-full bg-destructive-solid text-white text-[11px] font-bold leading-none flex items-center justify-center border-2 border-background z-30"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Identity Trigger with 3D Welcome Flip */}
            {!railOwnsChrome && <motion.button 
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={onOpenIdentity}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              aria-label="Open Identity and Account Hub"
              className="relative shrink-0 w-11 h-11 rounded-full bg-white border-[1.5px] border-border text-black flex items-center justify-center bw-h3 transition-colors focus:outline-none overflow-hidden cursor-pointer"
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
                    transition={{ duration: durations.slow, ease: [0.34, 1.25, 0.64, 1] }}
                  >
                    {/* Front Face: Initials */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center bw-h3 select-none"
                      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    >
                      {initials}
                    </div>

                    {/* Back Face: Profile Photo */}
                    <div 
                      className="absolute inset-0 rounded-full overflow-hidden"
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
            </motion.button>}
            </>
            )}
          </div>}
        </motion.div>
    </motion.header>
  );
};
