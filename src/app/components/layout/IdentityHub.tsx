import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  ArrowUpRight,
  MessageSquare,
  Calendar as CalendarIcon,
  CreditCard,
  FileText,
  Box,
  Music2,
  Split,
  Fingerprint
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { menuContainerVariants, menuItemVariants } from '@/styles/motion';
import { USER } from '@/app/data/user';
import { Band } from '@/app/data/bands';
import { NotificationItem } from '@/app/data/notifications';

interface NotificationGroup {
  type: string;
  items: NotificationItem[];
}

interface IdentityHubProps {
  isOpen: boolean;
  onClose: () => void;
  bands: Band[];
  selectedBand: Band;
  setSelectedBand: (band: Band) => void;
  notificationGroups: NotificationGroup[];
  unreadCount: number;
  onNotificationClick: (ids: number[], actionType: string) => void;
}

export const IdentityHub: React.FC<IdentityHubProps> = ({
  isOpen,
  onClose,
  bands,
  selectedBand,
  setSelectedBand,
  notificationGroups,
  unreadCount,
  onNotificationClick
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[60] bg-[#050505] overflow-y-auto px-4 pt-12 pb-32 text-white"
        >
          {/* Creative Background Element */}
          <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#D4FB46] rounded-full blur-[100px] animate-pulse" />
          </div>

          {/* Header */}
          <motion.div 
            className="flex justify-between items-start mb-8 relative z-10" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.2 }}
          >
            <div>
              <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest mb-1 block">Identity Hub</span>
              <h2 className="text-3xl font-black tracking-tighter">Who you are</h2>
            </div>
            <button 
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-[#1C1C1E]/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform hover:bg-[#1C1C1E]"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>

          {/* STAGGERED LIST CONTAINER */}
          <motion.div variants={menuContainerVariants} initial="hidden" animate="show" exit="exit" className="relative z-10">

            {/* NOTIFICATIONS SECTION */}
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.div variants={menuItemVariants} exit={{ opacity: 0, height: 0 }} className="mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4 px-2 flex items-center justify-between">
                    <span>Latest Updates</span>
                    <span className="text-[#D4FB46]">{unreadCount} new</span>
                  </h3>
                  <div className="space-y-3">
                    {notificationGroups.map((group) => {
                      const isStack = group.items.length > 1;
                      const latestItem = group.items[0];
                      
                      return (
                        <motion.div 
                          key={group.type}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          onClick={() => onNotificationClick(group.items.map(i => i.id), latestItem.actionType)}
                          whileTap={{ scale: 0.98 }}
                          className="relative cursor-pointer group"
                        >
                          {/* Stack Effect */}
                          {isStack && (
                            <div className="absolute top-2 left-0 w-full h-full bg-[#E6E5E1]/30 rounded-[1.5rem] scale-[0.95] translate-y-1 z-0" />
                          )}
                          
                          <div className={cn(
                            "p-4 rounded-[1.5rem] flex items-center justify-between border transition-all relative z-10 bg-[#E6E5E1] border-transparent text-[#1A1A1A] shadow-lg",
                            isStack && "hover:translate-y-1"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center border bg-[#D4FB46] border-black text-black">
                                {group.type === 'chat' && <MessageSquare className="w-4 h-4" />}
                                {group.type === 'event' && <CalendarIcon className="w-4 h-4" />}
                                {group.type === 'finance' && <CreditCard className="w-4 h-4" />}
                              </div>
                              <div className="flex flex-col">
                                <h4 className="text-xs font-black uppercase tracking-wide text-[#1A1A1A]">
                                  {isStack ? `${group.items.length} New ${group.type === 'chat' ? 'Messages' : 'Updates'}` : latestItem.title}
                                </h4>
                                <p className="text-sm font-medium leading-tight truncate max-w-[180px] text-[#1A1A1A]/80">
                                  {isStack ? "Tap to view all updates" : latestItem.message}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              {isStack && <span className="bg-black text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1">+{group.items.length - 1}</span>}
                              <span className="text-[9px] font-bold uppercase text-[#1A1A1A]/50">{latestItem.time}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PROFILE CARD */}
            <motion.div variants={menuItemVariants} className="bg-gradient-to-br from-[#1C1C1E] to-[#0A0A0A] rounded-[2rem] p-1 mb-8 border border-white/10 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="bg-[#111111] rounded-[1.8rem] p-5 flex items-center gap-5 relative z-10">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-[#1C1C1E] flex items-center justify-center text-white font-black text-xl border border-white/10 z-10 relative">
                    {USER.initials}
                  </div>
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-[#D4FB46] rounded-full border-2 border-[#111111] z-20 shadow-[0_0_10px_#D4FB46]" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight leading-none mb-1 text-white">{USER.name} {USER.surname}</h2>
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wide">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                      <Fingerprint className="w-3 h-3 text-[#D4FB46]" />
                      <span className="text-[#D4FB46]">{USER.role}</span>
                    </div>
                    <span>{USER.subRole}</span>
                  </div>
                  <button className="text-[10px] font-bold text-stone-600 uppercase mt-2 hover:text-white transition-colors flex items-center gap-1">
                    Edit Profile <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Band Selection */}
            <motion.div variants={menuItemVariants} className="space-y-4 mb-8">
              {bands.map((band) => (
                <motion.div 
                  key={band.id} 
                  onClick={() => setSelectedBand(band)}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "p-6 rounded-[2.5rem] relative overflow-hidden transition-all cursor-pointer border", 
                    selectedBand.id === band.id 
                      ? "bg-[#D4FB46] text-black shadow-[0_0_30px_-10px_rgba(212,251,70,0.3)] border-[#D4FB46]" 
                      : "bg-[#1C1C1E] text-white border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center font-black text-sm border-2", 
                        selectedBand.id === band.id ? "bg-black text-[#D4FB46] border-black" : "bg-black text-white border-black"
                      )}>
                        {band.initials}
                      </div>
                      <div>
                        <h4 className="font-black text-2xl leading-none mb-1">{band.name}</h4>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wide", 
                          selectedBand.id === band.id ? "text-black/60" : "text-stone-500"
                        )}>{band.role}</span>
                      </div>
                    </div>
                    {selectedBand.id === band.id && (
                      <span className="px-2 py-1 bg-black/10 rounded-md text-[9px] font-bold uppercase text-black animate-pulse">Active</span>
                    )}
                  </div>

                  {/* Stats Pills */}
                  <div className="grid grid-cols-3 gap-3 relative z-10">
                    {[
                      { label: "Members", val: band.members },
                      { label: "Genre", val: band.genre },
                      { label: "Plan", val: band.plan }
                    ].map((stat, i) => (
                      <div key={i} className={cn(
                        "py-3 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm", 
                        selectedBand.id === band.id ? "bg-black/10" : "bg-black/30"
                      )}>
                        <span className="font-black text-lg leading-none mb-0.5">{stat.val}</span>
                        <span className={cn(
                          "text-[8px] font-bold uppercase", 
                          selectedBand.id === band.id ? "text-black/60" : "text-stone-600"
                        )}>{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
              
              <motion.button 
                variants={menuItemVariants} 
                className="w-full py-4 border-2 border-dashed border-white/10 rounded-[2rem] flex items-center justify-center gap-2 text-stone-500 font-bold text-xs uppercase hover:border-[#D4FB46] hover:text-[#D4FB46] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add New Entity
              </motion.button>
            </motion.div>

            {/* Entity Details */}
            <motion.h3 variants={menuItemVariants} className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4 px-2">Entity Details</motion.h3>
            <motion.div variants={menuItemVariants} className="space-y-2">
              {[
                { label: "Documents", icon: FileText, count: "5" },
                { label: "Inventory", icon: Box, count: "12" },
                { label: "Repertoire", icon: Music2, count: "45" },
                { label: "Finance Splits", icon: Split, count: "" },
              ].map((item, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ x: 5 }} 
                  className="flex items-center justify-between p-5 rounded-[2rem] bg-[#1C1C1E] border border-white/5 hover:bg-white/5 cursor-pointer group transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center border border-white/5">
                      <item.icon className="w-5 h-5 text-stone-500 group-hover:text-white transition-colors" />
                    </div>
                    <span className="font-bold text-sm text-white">{item.label}</span>
                  </div>
                  {item.count && (
                    <span className="bg-black px-2 py-0.5 rounded text-[10px] font-bold text-[#D4FB46] shadow-[0_0_10px_rgba(212,251,70,0.1)]">
                      {item.count}
                    </span>
                  )}
                </motion.div>
              ))}
            </motion.div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
