import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Calendar as CalendarIcon,
  Plus,
  Mic2,
  Music
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { EventData } from '@/app/components/dashboard/EventCard';

interface EventsViewProps {
  eventFilter: string;
  setEventFilter: (filter: string) => void;
  eventSearch: string;
  setEventSearch: (search: string) => void;
  eventView: 'list' | 'calendar';
  groupedEvents: [string, EventData[]][];
  allEvents: EventData[];
  onEventClick: (event: EventData) => void;
  onCreateEvent?: () => void;
  isAdmin?: boolean;
}

const FILTERS = ['All', 'GIGS', 'REHEARSAL', 'QUOTE', 'DRAFT'] as const;

const TAG_COLORS: Record<string, string> = {
  gig: 'bg-[#D5FB46] text-black',
  outdoor: 'bg-[#D5FB46] text-black',
  confirmed: 'bg-[#D5FB46] text-black',
  rehearsal: 'bg-[#0147FF] text-white',
  series: 'bg-[#0147FF] text-white',
  quote: 'bg-[#9A8878] text-white',
  draft: 'bg-black/20 text-black/60',
  pending: 'bg-[#9A8878] text-white',
};

const DotGrid: React.FC<{ filled: number; total: number; cols?: number; rows?: number; activeColor?: string }> = ({
  filled, total, cols = 6, rows = 2, activeColor = '#D5FB46'
}) => {
  const capped = Math.min(filled, total);
  return (
    <div
      className="grid w-full gap-[4px]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        height: 32,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{ backgroundColor: i < capped ? activeColor : 'rgba(0,0,0,0.1)' }}
        />
      ))}
    </div>
  );
};

const getEventTags = (event: EventData): string[] => {
  const tags: string[] = [];
  const status = event.status?.toUpperCase();
  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    tags.push('GIG');
    if (event.location && (event.location.toLowerCase().includes('outdoor') || event.location.toLowerCase().includes('park') || event.location.toLowerCase().includes('garden'))) {
      tags.push('OUTDOOR');
    }
  } else if (status === 'REHEARSAL') {
    tags.push('REHEARSAL');
  } else if (status === 'QUOTED' || status === 'QUOTE') {
    tags.push('QUOTE');
    tags.push('OUTDOOR');
  } else if (status === 'DRAFT' || status === 'PENDING') {
    tags.push('DRAFT');
  }
  return tags;
};

const getTagStyle = (tag: string, eventStatus?: string): string => {
  const s = eventStatus?.toUpperCase();
  if (s === 'QUOTED' || s === 'QUOTE') return 'bg-[#9A8878] text-white';
  if (s === 'DRAFT' || s === 'PENDING') return 'bg-black/20 text-black/60';
  const key = tag.toLowerCase();
  return TAG_COLORS[key] || 'bg-[#D5FB46] text-black';
};

const getDotColor = (eventStatus?: string): string => {
  const s = eventStatus?.toUpperCase();
  if (s === 'REHEARSAL') return '#0147FF';
  if (s === 'QUOTED' || s === 'QUOTE') return '#9A8878';
  return '#D5FB46';
};

const getCalendarColor = (event: EventData): string => {
  const status = event.status?.toUpperCase();
  if (status === 'REHEARSAL') return '#0147FF';
  if (status === 'CONFIRMED' || status === 'COMPLETED') return '#D5FB46';
  if (status === 'QUOTED' || status === 'QUOTE') return '#9A8878';
  if (status === 'DRAFT' || status === 'PENDING') return 'rgba(0,0,0,0.5)';
  return '#D5FB46';
};

const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${month} ${day}`;
};

const formatEventTime = (timeStr: string): string => {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m > 0 ? `${h}:${match[2]} ${ampm}` : `${h}${ampm}`;
  }
  return timeStr;
};

const formatBandTotal = (price: string): string => {
  if (!price) return '$0';
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return price;
  if (num >= 1000) return `$${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`;
  return `$${num}`;
};

export const EventsView: React.FC<EventsViewProps> = ({
  eventFilter,
  setEventFilter,
  allEvents,
  onEventClick,
  onCreateEvent,
  isAdmin = true
}) => {
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'All') return allEvents;
    return allEvents.filter(e => {
      const s = e.status?.toUpperCase();
      if (eventFilter === 'GIGS') return s === 'CONFIRMED' || s === 'COMPLETED';
      if (eventFilter === 'REHEARSAL') return s === 'REHEARSAL';
      if (eventFilter === 'QUOTE') return s === 'QUOTED' || s === 'QUOTE';
      if (eventFilter === 'DRAFT') return s === 'DRAFT' || s === 'PENDING';
      return true;
    });
  }, [allEvents, eventFilter]);

  const eventDatesMap = useMemo(() => {
    const map: Record<string, EventData> = {};
    allEvents.forEach(ev => {
      if (ev.date) {
        const d = new Date(ev.date);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map[key]) map[key] = ev;
      }
    });
    return map;
  }, [allEvents]);

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
  const monthName = new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long' }).toUpperCase();

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };

  const today = new Date();
  const isCurrentMonth = calendarMonth === today.getMonth() && calendarYear === today.getFullYear();

  const EmptyStateHero = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-4"
    >
      <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#D4FB46]/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-[#D4FB46] rounded-2xl flex items-center justify-center mb-6">
            <CalendarIcon className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-2xl font-black mb-2">No Events Yet</h2>
          <p className="text-white/60 text-sm mb-8 max-w-[280px]">
            Start by creating your first gig, rehearsal, or quote request.
          </p>
          {isAdmin && (
            <div className="flex flex-wrap gap-3">
              <button onClick={onCreateEvent} className="flex items-center gap-2 bg-[#D4FB46] text-black px-5 py-3 rounded-full font-bold text-sm">
                <Mic2 className="w-4 h-4" /> New Gig
              </button>
              <button onClick={onCreateEvent} className="flex items-center gap-2 bg-white/10 text-white px-5 py-3 rounded-full font-bold text-sm">
                <Music className="w-4 h-4" /> New Rehearsal
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      key="events"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-[40px] relative z-10 pb-32 min-h-[50vh]"
    >
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-[4px]">
          <span className="text-[12px] font-bold text-black uppercase leading-none">
            EVENTS
          </span>
          <h1 className="text-[32px] font-bold text-black uppercase leading-none">
            NEXT GIGS
          </h1>
        </div>
      </div>

      {allEvents.length === 0 ? (
        <EmptyStateHero />
      ) : (
        <>
          {/* ═══ FILTER PILLS ═══ */}
          <div className="flex gap-[12px] items-center overflow-x-auto scrollbar-hide -mt-[20px]">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={cn(
                  "px-[8px] py-[6px] rounded-[6px] text-[12px] whitespace-nowrap transition-all shrink-0",
                  eventFilter === f
                    ? "bg-white text-black font-bold"
                    : "bg-black/20 text-black/40 font-medium"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* ═══ CALENDAR ═══ */}
          <div className="flex flex-col gap-[20px]">
            {/* Month Navigation */}
            <div className="flex gap-[16px] items-center">
              <div className="flex gap-[12px] items-center">
                <button
                  onClick={prevMonth}
                  className="border-[1.5px] border-black border-solid rounded-full p-[4px] flex items-center"
                >
                  <ChevronLeft className="w-[20px] h-[20px]" />
                </button>
                <button
                  onClick={nextMonth}
                  className="border-[1.5px] border-black border-solid rounded-full p-[4px] flex items-center"
                >
                  <ChevronRight className="w-[20px] h-[20px]" />
                </button>
              </div>
              <span className="text-[16px] font-bold text-black uppercase">
                {monthName} {calendarYear}
              </span>
            </div>

            {/* Day Labels */}
            <div className="flex flex-col gap-[10px]">
              <div className="bg-black/10 rounded-[10px] flex">
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <div key={i} className="flex-1 py-[4px] text-center">
                    <span className="text-[10px] font-medium text-black">{d}</span>
                  </div>
                ))}
              </div>

              {/* Day Grid */}
              {(() => {
                const totalCells = firstDayOfWeek + daysInMonth;
                const numRows = Math.ceil(totalCells / 7);
                const gridHeight = numRows * 28;
                return (
                  <div
                    className="grid grid-cols-7 gap-[4px]"
                    style={{
                      gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
                      height: gridHeight,
                    }}
                  >
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const isToday = isCurrentMonth && day === today.getDate();
                      const dateKey = `${calendarYear}-${calendarMonth}-${day}`;
                      const eventOnDay = eventDatesMap[dateKey];
                      let bgColor = 'rgba(0,0,0,0.1)';
                      let textColor = 'text-black';

                      if (isToday) {
                        bgColor = '#D5FB46';
                        textColor = 'text-black';
                      } else if (eventOnDay) {
                        bgColor = getCalendarColor(eventOnDay);
                        const status = eventOnDay.status?.toUpperCase();
                        textColor = (status === 'REHEARSAL' || status === 'DRAFT' || status === 'PENDING' || status === 'QUOTE' || status === 'QUOTED') ? 'text-white' : 'text-black';
                      }

                      return (
                        <div
                          key={day}
                          className={cn(
                            "rounded-[10px] flex items-center justify-center text-[16px] font-medium",
                            textColor
                          )}
                          style={{ backgroundColor: bgColor }}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ═══ LIST HEADER ═══ */}
          <div className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-bold text-black uppercase leading-none">
              LIST
            </span>
            <h2 className="text-[32px] font-bold text-black uppercase leading-none">
              UPCOMING
            </h2>
          </div>

          {/* ═══ EVENT CARDS ═══ */}
          <div className="flex flex-col gap-[80px]">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => {
                const tags = getEventTags(event);
                const status = event.status?.toUpperCase();
                const isRehearsal = status === 'REHEARSAL';
                const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
                const memberCount = event.members?.length || 0;
                const dotColor = getDotColor(event.status);
                const arrowBg = isGig ? 'bg-black' : 'bg-white';
                const arrowColor = isGig ? 'text-[#D5FB46]' : 'text-black';

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-[20px] cursor-pointer"
                    onClick={() => onEventClick(event)}
                  >
                    {/* Top: Info + Arrow/Date */}
                    <div className="flex gap-[30px] items-start justify-end">
                      {/* Left: Tags + Title + Venue */}
                      <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                        {/* Tags */}
                        <div className="flex gap-[4px] items-center flex-wrap">
                          {tags.map((tag, i) => (
                            <div
                              key={i}
                              className={cn("rounded-[6px] px-[10px] py-[4px]", getTagStyle(tag, event.status))}
                            >
                              <span className="text-[12px] font-bold uppercase">{tag}</span>
                            </div>
                          ))}
                        </div>
                        {/* Title */}
                        <h3 className="text-[32px] font-bold text-black uppercase leading-none">
                          {event.title}
                        </h3>
                        {/* Venue + Address */}
                        <div className="flex flex-col gap-[2px]">
                          <span className="text-[16px] font-bold text-black uppercase">
                            {event.location?.split(',')[0] || 'TBD'}
                          </span>
                          {event.location?.includes(',') && (
                            <span className="text-[12px] font-medium text-black/50 uppercase">
                              {event.location.split(',').slice(1).join(',').trim()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Alert + Arrow + Date */}
                      <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                        <div className="flex gap-[6px] items-start">
                          {event.notes && (
                            <div className="bg-[#F23030] rounded-full p-[5.7px]">
                              <AlertCircle className="w-[28px] h-[28px] text-white" />
                            </div>
                          )}
                          <div className={cn("rounded-full p-[5.7px]", arrowBg)}>
                            <ArrowUpRight className={cn("w-[28px] h-[28px]", arrowColor)} />
                          </div>
                        </div>
                        <div className="bg-black/10 rounded-[10px] px-[10px] py-[10px]">
                          <span className="text-[12px] font-bold text-black uppercase whitespace-nowrap">
                            {event.date ? formatEventDate(event.date) : 'TBD'}
                            {event.time ? ` - ${formatEventTime(event.time)}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Dot Grid + Stats */}
                    <div className="flex gap-[20px] items-end">
                      {/* Team Members */}
                      <div className="w-[169px] flex flex-col gap-[10px] shrink-0">
                        <DotGrid filled={memberCount} total={12} cols={6} rows={2} activeColor={dotColor} />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-black uppercase">
                            TEAM MEMBERS
                          </span>
                          <span className="text-[42px] font-bold text-black leading-none">
                            {memberCount}
                          </span>
                        </div>
                      </div>

                      {/* Band Total or Time */}
                      <div className="flex-1 flex flex-col gap-[10px]">
                        <DotGrid
                          filled={isRehearsal ? 8 : Math.min(12, Math.ceil(parseFloat(event.price?.replace(/[^0-9.]/g, '') || '0') / 500))}
                          total={12}
                          cols={6}
                          rows={2}
                          activeColor={dotColor}
                        />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-black uppercase">
                            {isRehearsal ? 'TIME' : 'BAND TOTAL'}
                          </span>
                          <span className="text-[42px] font-bold text-black leading-none">
                            {isRehearsal ? formatEventTime(event.time || '20:00') : formatBandTotal(event.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <span className="text-[12px] font-bold text-black/40 uppercase mb-2">No Events</span>
                <span className="text-[32px] font-bold text-black uppercase leading-none">EMPTY</span>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};
