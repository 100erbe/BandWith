import React from 'react';
import { motion } from 'motion/react';
import { X, Calendar, MapPin, Clock, Users, DollarSign, CheckCircle2 } from 'lucide-react';
import { springs } from '@/styles/motion';
import { EventData } from './EventCard';
import { StatusBadge } from '@/app/components/ui/StatusBadge';

interface EventDetailProps {
  event: EventData;
  onClose: () => void;
}

export const EventDetail: React.FC<EventDetailProps> = ({ event, onClose }) => {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />
      
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          layoutId={`card-${event.id}`}
          className="w-full max-w-lg bg-white shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]"
          style={{ borderRadius: "2rem" }}
          transition={springs.smooth}
        >
             {/* Header Section (Matching Card) */}
             <div className="relative p-6">
                {/* Close Button */}
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={onClose}
                    className="absolute top-6 right-6 w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 z-20"
                >
                    <X className="w-5 h-5" />
                </motion.button>

                <div className="flex gap-4 mb-2">
                    <motion.div 
                        layoutId={`date-block-${event.id}`}
                        className="flex flex-col items-center justify-center w-16 h-16 bg-[#D4FB46] rounded-2xl shrink-0"
                    >
                        <span className="text-[10px] font-black uppercase text-black leading-none mb-0.5">Jan</span>
                        <span className="text-2xl font-black text-black leading-none">{event.date.split('-')[2]}</span>
                    </motion.div>

                    <div>
                         <motion.div layoutId={`status-${event.id}`}>
                            <StatusBadge status={event.status} />
                         </motion.div>
                         <motion.h2 
                            layoutId={`title-${event.id}`}
                            className="text-3xl font-black text-[#1A1A1A] leading-tight mt-2"
                         >
                            {event.title}
                         </motion.h2>
                    </div>
                </div>

                <motion.div 
                    layoutId={`meta-${event.id}`}
                    className="flex items-center gap-4 text-xs font-bold text-stone-500 uppercase tracking-wide mt-4"
                >
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {event.time}</span>
                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.location}</span>
                </motion.div>
             </div>

             {/* Expanded Content */}
             <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="p-6 pt-0 flex-1 overflow-y-auto"
             >
                <div className="h-px w-full bg-stone-100 mb-6" />

                <div className="space-y-8">
                     {/* Timeline */}
                     <div>
                        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4">
                            <Clock className="w-4 h-4" /> Timeline
                        </h4>
                        <div className="space-y-4 pl-2 border-l-2 border-stone-100 ml-1.5">
                            <div className="relative pl-6">
                                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-stone-200" />
                                <span className="text-xs font-mono text-stone-400 mr-2">17:00</span>
                                <span className="font-bold text-[#1A1A1A]">Load In</span>
                            </div>
                            <div className="relative pl-6">
                                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-stone-200" />
                                <span className="text-xs font-mono text-stone-400 mr-2">18:30</span>
                                <span className="font-bold text-[#1A1A1A]">Sound Check</span>
                            </div>
                            <div className="relative pl-6">
                                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#D4FB46] ring-4 ring-[#D4FB46]/20" />
                                <span className="text-xs font-mono text-stone-400 mr-2">{event.time}</span>
                                <span className="font-bold text-[#1A1A1A]">Show Start</span>
                            </div>
                        </div>
                     </div>

                     {/* Lineup */}
                     <div>
                        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4">
                            <Users className="w-4 h-4" /> Lineup
                        </h4>
                        <div className="flex gap-2">
                             {event.members.length > 0 ? event.members.map((m, i) => (
                                <div key={i} className="flex items-center gap-2 bg-stone-50 pl-1 pr-3 py-1 rounded-full border border-stone-100">
                                    <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white text-[10px] font-bold">{m}</div>
                                    <span className="text-xs font-bold text-[#1A1A1A]">{m === 'GB' ? 'Gianluca' : m === 'CE' ? 'Centerbe' : 'Member'}</span>
                                </div>
                             )) : <span className="text-sm text-stone-500">No members assigned</span>}
                        </div>
                     </div>

                     {/* Financials */}
                     <div>
                        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4">
                            <DollarSign className="w-4 h-4" /> Financials
                        </h4>
                        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-bold uppercase text-stone-400 mb-1">Total Fee</div>
                                <div className="text-2xl font-black text-[#1A1A1A]">€{event.price}</div>
                            </div>
                            <div className="px-3 py-1 bg-[#D4FB46] rounded-full text-[10px] font-bold text-black uppercase">
                                Verified
                            </div>
                        </div>
                     </div>
                </div>

                {/* Footer Action */}
                <div className="mt-8 flex gap-3 sticky bottom-0 bg-white pt-4 border-t border-stone-100">
                     <button className="flex-1 bg-[#1A1A1A] text-white h-12 rounded-xl font-bold uppercase text-xs tracking-wide hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg">
                        <CheckCircle2 className="w-4 h-4" /> Accept Gig
                     </button>
                     <button className="px-6 border-2 border-stone-200 text-[#1A1A1A] h-12 rounded-xl font-bold uppercase text-xs tracking-wide hover:bg-stone-50 active:scale-95 transition-all">
                        Decline
                     </button>
                </div>

             </motion.div>
        </motion.div>
      </div>
    </>
  );
};
