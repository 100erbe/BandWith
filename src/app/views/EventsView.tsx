import React from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  ArrowLeft,
  ArrowUpRight,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { EventCard, EventData } from '@/app/components/dashboard/EventCard';
import { EVENTS_DATA, EVENT_FILTERS } from '@/app/data/events';

interface EventsViewProps {
  eventFilter: string;
  setEventFilter: (filter: string) => void;
  eventSearch: string;
  setEventSearch: (search: string) => void;
  eventView: 'list' | 'calendar';
  groupedEvents: [string, typeof EVENTS_DATA][];
  onEventClick: (event: EventData) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  eventFilter,
  setEventFilter,
  eventSearch,
  setEventSearch,
  eventView,
  groupedEvents,
  onEventClick
}) => {
  return (
    <motion.div 
      key="events"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 relative z-10 pb-32"
    >
      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            placeholder="Search events..."
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            className="w-full bg-white h-14 pl-12 pr-4 rounded-[1.5rem] text-sm font-bold text-[#1A1A1A] placeholder:text-stone-300 border-none shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4FB46]" 
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {EVENT_FILTERS.map((f) => {
            const count = f === "All" ? EVENTS_DATA.length : EVENTS_DATA.filter(e => {
              if(f === "Confirmed") return e.status === "CONFIRMED";
              if(f === "Tentative") return e.status === "TENTATIVE";
              if(f === "Pending") return e.status === "QUOTE";
              return false;
            }).length;
            return (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all border",
                  eventFilter === f 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-stone-600 border-stone-100 hover:bg-stone-50"
                )}
              >
                {f} <span className={cn("ml-1", eventFilter === f ? "text-[#D4FB46]" : "text-stone-400")}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {eventView === 'list' ? (
        <div className="space-y-6">
          {groupedEvents.map(([date, events]) => (
            <motion.div key={date} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="space-y-3">
                {events.map((event) => (
                  <EventCard 
                    key={event.id}
                    event={event as EventData} 
                    onClick={() => onEventClick(event as EventData)} 
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        // CALENDAR VIEW
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-[#1A1A1A] rounded-[2.5rem] p-6 text-white mb-8 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <button className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-[#D4FB46] uppercase tracking-[0.2em] mb-1">Current Month</span>
                <h3 className="text-2xl font-black uppercase tracking-wider leading-none">January <span className="text-stone-600">26</span></h3>
              </div>
              <button className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-2 text-center mb-4">
              {['S','M','T','W','T','F','S'].map((d,i) => (
                <div key={i} className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {/* Offset for Jan 1 2026 (Thursday) -> 4 empty slots */}
              {[...Array(4)].map((_,i) => <div key={`empty-${i}`} />)}
              {[...Array(31)].map((_, i) => {
                const day = i + 1;
                const isToday = day === 21;
                return (
                  <div 
                    key={day} 
                    className={cn(
                      "aspect-square rounded-full flex items-center justify-center text-sm font-bold cursor-pointer transition-all",
                      isToday 
                        ? "bg-[#D4FB46] text-black shadow-[0_0_20px_rgba(212,251,70,0.3)] scale-110 z-10" 
                        : "hover:bg-white/10 text-stone-400 hover:text-white"
                    )}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">Upcoming in Jan</h3>
            <button className="text-[10px] font-bold text-[#1A1A1A] uppercase border-b border-black/20 hover:border-black transition-colors">View All</button>
          </div>
          
          <div className="space-y-2">
            {EVENTS_DATA.slice(0, 4).map((event) => (
              <div 
                key={event.id} 
                className="bg-white p-4 rounded-[2rem] border border-black/5 hover:border-black/10 transition-colors flex items-center gap-5 group cursor-pointer"
              >
                <div className={cn(
                  "w-14 h-14 rounded-full flex flex-col items-center justify-center shrink-0 border-2 transition-colors", 
                  event.status === 'CONFIRMED' 
                    ? "bg-green-100 text-green-700 border-green-200" 
                    : "bg-black text-[#D4FB46] border-transparent"
                )}>
                  <span className="text-[8px] font-black uppercase opacity-60 leading-none mb-0.5">Jan</span>
                  <span className="text-lg font-black leading-none">{event.date.split('-')[2]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-black text-[#1A1A1A] leading-none mb-1 truncate group-hover:text-black/70 transition-colors">
                    {event.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-stone-400 uppercase tracking-wide">
                    <span>{event.time}</span>
                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                    <span className="truncate">{event.location}</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full border border-stone-100 flex items-center justify-center group-hover:bg-[#1A1A1A] group-hover:border-[#1A1A1A] transition-colors">
                  <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#D4FB46]" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
