import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Search,
  Clock,
  MapPin,
  CloudRain,
  Sun,
  Phone,
  Navigation,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import { StatusBadge } from '@/app/components/ui/StatusBadge';
import { PENDING_EVENTS_BY_DATE, EVENT_FILTERS } from '@/app/data/events';
import type { Event } from '@/lib/services/events';

interface PendingExpandedProps {
  bandId: string;
  onClose: () => void;
  eventFilter: string;
  setEventFilter: (filter: string) => void;
  events?: Event[];
  loading?: boolean;
}

export const PendingExpanded: React.FC<PendingExpandedProps> = ({
  onClose,
  eventFilter,
  setEventFilter,
  events: realEvents,
  loading
}) => {
  // Convert real events to display format and group by date
  const eventsByDate = useMemo(() => {
    if (!realEvents || realEvents.length === 0) {
      return []; // No mock data - show empty state
    }

    // Group events by date
    const groups: { [key: string]: any[] } = {};
    
    realEvents.forEach(event => {
      const dateKey = event.date || event.event_date;
      if (!groups[dateKey]) groups[dateKey] = [];
      
      groups[dateKey].push({
        id: parseInt(event.id.replace(/-/g, '').slice(0, 8), 16) || Date.now(),
        title: event.title,
        status: (event.status || 'draft').toUpperCase(),
        price: event.fee ? Number(event.fee).toLocaleString() : '0',
        time: event.time || event.start_time || '00:00',
        location: event.venue || event.venue_name || 'TBD',
        weather: 'sun',
        temp: '20°',
        travelTime: '30 min',
        members: [],
        contractSigned: event.contract_signed || false
      });
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        label: getDateLabel(date),
        events
      }));
  }, [realEvents]);

  function getDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return 'This Week';
    if (diffDays <= 14) return 'Next Week';
    return 'Upcoming';
  }
  return (
    <ExpandedCardWrapper
      backgroundColor="#F7F7F5"
      onClose={onClose}
      origin={{ top: '12%', left: '61%', right: '3%', bottom: '62%' }}
    >
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-[#F7F7F5]/95 backdrop-blur-md" 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black border border-stone-200 hover:bg-stone-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-black tracking-tight text-[#1A1A1A]">Events</h2>
        </div>
      </motion.div>
      
      <div className="px-3 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.3 }} 
          className="relative mb-6"
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            placeholder="Search events..." 
            className="w-full bg-white h-12 pl-12 pr-4 rounded-[1.2rem] text-sm font-medium text-[#1A1A1A] placeholder:text-stone-400 border border-stone-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4FB46]" 
          />
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.35 }} 
          className="flex gap-2 overflow-x-auto pb-6 scrollbar-hide"
        >
          {EVENT_FILTERS.map((filter) => (
            <button 
              key={filter} 
              onClick={() => setEventFilter(filter)} 
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors", 
                eventFilter === filter 
                  ? "bg-black text-white" 
                  : "bg-white text-black border border-stone-100 shadow-sm hover:bg-stone-50"
              )}
            >
              {filter}
            </button>
          ))}
        </motion.div>
        
        <div className="space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
            </div>
          ) : eventsByDate.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-stone-400">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p className="font-bold">No pending events</p>
            </div>
          ) : null}
          {!loading && eventsByDate.map((group, groupIndex) => (
            <motion.div 
              key={group.date} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.4 + (groupIndex * 0.1) }}
            >
              <div className="flex items-baseline justify-between mb-3 px-2">
                <h3 className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider">{group.date}</h3>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{group.label}</span>
              </div>
              <div className="space-y-3">
                {group.events.map((event) => (
                  <div 
                    key={event.id} 
                    className="bg-white rounded-[1.8rem] border border-stone-100 shadow-lg shadow-stone-200/50 relative overflow-hidden group hover:scale-[1.01] transition-all"
                  >
                    <div className="p-5 pb-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={event.status} />
                          <h4 className="text-xl font-black text-[#1A1A1A] leading-tight mt-1">{event.title}</h4>
                        </div>
                        <div className="text-right">
                          <span className="block text-xl font-black text-[#1A1A1A]">€{event.price}</span>
                          {!event.contractSigned && (
                            <div className="flex items-center gap-1 justify-end text-[10px] text-red-500 font-bold mt-1 uppercase">
                              <AlertCircle className="w-3 h-3" /> No Contract
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-stone-50 rounded-2xl p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-stone-100 text-stone-500">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-stone-400 font-bold uppercase">Time</span>
                            <span className="text-sm font-bold text-[#1A1A1A]">{event.time}</span>
                          </div>
                        </div>
                        <div className="bg-stone-50 rounded-2xl p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-stone-100 text-stone-500">
                            {event.weather === 'rain' ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-stone-400 font-bold uppercase">Forecast</span>
                            <span className="text-sm font-bold text-[#1A1A1A]">{event.temp}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-stone-500 pl-1">
                        <MapPin className="w-4 h-4 text-[#D4FB46] fill-[#1A1A1A]" />
                        <span className="uppercase tracking-wide">{event.location}</span>
                        <span className="w-1 h-1 rounded-full bg-stone-300 mx-1" />
                        <span>{event.travelTime} drive</span>
                      </div>
                    </div>
                    <div className="bg-[#F7F7F5] border-t border-stone-100 p-2 flex items-center justify-between gap-2">
                      <div className="flex -space-x-2 pl-2">
                        {event.members.length > 0 ? event.members.map((initial, i) => (
                          <div key={i} className="w-8 h-8 rounded-full bg-[#1C1C1E] flex items-center justify-center text-white text-[10px] font-bold border-2 border-white relative z-10">
                            {initial}
                          </div>
                        )) : (
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">No members assigned</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button className="h-9 px-4 rounded-xl bg-white border border-stone-200 flex items-center gap-2 text-xs font-bold text-[#1A1A1A] hover:bg-stone-50 transition-colors">
                          <Phone className="w-3.5 h-3.5" /> Call
                        </button>
                        <button className="h-9 px-4 rounded-xl bg-[#1A1A1A] flex items-center gap-2 text-xs font-bold text-white shadow-lg hover:bg-black transition-colors">
                          <Navigation className="w-3.5 h-3.5" /> Go
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </ExpandedCardWrapper>
  );
};
