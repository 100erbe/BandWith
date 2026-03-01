import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { TabName, CreateEventType } from '@/app/types';

/* ── Inline SVG icons — exact Figma paths from node 80:494 ── */

const IconHome: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.75 20.25H20.25V11.25C20.2501 11.1515 20.2307 11.0539 20.1931 10.9629C20.1555 10.8718 20.1003 10.7891 20.0306 10.7194L12.5306 3.21938C12.461 3.14964 12.3783 3.09432 12.2872 3.05658C12.1962 3.01884 12.0986 2.99941 12 2.99941C11.9014 2.99941 11.8038 3.01884 11.7128 3.05658C11.6217 3.09432 11.539 3.14964 11.4694 3.21938L3.96937 10.7194C3.89975 10.7891 3.84454 10.8718 3.8069 10.9629C3.76926 11.0539 3.74992 11.1515 3.75 11.25V20.25Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconMusic: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.875 18C18.3247 18 19.5 16.8247 19.5 15.375C19.5 13.9253 18.3247 12.75 16.875 12.75C15.4253 12.75 14.25 13.9253 14.25 15.375C14.25 16.8247 15.4253 18 16.875 18Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.875 21C6.32475 21 7.5 19.8247 7.5 18.375C7.5 16.9253 6.32475 15.75 4.875 15.75C3.42525 15.75 2.25 16.9253 2.25 18.375C2.25 19.8247 3.42525 21 4.875 21Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.5 6.75L7.5 9.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 18.375V5.25L19.5 2.25V15.375" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
    <path d="M4.23281 21.5728C4.12357 21.6647 3.99038 21.7235 3.84887 21.7423C3.70737 21.7612 3.56343 21.7392 3.43397 21.679C3.30451 21.6189 3.1949 21.523 3.11803 21.4028C3.04116 21.2825 3.00021 21.1428 3 21V6C3 5.80109 3.07902 5.61032 3.21967 5.46967C3.36032 5.32902 3.55109 5.25 3.75 5.25H20.25C20.4489 5.25 20.6397 5.32902 20.7803 5.46967C20.921 5.61032 21 5.80109 21 6V18C21 18.1989 20.921 18.3897 20.7803 18.5303C20.6397 18.671 20.4489 18.75 20.25 18.75H7.5L4.23281 21.5728Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconMenu: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.75 12H20.25" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.75 6H20.25" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.75 18H20.25" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconClose: React.FC<{ color: string }> = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.5 19.5L19.5 4.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.5 4.5L19.5 19.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
}

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
}) => {
  const handleTabClick = (tab: TabName) => {
    setActiveTab(tab);
    closeMenus();
  };

  const isMenuOpen = isControlDeckOpen || isIdentityOpen;
  const isHomeActive = activeTab === "Home" && !isMenuOpen;
  const isEventsActive = activeTab === "Events" && !isMenuOpen;
  const isChatActive = activeTab === "Chat" && !isMenuOpen;

  const activeColor = isMenuOpen ? "#FFFFFF" : "#000000";
  const inactiveColor = isMenuOpen ? "rgba(255,255,255,0.30)" : "#737373";

  return (
    <motion.div 
      className="fixed left-4 right-4 z-[80]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      animate={{ y: isHidden ? 200 : 0, opacity: isHidden ? 0 : 1 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Plus Menu — Bottom Sheet (Figma: NEW - Popup) */}
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
              className="fixed bottom-0 left-0 right-0 z-[91] bg-black rounded-t-[26px] px-4 pt-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
            >
              {/* Pill handle */}
              <div className="flex justify-center mb-2.5">
                <div className="w-10 h-1 rounded-full bg-white/30" />
              </div>

              {/* Header */}
              <div className="flex items-end justify-between mb-8">
                <p className="text-[12px] font-bold text-white/50 uppercase">START</p>
                <button
                  onClick={() => setIsPlusMenuOpen(false)}
                  className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex flex-col gap-10">
                {/* NEW GIG */}
                <button
                  onClick={() => { onCreateEvent('gig'); setIsPlusMenuOpen(false); }}
                  className="flex items-start gap-5 w-full text-left"
                >
                  <div className="grid grid-cols-3 grid-rows-5 gap-1 w-[40px] h-[70px] shrink-0">
                    <div className="col-span-3 bg-[#D5FB46] rounded-[10px]" />
                    <div className="bg-[#D5FB46] rounded-[10px] row-span-3" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-[#D5FB46] rounded-[10px]" />
                    <div className="col-span-3 bg-[#D5FB46] rounded-[10px]" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <span className="text-[22px] font-bold text-white uppercase">NEW GIG</span>
                    <span className="text-[12px] font-medium text-white leading-normal">Click to create a new gig—your next live performance—right in the app.</span>
                  </div>
                </button>

                {/* NEW REHEARSAL */}
                <button
                  onClick={() => { onCreateEvent('rehearsal'); setIsPlusMenuOpen(false); }}
                  className="flex items-start gap-5 w-full text-left"
                >
                  <div className="grid grid-cols-3 grid-rows-5 gap-1 w-[40px] h-[70px] shrink-0">
                    <div className="col-span-3 bg-[#0147FF] rounded-[10px]" />
                    <div className="bg-[#0147FF] rounded-[10px]" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-[#0147FF] rounded-[10px]" />
                    <div className="col-span-3 bg-[#0147FF] rounded-[10px]" />
                    <div className="bg-[#0147FF] rounded-[10px] row-span-2" />
                    <div className="bg-[#0147FF] rounded-[10px]" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-[#0147FF] rounded-[10px]" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <span className="text-[22px] font-bold text-white uppercase">NEW REHEARSAL</span>
                    <span className="text-[12px] font-medium text-white leading-normal">Click to create a new rehearsal—plan the session, share the details, and keep everyone in sync.</span>
                  </div>
                </button>

                {/* NEW QUOTE */}
                <button
                  onClick={() => { onCreateEvent('quote'); setIsPlusMenuOpen(false); }}
                  className="flex items-start gap-5 w-full text-left"
                >
                  <div className="grid grid-cols-3 grid-rows-5 gap-1 w-[40px] h-[70px] shrink-0">
                    <div className="col-span-3 bg-[#9A8878] rounded-[10px]" />
                    <div className="bg-[#9A8878] rounded-[10px] row-span-3" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-[#9A8878] rounded-[10px] row-span-3" />
                    <div className="bg-white/20 rounded-[10px]" />
                    <div className="bg-[#9A8878] rounded-[10px]" />
                    <div className="col-span-3 bg-[#9A8878] rounded-[10px]" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <span className="text-[22px] font-bold text-white uppercase">NEW QUOTE</span>
                    <span className="text-[12px] font-medium text-white leading-normal">Click to create a quote for an event—build an estimate, package the details, and send it fast.</span>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ NAVBAR — Exact Figma node 80:494 ═══ */}
      <div 
        className={cn(
          "flex items-end justify-center rounded-[999px] transition-all duration-300",
          isMenuOpen 
            ? "bg-[rgba(28,28,30,0.92)]" 
            : "bg-[rgba(255,255,255,0.20)]"
        )}
        style={{ 
          height: 50, 
          paddingLeft: 10, 
          paddingRight: 10,
          boxShadow: '0px 0px 4px 0px rgba(0,0,0,0.04), 0px 8px 16px 0px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Tab 1: Home */}
        <button 
          onClick={() => handleTabClick("Home")}
          className="flex flex-col gap-[2px] items-center justify-center flex-1 h-full min-w-0"
        >
          <div className="shrink-0 w-[24px] h-[24px]">
            <IconHome color={isHomeActive ? activeColor : inactiveColor} />
          </div>
          {isHomeActive && (
            <motion.div 
              layoutId="nav-dot" 
              className="w-[6px] h-[6px] rounded-full bg-[#D5FB46] shrink-0" 
            />
          )}
        </button>

        {/* Tab 2: Events */}
        <button 
          onClick={() => handleTabClick("Events")}
          className="flex flex-col gap-[2px] items-center justify-center flex-1 h-full min-w-0"
        >
          <div className="shrink-0 w-[24px] h-[24px]">
            <IconMusic color={isEventsActive ? activeColor : inactiveColor} />
          </div>
          {isEventsActive && (
            <motion.div 
              layoutId="nav-dot" 
              className="w-[6px] h-[6px] rounded-full bg-[#D5FB46] shrink-0" 
            />
          )}
        </button>

        {/* Tab 3: Plus — lime rounded square, anchored to bottom */}
        <div className="flex flex-col items-center justify-end flex-1 h-full min-w-0 pb-[12px] pt-[8px]">
          <button 
            onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
            className="w-[52px] h-[52px] bg-[#D5FB46] rounded-[16px] flex items-center justify-center p-[12px] shrink-0 active:scale-95 transition-transform"
          >
            <IconPlus 
              color="#000000" 
              className={cn(
                "transition-transform duration-300",
                isPlusMenuOpen && "rotate-45"
              )} 
            />
          </button>
        </div>

        {/* Tab 4: Chat */}
        <button 
          onClick={() => handleTabClick("Chat")}
          className="flex flex-col gap-[2px] items-center justify-center flex-1 h-full min-w-0"
        >
          <div className="shrink-0 w-[24px] h-[24px]">
            <IconChat color={isChatActive ? activeColor : inactiveColor} />
          </div>
          {isChatActive && (
            <motion.div 
              layoutId="nav-dot" 
              className="w-[6px] h-[6px] rounded-full bg-[#D5FB46] shrink-0" 
            />
          )}
        </button>

        {/* Tab 5: More */}
        <button 
          onClick={toggleControlDeck}
          className="flex flex-col gap-[2px] items-center justify-center flex-1 h-full min-w-0"
        >
          <div className="shrink-0 w-[24px] h-[24px]">
            {isControlDeckOpen 
              ? <IconClose color="#FFFFFF" />
              : <IconMenu color={isMenuOpen ? "rgba(255,255,255,0.30)" : inactiveColor} />
            }
          </div>
          {isControlDeckOpen && (
            <motion.div 
              layoutId="nav-dot" 
              className="w-[6px] h-[6px] rounded-full bg-[#D5FB46] shrink-0" 
            />
          )}
        </button>
      </div>
    </motion.div>
  );
};
