import React from 'react';
import { motion } from 'motion/react';
import { springs } from '@/styles/motion';
import { StatusBadge } from '@/app/components/ui/StatusBadge';

export interface EventData {
  id: number;
  band_id?: string;
  band_name?: string;
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
  indoorOutdoor?: 'indoor' | 'outdoor' | 'hybrid';
  quoteStatus?: string;
  is_recurring?: boolean;
  recurrence_rule?: { freq?: string; frequency?: string; interval?: number; until?: string; count?: number };
  memberUserIds?: string[];
  memberFeeMap?: Record<string, string>;
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
      className="bg-card p-5 rounded-4xl relative overflow-hidden group shadow-sm border border-transparent hover:border-border cursor-pointer"
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
              className="flex flex-col items-center justify-center w-14 h-14 bg-muted rounded-2xl group-hover:bg-accent transition-colors shrink-0"
            >
                <span className="text-xs font-black uppercase text-muted-foreground group-hover:text-foreground leading-tight mb-0.5">
                  {event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short' }) : 'TBD'}
                </span>
                <span className="text-xl font-black text-foreground leading-tight group-hover:text-foreground">{event.date?.split('-')[2] || '--'}</span>
            </motion.div>
            
            {/* Title & Status */}
            <div>
                <motion.div layoutId={`status-${event.id}`}>
                  <StatusBadge status={event.status} />
                </motion.div>
                <motion.h4 
                  layoutId={`title-${event.id}`}
                  className="text-2xl font-black text-foreground leading-tight mt-1 group-hover:text-foreground/80"
                >
                  {event.title}
                </motion.h4>
            </div>
        </div>

        {/* Pill badge replaces the top-right menu icon */}
        <StatusBadge status={event.status} />
      </div>
      
      {/* Metadata — typographic only, no icons */}
      <motion.div 
        layoutId={`meta-${event.id}`}
        className="flex items-center gap-3 text-xs font-bold text-muted-foreground uppercase tracking-wide mb-6 pl-1"
      >
          <span>{event.time}</span>
          <span className="w-1 h-1 rounded-full bg-muted" />
          <span className="truncate max-w-37.5">{event.location}</span>
      </motion.div>

      {/* Footer */}
      <motion.div 
        layoutId={`footer-${event.id}`}
        className="flex items-center justify-between border-t border-border pt-4"
      >
          <div className="flex -space-x-2">
              {event.members.length > 0 ? event.members.map((m, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-surface-inverse border-2 border-border flex items-center justify-center text-accent-foreground text-xs font-bold">
                      {m}
                  </div>
              )) : <span className="text-xs font-bold text-muted-foreground uppercase">No team</span>}
          </div>
          <span className="text-xl font-black text-foreground">€{event.price}</span>
      </motion.div>
    </motion.div>
  );
};