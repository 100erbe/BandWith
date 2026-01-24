import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Briefcase
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import { METRICS, TRANSACTIONS } from '@/app/data/metrics';

interface FinanceExpandedProps {
  bandId: number;
  onClose: () => void;
}

export const FinanceExpanded: React.FC<FinanceExpandedProps> = ({
  onClose
}) => {
  return (
    <ExpandedCardWrapper
      backgroundColor="#050505"
      onClose={onClose}
      origin={{ top: '12%', left: '3%', right: '42%', bottom: '62%' }}
    >
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-[#050505]/95 backdrop-blur-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="w-10 h-10 rounded-full bg-[#1C1C1E] flex items-center justify-center text-white border border-white/10 hover:bg-[#333336] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold tracking-[0.2em] text-stone-500 uppercase">Financial Overview</span>
        <div className="w-10" />
      </motion.div>
      
      <div className="px-3 pb-32 max-w-md mx-auto w-full">
        <div className="mb-6 relative pt-2 px-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3 }} 
            className="w-full bg-[#1C1C1E] rounded-[2rem] p-6 relative overflow-hidden border border-white/5"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col">
                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-1">Net Profit (Jan)</span>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-4xl font-black text-[#D4FB46] tracking-tighter">€{METRICS.net.value}</h2>
                  <span className="text-white font-bold text-sm bg-white/10 px-2 py-0.5 rounded-full">+18%</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-[#D4FB46] rounded-full flex items-center justify-center text-black shadow-[0_0_15px_rgba(212,251,70,0.4)]">
                <Briefcase className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
              <div>
                <span className="text-stone-500 text-[10px] font-bold uppercase block mb-0.5">Total Revenue</span>
                <span className="text-white text-lg font-bold">€{METRICS.earnings.value}</span>
              </div>
              <div className="border-l border-white/10 pl-4">
                <span className="text-stone-500 text-[10px] font-bold uppercase block mb-0.5">Expenses</span>
                <span className="text-white text-lg font-bold">-€{METRICS.expenses.value}</span>
              </div>
            </div>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.25, type: "tween", duration: 0.3, ease: "easeOut" }} 
          className="w-full h-56 bg-[#101010] rounded-[2rem] border border-white/5 relative overflow-hidden mb-6 p-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-4 z-10">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Cash Flow</span>
            <div className="flex gap-2">
              <button className="w-6 h-6 rounded-full bg-[#1C1C1E] text-stone-500 flex items-center justify-center text-[10px] font-bold border border-white/5">M</button>
              <button className="w-6 h-6 rounded-full bg-[#D4FB46] text-black flex items-center justify-center text-[10px] font-bold">Y</button>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-between gap-2 relative z-10">
            {[40, 65, 45, 80, 55, 90, 70, 50, 60].map((h, i) => (
              <motion.div 
                key={i} 
                initial={{ height: "4px" }} 
                animate={{ height: `${h}%` }} 
                transition={{ delay: 0.3 + (i * 0.03), type: "tween", duration: 0.35, ease: "easeOut" }} 
                className={cn(
                  "w-full rounded-full relative group", 
                  i === 5 ? "bg-[#D4FB46] shadow-[0_0_15px_rgba(212,251,70,0.3)]" : "bg-[#1C1C1E] hover:bg-[#2C2C30]"
                )} 
              />
            ))}
          </div>
        </motion.div>
        
        <div className="flex flex-col gap-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.7 }} 
            className="flex items-center justify-between px-1"
          >
            <h3 className="text-xl font-black text-white tracking-tight">Recent Activity</h3>
            <Search className="w-5 h-5 text-stone-500" />
          </motion.div>
          
          {TRANSACTIONS.map((tx, i) => (
            <motion.div 
              key={tx.id} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.4 + (i * 0.03), type: "tween", duration: 0.25, ease: "easeOut" }} 
              className="bg-[#101010] border border-white/10 p-4 rounded-[1.5rem] relative group overflow-hidden hover:border-[#D4FB46]/50 transition-colors"
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-transform group-hover:scale-110", 
                    tx.type === 'income' ? "bg-[#1C1C1E] text-[#D4FB46]" : "bg-[#1C1C1E] text-white"
                  )}>
                    {tx.type === 'income' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold bg-[#1C1C1E] px-1.5 py-0.5 rounded text-stone-400 border border-white/5">{tx.tag}</span>
                      <span className="text-[10px] font-bold text-stone-600 uppercase">{tx.date}</span>
                    </div>
                    <h4 className="font-bold text-white text-sm tracking-wide">{tx.title}</h4>
                  </div>
                </div>
                <span className={cn(
                  "text-lg font-black tracking-tight", 
                  tx.type === 'income' ? "text-[#D4FB46]" : "text-white"
                )}>
                  {tx.amount}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </ExpandedCardWrapper>
  );
};
