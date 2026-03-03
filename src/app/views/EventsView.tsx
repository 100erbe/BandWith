import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Calendar as CalendarIcon,
  Plus,
  Search,
  X
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { EmptyState } from '@/app/components/ui/EmptyState';
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
  onDayPickerOpen?: (open: boolean) => void;
  userFeeMap?: Record<string, number>;
}

const FILTERS = ['All', 'GIGS', 'REHEARSAL', 'QUOTE'] as const;

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

const DotGrid: React.FC<{ filled: number; total: number; cols?: number; rows?: number; activeColor?: string; height?: number; fillFromEnd?: boolean }> = ({
  filled, total, cols = 6, rows = 2, activeColor = '#D5FB46', height = 32, fillFromEnd = false
}) => {
  const fullCount = Math.floor(Math.min(filled, total));
  const hasHalf = filled % 1 !== 0 && fullCount < total;

  return (
    <div
      className="grid w-full gap-[4px]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        height,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isFull = fillFromEnd ? i >= total - fullCount : i < fullCount;
        const isHalf = hasHalf && (fillFromEnd ? i === total - fullCount - 1 : i === fullCount);
        const dotStyle: React.CSSProperties = isHalf
          ? { background: fillFromEnd
              ? `linear-gradient(to right, rgba(0,0,0,0.1) 50%, ${activeColor} 50%)`
              : `linear-gradient(to right, ${activeColor} 50%, rgba(0,0,0,0.1) 50%)` }
          : { backgroundColor: isFull ? activeColor : 'rgba(0,0,0,0.1)' };
        return (
          <div
            key={i}
            className="rounded-[10px]"
            style={dotStyle}
          />
        );
      })}
    </div>
  );
};

type GlyphSpan = [number, number, number, number];
const GLYPH_SPANS: Record<string, GlyphSpan[]> = {
  A: [[1,1,3,1],[1,2,1,4],[3,2,1,4],[2,3,1,1]],
  B: [[1,1,1,5],[2,1,2,1],[3,2,1,1],[2,3,2,1],[3,4,1,1],[2,5,2,1]],
  C: [[1,1,3,1],[1,2,1,3],[1,5,3,1]],
  D: [[1,1,1,5],[2,1,1,1],[3,2,1,3],[2,5,1,1]],
  E: [[1,1,3,1],[1,2,1,3],[2,3,1,1],[1,5,3,1]],
  F: [[1,1,3,1],[1,2,1,4],[2,3,1,1]],
  G: [[1,1,3,1],[1,2,1,3],[1,5,3,1],[3,3,1,3]],
  H: [[1,1,1,5],[3,1,1,5],[2,3,1,1]],
  I: [[1,1,3,1],[2,2,1,3],[1,5,3,1]],
  J: [[3,1,1,4],[1,5,3,1],[1,4,1,1]],
  K: [[1,1,1,5],[3,1,1,2],[2,3,1,1],[3,4,1,2]],
  L: [[1,1,1,5],[2,5,2,1]],
  M: [[1,1,1,5],[2,1,1,2],[3,1,1,5]],
  N: [[1,1,1,5],[2,1,1,1],[3,1,1,5]],
  O: [[1,1,3,1],[1,2,1,3],[3,2,1,3],[1,5,3,1]],
  P: [[1,1,1,5],[2,1,2,1],[3,2,1,1],[2,3,1,1]],
  Q: [[1,1,3,1],[1,2,1,3],[3,2,1,3],[2,5,1,1],[3,5,1,1]],
  R: [[1,1,1,5],[2,1,2,1],[3,2,1,1],[2,3,1,1],[3,4,1,2]],
  S: [[1,1,3,1],[1,2,1,1],[1,3,3,1],[3,4,1,1],[1,5,3,1]],
  T: [[1,1,3,1],[2,2,1,4]],
  U: [[1,1,1,4],[3,1,1,4],[1,5,3,1]],
  V: [[1,1,1,3],[3,1,1,3],[1,4,1,1],[3,4,1,1],[2,5,1,1]],
  W: [[1,1,1,5],[3,1,1,5],[2,4,1,2]],
  X: [[1,1,1,2],[3,1,1,2],[2,3,1,1],[1,4,1,2],[3,4,1,2]],
  Y: [[1,1,1,2],[3,1,1,2],[2,3,1,3]],
  Z: [[1,1,3,1],[3,2,1,1],[2,3,1,1],[1,4,1,1],[1,5,3,1]],
};

const PixelInitials: React.FC<{ name: string; activeColor: string; height?: number }> = ({ name, activeColor, height = 91 }) => {
  const items = useMemo(() => {
    const words = name.trim().split(/\s+/);
    const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase()).filter(Boolean);
    const totalCols = 8;
    const totalRows = 5;
    const covered = new Set<string>();
    const spans: { col: number; row: number; cs: number; rs: number; active: boolean }[] = [];

    initials.forEach((ch, li) => {
      const glyph = GLYPH_SPANS[ch];
      if (!glyph) return;
      const offsetCol = li * 5;
      for (const [c, r, cs, rs] of glyph) {
        const absCol = offsetCol + c;
        if (absCol + cs - 1 > totalCols) continue;
        spans.push({ col: absCol, row: r, cs, rs, active: true });
        for (let dc = 0; dc < cs; dc++)
          for (let dr = 0; dr < rs; dr++)
            covered.add(`${absCol + dc},${r + dr}`);
      }
    });

    for (let r = 1; r <= totalRows; r++)
      for (let c = 1; c <= totalCols; c++)
        if (!covered.has(`${c},${r}`))
          spans.push({ col: c, row: r, cs: 1, rs: 1, active: false });

    return spans;
  }, [name]);

  return (
    <div
      className="grid w-full gap-[4px]"
      style={{
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(5, minmax(0, 1fr))',
        height,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{
            gridColumn: `${item.col} / span ${item.cs}`,
            gridRow: `${item.row} / span ${item.rs}`,
            backgroundColor: item.active ? activeColor : 'rgba(0,0,0,0.1)',
          }}
        />
      ))}
    </div>
  );
};

const BarChart: React.FC<{ bars: number; activeColor: string; seed?: number; rows?: number }> = ({ bars, activeColor, seed = 0, rows = 4 }) => {
  const items = useMemo(() => {
    const base = [4, 3, 1, 2, 3, 4, 1, 3, 2, 1];
    const barHeights = Array.from({ length: bars }, (_, i) => Math.min(base[(i + (typeof seed === 'number' ? seed : 0)) % base.length], rows));
    const result: { col: number; row: number; cs: number; rs: number; active: boolean }[] = [];

    for (let c = 0; c < bars; c++) {
      const h = barHeights[c];
      const startRow = rows - h + 1;
      if (h > 0) result.push({ col: c + 1, row: startRow, cs: 1, rs: h, active: true });
      for (let r = 1; r < startRow; r++)
        result.push({ col: c + 1, row: r, cs: 1, rs: 1, active: false });
    }
    return result;
  }, [bars, seed, rows]);

  return (
    <div
      className="grid w-full h-full gap-[4px]"
      style={{
        gridTemplateColumns: `repeat(${bars}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{
            gridColumn: `${item.col} / span ${item.cs}`,
            gridRow: `${item.row} / span ${item.rs}`,
            backgroundColor: item.active ? activeColor : 'rgba(0,0,0,0.1)',
          }}
        />
      ))}
    </div>
  );
};

const getRehearsalCadence = (event: EventData): string => {
  if (!event.is_recurring) return 'ONCE';
  const rule = event.recurrence_rule;
  const freq = (rule?.freq || rule?.frequency || '').toLowerCase();
  const interval = rule?.interval || 1;
  if (freq === 'weekly' && interval === 1) return 'WEEKLY';
  if (freq === 'weekly' && interval === 2) return 'BI-WEEKLY';
  if (freq === 'monthly' && interval === 1) return 'MONTHLY';
  if (freq === 'monthly' && interval === 2) return 'BI-MONTHLY';
  if (freq) return freq.toUpperCase();
  return 'ONCE';
};

const getEventTags = (event: EventData): string[] => {
  const tags: string[] = [];
  const status = event.status?.toUpperCase();
  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    tags.push('GIG');
    tags.push(event.indoorOutdoor?.toUpperCase() || 'INDOOR');
  } else if (status === 'REHEARSAL') {
    tags.push('REHEARSAL');
    tags.push(getRehearsalCadence(event));
  } else if (status === 'QUOTED' || status === 'QUOTE') {
    tags.push('QUOTE');
    tags.push((event.quoteStatus || 'pending').toUpperCase());
  } else if (status === 'DRAFT' || status === 'PENDING') {
    tags.push('DRAFT');
  }
  return tags;
};

const getTagStyle = (tag: string, eventStatus?: string): { bg: string; text: string } => {
  const secondaryLabels = ['WEEKLY', 'BI-WEEKLY', 'MONTHLY', 'BI-MONTHLY', 'ONCE', 'RECURRING', 'INDOOR', 'OUTDOOR', 'HYBRID', 'PENDING', 'DRAFT', 'TENTATIVE', 'CONFIRMED', 'SENT', 'CANCELLED', 'COMPLETED'];
  if (secondaryLabels.includes(tag)) {
    return { bg: 'rgba(0,0,0,0.15)', text: '#000000' };
  }
  const s = eventStatus?.toUpperCase();
  if (s === 'REHEARSAL') return { bg: '#0147FF', text: '#FFFFFF' };
  if (s === 'QUOTED' || s === 'QUOTE') return { bg: '#9A8878', text: '#FFFFFF' };
  if (s === 'DRAFT' || s === 'PENDING') return { bg: 'rgba(0,0,0,0.5)', text: '#FFFFFF' };
  return { bg: '#D5FB46', text: '#000000' };
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

const parseEventHour = (timeStr: string): number => {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return m >= 30 ? h + 0.5 : h;
};

const formatBandTotal = (price: string): string => {
  if (!price) return '$0';
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return price;
  if (num >= 1000) return `$${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`;
  return `$${num}`;
};

const getEventWarnings = (event: EventData): string[] => {
  const warnings: string[] = [];
  const type = event.eventType?.toLowerCase() || event.status?.toLowerCase();
  if (!event.location || event.location === 'TBD') warnings.push('Missing venue');
  if (!event.date) warnings.push('Missing date');
  if (type !== 'rehearsal' && (!event.price || event.price === '0')) warnings.push('Missing fee');
  return warnings;
};

const getEventSuggestions = (event: EventData): string[] => {
  const suggestions: string[] = [];
  const type = event.eventType?.toLowerCase() || event.status?.toLowerCase();
  const status = event.status?.toUpperCase();
  if (status === 'DRAFT' || status === 'PENDING') return suggestions;

  const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
  const isRehearsal = type === 'rehearsal' || status === 'REHEARSAL';
  const isQuote = status === 'QUOTED' || status === 'QUOTE';

  const hasMembers = event.members && event.members.length > 0;
  const hasAddress = !!event.venueAddress;
  const hasLocation = event.location && event.location !== 'TBD';

  if (isGig) {
    if (!hasAddress && !hasLocation) suggestions.push('No venue address');
    if (!hasMembers) suggestions.push('No team assigned');
    if (!event.endTime) suggestions.push('No end time');
    if (!event.clientName) suggestions.push('No client info');
  }

  if (isRehearsal) {
    if (!hasAddress && !hasLocation) suggestions.push('No venue address');
    if (!hasMembers) suggestions.push('No team assigned');
  }

  if (isQuote) {
    if (!event.clientName) suggestions.push('No client info');
    if (!hasMembers) suggestions.push('No team assigned');
  }

  return suggestions;
};

export const EventsView: React.FC<EventsViewProps> = ({
  eventFilter,
  setEventFilter,
  eventSearch,
  setEventSearch,
  allEvents,
  onEventClick,
  onCreateEvent,
  isAdmin = true,
  onDayPickerOpen,
  userFeeMap = {}
}) => {
  const getDisplayFee = (event: EventData): string => {
    if (!isAdmin && event.eventId && userFeeMap[event.eventId] != null) {
      return formatBandTotal(String(userFeeMap[event.eventId]));
    }
    return formatBandTotal(event.price);
  };
  const getFeeLabel = (event: EventData): string => {
    if (!isAdmin && event.eventId && userFeeMap[event.eventId] != null) return 'YOUR FEE';
    return 'BAND TOTAL';
  };

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [warningPopoverId, setWarningPopoverId] = useState<number | null>(null);
  const [suggestionPopoverId, setSuggestionPopoverId] = useState<number | null>(null);
  const [dayPickerEvents, setDayPickerEvents] = useState<EventData[] | null>(null);

  const openDayPicker = (events: EventData[]) => {
    setDayPickerEvents(events);
    onDayPickerOpen?.(true);
  };
  const closeDayPicker = () => {
    setDayPickerEvents(null);
    onDayPickerOpen?.(false);
  };
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (eventFilter !== 'All') {
      result = result.filter(e => {
        const s = e.status?.toUpperCase();
        if (eventFilter === 'GIGS') return s === 'CONFIRMED' || s === 'COMPLETED';
        if (eventFilter === 'REHEARSAL') return s === 'REHEARSAL';
        if (eventFilter === 'QUOTE') return s === 'QUOTED' || s === 'QUOTE';
        if (eventFilter === 'DRAFT') return s === 'DRAFT' || s === 'PENDING';
        return true;
      });
    }
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.clientName || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [allEvents, eventFilter, eventSearch]);

  const eventDatesMap = useMemo(() => {
    const map: Record<string, EventData[]> = {};
    const monthStart = new Date(calendarYear, calendarMonth, 1);
    const monthEnd = new Date(calendarYear, calendarMonth + 1, 0);
    const source = filteredEvents;

    const addToMap = (ev: EventData, dateObj: Date) => {
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
      if (!map[key]) map[key] = [];
      if (!map[key].some(e => e.id === ev.id)) map[key].push(ev);
    };

    source.forEach(ev => {
      if (!ev.date) return;
      const d = new Date(ev.date);
      addToMap(ev, d);

      const rec = ev as any;
      if (rec.is_recurring && rec.recurrence_rule) {
        const rule = rec.recurrence_rule;
        const freq = rule.freq || rule.frequency;
        if (!freq) return;
        const until = rule.until ? new Date(rule.until) : new Date(calendarYear, calendarMonth + 3, 0);
        const maxCount = rule.count || 52;
        let cursor = new Date(d);
        let generated = 0;
        while (cursor <= until && generated < maxCount) {
          if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7 * (rule.interval || 1));
          else if (freq === 'biweekly') cursor.setDate(cursor.getDate() + 14);
          else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
          else break;
          if (cursor > until) break;
          if (cursor >= monthStart && cursor <= monthEnd) {
            addToMap(ev, new Date(cursor));
          }
          generated++;
        }
      }
    });
    return map;
  }, [filteredEvents, calendarMonth, calendarYear]);

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

  const EmptyStateHero = () => <EmptyState />;

  return (
    <motion.div
      key="events"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-[40px] relative z-10 pb-32 min-h-[50vh]"
    >
      {allEvents.length === 0 ? (
        <EmptyStateHero />
      ) : (
        <>
          {/* ═══ SEARCH BAR ═══ */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-[8px] bg-black/10 rounded-[10px] px-[12px] py-[8px]">
                  <Search className="w-[16px] h-[16px] text-black/40 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events..."
                    className="bg-transparent text-[14px] font-medium text-black placeholder:text-black/30 focus:outline-none flex-1"
                    autoFocus
                  />
                  {eventSearch && (
                    <button onClick={() => setEventSearch('')}>
                      <X className="w-[14px] h-[14px] text-black/40" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ FILTER PILLS ═══ */}
          <div className="flex gap-[12px] items-center overflow-x-auto scrollbar-hide">
            {FILTERS.map((f) => {
              const isActive = eventFilter === f;
              let activeBg = 'bg-white';
              let activeText = 'text-black';
              if (f === 'GIGS') { activeBg = 'bg-[#D5FB46]'; activeText = 'text-black'; }
              else if (f === 'REHEARSAL') { activeBg = 'bg-[#0147FF]'; activeText = 'text-white'; }
              else if (f === 'QUOTE') { activeBg = 'bg-[#9A8878]'; activeText = 'text-white'; }
              else if (f === 'DRAFT') { activeBg = 'bg-black/50'; activeText = 'text-white'; }
              return (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={cn(
                  "px-[8px] py-[6px] rounded-[6px] text-[12px] whitespace-nowrap transition-all shrink-0",
                  isActive
                    ? `${activeBg} ${activeText} font-bold`
                    : "bg-black/20 text-black/40 font-medium"
                )}
              >
                {f}
              </button>);
            })}
            <button
              onClick={() => { setIsSearchOpen(!isSearchOpen); if (!isSearchOpen) setTimeout(() => searchRef.current?.focus(), 100); }}
              className={cn(
                "w-[32px] h-[32px] rounded-full border-[1.5px] flex items-center justify-center transition-all shrink-0",
                isSearchOpen ? "border-black bg-black text-white" : "border-black/30 bg-transparent text-black/50"
              )}
            >
              <Search className="w-[14px] h-[14px]" />
            </button>
          </div>

          {/* ═══ FEATURED EVENT CARD (when filter ≠ All) ═══ */}
          {eventFilter !== 'All' && (() => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const futureEvents = filteredEvents.filter(e => {
              if (!e.date) return false;
              const d = new Date(e.date);
              d.setHours(0, 0, 0, 0);
              return d >= now;
            });
            if (futureEvents.length === 0) return null;
            const feat = futureEvents[0];
            const tags = getEventTags(feat);
            const status = feat.status?.toUpperCase();
            const isRehearsal = status === 'REHEARSAL';
            const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
            const isQuote = status === 'QUOTED' || status === 'QUOTE';
            const memberCount = feat.members?.length || 0;
            const dotColor = getDotColor(feat.status);
            const arrowBg = isGig ? 'bg-black' : 'bg-white';
            const arrowColor = isGig ? 'text-[#D5FB46]' : 'text-black';

            const nextLabel = isGig ? 'NEXT GIG' : isRehearsal ? 'NEXT REHARSAL' : isQuote ? 'QUOTE' : 'DRAFT';
            const featTags = [nextLabel, ...tags.filter(t => t !== 'GIG' && t !== 'REHEARSAL' && t !== 'QUOTE' && t !== 'DRAFT')];

            const tagBg = isRehearsal ? '#0147FF' : isQuote ? '#9A8878' : (status === 'DRAFT' || status === 'PENDING') ? 'rgba(0,0,0,0.5)' : '#D5FB46';
            const tagTextColor = isGig ? '#000000' : '#FFFFFF';

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-[10px] p-[20px] cursor-pointer overflow-hidden"
                onClick={() => onEventClick(feat)}
              >
                <div className="flex flex-col gap-[20px]">
                  <div className="flex gap-[20px] items-start">
                    <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                      <div className="flex gap-[4px] items-center flex-wrap">
                        {featTags.map((tag, i) => (
                          <div key={i} className="rounded-[6px] px-[10px] py-[4px]" style={{ backgroundColor: tagBg, color: tagTextColor }}>
                            <span className="text-[12px] font-bold uppercase whitespace-nowrap">{tag}</span>
                          </div>
                        ))}
                      </div>
                      <h3 className="text-[32px] font-bold text-black uppercase leading-none">{feat.title}</h3>
                      <div className="flex flex-col gap-[2px]">
                        <span className="text-[16px] font-bold text-black uppercase">{feat.location?.split(',')[0] || 'TBD'}</span>
                        {feat.venueAddress && (
                          <span className="text-[12px] font-medium text-black/50 uppercase">{feat.venueAddress}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                      <div className={cn("rounded-full p-[6px]", arrowBg)}>
                        <ArrowUpRight className={cn("w-[28px] h-[28px]", arrowColor)} />
                      </div>
                      <div className="bg-black/10 rounded-[10px] px-[10px] py-[10px]">
                        <span className="text-[12px] font-bold text-black uppercase whitespace-nowrap">
                          {feat.date ? formatEventDate(feat.date) : 'TBD'}{feat.time ? ` - ${formatEventTime(feat.time)}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isGig ? (
                    <div className="flex flex-col gap-[12px]">
                      <DotGrid filled={memberCount} total={Math.max(9, memberCount)} cols={9} rows={1} activeColor={dotColor} height={15} />
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col items-start">
                          <span className="text-[12px] font-bold text-black">LOAD IN</span>
                          <span className="text-[22px] font-bold text-black leading-none">
                            {feat.loadInTime ? formatEventTime(feat.loadInTime) : feat.time ? formatEventTime(feat.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 3)))) : 'TBD'}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[12px] font-bold text-black">SOUNDCHECK</span>
                          <span className="text-[22px] font-bold text-black leading-none">
                            {feat.soundcheckTime ? formatEventTime(feat.soundcheckTime) : feat.time ? formatEventTime(feat.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 2)))) : 'TBD'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[12px] font-bold text-black">SHOW</span>
                          <span className="text-[22px] font-bold text-black leading-none">{feat.time ? formatEventTime(feat.time) : 'TBD'}</span>
                        </div>
                      </div>
                    </div>
                  ) : isRehearsal ? (
                    <div className="flex gap-[20px] items-end">
                      <div className="flex-1 flex flex-col gap-[20px]">
                        <DotGrid filled={memberCount} total={Math.max(12, memberCount)} cols={6} rows={2} activeColor={dotColor} height={15 * 2 + 4} />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-black">CONFIRMED MEMBERS</span>
                          <span className="text-[22px] font-bold text-black leading-none">{memberCount}</span>
                        </div>
                      </div>
                    </div>
                  ) : isQuote ? (
                    <div className="grid grid-cols-2 gap-x-[20px] gap-y-[40px]">
                      <div className="flex flex-col gap-[8px]">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-black">CLIENT</span>
                          <span className="text-[22px] font-bold text-black leading-none uppercase">{feat.clientName || 'TBD'}</span>
                        </div>
                        <PixelInitials name={feat.clientName || 'TBD'} activeColor={dotColor} height={91} />
                      </div>
                      <div className="flex flex-col gap-[8px]">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-black">{isAdmin ? 'PRICING & FINANCE' : 'YOUR FEE'}</span>
                          <span className="text-[22px] font-bold text-black leading-none">{getDisplayFee(feat)}</span>
                        </div>
                        <div className="h-[91px]">
                          <BarChart bars={8} activeColor={dotColor} seed={feat.id + 3} rows={5} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-[20px] items-end">
                      <div className="flex-1 flex flex-col gap-[10px]">
                        <DotGrid filled={memberCount} total={12} cols={6} rows={2} activeColor="rgba(0,0,0,0.2)" />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-black">TEAM MEMBERS</span>
                          <span className="text-[22px] font-bold text-black leading-none">{memberCount}</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-[10px]">
                        <DotGrid filled={0} total={12} cols={6} rows={2} activeColor="rgba(0,0,0,0.2)" />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-black">{getFeeLabel(feat)}</span>
                          <span className="text-[22px] font-bold text-black leading-none">{getDisplayFee(feat)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

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
                return (
                  <div
                    className="grid grid-cols-7 gap-[4px]"
                    style={{
                      gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
                      height: numRows * 28,
                    }}
                  >
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateKey = `${calendarYear}-${calendarMonth}-${day}`;
                      const eventsOnDay = eventDatesMap[dateKey] || [];
                      const hasEvents = eventsOnDay.length > 0;
                      const multipleEvents = eventsOnDay.length > 1;

                      let bgColor = 'rgba(0,0,0,0.1)';
                      let textColor = 'text-black';
                      let bgStyle: React.CSSProperties = { backgroundColor: bgColor };

                      if (hasEvents) {
                        const primary = eventsOnDay[0];
                        bgColor = getCalendarColor(primary);
                        const status = primary.status?.toUpperCase();
                        textColor = (status === 'REHEARSAL' || status === 'DRAFT' || status === 'PENDING' || status === 'QUOTE' || status === 'QUOTED')
                          ? 'text-white' : 'text-black';

                        if (multipleEvents) {
                          const colors = [...new Set(eventsOnDay.map(getCalendarColor))];
                          if (colors.length > 1) {
                            bgStyle = { background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` };
                            textColor = 'text-white';
                          } else {
                            bgStyle = { backgroundColor: bgColor };
                          }
                        } else {
                          bgStyle = { backgroundColor: bgColor };
                        }
                      }

                      return hasEvents ? (
                        <button
                          key={day}
                          onClick={() => multipleEvents ? openDayPicker(eventsOnDay) : onEventClick(eventsOnDay[0])}
                          className={cn(
                            "rounded-[10px] flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 relative",
                            textColor
                          )}
                          style={bgStyle}
                        >
                          <span className="text-[16px] font-medium leading-none">{day}</span>
                          {multipleEvents && (
                            <span className="absolute -top-1 -right-1 w-[14px] h-[14px] bg-black text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                              {eventsOnDay.length}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div
                          key={day}
                          className="rounded-[10px] flex items-center justify-center text-black"
                          style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
                        >
                          <span className="text-[16px] font-medium leading-none">{day}</span>
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
                const status = event.status?.toUpperCase();
                const isRehearsal = status === 'REHEARSAL';
                const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
                const isQuote = status === 'QUOTED' || status === 'QUOTE';
                const memberCount = event.members?.length || 0;
                const dotColor = getDotColor(event.status);
                const dateTagStyle = getTagStyle('', event.status);

                const rightLabel = isRehearsal ? 'TIME' : getFeeLabel(event);
                const rightValue = isRehearsal
                  ? (event.time ? formatEventTime(event.time) : 'TBD')
                  : getDisplayFee(event);

                const barCount = isRehearsal ? 0 : 5;
                const warnings = getEventWarnings(event);
                const suggestions = getEventSuggestions(event);

                const tags = getEventTags(event);
                const secondaryTags = tags.filter(t => t !== 'GIG' && t !== 'REHEARSAL' && t !== 'QUOTE' && t !== 'DRAFT');

                if (isRehearsal) {
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-[12px] items-end cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Section 1: Event Info + Icons + Date */}
                      <div className="flex gap-[30px] items-start w-full">
                        <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                          <div className="flex gap-[4px] items-start">
                            <div
                              className="rounded-[6px] px-[10px] py-[4px]"
                              style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                            >
                              <span className="text-[12px] font-bold uppercase whitespace-nowrap">REHEARSAL</span>
                            </div>
                            {secondaryTags.map((tag, i) => (
                              <div
                                key={i}
                                className="rounded-[6px] px-[10px] py-[4px]"
                                style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                              >
                                <span className="text-[12px] font-bold uppercase whitespace-nowrap">{tag}</span>
                              </div>
                            ))}
                          </div>
                          <h3 className="text-[32px] font-bold text-black uppercase leading-none">
                            {event.title}
                          </h3>
                          <div className="flex flex-col gap-[2px]">
                            <div className="flex gap-[2px] items-center">
                              <span className="text-[16px] font-bold text-black uppercase whitespace-nowrap">
                                {event.location?.split(',')[0] || 'TBD'}
                              </span>
                              <ArrowUpRight className="w-[18px] h-[18px] text-black shrink-0" />
                            </div>
                            {(event.venueAddress || event.location?.includes(',')) && (
                              <span className="text-[12px] font-medium text-black/50 uppercase">
                                {event.venueAddress || event.location?.split(',').slice(1).join(',').trim()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                          <div className="flex gap-[6px] items-start">
                            {warnings.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSuggestionPopoverId(null); setWarningPopoverId(warningPopoverId === event.id ? null : event.id); }}
                                  className="bg-[#F23030] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {warningPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Missing Info</span>
                                      {warnings.map((w, wi) => (
                                        <div key={wi} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[#F23030] shrink-0" />
                                          <span className="text-[11px] font-medium text-white/80">{w}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            {isAdmin && suggestions.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setWarningPopoverId(null); setSuggestionPopoverId(suggestionPopoverId === event.id ? null : event.id); }}
                                  className="bg-[#F59E0B] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {suggestionPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Suggestions</span>
                                      {suggestions.map((s, si) => (
                                        <div key={si} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[#F59E0B] shrink-0" />
                                          <span className="text-[11px] font-medium text-white/80">{s}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            <div className="bg-white rounded-full p-[6px]">
                              <ArrowUpRight className="w-[28px] h-[28px] text-black" />
                            </div>
                          </div>
                          <div
                            className="rounded-[6px] px-[10px] py-[4px]"
                            style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                          >
                            <span className="text-[12px] font-bold uppercase whitespace-nowrap">
                              {event.date ? (() => {
                                const d = new Date(event.date);
                                const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                                const day = d.getDate();
                                const year = d.getFullYear();
                                return `${month} ${day} ${year}`;
                              })() : 'TBD'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Grids (left) + Labels (right) */}
                      <div className="flex gap-[69px] items-center w-full">
                        <div className="flex-1 flex flex-col gap-[12px] items-start min-w-0">
                          <DotGrid filled={event.time ? parseEventHour(event.time) : 0} total={12} cols={6} rows={2} activeColor={dotColor} height={68} />
                          <DotGrid filled={memberCount} total={Math.max(16, memberCount)} cols={8} rows={2} activeColor={dotColor} fillFromEnd height={68} />
                        </div>
                        <div className="flex flex-col gap-[16px] items-end w-[95px] shrink-0">
                          <div className="flex flex-col items-end w-full">
                            <span className="text-[12px] font-bold text-black text-right w-full uppercase">TIME</span>
                            <span className="text-[42px] font-bold text-black leading-none whitespace-nowrap">
                              {event.time ? formatEventTime(event.time) : 'TBD'}
                            </span>
                          </div>
                          <div className="flex flex-col items-end w-full">
                            <span className="text-[12px] font-bold text-black whitespace-nowrap">TEAM MEMBERS</span>
                            <span className="text-[42px] font-bold text-black leading-none">{memberCount}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                if (isGig) {
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-[12px] items-end cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Section 1: Event Info + Icons + Date */}
                      <div className="flex gap-[30px] items-start w-full">
                        <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                          <div className="flex gap-[4px] items-start">
                            <div
                              className="rounded-[6px] px-[10px] py-[4px]"
                              style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                            >
                              <span className="text-[12px] font-bold uppercase whitespace-nowrap">GIG</span>
                            </div>
                            {secondaryTags.map((tag, i) => (
                              <div
                                key={i}
                                className="rounded-[6px] px-[10px] py-[4px]"
                                style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                              >
                                <span className="text-[12px] font-bold uppercase whitespace-nowrap">{tag}</span>
                              </div>
                            ))}
                          </div>
                          <h3 className="text-[32px] font-bold text-black uppercase leading-none">
                            {event.title}
                          </h3>
                          <div className="flex flex-col gap-[2px]">
                            <div className="flex gap-[2px] items-center">
                              <span className="text-[16px] font-bold text-black uppercase whitespace-nowrap">
                                {event.location?.split(',')[0] || 'TBD'}
                              </span>
                              <ArrowUpRight className="w-[18px] h-[18px] text-black shrink-0" />
                            </div>
                            {(event.venueAddress || event.location?.includes(',')) && (
                              <span className="text-[12px] font-medium text-black/50 uppercase">
                                {event.venueAddress || event.location?.split(',').slice(1).join(',').trim()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                          <div className="flex gap-[6px] items-start">
                            {warnings.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSuggestionPopoverId(null); setWarningPopoverId(warningPopoverId === event.id ? null : event.id); }}
                                  className="bg-[#F23030] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {warningPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Missing Info</span>
                                      {warnings.map((w, wi) => (
                                        <div key={wi} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[#F23030] shrink-0" />
                                          <span className="text-[11px] font-medium text-white/80">{w}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            {isAdmin && suggestions.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setWarningPopoverId(null); setSuggestionPopoverId(suggestionPopoverId === event.id ? null : event.id); }}
                                  className="bg-[#F59E0B] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {suggestionPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Suggestions</span>
                                      {suggestions.map((s, si) => (
                                        <div key={si} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[#F59E0B] shrink-0" />
                                          <span className="text-[11px] font-medium text-white/80">{s}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            <div className="bg-black rounded-full p-[6px]">
                              <ArrowUpRight className="w-[28px] h-[28px] text-[#D5FB46]" />
                            </div>
                          </div>
                          <div
                            className="rounded-[6px] px-[10px] py-[4px]"
                            style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                          >
                            <span className="text-[12px] font-bold uppercase whitespace-nowrap">
                              {event.date ? (() => {
                                const d = new Date(event.date);
                                const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                                const day = d.getDate();
                                const year = d.getFullYear();
                                return `${month} ${day} ${year}`;
                              })() : 'TBD'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Bar Chart + Team Members (left) + Labels (right) */}
                      <div className="flex gap-[69px] items-center w-full">
                        <div className="flex-1 flex flex-col gap-[12px] items-start min-w-0">
                          <div className="w-full h-[68px]">
                            <BarChart bars={10} activeColor={dotColor} seed={event.id} />
                          </div>
                          <DotGrid filled={memberCount} total={16} cols={8} rows={2} activeColor={dotColor} fillFromEnd height={68} />
                        </div>
                        <div className="flex flex-col gap-[16px] items-end w-[95px] shrink-0">
                          <div className="flex flex-col items-end w-full">
                            <span className="text-[12px] font-bold text-black text-right w-full uppercase">{isAdmin ? 'DUE TOTAL' : 'YOUR FEE'}</span>
                            <span className="text-[42px] font-bold text-black leading-none whitespace-nowrap">
                              {getDisplayFee(event)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end w-full">
                            <span className="text-[12px] font-bold text-black whitespace-nowrap">TEAM MEMBERS</span>
                            <span className="text-[42px] font-bold text-black leading-none">{memberCount}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                if (isQuote) {
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-[12px] items-end cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Section 1: Event Info + Icons + Date */}
                      <div className="flex gap-[30px] items-start w-full">
                        <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                          <div className="flex gap-[4px] items-start">
                            <div
                              className="rounded-[6px] px-[10px] py-[4px]"
                              style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                            >
                              <span className="text-[12px] font-bold uppercase whitespace-nowrap">QUOTE</span>
                            </div>
                            {secondaryTags.map((tag, i) => (
                              <div
                                key={i}
                                className="rounded-[6px] px-[10px] py-[4px]"
                                style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                              >
                                <span className="text-[12px] font-bold uppercase whitespace-nowrap">{tag}</span>
                              </div>
                            ))}
                          </div>
                          <h3 className="text-[32px] font-bold text-black uppercase leading-none">
                            {event.title}
                          </h3>
                          <div className="flex flex-col gap-[2px]">
                            <div className="flex gap-[2px] items-center">
                              <span className="text-[16px] font-bold text-black uppercase whitespace-nowrap">
                                {event.location?.split(',')[0] || 'TBD'}
                              </span>
                              <ArrowUpRight className="w-[18px] h-[18px] text-black shrink-0" />
                            </div>
                            {(event.venueAddress || event.location?.includes(',')) && (
                              <span className="text-[12px] font-medium text-black/50 uppercase">
                                {event.venueAddress || event.location?.split(',').slice(1).join(',').trim()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                          <div className="flex gap-[6px] items-start">
                            {warnings.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSuggestionPopoverId(null); setWarningPopoverId(warningPopoverId === event.id ? null : event.id); }}
                                  className="bg-[#F23030] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {warningPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Missing Info</span>
                                      {warnings.map((w, wi) => (
                                        <div key={wi} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[#F23030] shrink-0" />
                                          <span className="text-[11px] font-medium text-white/80">{w}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            {isAdmin && suggestions.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setWarningPopoverId(null); setSuggestionPopoverId(suggestionPopoverId === event.id ? null : event.id); }}
                                  className="bg-[#F59E0B] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {suggestionPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Suggestions</span>
                                      {suggestions.map((s, si) => (
                                        <div key={si} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[#F59E0B] shrink-0" />
                                          <span className="text-[11px] font-medium text-white/80">{s}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            <div className="bg-white rounded-full p-[6px]">
                              <ArrowUpRight className="w-[28px] h-[28px] text-black" />
                            </div>
                          </div>
                          <div
                            className="rounded-[6px] px-[10px] py-[4px]"
                            style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                          >
                            <span className="text-[12px] font-bold uppercase whitespace-nowrap">
                              {event.date ? (() => {
                                const d = new Date(event.date);
                                const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                                const day = d.getDate();
                                const year = d.getFullYear();
                                return `${month} ${day} ${year}`;
                              })() : 'TBD'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Bar Chart + Team Members (left) + Labels (right) */}
                      <div className="flex gap-[69px] items-center w-full">
                        <div className="flex-1 flex flex-col gap-[12px] items-start min-w-0">
                          <div className="w-full h-[68px]">
                            <BarChart bars={10} activeColor={dotColor} seed={event.id} />
                          </div>
                          <DotGrid filled={memberCount} total={16} cols={8} rows={2} activeColor={dotColor} fillFromEnd height={68} />
                        </div>
                        <div className="flex flex-col gap-[16px] items-end w-[95px] shrink-0">
                          <div className="flex flex-col items-end w-full">
                            <span className="text-[12px] font-bold text-black text-right w-full uppercase">{isAdmin ? 'DUE TOTAL' : 'YOUR FEE'}</span>
                            <span className="text-[42px] font-bold text-black leading-none whitespace-nowrap">
                              {getDisplayFee(event)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end w-full">
                            <span className="text-[12px] font-bold text-black whitespace-nowrap">TEAM MEMBERS</span>
                            <span className="text-[42px] font-bold text-black leading-none">{memberCount}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-[12px] items-end cursor-pointer"
                    onClick={() => onEventClick(event)}
                  >
                    {/* Section 1: Event Info + Icons + Date */}
                    <div className="flex gap-[30px] items-start w-full">
                      <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                        <div className="flex gap-[4px] items-start">
                          <div
                            className="rounded-[6px] px-[10px] py-[4px]"
                            style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                          >
                            <span className="text-[12px] font-bold uppercase whitespace-nowrap">
                              {event.date ? formatEventDate(event.date) : 'TBD'}
                            </span>
                          </div>
                          {secondaryTags.map((tag, i) => (
                            <div
                              key={i}
                              className="rounded-[6px] px-[10px] py-[4px]"
                              style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                            >
                              <span className="text-[12px] font-bold uppercase whitespace-nowrap">{tag}</span>
                            </div>
                          ))}
                        </div>
                        <h3 className="text-[32px] font-bold text-black uppercase leading-none">
                          {event.title}
                        </h3>
                        <div className="flex flex-col gap-[2px]">
                          <div className="flex gap-[2px] items-center">
                            <span className="text-[16px] font-bold text-black uppercase whitespace-nowrap">
                              {event.location?.split(',')[0] || 'TBD'}
                            </span>
                            <ArrowUpRight className="w-[18px] h-[18px] text-black shrink-0" />
                          </div>
                          {(event.venueAddress || event.location?.includes(',')) && (
                            <span className="text-[12px] font-medium text-black/50 uppercase">
                              {event.venueAddress || event.location?.split(',').slice(1).join(',').trim()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                        <div className="flex gap-[6px] items-start">
                          {warnings.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setWarningPopoverId(warningPopoverId === event.id ? null : event.id); }}
                                className="bg-[#F23030] rounded-full p-[6px]"
                                style={{ transform: 'rotate(180deg)' }}
                              >
                                <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                              </button>
                              <AnimatePresence>
                                {warningPopoverId === event.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                    className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Missing Info</span>
                                    {warnings.map((w, wi) => (
                                      <div key={wi} className="flex items-center gap-2 py-1">
                                        <div className="w-[5px] h-[5px] rounded-full bg-[#F23030] shrink-0" />
                                        <span className="text-[11px] font-medium text-white/80">{w}</span>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                          {isAdmin && suggestions.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSuggestionPopoverId(suggestionPopoverId === event.id ? null : event.id); }}
                                className="bg-[#F59E0B] rounded-full p-[6px]"
                                style={{ transform: 'rotate(180deg)' }}
                              >
                                <AlertCircle className="w-[28px] h-[28px] text-white" style={{ transform: 'rotate(180deg)' }} />
                              </button>
                              <AnimatePresence>
                                {suggestionPopoverId === event.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                    className="absolute top-full right-0 mt-2 bg-[#1A1A1A] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Suggestions</span>
                                    {suggestions.map((s, si) => (
                                      <div key={si} className="flex items-center gap-2 py-1">
                                        <div className="w-[5px] h-[5px] rounded-full bg-[#F59E0B] shrink-0" />
                                        <span className="text-[11px] font-medium text-white/80">{s}</span>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                          <div className="bg-white rounded-full p-[6px]">
                            <ArrowUpRight className="w-[28px] h-[28px] text-black" />
                          </div>
                        </div>
                        <div
                          className="rounded-[6px] px-[10px] py-[4px]"
                          style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}
                        >
                          <span className="text-[12px] font-bold uppercase whitespace-nowrap">
                            {event.date ? formatEventDate(event.date) : 'TBD'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Grids (left) + Labels (right) */}
                    <div className="flex gap-[69px] items-center w-full">
                      <div className="flex-1 flex flex-col gap-[12px] items-start min-w-0">
                        <DotGrid filled={memberCount} total={16} cols={8} rows={2} activeColor={dotColor} fillFromEnd height={68} />
                      </div>
                      <div className="flex flex-col gap-[16px] items-end w-[95px] shrink-0">
                        <div className="flex flex-col items-end w-full">
                          <span className="text-[12px] font-bold text-black text-right w-full uppercase">{rightLabel}</span>
                          <span className="text-[42px] font-bold text-black leading-none whitespace-nowrap">
                            {rightValue}
                          </span>
                        </div>
                        <div className="flex flex-col items-end w-full">
                          <span className="text-[12px] font-bold text-black whitespace-nowrap">TEAM MEMBERS</span>
                          <span className="text-[42px] font-bold text-black leading-none">{memberCount}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <EmptyState />
            )}
          </div>
        </>
      )}
      {/* Multi-event day picker */}
      <AnimatePresence>
        {dayPickerEvents && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[10px]"
              onClick={closeDayPicker}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[91] bg-black rounded-t-[26px] px-4 pt-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-white/30" />
              </div>

              <div className="flex items-end justify-between mb-8">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  {dayPickerEvents[0]?.date ? formatEventDate(dayPickerEvents[0].date) : ''} — {dayPickerEvents.length} EVENTS
                </p>
                <button
                  onClick={closeDayPicker}
                  className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-6 mb-6">
                {dayPickerEvents.map(ev => {
                  const status = ev.status?.toUpperCase();
                  const isReh = status === 'REHEARSAL';
                  const isQuote = status === 'QUOTED' || status === 'QUOTE';
                  const accentColor = isReh ? '#0147FF' : isQuote ? '#9A8878' : '#D5FB46';
                  const label = isReh ? 'REHEARSAL' : isQuote ? 'QUOTE' : 'GIG';

                  return (
                    <motion.button
                      key={ev.id}
                      onClick={() => { closeDayPicker(); onEventClick(ev); }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full text-left flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold uppercase" style={{ color: accentColor }}>
                          {label}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      </div>
                      <h3 className="text-[22px] font-bold text-white uppercase leading-tight">
                        {ev.title}
                      </h3>
                      <div className="flex items-center gap-2 text-white/50 text-[12px] font-bold">
                        {ev.time && <span>{formatEventTime(ev.time)}</span>}
                        {ev.time && ev.location && <span className="text-white/20">·</span>}
                        {ev.location && <span>{ev.location.split(',')[0]}</span>}
                      </div>
                      <div className="grid grid-cols-6 gap-1 w-full">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-[15px] rounded-[10px]"
                            style={{ backgroundColor: i < (ev.members?.length || 0) ? accentColor : 'rgba(255,255,255,0.2)' }}
                          />
                        ))}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
