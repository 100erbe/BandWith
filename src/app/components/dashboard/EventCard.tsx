import React from 'react';
import { motion } from 'motion/react';
import { Clock, MapPin, MoreHorizontal } from 'lucide-react';
import { springs } from '@/styles/motion';
import { StatusBadge } from '@/app/components/ui/StatusBadge';

export interface EventData {
  id: number;
  eventId?: string;
  title: string;
  status: string;
  date: string;
  time: string;
  location: string;
  price: string;
  members: string[];
  color: string;
  notes?: string;
  createdBy?: string;
  setlistId?: string;
  clientName?: string;
  venueAddress?: string;
  venueCity?: string;
  guests?: number;
  eventType?: string;
  loadInTime?: string;
  soundcheckTime?: string;
  endTime?: string;
}

interface EventCardProps {
  event: EventData;
  onClick: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  return (
    <motion.div
      layoutId={`card-${event.id}`}
      onClick={onClick}
      className="bg-white p-5 rounded-[2rem] relative overflow-hidden group shadow-sm border border-transparent hover:border-black/5 cursor-pointer"
      whileHover={{ scale: 1.02 }}
      transition={springs.smooth}
      style={{ borderRadius: "2rem" }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4">
            {/* Date Block */}
            <motion.div 
              layoutId={`date-block-${event.id}`}
              className="flex flex-col items-center justify-center w-14 h-14 bg-stone-100 rounded-2xl group-hover:bg-[#D4FB46] transition-colors shrink-0"
            >
                <span className="text-[10px] font-black uppercase text-stone-400 group-hover:text-black leading-none mb-0.5">
                  {event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short' }) : 'TBD'}
                </span>
                <span className="text-xl font-black text-[#1A1A1A] leading-none group-hover:text-black">{event.date?.split('-')[2] || '--'}</span>
            </motion.div>
            
            {/* Title & Status */}
            <div>
                <motion.div layoutId={`status-${event.id}`}>
                  <StatusBadge status={event.status} />
                </motion.div>
                <motion.h4 
                  layoutId={`title-${event.id}`}
                  className="text-2xl font-black text-[#1A1A1A] leading-tight mt-1 group-hover:text-black/80"
                >
                  {event.title}
                </motion.h4>
            </div>
        </div>
        
        {/* Menu Button */}
        <motion.button 
          layoutId={`menu-btn-${event.id}`}
          className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 hover:text-black hover:bg-stone-100 transition-colors"
        >
            <MoreHorizontal className="w-4 h-4" />
        </motion.button>
      </div>
      
      {/* Metadata */}
      <motion.div 
        layoutId={`meta-${event.id}`}
        className="flex items-center gap-3 text-xs font-bold text-stone-400 uppercase tracking-wide mb-6 pl-1"
      >
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {event.time}</span>
          <span className="w-1 h-1 rounded-full bg-stone-300" />
          <span className="flex items-center gap-1.5 truncate max-w-[150px]"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
      </motion.div>

      {/* Footer */}
      <motion.div 
        layoutId={`footer-${event.id}`}
        className="flex items-center justify-between border-t border-stone-100 pt-4"
      >
          <div className="flex -space-x-2">
              {event.members.length > 0 ? event.members.map((m, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-[#1A1A1A] border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                      {m}
                  </div>
              )) : <span className="text-[10px] font-bold text-stone-400 uppercase">No team</span>}
          </div>
          <span className="text-xl font-black text-[#1A1A1A]">€{event.price}</span>
      </motion.div>
    </motion.div>
  );
};
