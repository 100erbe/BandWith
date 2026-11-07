import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mic2,
  Music,
  FileText,
  IconHome,
  IconCalendar,
  IconChat,
  IconPlus,
  type IconProps,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { TabName, CreateEventType } from '@/app/types';
import { haptic } from '@/lib/haptics';

interface BottomNavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  isPlusMenuOpen: boolean;
  setIsPlusMenuOpen: (open: boolean) => void;
  isControlDeckOpen?: boolean;
  isIdentityOpen: boolean;
  toggleControlDeck?: () => void;
  toggleIdentity?: () => void;
  closeMenus: () => void;
  onCreateEvent: (type: CreateEventType) => void;
  isHidden: boolean;
  isAdmin: boolean;
  isSolo?: boolean;
  isScrollingDown?: boolean;
  unreadChatCount?: number;
}

type TabDescriptor = {
  key: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  isActive: boolean;
  onClick: () => void;
  badgeCount?: number;
};

/* ═══ Shared spring config — snappy, controlled, no visible bounce ═══ */

const SPRING = { type: 'spring' as const, stiffness: 350, damping: 27, mass: 0.8 };
const STIFF_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.7 };

/* ═══ Tab index map ═══ */

const TAB_INDEX_MAP: Record<string, number> = {
  Home: 0,
  Events: 1,
  Chat: 2,
  Settings: 3,
};

/* ═══ Discrete pill positions (hardcoded from layout) ═══
 *
 * Layout: px-2 (8px) | tab | gap-x-2 (8px) | tab | gap-x-2 | mx-1 (4px) | plus (44px) | mx-1 (4px) | gap-x-2 | tab | gap-x-2 | tab | px-2
 * Tab width = w-16 = 64px
 * Pill width = 72px
 *
 * Positions (left offset of pill, half-width = 36):
 *   Home:    40 - 36 =  4
 *   Events: 112 - 36 = 76
 *   Chat:   244 - 36 = 208
 *   Settings:316 - 36 = 280
 *
 * Note: No separate shrunk positions needed — the container scale (0.78)
 * handles the visual shrink uniformly, avoiding conflicting layout animations.
 */

const PILL_POSITIONS = [4, 76, 208, 280];
const PILL_WIDTH = 72;

/* ═══ 2-Track Studio Faders — Music-Tech Aesthetic Navigation Icon ═══ */
const SettingsIcon: React.FC<IconProps> = ({
  size = 26.4,
  color = 'currentColor',
  strokeWidth = 2.4,
  className,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <line x1="4" y1="8" x2="10" y2="8" />
    <line x1="16" y1="8" x2="20" y2="8" />
    <circle cx="13" cy="8" r="3" />
    <line x1="4" y1="16" x2="8" y2="16" />
    <line x1="14" y1="16" x2="20" y2="16" />
    <circle cx="11" cy="16" r="3" />
  </svg>
);

const SlidingPill: React.FC<{
  activeKey: string | null;
}> = ({ activeKey }) => {
  if (!activeKey) return null;

  const idx = TAB_INDEX_MAP[activeKey];
  if (idx === undefined) return null;

  return (
    <motion.div
      className="absolute rounded-full bg-foreground/10 dark:bg-white/10 z-0"
      style={{ top: '2px', bottom: '2px' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        left: PILL_POSITIONS[idx],
        width: PILL_WIDTH,
        opacity: 1,
        scale: 1,
      }}
      transition={SPRING}
    />
  );
};

/* ═══ NavTab sub-component — Framer Motion layout for auto-size animation ═══ */

const NavTab: React.FC<{
  tabKey: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  isActive: boolean;
  onClick: () => void;
  isScrollingDown: boolean;
  badgeCount?: number;
}> = ({ tabKey, label, icon: Icon, isActive, onClick, isScrollingDown, badgeCount }) => {
  return (
    <button
      data-tab-key={tabKey}
      onClick={onClick}
      className={cn(
        'relative z-10 outline-none px-0 shrink-0 h-full overflow-hidden w-16',
        'flex flex-col items-center justify-center transition-colors duration-150',
        isActive ? 'text-[var(--fg)]' : 'text-muted-foreground hover:text-foreground/80'
      )}
    >
      {/* Icon: smoothly glides between elevated (with label) and dead-center (when shrunk) */}
      <motion.div
        className="w-[26px] h-[26px] flex items-center justify-center z-10 relative"
        animate={{
          y: isScrollingDown ? 0 : -6,
        }}
        transition={SPRING}
      >
        <Icon color="currentColor" size={26.4} strokeWidth={isActive ? 2.85 : 2.4} />
        {badgeCount !== undefined && badgeCount > 0 ? (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center leading-none pointer-events-none shadow-xs ring-2 ring-card dark:ring-zinc-900">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </motion.div>

      {/* Label: smoothly fades and glides in/out in absolute position to avoid layout jumps */}
      <motion.div
        className="absolute bottom-[8px] left-0 right-0 flex items-center justify-center pointer-events-none"
        animate={{
          opacity: isScrollingDown ? 0 : 1,
          y: isScrollingDown ? 6 : 0,
          scale: isScrollingDown ? 0.75 : 1,
        }}
        transition={SPRING}
      >
        <span
          className={cn(
            'text-[10px] tracking-tight select-none leading-none transition-colors duration-150',
            isActive
              ? 'text-[var(--fg)] font-semibold'
              : 'text-muted-foreground font-medium'
          )}
        >
          {label}
        </span>
      </motion.div>
    </button>
  );
};

/* ═══ BottomNavigation ═══ */

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  setActiveTab,
  isPlusMenuOpen,
  setIsPlusMenuOpen,
  isControlDeckOpen,
  isIdentityOpen,
  toggleControlDeck,
  toggleIdentity,
  closeMenus,
  onCreateEvent,
  isHidden,
  isAdmin,
  isSolo = false,
  isScrollingDown = false,
  unreadChatCount = 0,
}) => {
  const navRef = useRef<HTMLDivElement>(null);
  
  const [forceOpen, setForceOpen] = useState(false);
  const [localScrollDown, setLocalScrollDown] = useState(false);
  const scrollTrackersRef = useRef<WeakMap<Element, { pivotTop: number; isDown: boolean }>>(new WeakMap());

  // When parent reports scrolling up, allow force-open to be cleared
  useEffect(() => {
    if (!isScrollingDown) {
      setForceOpen(false);
    }
  }, [isScrollingDown]);

  // When local (overlay) scroll detects downward motion, allow shrinking
  useEffect(() => {
    if (localScrollDown) {
      setForceOpen(false);
    }
  }, [localScrollDown]);

  // Local scroll detection — captures scroll on overlay scrollable containers
  // (e.g., IdentityHub) using 18px pivot hysteresis to prevent micro-tremor bounce.
  useEffect(() => {
    const THRESHOLD = 18;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | Document;
      const scrollEl = target instanceof Document ? document.documentElement : target;
      if (!(scrollEl instanceof HTMLElement)) return;

      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      // Ignore horizontal pill bars or non-vertically-scrollable elements
      if (maxScroll <= 24) return;

      const currentTop = Math.max(0, Math.min(scrollEl.scrollTop ?? 0, maxScroll));
      let tracker = scrollTrackersRef.current.get(scrollEl);
      if (!tracker) {
        tracker = { pivotTop: currentTop, isDown: false };
        scrollTrackersRef.current.set(scrollEl, tracker);
      }

      if (currentTop <= 12) {
        if (tracker.isDown) {
          tracker.isDown = false;
          setLocalScrollDown(false);
        }
        tracker.pivotTop = currentTop;
        return;
      }

      if (!tracker.isDown) {
        if (currentTop < tracker.pivotTop) {
          tracker.pivotTop = currentTop;
        } else if (currentTop > 32 && currentTop - tracker.pivotTop >= THRESHOLD) {
          tracker.isDown = true;
          tracker.pivotTop = currentTop;
          setLocalScrollDown(true);
        }
      } else {
        if (currentTop > tracker.pivotTop) {
          tracker.pivotTop = currentTop;
        } else if (tracker.pivotTop - currentTop >= THRESHOLD) {
          tracker.isDown = false;
          tracker.pivotTop = currentTop;
          setLocalScrollDown(false);
        }
      }
    };

    // Use capture phase to catch scroll events on any descendant overlay
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, []);

  const effectiveIsScrollingDown = (isScrollingDown || localScrollDown) && !forceOpen;
  const isShrunk = effectiveIsScrollingDown;

  const handleTabClick = (tab: TabName) => {
    haptic.tap();
    if (isSolo && tab === 'Chat') tab = 'Events';
    setActiveTab(tab);
    setForceOpen(true);
    closeMenus();
  };

  const isSettingsActive = isIdentityOpen || !!isControlDeckOpen;
  const isHomeActive = activeTab === 'Home' && !isSettingsActive;
  const isEventsActive = activeTab === 'Events' && !isSettingsActive;
  const isChatActive = activeTab === 'Chat' && !isSettingsActive;

  const pillActiveKey = isSettingsActive
    ? 'Settings'
    : isHomeActive
      ? 'Home'
      : isEventsActive
        ? 'Events'
        : isChatActive
          ? 'Chat'
          : null;

  const tabs: TabDescriptor[] = [
    { key: 'Home', label: 'Home', icon: IconHome, isActive: isHomeActive, onClick: () => handleTabClick('Home') },
    { key: 'Events', label: 'Calendar', icon: IconCalendar, isActive: isEventsActive, onClick: () => handleTabClick('Events') },
    { key: 'Chat', label: 'Chat', icon: IconChat, isActive: isChatActive, badgeCount: unreadChatCount, onClick: () => handleTabClick('Chat') },
    {
      key: 'Settings',
      label: 'Settings',
      icon: SettingsIcon,
      isActive: isSettingsActive,
      onClick: () => {
        haptic.tap();
        if (!isSettingsActive) {
          if (toggleIdentity) {
            toggleIdentity();
          } else if (toggleControlDeck) {
            toggleControlDeck();
          }
        }
        setForceOpen(true);
      },
    },
  ];

  return (
    <>
      {/* Plus Menu Bottom Sheet */}
      <AnimatePresence>
        {isPlusMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[90] bg-[var(--surface-inverse)]/30 backdrop-blur-[10px]"
              onClick={() => setIsPlusMenuOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[91] bg-background rounded-t-[26px] px-4 pt-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex justify-center mb-2.5">
                <div className="w-10 h-1 rounded-full bg-foreground/20" />
              </div>
              <div className="flex items-end justify-between mb-8">
                <p className="text-[12px] font-bold text-foreground/50 uppercase">START</p>
                <button onClick={() => setIsPlusMenuOpen(false)} className="w-9 h-9 rounded-full border border-foreground/20 flex items-center justify-center">
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>
              <div className="flex flex-col gap-6">
                {/* Solo or Non-Admin Member: Add Personal Gig */}
                {(!isAdmin || isSolo) && (
                  <button onClick={() => { haptic.tap(); onCreateEvent('personal'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group">
                    <div className="w-14 h-14 rounded-2xl bg-accent-gig/15 border border-accent-gig/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <Mic2 className="w-7 h-7 text-accent-gig" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[20px] font-bold text-foreground uppercase">ADD PERSONAL GIG</span>
                      <span className="text-[12px] font-medium text-foreground/60 leading-normal">Log your outside gig, track personal earnings, and keep your calendar unified.</span>
                    </div>
                  </button>
                )}

                {/* Admins: Band Gig */}
                {isAdmin && !isSolo && (
                  <button onClick={() => { haptic.tap(); onCreateEvent('gig'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group">
                    <div className="w-14 h-14 rounded-2xl bg-accent-gig/15 border border-accent-gig/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <Mic2 className="w-7 h-7 text-accent-gig" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[20px] font-bold text-foreground uppercase">NEW GIG</span>
                      <span className="text-[12px] font-medium text-foreground/60 leading-normal">Click to create a new gig—your next live performance—right in the app.</span>
                    </div>
                  </button>
                )}

                {/* Rehearsal / Propose Rehearsal: Always accessible */}
                <button onClick={() => { haptic.tap(); onCreateEvent('rehearsal'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group">
                  <div className="w-14 h-14 rounded-2xl bg-accent-rehearsal/15 border border-accent-rehearsal/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <Music className="w-7 h-7 text-accent-rehearsal" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[20px] font-bold text-foreground uppercase">
                      {isAdmin ? 'NEW REHEARSAL' : 'PROPOSE REHEARSAL'}
                    </span>
                    <span className="text-[12px] font-medium text-foreground/60 leading-normal">
                      {isAdmin
                        ? 'Plan the session, share details, and keep everyone in sync.'
                        : 'Suggest a rehearsal date or topic to the band admin.'}
                    </span>
                  </div>
                </button>

                {/* Quotes: Admin only */}
                {isAdmin && !isSolo && (
                  <button onClick={() => { haptic.tap(); onCreateEvent('quote'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group">
                    <div className="w-14 h-14 rounded-2xl bg-accent-quote/15 border border-accent-quote/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <FileText className="w-7 h-7 text-accent-quote" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[20px] font-bold text-foreground uppercase">NEW QUOTE</span>
                      <span className="text-[12px] font-medium text-foreground/60 leading-normal">Build an estimate, package details, and send it fast.</span>
                    </div>
                  </button>
                )}

                {/* Admins: optional personal gig */}
                {isAdmin && !isSolo && (
                  <button onClick={() => { haptic.tap(); onCreateEvent('personal'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group opacity-80 hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-2xl bg-foreground/5 border border-foreground/15 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <Mic2 className="w-7 h-7 text-foreground/60" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[16px] font-bold text-foreground/80 uppercase">LOG PERSONAL GIG</span>
                      <span className="text-[11px] font-medium text-foreground/50 leading-normal">Log an outside solo gig without inviting band members.</span>
                    </div>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Bar Centering Wrapper */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-[80] flex justify-center pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
        animate={{ y: isHidden ? 200 : 0, opacity: isHidden ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <motion.div
          ref={navRef}
          className={cn(
            'pointer-events-auto relative flex items-center justify-center rounded-[999px] origin-bottom',
            'bg-card/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-300/80 dark:border-zinc-800/80',
            'h-[56px] gap-x-2 px-2'
          )}
          animate={{ scale: isShrunk ? 0.78 : 1 }}
          transition={SPRING}
          style={{
            boxShadow: '0px 0px 4px 0px rgba(0,0,0,0.04), 0px 8px 16px 0px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            willChange: 'transform',
          }}
        >
          <SlidingPill activeKey={pillActiveKey} />

          {tabs.slice(0, 2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} badgeCount={tab.badgeCount} onClick={tab.onClick} isScrollingDown={isShrunk} />
          ))}

          <div className="relative z-10 flex items-center justify-center mx-1">
            <motion.button
              onClick={() => {
                haptic.tap();
                setIsPlusMenuOpen(!isPlusMenuOpen);
                setForceOpen(true);
              }}
              className={cn(
                'bg-accent rounded-[18px] flex items-center justify-center shadow-[0px_4px_16px_rgba(0,0,0,0.15)] w-[48px] h-[48px] -translate-y-3'
              )}
              animate={{ scale: isShrunk ? 1.282 : 1 }}
              transition={SPRING}
            >
              <IconPlus size={29} color="var(--accent-fg)" strokeWidth={3.15} className={cn('transition-transform duration-300', isPlusMenuOpen && 'rotate-45')} />
            </motion.button>
          </div>

          {tabs.slice(2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} badgeCount={tab.badgeCount} onClick={tab.onClick} isScrollingDown={isShrunk} />
          ))}
        </motion.div>
      </motion.div>
    </>
  );
};

export default BottomNavigation;