import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { 
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Calendar as CalendarIcon,
  Plus,
  Search,
  X,
  Music,
  CalendarDays,
  FileText
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { EventData } from '@/app/components/dashboard/EventCard';
import {
  CalendarEventCard,
  getEventAccent,
  EVENT_ACCENT_MAP,
} from '@/app/components/events/CalendarEventCard';
import type { EventAccent } from '@/app/components/events/CalendarEventCard';

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
  bands?: Array<{ id: string; name: string }>;
  selectedBandPill?: string;
  onBandPillClick?: (bandId: string) => void;
}

const FILTERS = ['All', 'GIGS', 'REHEARSAL', 'QUOTE', 'DRAFT'] as const;

const TAG_COLORS: Record<string, string> = {
  gig: 'bg-accent-gig text-accent-gig-foreground',
  outdoor: 'bg-accent-gig text-accent-gig-foreground',
  confirmed: 'bg-accent-gig text-accent-gig-foreground',
  rehearsal: 'bg-accent-rehearsal text-accent-rehearsal-foreground',
  series: 'bg-accent-rehearsal text-accent-rehearsal-foreground',
  quote: 'bg-accent-quote text-accent-quote-foreground',
  draft: 'bg-muted/40 text-muted-foreground',
  pending: 'bg-accent-quote text-accent-quote-foreground',
};

const DotGrid: React.FC<{ filled: number; total: number; cols?: number; rows?: number; activeColor?: string; height?: number; fillFromEnd?: boolean }> = ({
  filled, total, cols = 6, rows = 2, activeColor = 'var(--accent)', height = 32, fillFromEnd = false
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
              ? `linear-gradient(to right, var(--dot-inactive) 50%, ${activeColor} 50%)`
              : `linear-gradient(to right, ${activeColor} 50%, var(--dot-inactive) 50%)` }
          : { backgroundColor: isFull ? activeColor : 'var(--dot-inactive)' };
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
            backgroundColor: item.active ? activeColor : 'var(--dot-inactive)',
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
            backgroundColor: item.active ? activeColor : 'var(--muted)',
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
    return { bg: 'var(--muted)', text: 'var(--fg)' };
  }
  const s = eventStatus?.toUpperCase();
  if (s === 'REHEARSAL') return { bg: 'var(--accent-rehearsal)', text: 'var(--accent-rehearsal-fg)' };
  if (s === 'QUOTED' || s === 'QUOTE') return { bg: 'var(--accent-quote)', text: 'var(--accent-quote-fg)' };
  if (s === 'DRAFT' || s === 'PENDING') return { bg: 'var(--muted-fg)', text: 'var(--surface-inverse-fg)' };
  return { bg: 'var(--accent-gig)', text: 'var(--accent-gig-fg)' };
};

const getDotColor = (eventStatus?: string): string => {
  const s = eventStatus?.toUpperCase();
  if (s === 'REHEARSAL') return 'var(--accent-rehearsal)';
  if (s === 'QUOTED' || s === 'QUOTE') return 'var(--accent-quote)';
  return 'var(--accent-gig)';
};

const getCalendarColor = (event: EventData): string => {
  const status = event.status?.toUpperCase();
  if (status === 'REHEARSAL') return 'var(--accent-rehearsal)';
  if (status === 'CONFIRMED' || status === 'COMPLETED') return 'var(--accent-gig)';
  if (status === 'QUOTED' || status === 'QUOTE') return 'var(--accent-quote)';
  if (status === 'DRAFT' || status === 'PENDING') return 'var(--muted-fg)';
  return 'var(--accent-gig)';
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

interface MonthEntry {
  year: number;
  month: number;
}

interface MonthGridProps {
  year: number;
  month: number;
  eventsByDate: Record<string, EventData[]>;
  onSelectDay: (eventsOnDay: EventData[]) => void;
}

const MONTHS_PER_EXTEND = 12;

const MonthGrid: React.FC<MonthGridProps> = ({ year, month, eventsByDate, onSelectDay }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells = firstDayOfWeek + daysInMonth;
  const numRows = Math.ceil(totalCells / 7);

  return (
    <div className="w-full shrink-0 flex flex-col gap-[10px]">
      <div className="bg-muted/50 rounded-[10px] flex">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="flex-1 py-[4px] text-center">
            <span className="text-xs font-medium text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

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
          const dateKey = `${year}-${month}-${day}`;
          const eventsOnDay = eventsByDate[dateKey] || [];
          const hasEvents = eventsOnDay.length > 0;
          const multipleEvents = eventsOnDay.length > 1;

          let bgColor = 'var(--muted)';
          let textColor = 'text-foreground';
          let bgStyle: React.CSSProperties = { backgroundColor: bgColor };

          if (hasEvents) {
            const primary = eventsOnDay[0];
            bgColor = getCalendarColor(primary);
            const status = primary.status?.toUpperCase();
            textColor = (status === 'REHEARSAL' || status === 'DRAFT' || status === 'PENDING' || status === 'QUOTE' || status === 'QUOTED')
              ? 'text-accent-rehearsal-foreground' : 'text-accent-gig-foreground';

            if (multipleEvents) {
              const colors = [...new Set(eventsOnDay.map(getCalendarColor))];
              if (colors.length > 1) {
                bgStyle = { background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` };
                textColor = 'text-accent-rehearsal-foreground';
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
              onClick={() => onSelectDay(eventsOnDay)}
              className={cn(
                "rounded-[10px] flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 relative",
                textColor
              )}
              style={bgStyle}
            >
              <span className="text-base font-medium leading-tight">{day}</span>
              {multipleEvents && (
                <span className="absolute -top-1 -right-1 w-[14px] h-[14px] bg-[var(--surface-inverse)] text-[var(--surface-inverse-fg)] text-xs font-bold rounded-full flex items-center justify-center">
                  {eventsOnDay.length}
                </span>
              )}
            </button>
          ) : (
            <div
              key={day}
              className="rounded-[10px] flex items-center justify-center text-foreground/60 dark:text-muted-foreground"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <span className="text-base font-medium leading-tight">{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const EventsView: React.FC<EventsViewProps> = ({
  eventFilter,
  setEventFilter,
  eventSearch,
  setEventSearch,
  selectedBandPill = 'all',
  onBandPillClick = () => {},
  eventView,
  allEvents,
  onEventClick,
  onCreateEvent,
  isAdmin = true,
  onDayPickerOpen,
  userFeeMap = {},
  bands = []
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

  const [currentIndex, setCurrentIndex] = useState(MONTHS_PER_EXTEND);
  const [months, setMonths] = useState<MonthEntry[]>(() => {
    const now = new Date();
    const arr: MonthEntry[] = [];
    for (let i = -MONTHS_PER_EXTEND; i <= MONTHS_PER_EXTEND; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      arr.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return arr;
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [warningPopoverId, setWarningPopoverId] = useState<number | null>(null);
  const [suggestionPopoverId, setSuggestionPopoverId] = useState<number | null>(null);
  const bandIds = React.useMemo(() => (bands || []).map(b => b.id), [bands]);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);
  const currentIndexRef = useRef(currentIndex);
  const skipAnimRef = useRef(false);
  const x = useMotionValue(0);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    return () => animRef.current?.stop();
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      widthRef.current = w;
      setWidth(w);
      if (w) x.set(-currentIndexRef.current * w);
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  useLayoutEffect(() => {
    if (skipAnimRef.current) {
      animRef.current?.stop();
      x.set(-currentIndex * widthRef.current);
      skipAnimRef.current = false;
    }
  }, [months]);

  const extendBackward = () => {
    skipAnimRef.current = true;
    setMonths(prev => {
      const first = prev[0];
      const added: MonthEntry[] = [];
      let y = first.year;
      let m = first.month;
      for (let i = 0; i < MONTHS_PER_EXTEND; i++) {
        m -= 1;
        if (m < 0) { m = 11; y -= 1; }
        added.unshift({ year: y, month: m });
      }
      return [...added, ...prev];
    });
  };

  const extendForward = () => {
    setMonths(prev => {
      const last = prev[prev.length - 1];
      const added: MonthEntry[] = [];
      let y = last.year;
      let m = last.month;
      for (let i = 0; i < MONTHS_PER_EXTEND; i++) {
        m += 1;
        if (m > 11) { m = 0; y += 1; }
        added.push({ year: y, month: m });
      }
      return [...prev, ...added];
    });
  };

  const snapTo = (index: number) => {
    setCurrentIndex(index);
    animRef.current?.stop();
    animRef.current = animate(x, -index * widthRef.current, {
      duration: 0.3,
      ease: 'easeOut',
    });
  };

  const goToIndex = (target: number) => {
    if (target <= 1) {
      extendBackward();
      setCurrentIndex(target + MONTHS_PER_EXTEND);
    } else if (target >= months.length - 2) {
      extendForward();
      snapTo(target);
    } else {
      snapTo(target);
    }
  };

  const scrollToMonth = (dir: 1 | -1) => goToIndex(currentIndex + dir);

  const handleDragEnd = (_: any, info: any) => {
    const w = widthRef.current;
    if (!w) return;
    let current = -x.get() / w;
    current = Math.max(0, Math.min(months.length - 1, current));
    let target = Math.round(current);
    if (info.velocity.x < -500) target = Math.floor(current) + 1;
    else if (info.velocity.x > 500) target = Math.ceil(current) - 1;
    target = Math.max(0, Math.min(months.length - 1, target));
    goToIndex(target);
  };

  const handleSelectDay = (eventsOnDay: EventData[]) => {
    if (eventsOnDay.length > 1) openDayPicker(eventsOnDay);
    else onEventClick(eventsOnDay[0]);
  };

  // All filtering now happens in parent component (AuthenticatedApp.tsx)
  // `allEvents` prop is already band-pill + status + search filtered

  const eventDatesMap = useMemo(() => {
    const map: Record<string, EventData[]> = {};
    if (months.length === 0) return map;
    const first = months[0];
    const last = months[months.length - 1];
    const rangeStart = new Date(first.year, first.month, 1);
    const rangeEnd = new Date(last.year, last.month + 1, 0);
    const source = allEvents;

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
        const until = rule.until ? new Date(rule.until) : rangeEnd;
        const maxCount = rule.count || 52;
        let cursor = new Date(d);
        let generated = 0;
        while (cursor <= until && generated < maxCount) {
          if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7 * (rule.interval || 1));
          else if (freq === 'biweekly') cursor.setDate(cursor.getDate() + 14);
          else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
          else break;
          if (cursor > until) break;
          if (cursor >= rangeStart && cursor <= rangeEnd) {
            addToMap(ev, new Date(cursor));
          }
          generated++;
        }
      }
    });
    return map;
  }, [allEvents, months]);

  const currentMonth = months[currentIndex] ?? { year: new Date().getFullYear(), month: new Date().getMonth() };
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', { month: 'long' }).toUpperCase();

  const monthEvents = useMemo(() => {
    const seen = new Set<number>();
    const result: EventData[] = [];
    const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${currentMonth.year}-${currentMonth.month}-${day}`;
      const events = eventDatesMap[key] || [];
      events.forEach(ev => {
        if (!seen.has(ev.id)) {
          seen.add(ev.id);
          result.push(ev);
        }
      });
    }
    return result;
  }, [eventDatesMap, currentMonth]);

  const EmptyStateHero = () => <EmptyState />;

  return (
    <motion.div
      key="events"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
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
                <div className="flex items-center gap-[8px] bg-muted/50 rounded-[10px] px-[12px] py-[8px]">
                  <Search className="w-[16px] h-[16px] text-foreground/40 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events..."
                    className="bg-transparent text-sm font-medium text-[var(--fg)] placeholder:text-foreground/30 focus:outline-none flex-1"
                    autoFocus
                  />
                  {eventSearch && (
                    <button onClick={() => setEventSearch('')}>
                      <X className="w-[14px] h-[14px] text-foreground/40" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ BAND FILTER PILLS ═══ (client-side, instant) */}
          {bands.length > 1 && !isAdmin && (
            <div className="flex gap-[4px] items-center flex-wrap pb-1 mb-1">
              <button
                key="all"
                onClick={() => onBandPillClick('all')}
                className={cn(
                  'inline-flex items-center justify-center px-4 py-2.5 rounded-full text-[11px] font-bold uppercase flex-shrink-0 transition-all leading-tight',
                  selectedBandPill === 'all'
                    ? 'bg-foreground text-background'
                    : 'bg-foreground/10 text-foreground/50'
                )}
              >
                All
              </button>
              {bands.map((band) => {
                const isActive = selectedBandPill === band.id;
                return (
                  <button
                    key={band.id}
                    onClick={() => onBandPillClick(band.id)}
                    className={cn(
                      'inline-flex items-center justify-center px-4 py-2.5 rounded-full text-[11px] font-bold uppercase flex-shrink-0 transition-all leading-tight',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/10 text-foreground/50'
                    )}
                  >
                    {band.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* ═══ FILTER PILLS ═══ */}
          <div className="flex gap-[12px] items-center overflow-x-auto scrollbar-hide">
            {FILTERS.map((f) => {
              const isActive = eventFilter === f;
              let activeBg = 'bg-card';
              let activeText = 'text-foreground';
              if (f === 'GIGS') { activeBg = 'bg-accent-gig'; activeText = 'text-accent-gig-foreground'; }
              else if (f === 'REHEARSAL') { activeBg = 'bg-accent-rehearsal'; activeText = 'text-accent-rehearsal-foreground'; }
              else if (f === 'QUOTE') { activeBg = 'bg-accent-quote'; activeText = 'text-accent-quote-foreground'; }
              else if (f === 'DRAFT') { activeBg = 'bg-muted'; activeText = 'text-foreground'; }
              return (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={cn(
                  "px-[8px] py-[6px] rounded-[6px] text-xs whitespace-nowrap transition-all shrink-0",
                  isActive
                    ? `${activeBg} ${activeText} font-bold`
                    : "bg-muted/20 text-muted-foreground font-medium"
                )}
              >
                {f}
              </button>);
            })}
            <button
              onClick={() => { setIsSearchOpen(!isSearchOpen); if (!isSearchOpen) setTimeout(() => searchRef.current?.focus(), 100); }}
              className={cn(
                "w-[32px] h-[32px] rounded-full border-[1.5px] flex items-center justify-center transition-all shrink-0",
                isSearchOpen ? "border-foreground bg-foreground text-background" : "border-foreground/30 bg-transparent text-muted-foreground"
              )}
            >
              <Search className="w-[14px] h-[14px]" />
            </button>
          </div>

          {/* ═══ FEATURED EVENT CARD (when filter ≠ All) ═══ */}
          {eventFilter !== 'All' && (() => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const futureEvents = allEvents.filter(e => {
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
            const arrowBg = isGig ? 'bg-foreground' : 'bg-background';
            const arrowColor = isGig ? 'text-accent-gig' : 'text-foreground';

            const nextLabel = isGig ? 'NEXT GIG' : isRehearsal ? 'NEXT REHEARSAL' : isQuote ? 'QUOTE' : 'DRAFT';
            const featTags = [nextLabel, ...tags.filter(t => t !== 'GIG' && t !== 'REHEARSAL' && t !== 'QUOTE' && t !== 'DRAFT')];

            const tagBg = isRehearsal ? 'var(--accent-rehearsal)' : isQuote ? 'var(--accent-quote)' : (status === 'DRAFT' || status === 'PENDING') ? 'var(--muted-fg)' : 'var(--accent-gig)';
            const tagTextColor = isGig ? 'var(--accent-gig-fg)' : 'var(--surface-inverse-fg)';

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
                      {/* Tag badges — admin/member single-band: event type / member multi-band: band name + event type */}
                      {(isAdmin || (!isAdmin && bands.length <= 1)) && (
                        <div className="flex gap-[4px] items-center flex-wrap">
                          {featTags.map((tag, i) => (
                            <div key={i} className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight" style={{ backgroundColor: tagBg, color: tagTextColor }}>
                              <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">{tag}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Multi-band member: band name pill + event type pill */}
                      {!isAdmin && bands.length > 1 && (
                        <div className="flex gap-[4px] items-center flex-wrap">
                          {feat.band_name && (
                            <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                              <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">{feat.band_name}</span>
                            </div>
                          )}
                          <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight" style={{ backgroundColor: tagBg, color: tagTextColor }}>
                            <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">{isGig ? 'GIG' : isRehearsal ? 'REHEARSAL' : isQuote ? 'QUOTE' : 'DRAFT'}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                            {isGig ? <Music className="w-6 h-6 text-accent-gig shrink-0" /> : isRehearsal ? <CalendarDays className="w-6 h-6 text-accent-rehearsal shrink-0" /> : isQuote ? <FileText className="w-6 h-6 text-accent-quote shrink-0" /> : null}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              {/* ═══ EYEBROW ROW — Event type text (single-band member only) ═══ */}
                              {!isAdmin && bands.length <= 1 && (isGig || isRehearsal || isQuote) && (
                                <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider leading-normal">
                                  <span className={cn('font-medium shrink-0', isGig ? 'text-accent-gig' : isRehearsal ? 'text-accent-rehearsal' : 'text-accent-quote')}>{isGig ? 'Gig' : isRehearsal ? 'Rehearsal' : 'Quote'}</span>
                                </div>
                              )}
                              {/* ═══ EVENT TITLE ═══ */}
                              <h3 className="text-3xl font-bold text-foreground uppercase leading-tight truncate">{feat.title}</h3>
                            </div>
                          </div>
                      <div className="flex flex-col gap-[2px]">
                        <span className="text-base font-bold text-foreground uppercase">{feat.location?.split(',')[0] || 'TBD'}</span>
                        {feat.venueAddress && (
                          <span className="text-xs font-medium text-foreground/50 uppercase">{feat.venueAddress}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                      <div className={cn("rounded-full p-[6px]", arrowBg)}>
                        <ArrowUpRight className={cn("w-[28px] h-[28px]", arrowColor)} />
                      </div>
                      <div className="bg-muted rounded-[10px] px-[10px] py-[10px]">
                        <span className="text-xs font-bold text-foreground uppercase whitespace-nowrap">
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
                          <span className="text-xs font-bold text-foreground/70">LOAD IN</span>
                          <span className="text-xl font-bold text-foreground leading-tight">
                            {feat.loadInTime ? formatEventTime(feat.loadInTime) : feat.time ? formatEventTime(feat.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 3)))) : 'TBD'}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-foreground/70">SOUNDCHECK</span>
                          <span className="text-xl font-bold text-foreground leading-tight">
                            {feat.soundcheckTime ? formatEventTime(feat.soundcheckTime) : feat.time ? formatEventTime(feat.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 2)))) : 'TBD'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-foreground/70">SHOW</span>
                          <span className="text-xl font-bold text-foreground leading-tight">{feat.time ? formatEventTime(feat.time) : 'TBD'}</span>
                        </div>
                      </div>
                    </div>
                  ) : isRehearsal ? (
                    <div className="flex gap-[20px] items-end">
                      <div className="flex-1 flex flex-col gap-[20px]">
                        <DotGrid filled={memberCount} total={Math.max(12, memberCount)} cols={6} rows={2} activeColor={dotColor} height={15 * 2 + 4} />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground/70">CONFIRMED MEMBERS</span>
                          <span className="text-xl font-bold text-foreground leading-tight">{memberCount}</span>
                        </div>
                      </div>
                    </div>
                  ) : isQuote ? (
                    <div className="grid grid-cols-2 gap-x-[20px] gap-y-[40px]">
                      <div className="flex flex-col gap-[8px]">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground/70">CLIENT</span>
                          <span className="text-xl font-bold text-foreground leading-tight uppercase">{feat.clientName || 'TBD'}</span>
                        </div>
                        <PixelInitials name={feat.clientName || 'TBD'} activeColor={dotColor} height={91} />
                      </div>
                      <div className="flex flex-col gap-[8px]">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground/70">{isAdmin ? 'PRICING & FINANCE' : 'YOUR FEE'}</span>
                          <span className="text-xl font-bold text-foreground leading-tight">{getDisplayFee(feat)}</span>
                        </div>
                        <div className="h-[91px]">
                          <BarChart bars={8} activeColor={dotColor} seed={feat.id + 3} rows={5} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-[20px] items-end">
                      <div className="flex-1 flex flex-col gap-[10px]">
                        <DotGrid filled={memberCount} total={12} cols={6} rows={2} activeColor="var(--dot-inactive)" />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground/70">TEAM MEMBERS</span>
                          <span className="text-xl font-bold text-foreground leading-tight">{memberCount}</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-[10px]">
                        <DotGrid filled={0} total={12} cols={6} rows={2} activeColor="var(--dot-inactive)" />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground/70">{getFeeLabel(feat)}</span>
                          <span className="text-xl font-bold text-foreground leading-tight">{getDisplayFee(feat)}</span>
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
                  onClick={() => scrollToMonth(-1)}
                  className="border-[1.5px] border-border border-solid rounded-full p-[4px] flex items-center"
                >
                  <ChevronLeft className="w-[20px] h-[20px]" />
                </button>
                <button
                  onClick={() => scrollToMonth(1)}
                  className="border-[1.5px] border-border border-solid rounded-full p-[4px] flex items-center"
                >
                  <ChevronRight className="w-[20px] h-[20px]" />
                </button>
              </div>
              <span className="text-base font-bold text-foreground uppercase">
                {monthName} {currentMonth.year}
              </span>
            </div>

            {/* Month drag track */}
            <div ref={containerRef} className="overflow-hidden w-full">
              <motion.div
                className="flex"
                drag="x"
                dragConstraints={{ left: -(months.length - 1) * width, right: 0 }}
                dragMomentum={false}
                style={{ x }}
                onDragEnd={handleDragEnd}
              >
                {months.map((m) => (
                  <MonthGrid
                    key={`${m.year}-${m.month}`}
                    year={m.year}
                    month={m.month}
                    eventsByDate={eventDatesMap}
                    onSelectDay={handleSelectDay}
                  />
                ))}
              </motion.div>
            </div>
          </div>

          {/* ═══ LIST HEADER ═══ */}
          <div className="flex flex-col gap-[4px]">
            <span className="text-xs font-bold text-foreground uppercase leading-tight">
              LIST
            </span>
            <h2 className="text-3xl font-bold text-foreground uppercase leading-tight">
              UPCOMING
            </h2>
          </div>

          {/* ═══ EVENT CARDS ═══ */}
          <motion.div
            layout
            className="flex flex-col gap-[80px]"
            transition={{ layout: { duration: 0.3, ease: 'easeInOut' } }}
          >
            {monthEvents.length > 0 ? (
              monthEvents.map((event) => {
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

                if (isRehearsal) {
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl shadow-sm bg-card border border-border/40 flex flex-col gap-2.5 cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Top Metadata Row */}
                      <div className="flex justify-between items-center gap-2 mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-accent-rehearsal truncate">REHEARSAL</span>
                      
                        <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight shrink-0" style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}>
                          <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">
                            {event.date ? formatEventDate(event.date) : 'TBD'}
                          </span>
                        </div>
                      </div>
                      {/* Section 1: Event Info + Icons + Date */}
                      <div className="flex gap-[30px] items-start w-full">
                        <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                              {/* ═══ EVENT TITLE ═══ */}
                              <h3 className="text-3xl font-bold text-foreground uppercase leading-tight truncate">
                                {event.title}
                              </h3>
                            </div>
                          <div className="flex flex-col gap-[2px] mt-1">
                            <div className="flex gap-[2px] items-center">
                              <span className="text-base font-bold text-foreground uppercase whitespace-nowrap">
                                {event.location?.split(',')[0] || 'TBD'}
                              </span>
                              <ArrowUpRight className="w-[18px] h-[18px] text-foreground/50 shrink-0" />
                            </div>
                            {(event.venueAddress || event.location?.includes(',')) && (
                              <span className="text-xs font-medium text-foreground/50 uppercase">
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
                                  className="bg-[var(--warning)] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {warningPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Missing Info</span>
                                      {warnings.map((w, wi) => (
                                        <div key={wi} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[var(--warning)] shrink-0" />
                                          <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{w}</span>
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
                                  className="bg-[var(--amber)] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {suggestionPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Suggestions</span>
                                      {suggestions.map((s, si) => (
                                        <div key={si} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[var(--amber)] shrink-0" />
                                          <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{s}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            <div className="bg-background rounded-full p-[6px]">
                              <ArrowUpRight className="w-[28px] h-[28px] text-foreground" />
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section 2: Bottom Values Row */}
                      <div className="mt-3 flex justify-between items-end gap-4 w-full">
                        <div>
                          <span className="text-xs font-bold text-foreground/70 uppercase">TEAM MEMBERS</span>
                          <span className="text-3xl font-bold text-foreground leading-tight block">{memberCount}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-foreground/70 uppercase">TIME</span>
                          <span className="text-3xl font-bold text-foreground leading-tight block whitespace-nowrap">
                            {event.time ? formatEventTime(event.time) : 'TBD'}
                          </span>
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
                      className="p-4 rounded-2xl shadow-sm bg-card border border-border/40 flex flex-col gap-2.5 cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Top Metadata Row */}
                      <div className="flex justify-between items-center gap-2 mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gig truncate">GIG</span>
                      
                        <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight shrink-0" style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}>
                          <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">
                            {event.date ? formatEventDate(event.date) : 'TBD'}
                          </span>
                        </div>
                      </div>
                      {/* Section 1: Event Info + Icons + Date */}
                      <div className="flex gap-[30px] items-start w-full">
                        <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                              {/* ═══ EVENT TITLE ═══ */}
                              <h3 className="text-3xl font-bold text-foreground uppercase leading-tight truncate">
                                {event.title}
                              </h3>
                            </div>
                          <div className="flex flex-col gap-[2px] mt-1">
                            <div className="flex gap-[2px] items-center">
                              <span className="text-base font-bold text-foreground uppercase whitespace-nowrap">
                                {event.location?.split(',')[0] || 'TBD'}
                              </span>
                              <ArrowUpRight className="w-[18px] h-[18px] text-foreground/50 shrink-0" />
                            </div>
                            {(event.venueAddress || event.location?.includes(',')) && (
                              <span className="text-xs font-medium text-foreground/50 uppercase">
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
                                  className="bg-[var(--warning)] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {warningPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Missing Info</span>
                                      {warnings.map((w, wi) => (
                                        <div key={wi} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[var(--warning)] shrink-0" />
                                          <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{w}</span>
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
                                  className="bg-[var(--amber)] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {suggestionPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Suggestions</span>
                                      {suggestions.map((s, si) => (
                                        <div key={si} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[var(--amber)] shrink-0" />
                                          <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{s}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            <div className="bg-accent-gig rounded-full p-[6px]">
                              <ArrowUpRight className="w-[28px] h-[28px] text-accent-gig-foreground" />
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section 2: Bottom Values Row */}
                      <div className="mt-3 flex justify-between items-end gap-4 w-full">
                        <div>
                          <span className="text-xs font-bold text-foreground/70 uppercase">TEAM MEMBERS</span>
                          <span className="text-3xl font-bold text-foreground leading-tight block">{memberCount}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-foreground uppercase">{isAdmin ? 'DUE TOTAL' : 'YOUR FEE'}</span>
                          <span className="text-3xl font-bold text-foreground leading-tight block whitespace-nowrap">
                            {getDisplayFee(event)}
                          </span>
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
                      className="p-4 rounded-2xl shadow-sm bg-card border border-border/40 flex flex-col gap-2.5 cursor-pointer"
                      onClick={() => onEventClick(event)}
                    >
                      {/* Top Metadata Row */}
                      <div className="flex justify-between items-center gap-2 mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-accent-quote truncate">QUOTE</span>
                      
                        <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight shrink-0" style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}>
                          <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">
                            {event.date ? formatEventDate(event.date) : 'TBD'}
                          </span>
                        </div>
                      </div>
                      {/* Section 1: Event Info + Icons + Date */}
                      <div className="flex gap-[30px] items-start w-full">
                        <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                              {/* ═══ EVENT TITLE ═══ */}
                              <h3 className="text-3xl font-bold text-foreground uppercase leading-tight truncate">
                                {event.title}
                              </h3>
                            </div>
                          <div className="flex flex-col gap-[2px] mt-1">
                            <div className="flex gap-[2px] items-center">
                              <span className="text-base font-bold text-foreground uppercase whitespace-nowrap">
                                {event.location?.split(',')[0] || 'TBD'}
                              </span>
                              <ArrowUpRight className="w-[18px] h-[18px] text-foreground/50 shrink-0" />
                            </div>
                            {(event.venueAddress || event.location?.includes(',')) && (
                              <span className="text-xs font-medium text-foreground/50 uppercase">
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
                                  className="bg-[var(--warning)] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {warningPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Missing Info</span>
                                      {warnings.map((w, wi) => (
                                        <div key={wi} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[var(--warning)] shrink-0" />
                                          <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{w}</span>
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
                                  className="bg-[var(--amber)] rounded-full p-[6px]"
                                  style={{ transform: 'rotate(180deg)' }}
                                >
                                  <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <AnimatePresence>
                                  {suggestionPopoverId === event.id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                      className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Suggestions</span>
                                      {suggestions.map((s, si) => (
                                        <div key={si} className="flex items-center gap-2 py-1">
                                          <div className="w-[5px] h-[5px] rounded-full bg-[var(--amber)] shrink-0" />
                                          <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{s}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                            <div className="bg-background rounded-full p-[6px]">
                              <ArrowUpRight className="w-[28px] h-[28px] text-foreground" />
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Section 2: Bottom Values Row */}
                      <div className="mt-3 flex justify-between items-end gap-4 w-full">
                        <div>
                          <span className="text-xs font-bold text-foreground/70 uppercase">TEAM MEMBERS</span>
                          <span className="text-3xl font-bold text-foreground leading-tight block">{memberCount}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-foreground uppercase">{isAdmin ? 'DUE TOTAL' : 'YOUR FEE'}</span>
                          <span className="text-3xl font-bold text-foreground leading-tight block whitespace-nowrap">
                            {getDisplayFee(event)}
                          </span>
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
                    className="p-4 rounded-2xl shadow-sm bg-card border border-border/40 flex flex-col gap-2.5 cursor-pointer"
                    onClick={() => onEventClick(event)}
                  >
                    {/* Top Metadata Row */}
                    <div className="flex justify-between items-center gap-2 mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">DRAFT</span>
                    
                        <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight shrink-0" style={{ backgroundColor: dateTagStyle.bg, color: dateTagStyle.text }}>
                          <span className="text-xs font-bold uppercase whitespace-nowrap leading-tight">
                            {event.date ? formatEventDate(event.date) : 'TBD'}
                          </span>
                        </div>
                      </div>
                    {/* Section 1: Event Info + Icons + Date */}
                    <div className="flex gap-[30px] items-start w-full">
                      <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                        <h3 className="text-3xl font-bold text-foreground uppercase leading-tight">
                          {event.title}
                        </h3>
                        <div className="flex flex-col gap-[2px]">
                          <div className="flex gap-[2px] items-center">
                            <span className="text-base font-bold text-foreground uppercase whitespace-nowrap">
                              {event.location?.split(',')[0] || 'TBD'}
                            </span>
                            <ArrowUpRight className="w-[18px] h-[18px] text-foreground/50 shrink-0" />
                          </div>
                          {(event.venueAddress || event.location?.includes(',')) && (
                            <span className="text-xs font-medium text-foreground/50 uppercase">
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
                                className="bg-[var(--warning)] rounded-full p-[6px]"
                                style={{ transform: 'rotate(180deg)' }}
                              >
                                <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                              </button>
                              <AnimatePresence>
                                {warningPopoverId === event.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                    className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Missing Info</span>
                                    {warnings.map((w, wi) => (
                                      <div key={wi} className="flex items-center gap-2 py-1">
                                        <div className="w-[5px] h-[5px] rounded-full bg-[var(--warning)] shrink-0" />
                                        <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{w}</span>
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
                                className="bg-[var(--amber)] rounded-full p-[6px]"
                                style={{ transform: 'rotate(180deg)' }}
                              >
                                <AlertCircle className="w-[28px] h-[28px] text-surface-inverse-foreground" style={{ transform: 'rotate(180deg)' }} />
                              </button>
                              <AnimatePresence>
                                {suggestionPopoverId === event.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                    className="absolute top-full right-0 mt-2 bg-[var(--surface-inverse)] rounded-[10px] p-3 z-50 min-w-[180px] shadow-lg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span className="text-xs font-bold text-surface-inverse-foreground/50 uppercase block mb-2">Suggestions</span>
                                    {suggestions.map((s, si) => (
                                      <div key={si} className="flex items-center gap-2 py-1">
                                        <div className="w-[5px] h-[5px] rounded-full bg-[var(--amber)] shrink-0" />
                                        <span className="text-[11px] font-medium text-surface-inverse-foreground/80">{s}</span>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                          <div className="bg-background rounded-full p-[6px]">
                            <ArrowUpRight className="w-[28px] h-[28px] text-foreground" />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Section 2: Bottom Values Row */}
                    <div className="mt-3 flex justify-between items-end gap-4 w-full">
                      <div>
                        <span className="text-xs font-bold text-foreground/70 uppercase">TEAM MEMBERS</span>
                        <span className="text-3xl font-bold text-foreground leading-tight block">{memberCount}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-foreground/70 uppercase">{rightLabel}</span>
                        <span className="text-3xl font-bold text-foreground leading-tight block whitespace-nowrap">
                          {rightValue}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm font-bold text-foreground/40 uppercase">
                  No events in {monthName} {currentMonth.year}
                </p>
              </div>
            )}
          </motion.div>
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
              className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-[10px]"
              onClick={closeDayPicker}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[91] bg-surface-inverse rounded-t-[26px] px-4 pt-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
              style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-surface-inverse-foreground/30" />
              </div>

              <div className="flex items-end justify-between mb-8">
                <p className="text-xs font-bold text-surface-inverse-foreground/50 uppercase tracking-wider">
                  {dayPickerEvents[0]?.date ? formatEventDate(dayPickerEvents[0].date) : ''} — {dayPickerEvents.length} EVENTS
                </p>
                <button
                  onClick={closeDayPicker}
                  className="w-9 h-9 rounded-full border border-surface-inverse-foreground/20 flex items-center justify-center text-surface-inverse-foreground active:scale-90 transition-transform"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-6 mb-6">
                {dayPickerEvents.map(ev => {
                  const status = ev.status?.toUpperCase();
                  const isReh = status === 'REHEARSAL';
                  const isQuote = status === 'QUOTED' || status === 'QUOTE';
                  const accentColor = isReh ? 'var(--accent-rehearsal)' : isQuote ? 'var(--accent-quote)' : 'var(--accent)';
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
                      <h3 className="text-xl font-bold text-surface-inverse-foreground uppercase leading-tight">
                        {ev.title}
                      </h3>
                      <div className="flex items-center gap-2 text-surface-inverse-foreground/50 text-xs font-bold">
                        {ev.time && <span>{formatEventTime(ev.time)}</span>}
                        {ev.time && ev.location && <span className="text-surface-inverse-foreground/20">·</span>}
                        {ev.location && <span>{ev.location.split(',')[0]}</span>}
                      </div>
                      <div className="grid grid-cols-6 gap-1 w-full">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-[15px] rounded-[10px]"
                            style={{ backgroundColor: i < (ev.members?.length || 0) ? accentColor : 'var(--dot-inactive)' }}
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
