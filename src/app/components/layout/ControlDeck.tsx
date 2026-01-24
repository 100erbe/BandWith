import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Home, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  CreditCard,
  Bell,
  Sun,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  LogOut
} from 'lucide-react';

interface ControlDeckProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (item: string) => void;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[60] bg-[#050505] overflow-y-auto px-4 pt-12 pb-32 text-white"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest mb-1 block">Control Deck</span>
              <h2 className="text-3xl font-black tracking-tighter">Navigate</h2>
            </div>
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 2x2 Grid - Swiss Style */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {[
              { label: "Dashboard", icon: Home, onClick: "Dashboard" },
              { label: "Events", icon: CalendarIcon, onClick: "Events" },
              { label: "Messages", icon: MessageSquare, onClick: "Messages" },
              { label: "Finance", icon: CreditCard, onClick: "Finance" }
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={() => onNavigate(item.onClick)}
                className="h-32 bg-[#1C1C1E] rounded-[2rem] flex flex-col justify-between p-5 border border-white/5 hover:bg-[#D4FB46] hover:border-[#D4FB46] group transition-all active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-white group-hover:text-[#D4FB46] transition-colors" />
                </div>
                <span className="text-xl font-black text-white group-hover:text-black tracking-tight text-left">{item.label}</span>
              </button>
            ))}
          </div>

          {/* App Settings List */}
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4 px-2">App Settings</h3>
          <div className="bg-[#1C1C1E] rounded-[2rem] overflow-hidden border border-white/10 mb-8">
            {[
              { label: "Notifications", icon: Bell },
              { label: "Appearance", icon: Sun },
              { label: "Language", isLanguage: true },
              { label: "Privacy & Security", icon: ShieldCheck }
            ].map((item, i) => (
              <button 
                key={i} 
                className="w-full p-5 flex items-center justify-between border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                    {item.isLanguage ? (
                      <span className="text-xs font-bold">EN</span>
                    ) : (
                      item.icon && <item.icon className="w-4 h-4 text-stone-400" />
                    )}
                  </div>
                  <span className="font-bold text-sm">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-600" />
              </button>
            ))}
          </div>

          {/* Help & Logout */}
          <div className="space-y-3">
            <button className="w-full py-4 rounded-[1.5rem] bg-[#1C1C1E] border border-white/5 text-sm font-bold text-stone-300 hover:text-white flex items-center justify-center gap-2">
              <HelpCircle className="w-4 h-4" /> Help & Support
            </button>
            <button className="w-full py-4 rounded-[1.5rem] bg-[#1a0505] border border-red-900/30 text-sm font-bold text-red-500 hover:bg-[#2a0a0a] flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};
