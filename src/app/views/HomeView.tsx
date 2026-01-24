import React from 'react';
import { motion } from 'motion/react';
import { 
  CreditCard,
  Clock,
  FileText,
  Check,
  ArrowUpRight,
  Music,
  Activity,
  Calendar as CalendarIcon,
  MapPin
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { dashboardContainerVariants, dashboardItemVariants } from '@/styles/motion';
import { METRICS, SMART_INSIGHTS, QUICK_ACTIONS } from '@/app/data/metrics';
import { EventItem } from '@/app/data/events';
import { Band } from '@/app/data/bands';
import { ExpandedCardType } from '@/app/types';

interface HomeViewProps {
  selectedBand: Band;
  expandedCard: ExpandedCardType;
  setExpandedCard: (card: ExpandedCardType) => void;
  upcomingRehearsals: EventItem[];
  currentRehearsal: EventItem | null;
  onRehearsalClick: () => void;
  isHidden: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  selectedBand,
  expandedCard,
  setExpandedCard,
  upcomingRehearsals,
  currentRehearsal,
  onRehearsalClick,
  isHidden
}) => {
  return (
    <motion.div 
      key={`dashboard-${selectedBand.id}`} 
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className={cn(
        "flex flex-col gap-4 relative z-10",
        isHidden && "opacity-0 pointer-events-none"
      )}
    >
      {/* Row 1 */}
      <motion.div variants={dashboardItemVariants} className="grid grid-cols-12 gap-3 h-48">
        {/* FINANCE */}
        <div className="col-span-7 relative z-30">
          <motion.div 
            onClick={() => setExpandedCard("finance")}
            className="w-full h-full bg-[#050505] rounded-[2.5rem] p-6 flex flex-col justify-between relative overflow-hidden cursor-pointer shadow-xl group"
            whileHover={{ scale: 0.98 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "tween", duration: 0.15 }}
          >
            <motion.div 
              animate={{ opacity: expandedCard === 'finance' ? 0 : 1 }} 
              className="relative z-10 flex justify-between items-start h-full flex-col"
            >
              <div className="w-full flex justify-between items-start">
                <div className="bg-[#1C1C1E] p-2 rounded-full border border-white/10">
                  <CreditCard className="w-5 h-5 text-[#D4FB46]" />
                </div>
                <div className="bg-[#D4FB46] text-black px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  12%
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#E6E5E1]/60 leading-none block mb-1">Total Revenue</span>
                <span className="text-4xl font-black tracking-tighter text-[#E6E5E1]">€{METRICS.earnings.value}</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* PENDING */}
        <motion.div 
          onClick={() => setExpandedCard("pending")}
          className="col-span-5 bg-[#FFFFFF] rounded-[2.5rem] p-5 flex flex-col justify-between relative overflow-hidden cursor-pointer shadow-lg group"
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          <motion.div 
            animate={{ opacity: expandedCard === 'pending' ? 0 : 1 }} 
            className="flex flex-col justify-between h-full"
          >
            <div className="flex justify-between items-start relative z-10">
              <div className="bg-[#F2F0ED] p-2.5 rounded-full group-hover:bg-[#E6E5E1] transition-colors">
                <Clock className="w-4 h-4 text-[#1A1A1A]" />
              </div>
            </div>
            <div className="relative z-10">
              <span className="text-3xl font-black tracking-tighter text-[#1A1A1A] block">{METRICS.pending.count}</span>
              <span className="text-[10px] font-bold uppercase text-stone-400">Pending</span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* NEXT REHEARSAL CARD */}
      {upcomingRehearsals.length > 0 && currentRehearsal && (
        <motion.div 
          key="rehearsal-card"
          variants={dashboardItemVariants}
          className="w-full h-40 bg-[#0047FF] rounded-[2.5rem] p-6 flex flex-col justify-between relative overflow-hidden cursor-pointer shadow-lg shadow-blue-900/20 group"
          onClick={onRehearsalClick}
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          {/* Background Abstract Shapes */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#3366FF] rounded-full blur-2xl opacity-50" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#0033CC] rounded-full blur-xl opacity-40" />
          
          {upcomingRehearsals.length > 1 ? (
            <motion.div 
              animate={{ opacity: expandedCard === 'rehearsal' ? 0 : 1 }} 
              className="flex flex-col h-full justify-between relative z-10 w-full"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/30 transition-colors">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white text-[#0047FF] px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
                  <Activity className="w-3 h-3" />
                  Action Required
                </div>
              </div>
              <div>
                <span className="text-3xl font-black tracking-tighter text-white block leading-none mb-1">{upcomingRehearsals.length}</span>
                <span className="text-[10px] font-bold uppercase text-white/80 tracking-wide">Upcoming Rehearsals</span>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              animate={{ opacity: expandedCard === 'rehearsal' ? 0 : 1 }} 
              className="flex flex-col h-full justify-between relative z-10 w-full"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
                  <span className="text-[10px] font-bold uppercase text-white tracking-widest">Next Rehearsal</span>
                </div>
                <span className="text-sm font-bold text-white/90 tabular-nums">{currentRehearsal.time}</span>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-white leading-none truncate pr-2 tracking-tighter">{currentRehearsal.title}</h3>
                
                <div className="flex items-end justify-between">
                  <div className="flex flex-col gap-1 text-white/80">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold uppercase tabular-nums">{currentRehearsal.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold uppercase truncate max-w-[120px]">{currentRehearsal.location}</span>
                    </div>
                  </div>
                  
                  <div className="flex -space-x-2">
                    {currentRehearsal.members.slice(0,3).map((m: string, i: number) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-[#0033CC] border-2 border-[#0047FF] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                        {m}
                      </div>
                    ))}
                    {currentRehearsal.members.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-[#0033CC] border-2 border-[#0047FF] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                        +{currentRehearsal.members.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Row 2 */}
      <motion.div variants={dashboardItemVariants} className="grid grid-cols-12 gap-3 h-40">
        {/* QUOTES */}
        <motion.div 
          onClick={() => setExpandedCard("quotes")}
          className="col-span-5 bg-[#998878] rounded-[2.5rem] p-5 flex flex-col justify-between relative overflow-hidden cursor-pointer shadow-lg"
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          <motion.div 
            animate={{ opacity: expandedCard === 'quotes' ? 0 : 1 }} 
            className="flex flex-col justify-between h-full relative z-20"
          >
            <div className="flex justify-between items-start">
              <div className="bg-white/10 p-2.5 rounded-full">
                <FileText className="w-4 h-4 text-[#1A1A1A]" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black tracking-tighter text-[#1A1A1A] block">{METRICS.quotes.count}</span>
              <span className="text-[10px] font-bold uppercase text-[#1A1A1A]/60">Quotes</span>
            </div>
          </motion.div>
        </motion.div>

        {/* CONFIRMED */}
        <motion.div 
          onClick={() => setExpandedCard("confirmed")}
          className="col-span-7 bg-[#D4FB46] rounded-[2.5rem] p-5 flex flex-col justify-between relative overflow-hidden cursor-pointer shadow-lg"
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          <motion.div 
            animate={{ opacity: expandedCard === 'confirmed' ? 0 : 1 }} 
            className="flex flex-col justify-between h-full relative z-20"
          >
            <div className="flex justify-between items-start">
              <div className="bg-black/10 p-2.5 rounded-full">
                <Check className="w-4 h-4 text-black" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-black opacity-30" />
            </div>
            <div>
              <span className="text-3xl font-black tracking-tighter text-black block">{METRICS.confirmed.count}</span>
              <span className="text-[10px] font-bold uppercase text-black/60">Confirmed</span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ACTION CENTER */}
      <motion.div variants={dashboardItemVariants} className="mt-16">
        <div className="flex items-end gap-6 mb-8 px-1">
          <h2 className="text-5xl font-black uppercase tracking-tighter text-[#1A1A1A] leading-[0.85]">ACTION<br/>CENTER</h2>
          <div className="h-[1.5px] flex-1 bg-stone-300 mb-2" />
        </div>
        
        {/* Actions */}
        <div className="overflow-x-auto pb-4 -mx-3 px-3 scrollbar-hide mb-4">
          <div className="flex gap-3 w-max">
            {QUICK_ACTIONS.map((action) => (
              <button 
                key={action.id} 
                className="w-36 h-32 bg-white rounded-[1.8rem] p-4 flex flex-col justify-between shadow-sm active:scale-95 transition-all group relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center text-stone-700 group-hover:bg-[#1A1A1A] group-hover:text-[#D4FB46] transition-colors relative z-10">
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase text-left text-[#1A1A1A] leading-tight px-1 group-hover:text-black relative z-10">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Insights */}
        <div className="overflow-x-auto pb-8 -mx-3 px-3 scrollbar-hide">
          <div className="flex gap-3 w-max">
            {SMART_INSIGHTS.map((item) => (
              <div 
                key={item.id} 
                className={cn(
                  "w-72 p-6 rounded-[2.2rem] flex flex-col justify-between shrink-0 relative overflow-hidden shadow-xl min-h-[160px]", 
                  item.color
                )}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={cn("p-2.5 rounded-full backdrop-blur-sm bg-white/10", item.textColor)}>
                    <item.icon className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h4 className={cn("text-[10px] font-bold uppercase tracking-widest mb-2 opacity-60", item.textColor)}>
                    {item.title}
                  </h4>
                  <p className={cn("font-bold text-xl leading-tight mb-6 tracking-tight", item.textColor)}>
                    {item.desc}
                  </p>
                  <button className={cn(
                    "h-10 px-5 rounded-full text-xs font-bold uppercase tracking-wide w-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm", 
                    item.textColor === "text-white" ? "bg-white text-black" : "bg-[#1A1A1A] text-white"
                  )}>
                    {item.action} <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
