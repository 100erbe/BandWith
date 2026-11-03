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
  IconMenu,
  IconClose,
  IconPlus,
  type IconProps,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { TabName, CreateEventType } from '@/app/types';

interface BottomNavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  isPlusMenuOpen: boolean;
  setIsPlusMenuOpen: (open: boolean) => void;
  isControlDeckOpen: boolean;
  isIdentityOpen: boolean;
  toggleControlDeck: () => void;
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

const SlidingPill: React.FC<{
  activeKey: string | null;
}> = ({ activeKey }) => {
  if (!activeKey) return null;

  const idx = TAB_INDEX_MAP[activeKey];
  if (idx === undefined) return null;

  return (
    <motion.div
      className="absolute rounded-full bg-foreground/10 z-0"
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
  isMenuOpen: boolean;
  badgeCount?: number;
}> = ({ tabKey, label, icon: Icon, isActive, onClick, isScrollingDown, isMenuOpen, badgeCount }) => {
  // Always bold and black (design system foreground color) regardless of selection
  const strokeColor = isMenuOpen ? 'var(--surface-inverse-fg)' : 'var(--fg)';

  return (
    <button
      data-tab-key={tabKey}
      onClick={onClick}
      className={cn(
        'relative z-10 outline-none px-0 shrink-0 h-full overflow-hidden w-16',
        'flex flex-col items-center justify-center'
      )}
    >
      {/* Icon: smoothly glides between elevated (with label) and dead-center (when shrunk) */}
      <motion.div
        className="w-[22px] h-[22px] flex items-center justify-center z-10 relative"
        style={{ color: strokeColor }}
        animate={{
          y: isScrollingDown ? 0 : -6,
        }}
        transition={SPRING}
      >
        <Icon color="currentColor" size={22} />
        {badgeCount !== undefined && badgeCount > 0 ? (
          <span className={cn(
            "absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center leading-none pointer-events-none shadow-xs ring-2",
            isMenuOpen ? "ring-[var(--surface-inverse)]" : "ring-background"
          )}>
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
              ? 'text-foreground/60 font-semibold'
              : 'text-foreground/45 font-medium'
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
  const lastScrollYRef = useRef(0);

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

  // Local scroll detection — captures scroll on any scrollable container
  // (e.g., Settings overlay or ControlDeck, which have their own scroll
  // containers not tracked by the parent's useScrollDirection hook).
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | Document;
      const scrollEl = target instanceof Document ? document.documentElement : target;
      const scrollTop = scrollEl.scrollTop ?? 0;
      
      if (scrollTop > 10 && scrollTop > lastScrollYRef.current) {
        setLocalScrollDown(true);
      } else if (scrollTop <= 10 || scrollTop < lastScrollYRef.current) {
        setLocalScrollDown(false);
      }
      lastScrollYRef.current = scrollTop;
    };

    // Use capture phase to catch scroll events on any descendant
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, []);

  const effectiveIsScrollingDown = (isScrollingDown || localScrollDown) && !forceOpen;
  const isShrunk = effectiveIsScrollingDown;

  const handleTabClick = (tab: TabName) => {
    if (isSolo && tab === 'Chat') tab = 'Events';
    setActiveTab(tab);
    setForceOpen(true);
    closeMenus();
  };

  const isMenuOpen = isIdentityOpen;
  const isHomeActive = activeTab === 'Home' && !isMenuOpen;
  const isEventsActive = activeTab === 'Events' && !isMenuOpen;
  const isChatActive = activeTab === 'Chat' && !isMenuOpen;

  const isSettingsActive = isControlDeckOpen;
  const pillActiveKey = isMenuOpen
    ? null
    : isSettingsActive
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
      icon: isControlDeckOpen ? IconClose : IconMenu,
      isActive: isSettingsActive,
      onClick: () => {
        toggleControlDeck();
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
                {isAdmin && (
                  <button onClick={() => { onCreateEvent('gig'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group">
                    <div className="w-14 h-14 rounded-2xl bg-accent-gig/15 border border-accent-gig/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <Mic2 className="w-7 h-7 text-accent-gig" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[20px] font-bold text-foreground uppercase">NEW GIG</span>
                      <span className="text-[12px] font-medium text-foreground/60 leading-normal">Click to create a new gig—your next live performance—right in the app.</span>
                    </div>
                  </button>
                )}
                <button onClick={() => { onCreateEvent('rehearsal'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group">
                  <div className="w-14 h-14 rounded-2xl bg-accent-rehearsal/15 border border-accent-rehearsal/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <Music className="w-7 h-7 text-accent-rehearsal" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-[20px] font-bold text-foreground uppercase">NEW REHEARSAL</span>
                    <span className="text-[12px] font-medium text-foreground/60 leading-normal">Plan the session, share details, and keep everyone in sync.</span>
                  </div>
                </button>
                {isAdmin && (
                  <button onClick={() => { onCreateEvent('quote'); setIsPlusMenuOpen(false); }} className="flex items-center gap-5 w-full text-left group">
                    <div className="w-14 h-14 rounded-2xl bg-accent-quote/15 border border-accent-quote/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <FileText className="w-7 h-7 text-accent-quote" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-[20px] font-bold text-foreground uppercase">NEW QUOTE</span>
                      <span className="text-[12px] font-medium text-foreground/60 leading-normal">Build an estimate, package details, and send it fast.</span>
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
            isMenuOpen ? 'bg-[var(--surface-inverse)]/95' : 'bg-background/85',
            'h-[56px] gap-x-2 px-2'
          )}
          animate={{ scale: isShrunk ? 0.78 : 1 }}
          transition={SPRING}
          style={{
            boxShadow: '0px 0px 4px 0px rgba(0,0,0,0.04), 0px 8px 16px 0px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '0.5px solid var(--nav-border, rgba(0,0,0,0.08))',
            willChange: 'transform',
          }}
        >
          <SlidingPill activeKey={pillActiveKey} />

          {tabs.slice(0, 2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} badgeCount={tab.badgeCount} onClick={tab.onClick} isScrollingDown={isShrunk} isMenuOpen={isMenuOpen} />
          ))}

          <div className="relative z-10 flex items-center justify-center mx-1">
            <motion.button
              onClick={() => {
                setIsPlusMenuOpen(!isPlusMenuOpen);
                setForceOpen(true);
              }}
              className={cn(
                'bg-accent rounded-[16px] flex items-center justify-center shadow-[0px_4px_16px_rgba(0,0,0,0.15)] w-[44px] h-[44px] -translate-y-3'
              )}
              animate={{ scale: isShrunk ? 1.282 : 1 }}
              transition={SPRING}
            >
              <IconPlus color="var(--accent-fg)" className={cn('transition-transform duration-300', isPlusMenuOpen && 'rotate-45')} />
            </motion.button>
          </div>

          {tabs.slice(2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} badgeCount={tab.badgeCount} onClick={tab.onClick} isScrollingDown={isShrunk} isMenuOpen={isMenuOpen} />
          ))}
        </motion.div>
      </motion.div>
    </>
  );
};

export default BottomNavigation;