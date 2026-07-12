import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { TabName, CreateEventType } from '@/app/types';

/* ── SVG icons ── */

const IconHome: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.75 20.25H20.25V11.25C20.2501 11.1515 20.2307 11.0539 20.1931 10.9629C20.1555 10.8718 20.1003 10.7891 20.0306 10.7194L12.5306 3.21938C12.461 3.14964 12.3783 3.09432 12.2872 3.05658C12.1962 3.01884 12.0986 2.99941 12 2.99941C11.9014 2.99941 11.8038 3.01884 11.7128 3.05658C11.6217 3.09432 11.539 3.14964 11.4694 3.21938L3.96937 10.7194C3.89975 10.7891 3.84454 10.8718 3.8069 10.9629C3.76926 11.0539 3.74992 11.1515 3.75 11.25V20.25Z" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconMusic: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.875 18C18.3247 18 19.5 16.8247 19.5 15.375C19.5 13.9253 18.3247 12.75 16.875 12.75C15.4253 12.75 14.25 13.9253 14.25 15.375C14.25 16.8247 15.4253 18 16.875 18Z" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.875 21C6.32475 21 7.5 19.8247 7.5 18.375C7.5 16.9253 6.32475 15.75 4.875 15.75C3.42525 15.75 2.25 16.9253 2.25 18.375C2.25 19.8247 3.42525 21 4.875 21Z" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.5 6.75L7.5 9.75" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 18.375V5.25L19.5 2.25V15.375" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconPlus: React.FC<{ color: string; className?: string }> = ({ color, className }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3.75 12H20.25" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3.75V20.25" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconChat: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.23281 21.5728C4.12357 21.6647 3.99038 21.7235 3.84887 21.7423C3.70737 21.7612 3.56343 21.7392 3.43397 21.679C3.30451 21.6189 3.1949 21.523 3.11803 21.4028C3.04116 21.2825 3.00021 21.1428 3 21V6C3 5.80109 3.07902 5.61032 3.21967 5.46967C3.36032 5.32902 3.55109 5.25 3.75 5.25H20.25C20.4489 5.25 20.6397 5.32902 20.7803 5.46967C20.921 5.61032 21 5.80109 21 6V18C21 18.1989 20.921 18.3897 20.7803 18.5303C20.6397 18.671 20.4489 18.75 20.25 18.75H7.5L4.23281 21.5728Z" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconMenu: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.75 12H20.25" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.75 6H20.25" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.75 18H20.25" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconClose: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.5 19.5L19.5 4.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.5 4.5L19.5 19.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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
}

type TabDescriptor = {
  key: string;
  label: string;
  icon: React.FC<{ color: string }>;
  isActive: boolean;
  onClick: () => void;
};

/* ═══ Uniform sliding capsule pill — 2px inset, identical geometry ═══ */

const PILL_LEFT_OFFSET = 2; // 2px from left edge of tab button
const PILL_RIGHT_OFFSET = 2; // 2px from right edge of tab button

const SlidingPill: React.FC<{ containerRef: React.RefObject<HTMLDivElement | null>; activeKey: string | null; isScrollingDown: boolean; forceOpen: boolean }> = ({
  containerRef,
  activeKey,
  isScrollingDown,
  forceOpen,
}) => {
  const pillRef = useRef<HTMLDivElement>(null);
  const [[x, w], setRect] = useState<[number, number]>([0, 0]);

  const calcPill = useCallback(() => {
    if (!containerRef.current || !activeKey) return;
    const tabEl = containerRef.current.querySelector(`[data-tab-key="${activeKey}"]`) as HTMLElement | null;
    if (!tabEl) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();

    // Uniform pill: tab button width minus 4px total for 2px left + 2px right inset
    const pillWidth = tabRect.width - 4;
    const tabCenter = (tabRect.left - containerRect.left) + (tabRect.width / 2);
    const pillLeft = tabCenter - (pillWidth / 2);

    setRect([pillLeft, pillWidth]);
  }, [activeKey, containerRef]);

  // Use useLayoutEffect so DOM reads happen synchronously after render
  useLayoutEffect(() => {
    calcPill();
  }, [calcPill]);

  // When the nav transitions between shrink/expand states, wait for CSS transition
  // to finish before recalculating pill position
  useEffect(() => {
    // Use requestAnimationFrame to let the browser complete layout transitions first
    const raf = requestAnimationFrame(() => {
      calcPill();
    });
    return () => cancelAnimationFrame(raf);
  }, [isScrollingDown, forceOpen, calcPill]);

  // Resize handler
  useEffect(() => {
    window.addEventListener('resize', calcPill);
    return () => window.removeEventListener('resize', calcPill);
  }, [calcPill]);

  return (
    <motion.div
      ref={pillRef}
      className="absolute rounded-full bg-foreground/10 z-0"
      style={{ top: '2px', bottom: '2px' }}
      animate={{ left: x, width: w }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 1 }}
    />
  );
};

/* ═══ NavTab sub-component ═══ */

const NavTab: React.FC<{
  tabKey: string;
  label: string;
  icon: React.FC<{ color: string }>;
  isActive: boolean;
  onClick: () => void;
  isScrollingDown: boolean;
  isMenuOpen: boolean;
}> = ({ tabKey, label, icon: Icon, isActive, onClick, isScrollingDown, isMenuOpen }) => {
  const activeColor = isMenuOpen ? '#FFFFFF' : 'var(--fg)';
  const inactiveColor = isMenuOpen ? 'rgba(255,255,255,0.30)' : 'var(--muted-fg)';
  const strokeColor = isActive ? activeColor : inactiveColor;

  return (
    <button
      data-tab-key={tabKey}
      onClick={onClick}
      className={cn(
        'relative z-10 flex flex-col items-center justify-center outline-none px-0 shrink-0 h-full',
        'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        isScrollingDown ? 'w-12' : 'w-16'
      )}
    >
      <div className="flex flex-col items-center justify-center w-full">
        <div className="w-[24px] h-[24px] flex items-center justify-center z-10 relative">
          <Icon color={strokeColor} />
        </div>
        
        <div className={cn(
          'overflow-hidden flex items-start justify-center w-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          isScrollingDown ? 'h-0 opacity-0' : 'h-[16px] mt-[2px] opacity-100'
        )}>
          <span className={cn(
            'text-[10px] font-black tracking-wide select-none leading-[14px]',
            isActive ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {label}
          </span>
        </div>
      </div>
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
}) => {
  const navRef = useRef<HTMLDivElement>(null);
  
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    if (!isScrollingDown) {
      setForceOpen(false);
    }
  }, [isScrollingDown]);

  const effectiveIsScrollingDown = isScrollingDown && !forceOpen;

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
  const inactiveHamburger = isMenuOpen ? 'rgba(255,255,255,0.30)' : '#737373';

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
    { key: 'Events', label: 'Calendar', icon: IconMusic, isActive: isEventsActive, onClick: () => handleTabClick('Events') },
    { key: 'Chat', label: 'Chat', icon: IconChat, isActive: isChatActive, onClick: () => handleTabClick('Chat') },
    {
      key: 'Settings',
      label: 'Settings',
      icon: ({ color }: { color: string }) => (isControlDeckOpen ? <IconClose color={color} /> : <IconMenu color={inactiveHamburger} />),
      isActive: isSettingsActive,
      onClick: () => {
        toggleControlDeck();
        setForceOpen(true);
      },
    },
  ];

  return (
    <>
      {/* Plus Menu Bottom Sheet - Moved out of the flex-center container to guarantee stable full-width layout */}
      <AnimatePresence>
        {isPlusMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[10px]"
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
              <div className="flex flex-col gap-10">
                {isAdmin && (
                  <button onClick={() => { onCreateEvent('gig'); setIsPlusMenuOpen(false); }} className="flex items-start gap-5 w-full text-left">
                    <div className="grid grid-cols-3 grid-rows-5 gap-1 w-[40px] h-[70px] shrink-0">
                      <div className="col-span-3 bg-accent-gig rounded-[10px]" />
                      <div className="bg-accent-gig rounded-[10px] row-span-3" />
                      <div className="bg-foreground/10 rounded-[10px]" /><div className="bg-foreground/10 rounded-[10px]" /><div className="bg-foreground/10 rounded-[10px]" />
                      <div className="bg-foreground/10 rounded-[10px]" /><div className="bg-foreground/10 rounded-[10px]" />
                      <div className="bg-accent-gig rounded-[10px]" />
                      <div className="col-span-3 bg-accent-gig rounded-[10px]" />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <span className="text-[22px] font-bold text-foreground uppercase">NEW GIG</span>
                      <span className="text-[12px] font-medium text-foreground/60 leading-normal">Click to create a new gig—your next live performance—right in the app.</span>
                    </div>
                  </button>
                )}
                <button onClick={() => { onCreateEvent('rehearsal'); setIsPlusMenuOpen(false); }} className="flex items-start gap-5 w-full text-left">
                  <div className="grid grid-cols-3 grid-rows-5 gap-1 w-[40px] h-[70px] shrink-0">
                    <div className="col-span-3 bg-accent-rehearsal rounded-[10px]" />
                    <div className="bg-accent-rehearsal rounded-[10px]" /><div className="bg-foreground/10 rounded-[10px]" />
                    <div className="bg-accent-rehearsal rounded-[10px]" /><div className="col-span-3 bg-accent-rehearsal rounded-[10px]" />
                    <div className="bg-accent-rehearsal rounded-[10px] row-span-2" /><div className="bg-accent-rehearsal rounded-[10px]" />
                    <div className="bg-foreground/10 rounded-[10px]" /><div className="bg-foreground/10 rounded-[10px]" /><div className="bg-accent-rehearsal rounded-[10px]" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <span className="text-[22px] font-bold text-foreground uppercase">NEW REHEARSAL</span>
                    <span className="text-[12px] font-medium text-foreground/60 leading-normal">Plan the session, share details, and keep everyone in sync.</span>
                  </div>
                </button>
                {isAdmin && (
                  <button onClick={() => { onCreateEvent('quote'); setIsPlusMenuOpen(false); }} className="flex items-start gap-5 w-full text-left">
                    <div className="grid grid-cols-3 grid-rows-5 gap-1 w-[40px] h-[70px] shrink-0">
                      <div className="col-span-3 bg-accent-quote rounded-[10px]" />
                      <div className="bg-accent-quote rounded-[10px] row-span-3" /><div className="bg-foreground/10 rounded-[10px]" />
                      <div className="bg-accent-quote rounded-[10px] row-span-3" /><div className="bg-foreground/10 rounded-[10px]" />
                      <div className="bg-accent-quote rounded-[10px]" />
                      <div className="col-span-3 bg-accent-quote rounded-[10px]" />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <span className="text-[22px] font-bold text-foreground uppercase">NEW QUOTE</span>
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
        <div
          ref={navRef}
          className={cn(
            'pointer-events-auto relative flex items-center justify-center rounded-[999px]',
            isMenuOpen ? 'bg-[rgba(28,28,30,0.95)]' : 'bg-background/85',
            'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            effectiveIsScrollingDown ? 'h-10 gap-x-1.5 px-2' : 'h-[44px] gap-x-2 px-2'
          )}
          style={{
            boxShadow: '0px 0px 4px 0px rgba(0,0,0,0.04), 0px 8px 16px 0px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '0.5px solid var(--nav-border, rgba(0,0,0,0.08))',
          }}
        >
          <SlidingPill containerRef={navRef} activeKey={pillActiveKey} isScrollingDown={effectiveIsScrollingDown} forceOpen={forceOpen} />

          {tabs.slice(0, 2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} onClick={tab.onClick} isScrollingDown={effectiveIsScrollingDown} isMenuOpen={isMenuOpen} />
          ))}

          <div className="relative z-10 flex items-center justify-center mx-1">
            <button
              onClick={() => {
                setIsPlusMenuOpen(!isPlusMenuOpen);
                setForceOpen(true);
              }}
              className={cn(
                'bg-accent rounded-[16px] flex items-center justify-center shrink-0 active:scale-95 shadow-[0px_4px_16px_rgba(0,0,0,0.15)]',
                'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                effectiveIsScrollingDown ? 'w-[40px] h-[40px] -translate-y-2' : 'w-[44px] h-[44px] -translate-y-3'
              )}
            >
              <IconPlus color="var(--accent-fg)" className={cn('transition-transform duration-300', isPlusMenuOpen && 'rotate-45')} />
            </button>
          </div>

          {tabs.slice(2).map((tab) => (
            <NavTab key={tab.key} tabKey={tab.key} label={tab.label} icon={tab.icon} isActive={tab.isActive} onClick={tab.onClick} isScrollingDown={effectiveIsScrollingDown} isMenuOpen={isMenuOpen} />
          ))}
        </div>
      </motion.div>
    </>
  );
};

export default BottomNavigation;