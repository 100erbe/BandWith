import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Plus,
  MapPin,
  Users,
  Mic2,
  FileText,
  Truck,
  Volume2,
  Play,
  Copy,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import { CONFIRMED_GIGS } from '@/app/data/events';

interface ConfirmedExpandedProps {
  bandId: number;
  onClose: () => void;
}

export const ConfirmedExpanded: React.FC<ConfirmedExpandedProps> = ({
  onClose
}) => {
  const [expandedGigId, setExpandedGigId] = useState<number | null>(null);

  return (
    <ExpandedCardWrapper
      backgroundColor="#D4FB46"
      onClose={onClose}
      origin={{ top: '40%', left: '44%', right: '3%', bottom: '42%' }}
    >
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-[#D4FB46]/95 backdrop-blur-md" 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center text-black hover:bg-black/20 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h2 className="text-2xl font-black tracking-tight text-black">Schedule</h2>
        </div>
        <button className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-[#D4FB46] shadow-lg hover:scale-105 transition-transform">
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </motion.div>
      
      <div className="px-3 pb-32 max-w-md mx-auto w-full" onClick={() => setExpandedGigId(null)}>
        {/* Next Gig Hero */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ delay: 0.3 }} 
          className="mb-8 p-6 bg-[#050505] rounded-[2.5rem] relative overflow-hidden shadow-2xl text-white" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#D4FB46] animate-pulse" />
                  <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest">Next Operation</span>
                </div>
                <h3 className="text-3xl font-black text-white tracking-tighter leading-none mb-1">Jazz Night</h3>
                <div className="flex items-center gap-1.5 text-stone-500">
                  <MapPin className="w-3 h-3" />
                  <span className="text-xs font-bold uppercase">Blue Note, Milano</span>
                </div>
              </div>
              <div className="bg-[#1C1C1E] px-3 py-1.5 rounded-full border border-white/10 text-center">
                <span className="text-white font-black text-lg block leading-none">5</span>
                <span className="text-[9px] font-bold text-stone-500 uppercase">Days</span>
              </div>
            </div>
            
            {/* Timeline */}
            <div className="relative pt-6 pb-2">
              <div className="absolute top-[34px] left-0 w-full h-0.5 bg-white/10" />
              <div className="flex justify-between relative z-10">
                {[
                  { time: "17:00", label: "Load In", icon: Truck }, 
                  { time: "18:30", label: "Soundcheck", icon: Volume2 }, 
                  { time: "21:00", label: "Show", icon: Play, active: true }
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2", 
                      step.active 
                        ? "bg-[#D4FB46] border-[#D4FB46] text-black" 
                        : "bg-[#1C1C1E] border-white/20 text-stone-500"
                    )}>
                      <step.icon className="w-3.5 h-3.5 fill-current" />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        "text-xs font-bold", 
                        step.active ? "text-white" : "text-stone-500"
                      )}>{step.time}</span>
                      <span className="text-[9px] font-bold uppercase text-stone-600 tracking-wide">{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex -space-x-2">
                {["GB", "JT", "RS"].map((initial, i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-white text-black text-[9px] font-bold flex items-center justify-center border-2 border-black">
                    {initial}
                  </div>
                ))}
              </div>
              <button className="h-8 px-3 rounded-full bg-[#1C1C1E] border border-white/10 flex items-center gap-2 text-[10px] font-bold text-white hover:bg-[#333336]">
                <FileText className="w-3 h-3 text-[#D4FB46]" /> View Call Sheet
              </button>
            </div>
          </div>
        </motion.div>
        
        {/* Gig List */}
        <div className="space-y-3">
          <h4 className="text-sm font-black text-black uppercase tracking-wider ml-2 opacity-60 mb-2">Upcoming Gigs</h4>
          {CONFIRMED_GIGS.slice(1).map((gig, i) => { 
            const isExpanded = expandedGigId === gig.id; 
            
            return (
              <motion.div 
                key={gig.id} 
                layout 
                onClick={(e) => { e.stopPropagation(); setExpandedGigId(isExpanded ? null : gig.id); }} 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: 0.2 + (i * 0.05), type: "tween", duration: 0.25, ease: "easeOut" }} 
                className={cn(
                  "rounded-[2rem] relative overflow-hidden transition-colors cursor-pointer border border-black/5", 
                  isExpanded ? "bg-black/10" : "bg-black/5 hover:bg-black/10"
                )}
              >
                <motion.div layout className="p-5">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <motion.h4 layout className="text-xl font-black text-black leading-tight">{gig.title}</motion.h4>
                      <motion.div layout className="flex items-center gap-1.5 text-black/60 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs font-bold uppercase">{gig.venue}</span>
                      </motion.div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-black text-black">€{gig.amount}</span>
                      <span className="text-[10px] font-bold uppercase bg-black/10 px-1.5 py-0.5 rounded text-black/60">{gig.date}</span>
                    </div>
                  </div>
                  {!isExpanded && (
                    <motion.div 
                      layout 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="flex items-center gap-4 text-xs font-bold text-black/70 mt-3"
                    >
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> {gig.team.length} Team
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mic2 className="w-3.5 h-3.5" /> {gig.dress}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: "auto" }} 
                      exit={{ opacity: 0, height: 0 }} 
                      className="px-5 pb-5 pt-0"
                    >
                      <div className="h-px w-full bg-black/10 mb-4" />
                      <div className="bg-white/50 rounded-xl p-3 mb-3 flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-black/50 block mb-0.5">Address</span>
                          <p className="text-xs font-bold text-black">{gig.address}</p>
                        </div>
                        <button className="p-1.5 bg-white rounded-lg shadow-sm hover:scale-105 transition-transform">
                          <Copy className="w-3 h-3 text-black" />
                        </button>
                      </div>
                      <div className="flex gap-3 mb-3">
                        <div className="flex-1 bg-white/50 rounded-xl p-3">
                          <span className="text-[9px] font-bold uppercase text-black/50 block mb-0.5">Contact</span>
                          <p className="text-xs font-bold text-black">{gig.contactName}</p>
                        </div>
                        <div className="flex-1 bg-white/50 rounded-xl p-3">
                          <span className="text-[9px] font-bold uppercase text-black/50 block mb-0.5">Timeline</span>
                          <p className="text-xs font-bold text-black">{gig.timeline?.show} Show</p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-start text-[10px] font-bold text-black/70 bg-black/5 p-2 rounded-lg">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                        {gig.notes}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ); 
          })}
        </div>
      </div>
    </ExpandedCardWrapper>
  );
};
