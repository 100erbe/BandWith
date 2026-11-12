import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  Music,
  File,
  User,
  ArrowUpRight,
  IconHome,
  IconCalendar,
  IconChat,
  IconPlus,
  IconClose,
  IconMenu,
  type IconProps,
} from '@/app/components/icons';
import { BwSheet } from '@/app/components/bw/Screen';
import { cn } from '@/app/components/ui/utils';
import { TabName, CreateEventType } from '@/app/types';
import { haptic } from '@/lib/haptics';
import { springs } from '@/styles/motion';
import { useRailLayout } from '@/lib/deviceRegions';
import { DuoRail } from './DuoRail';
import { useT } from '@/lib/i18n';

interface BottomNavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  isPlusMenuOpen: boolean;
  setIsPlusMenuOpen: (open: boolean) => void;
  isControlDeckOpen?: boolean;
  isIdentityOpen: boolean;
  toggleControlDeck?: () => void;
  toggleIdentity?: () => void;
  /** iPhone Duo rail profile button (opens over any screen). */
  onRailProfile?: () => void;
  railProfileLocked?: boolean;
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

/* ═══ Shared spring config — unified design system springs ═══ */

const SPRING = springs.smooth;

/* ═══ Tab index map ═══ */


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
  // Figma "Bottom Nav": icon-only tabs (24px in a 44px hit area); the active
  // tab is full opacity with a lime dot beneath it.
  void isScrollingDown;
  return (
    <button
      data-tab-key={tabKey}
      onClick={onClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative z-10 outline-none shrink-0 w-11 h-11 flex flex-col items-center justify-center transition-colors duration-150 cursor-pointer',
        isActive ? 'text-foreground' : 'text-foreground/55 hover:text-foreground/80'
      )}
    >
      <span className="relative w-6 h-6 flex items-center justify-center">
        <Icon color="currentColor" size={24} strokeWidth={isActive ? 2.2 : 2} />
        {badgeCount !== undefined && badgeCount > 0 ? (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive-solid text-white text-[9px] font-bold flex items-center justify-center leading-none pointer-events-none ring-2 ring-background">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-0 w-[5px] h-[5px] rounded-full bg-accent transition-opacity duration-150"
        style={{ opacity: isActive ? 1 : 0 }}
      />
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
  onRailProfile,
  railProfileLocked = false,
  closeMenus,
  onCreateEvent,
  isHidden,
  isAdmin,
  isSolo = false,
  isScrollingDown = false,
  unreadChatCount = 0,
}) => {
  const t = useT();
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
  // iPhone Duo: the side rail (Figma "Duo/Side Tab Bar" + "Duo/Side Actions")
  // replaces the bottom bar entirely.
  const { rail } = useRailLayout();
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


  const tabs: TabDescriptor[] = [
    { key: 'Home', label: t('Home'), icon: IconHome, isActive: isHomeActive, onClick: () => handleTabClick('Home') },
    { key: 'Events', label: t('Calendar'), icon: IconCalendar, isActive: isEventsActive, onClick: () => handleTabClick('Events') },
    { key: 'Chat', label: t('Chat'), icon: IconChat, isActive: isChatActive, badgeCount: unreadChatCount, onClick: () => handleTabClick('Chat') },
    {
      key: 'Settings',
      label: t('Settings'),
      icon: IconMenu,
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

  /* Figma "Home / Create menu – Admin / Member" rows. */
  const createOptions: {
    key: string;
    type: CreateEventType;
    title: string;
    description: string;
    icon: React.ReactNode;
    tile: string;
    muted?: boolean;
  }[] = [
    ...(!isAdmin || isSolo
      ? [{
          key: 'personal',
          type: 'personal' as CreateEventType,
          title: t('Add personal gig'),
          description: t('Log your outside gig and track personal earnings.'),
          icon: <User />,
          tile: 'bg-accent-personal text-accent-personal-foreground',
        }]
      : []),
    ...(isAdmin && !isSolo
      ? [{
          key: 'gig',
          type: 'gig' as CreateEventType,
          title: t('New gig'),
          description: t('Lineup, fees, venue and setlist'),
          icon: <Music />,
          tile: 'bg-accent-gig text-accent-gig-foreground',
        }]
      : []),
    {
      key: 'rehearsal',
      type: 'rehearsal' as CreateEventType,
      title: isAdmin ? t('New rehearsal') : t('Propose rehearsal'),
      description: isAdmin ? t('Schedule directly or poll availability') : t('Suggest a date or topic to the band admin.'),
      icon: <Mic />,
      tile: 'bg-accent-rehearsal text-accent-rehearsal-foreground',
    },
    ...(isAdmin && !isSolo
      ? [
          {
            key: 'quote',
            type: 'quote' as CreateEventType,
            title: t('New quote'),
            description: t('Branded PDF with pricing & terms'),
            icon: <File />,
            tile: 'bg-accent-quote text-accent-quote-foreground',
          },
          {
            key: 'log-personal',
            type: 'personal' as CreateEventType,
            title: t('Log personal gig'),
            description: t('Log an outside solo gig without inviting band members.'),
            icon: <User />,
            tile: 'bg-sheet-foreground/[0.08] text-sheet-foreground',
            muted: true,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Create menu (Figma "Home / Create menu"): dark sheet that sits under
          the nav bar, so the FAB turns into its close button. */}
      <BwSheet
        open={isPlusMenuOpen}
        onClose={() => setIsPlusMenuOpen(false)}
        overline={t('Start')}
        title={t('Create')}
        // Bottom bar: just under the bar (z-80). Duo rail: above the detail
        // panes, still under the rail (z-190).
        zIndex={rail ? 150 : 79}
      >
        <div className="flex flex-col gap-3">
          {createOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                haptic.tap();
                onCreateEvent(option.type);
                setIsPlusMenuOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-4 p-3 rounded-[16px] bg-sheet-foreground/[0.08] text-left text-sheet-foreground',
                'active:scale-[0.99] transition-[transform,opacity] cursor-pointer',
                option.muted && 'opacity-80 hover:opacity-100',
              )}
            >
              <span
                className={cn(
                  'w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0 [&_svg]:w-6 [&_svg]:h-6',
                  option.tile,
                )}
              >
                {option.icon}
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className={cn('bw-h3', option.muted && 'text-sheet-foreground/85')}>{option.title}</span>
                <span className="bw-body-sm text-sheet-foreground/85">{option.description}</span>
              </span>
              <ArrowUpRight className="w-5 h-5 shrink-0" aria-hidden />
            </button>
          ))}
        </div>
        {/* Clearance for the floating bottom bar that stays above the sheet */}
        {!rail && <div aria-hidden="true" className="h-[104px]" />}
      </BwSheet>

      {rail ? (
        <DuoRail
          tabs={tabs.filter((tab) => tab.key !== 'Settings')}
          isPlusMenuOpen={isPlusMenuOpen}
          onPlus={() => {
            haptic.tap();
            setIsPlusMenuOpen(!isPlusMenuOpen);
          }}
          isProfileOpen={isIdentityOpen}
          profileLocked={railProfileLocked}
          onProfile={() => {
            if (isPlusMenuOpen) setIsPlusMenuOpen(false);
            if (onRailProfile) onRailProfile();
            else if (toggleIdentity) toggleIdentity();
            else toggleControlDeck?.();
          }}
          showTabs={!isHidden}
        />
      ) : (
      /* Main Bar Centering Wrapper */
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-[80] flex justify-center pointer-events-none"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
        animate={{ y: isHidden ? 200 : 0, opacity: isHidden ? 0 : 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <motion.div
          ref={navRef}
          className={cn(
            'pointer-events-auto relative flex items-center justify-between rounded-full origin-bottom',
            'bg-white/[0.86] dark:bg-[#1c1c1c]/[0.86] border border-border',
            'h-[60px] w-[calc(100%-32px)] max-w-[420px] px-6',
          )}
          animate={{ scale: isShrunk ? 0.9 : 1 }}
          transition={SPRING}
          style={{
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            willChange: 'transform',
          }}
        >
          {tabs.slice(0, 2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} badgeCount={tab.badgeCount} onClick={tab.onClick} isScrollingDown={isShrunk} />
          ))}

          <div className="relative z-10 w-[60px] h-11 flex items-center justify-center">
            <motion.button
              type="button"
              aria-label={isPlusMenuOpen ? t('Close create menu') : t('Create')}
              aria-expanded={isPlusMenuOpen}
              onClick={() => {
                haptic.tap();
                setIsPlusMenuOpen(!isPlusMenuOpen);
                setForceOpen(true);
              }}
              className={cn(
                'rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200',
                'absolute -top-[24px] w-[60px] h-[60px]',
                isPlusMenuOpen ? 'bg-surface-inverse text-surface-inverse-foreground' : 'bg-accent text-accent-foreground',
              )}
              style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.14)' }}
              whileTap={{ scale: 0.94 }}
            >
              {isPlusMenuOpen ? (
                <IconClose size={28} color="currentColor" strokeWidth={2.4} />
              ) : (
                <IconPlus size={28} color="currentColor" strokeWidth={2.4} />
              )}
            </motion.button>
          </div>

          {tabs.slice(2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} badgeCount={tab.badgeCount} onClick={tab.onClick} isScrollingDown={isShrunk} />
          ))}
        </motion.div>
      </motion.div>
      )}
    </>
  );
};

export default BottomNavigation;