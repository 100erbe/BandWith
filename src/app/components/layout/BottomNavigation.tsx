import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Menu, 
  X, 
  Plus,
  Mic2,
  FileText,
  Music
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { NavButton } from '@/app/components/navigation/NavButton';
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
  isHidden
}) => {
  const handleTabClick = (tab: TabName) => {
    setActiveTab(tab);
    closeMenus();
  };

  return (
    <motion.div 
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-[90%] max-w-[400px]"
      animate={{ y: isHidden ? 200 : 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      {/* Main Control Deck (Floating & Glass) */}
      <div className={cn(
        "backdrop-blur-2xl border shadow-2xl rounded-full px-6 py-3 flex items-center justify-between relative z-20 transition-colors duration-500",
        (isControlDeckOpen || isIdentityOpen) 
          ? "bg-[#1C1C1E] border-white/20" 
          : "bg-[#111111]/90 border-white/10"
      )}>
        <NavButton 
          icon={Home} 
          label="Home" 
          isActive={activeTab === "Home" && !isControlDeckOpen && !isIdentityOpen} 
          onClick={() => handleTabClick("Home")} 
        />
        <NavButton 
          icon={CalendarIcon} 
          label="Events" 
          isActive={activeTab === "Events"} 
          onClick={() => handleTabClick("Events")} 
        />
        
        <div className="relative -mt-8">
          <AnimatePresence>
            {isPlusMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 flex flex-col-reverse gap-3 items-center w-max z-0"
              >
                {[
                  { label: "New Gig", icon: Mic2, type: "gig" as const },
                  { label: "New Quote", icon: FileText, type: "quote" as const },
                  { label: "New Rehearsal", icon: Music, type: "rehearsal" as const }
                ].map((action, i) => (
                  <motion.button
                    key={i}
                    layoutId={`create-button-${action.type}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 bg-[#D4FB46] pl-4 pr-2 py-2 rounded-full border border-black/10 shadow-xl hover:scale-105 active:scale-95 group transition-transform"
                    onClick={() => { 
                      onCreateEvent(action.type);
                      setIsPlusMenuOpen(false); 
                    }}
                  >
                    <span className="text-xs font-black text-black uppercase tracking-wide">{action.label}</span>
                    <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
                      <action.icon className="w-4 h-4" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(212,251,70,0.4)] border-4 transition-all active:scale-95 group relative z-10",
              (isControlDeckOpen || isIdentityOpen) 
                ? "bg-[#D4FB46] border-[#000000] text-black" 
                : "bg-[#D4FB46] border-[#E6E5E1] text-[#1C1C1E]"
            )}
          >
            <Plus className={cn(
              "w-8 h-8 stroke-[3] transition-transform duration-300", 
              isPlusMenuOpen ? "rotate-45" : "group-hover:rotate-90"
            )} />
          </button>
        </div>

        <NavButton 
          icon={MessageSquare} 
          label="Chat" 
          isActive={activeTab === "Chat"} 
          onClick={() => handleTabClick("Chat")} 
        />
        <NavButton 
          icon={isControlDeckOpen ? X : Menu} 
          label="More" 
          isActive={isControlDeckOpen} 
          onClick={toggleControlDeck} 
        />
      </div>
    </motion.div>
  );
};
