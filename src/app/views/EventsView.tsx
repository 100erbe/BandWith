import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Plus,
  Search,
  X,
  ChevronDown,
  History,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { StatusBadge } from '@/app/components/ui/StatusBadge';
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
  onOpenPastEvents?: () => void;
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
  draft: 'bg-black/20 text-foreground/60',
  pending: 'bg-accent-quote text-accent-quote-foreground',
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

const getCalendarColor = (event: EventData): string => {
  const status = event.status?.toUpperCase();
  if (status === 'REHEARSAL') return 'var(--accent-rehearsal)';
  if (status === 'CONFIRMED' || status === 'COMPLETED') return 'var(--accent-gig)';
  if (status === 'QUOTED' || status === 'QUOTE') return 'var(--accent-quote)';
  if (status === 'DRAFT' || status === 'PENDING') return 'var(--muted-fg)';
  return 'var(--accent-gig)';
};

const normalizeDateStr = (rawDate: string | undefined): string | null => {
  if (!rawDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  if (rawDate.includes('T')) return rawDate.split('T')[0];
  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return rawDate;
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
  selectedBandPill = 'all',
  onBandPillClick = () => {},
  allEvents,
  onEventClick,
  onCreateEvent,
  onOpenPastEvents,
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

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [warningPopoverId, setWarningPopoverId] = useState<number | null>(null);
  const [suggestionPopoverId, setSuggestionPopoverId] = useState<number | null>(null);
  const bandIds = React.useMemo(() => (bands || []).map(b => b.id), [bands]);
  const [dayPickerEvents, setDayPickerEvents] = useState<EventData[] | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: EventData[] = [];
    const past: EventData[] = [];

    allEvents.forEach((event) => {
      const normDate = normalizeDateStr(event.date);
      if (!normDate) {
        // Undated drafts or unscheduled events stay in upcoming
        upcoming.push(event);
      } else if (normDate >= todayStr) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    // Upcoming sorted ascending (soonest first)
    upcoming.sort((a, b) => {
      const dateA = normalizeDateStr(a.date) || '9999-99-99';
      const dateB = normalizeDateStr(b.date) || '9999-99-99';
      return dateA.localeCompare(dateB);
    });

    // Past sorted descending (most recent past first)
    past.sort((a, b) => {
      const dateA = normalizeDateStr(a.date) || '';
      const dateB = normalizeDateStr(b.date) || '';
      return dateB.localeCompare(dateA);
    });

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [allEvents, todayStr]);

  const eyebrowLabel = useMemo(() => {
    if (eventFilter === 'All') return 'SCHEDULE';
    if (eventFilter === 'GIGS') return 'GIGS';
    if (eventFilter === 'REHEARSAL') return 'REHEARSALS';
    if (eventFilter === 'QUOTE') return 'QUOTES';
    if (eventFilter === 'DRAFT') return 'DRAFTS';
    return 'SCHEDULE';
  }, [eventFilter]);

  const openDayPicker = (events: EventData[]) => {
    setDayPickerEvents(events);
    onDayPickerOpen?.(true);
  };
  const closeDayPicker = () => {
    setDayPickerEvents(null);
    onDayPickerOpen?.(false);
  };
  const searchRef = useRef<HTMLInputElement>(null);

  const eventDatesMap = useMemo(() => {
    const map: Record<string, EventData[]> = {};
    const monthStart = new Date(calendarYear, calendarMonth, 1);
    const monthEnd = new Date(calendarYear, calendarMonth + 1, 0);
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
  }, [allEvents, calendarMonth, calendarYear]);

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

  const renderEventCard = (event: EventData, isPast: boolean = false) => {
    const status = event.status?.toUpperCase();
    const isRehearsal = status === 'REHEARSAL';
    const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
    const isQuote = status === 'QUOTED' || status === 'QUOTE';
    const isDraft = !isRehearsal && !isGig && !isQuote;
    const memberCount = event.members?.length || 0;

    let accentColor = 'var(--accent-gig)';
    let accentFg = 'var(--accent-gig-fg)';
    let typeLabel = 'GIG';

    if (isRehearsal) {
      accentColor = 'var(--accent-rehearsal)';
      accentFg = 'var(--accent-rehearsal-fg)';
      typeLabel = 'REHEARSAL';
    } else if (isQuote) {
      accentColor = 'var(--accent-quote)';
      accentFg = 'var(--accent-quote-fg)';
      typeLabel = 'QUOTE';
    } else if (isDraft) {
      accentColor = 'var(--muted-fg)';
      accentFg = 'var(--bg)';
      typeLabel = 'DRAFT';
    }

    if (isPast) {
      accentColor = 'var(--accent-past)';
      accentFg = 'var(--accent-past-fg)';
    }

    const warnings = getEventWarnings(event);
    const suggestions = getEventSuggestions(event);
    const tags = getEventTags(event);
    const secondaryTags = tags.filter(t => t !== 'GIG' && t !== 'REHEARSAL' && t !== 'QUOTE' && t !== 'DRAFT');

    const rehearsalTime = event.time
      ? (event.endTime
          ? `${formatEventTime(event.time)} - ${formatEventTime(event.endTime)}`
          : formatEventTime(event.time))
      : 'TBD';

    const loadInTime = event.loadInTime
      ? formatEventTime(event.loadInTime)
      : event.time
        ? formatEventTime(event.time.replace(/^(\d+)/, (_, h) => String(Math.max(1, parseInt(h) - 3))))
        : 'TBD';

    const soundCheckTime = event.soundcheckTime
      ? formatEventTime(event.soundcheckTime)
      : event.time
        ? formatEventTime(event.time.replace(/:d{2}$/, ':30').replace(/^(\d+)/, (_, h) => String(Math.max(1, parseInt(h) - 2))))
        : 'TBD';

    const showTime = event.time ? formatEventTime(event.time) : 'TBD';

    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative flex flex-col rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 overflow-hidden cursor-pointer shadow-sm transition-all hover:shadow-md active:scale-[0.99]",
          isPast && "opacity-80 hover:opacity-100"
        )}
        onClick={() => onEventClick(event)}
      >
        {/* Left Accent Rail */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[5px]"
          style={{ backgroundColor: accentColor }}
        />

        <div className="flex flex-col gap-[14px] p-[16px] pl-[20px] sm:p-[20px] sm:pl-[24px]">
          {/* Card Header: Tags + Date & Warnings */}
          <div className="flex items-start justify-between gap-[12px]">
            <div className="flex items-center gap-[6px] flex-wrap">
              {/* Multi-band member: band name pill */}
              {!isAdmin && bands.length > 1 && event.band_name && (
                <div className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[11px] font-bold uppercase tracking-wider leading-tight bg-foreground/10 text-foreground/80">
                  {event.band_name}
                </div>
              )}
              {/* Primary Type Badge */}
              <div
                className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[11px] font-bold uppercase tracking-wider leading-tight"
                style={{ backgroundColor: accentColor, color: accentFg }}
              >
                {typeLabel}
              </div>
              {/* Secondary Tags */}
              {secondaryTags.map((tag, i) => (
                <div
                  key={i}
                  className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[11px] font-bold uppercase tracking-wider leading-tight bg-foreground/10 text-foreground/70"
                >
                  {tag}
                </div>
              ))}
              {isPast && (
                <div className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[11px] font-bold uppercase tracking-wider leading-tight bg-foreground/10 text-foreground/50">
                  PAST
                </div>
              )}
            </div>

            {/* Top-Right Badges: Warnings & Date */}
            <div className="flex items-center gap-[8px] shrink-0">
              {!isPast && warnings.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSuggestionPopoverId(null); setWarningPopoverId(warningPopoverId === event.id ? null : event.id); }}
                    className="bg-[var(--warning)] rounded-full p-[4px] hover:opacity-90 transition-opacity"
                  >
                    <AlertCircle className="w-[16px] h-[16px] text-white" />
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
                        <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Missing Info</span>
                        {warnings.map((w, wi) => (
                          <div key={wi} className="flex items-center gap-2 py-1">
                            <div className="w-[5px] h-[5px] rounded-full bg-[var(--warning)] shrink-0" />
                            <span className="text-[11px] font-medium text-white/80">{w}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {!isPast && isAdmin && suggestions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setWarningPopoverId(null); setSuggestionPopoverId(suggestionPopoverId === event.id ? null : event.id); }}
                    className="bg-[var(--amber)] rounded-full p-[4px] hover:opacity-90 transition-opacity"
                  >
                    <AlertCircle className="w-[16px] h-[16px] text-white" />
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
                        <span className="text-[10px] font-bold text-white/50 uppercase block mb-2">Suggestions</span>
                        {suggestions.map((s, si) => (
                          <div key={si} className="flex items-center gap-2 py-1">
                            <div className="w-[5px] h-[5px] rounded-full bg-[var(--amber)] shrink-0" />
                            <span className="text-[11px] font-medium text-white/80">{s}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Date Badge */}
              <div
                className="rounded-[8px] px-[10px] py-[4px] text-[12px] font-bold uppercase tracking-wider whitespace-nowrap shadow-xs"
                style={{ backgroundColor: accentColor, color: accentFg }}
              >
                {event.date ? formatEventDate(event.date) : 'TBD'}
              </div>
            </div>
          </div>

          {/* Card Body: Title & Venue */}
          <div className="flex flex-col gap-[3px]">
            <h3 className="text-[19px] sm:text-[21px] font-bold text-foreground uppercase tracking-tight leading-snug line-clamp-1">
              {event.title}
            </h3>
            <div className="flex items-center gap-[6px] text-[13px] text-foreground/60 font-medium truncate">
              <span className="font-semibold text-foreground/80">
                {event.location?.split(',')[0] || event.clientName || 'TBD'}
              </span>
              {(event.venueAddress || event.location?.includes(',')) && (
                <>
                  <span className="text-foreground/30">•</span>
                  <span className="truncate text-foreground/50">
                    {event.venueAddress || event.location?.split(',').slice(1).join(',').trim()}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Card Footer: Metadata Strip */}
          <div className="border-t border-foreground/10 pt-[10px] flex items-center justify-between gap-[12px]">
            {isRehearsal ? (
              <>
                <div className="flex items-center gap-[8px]">
                  <span className="text-[11px] font-bold text-foreground/45 uppercase tracking-wider">TIME</span>
                  <span className="text-[15px] font-bold text-foreground leading-none">
                    {rehearsalTime}
                  </span>
                </div>
                <div className="flex items-center gap-[6px] text-foreground/70">
                  <span className="text-[11px] font-bold text-foreground/45 uppercase tracking-wider">MEMBERS</span>
                  <span className="text-[14px] font-bold text-foreground leading-none">{memberCount}</span>
                </div>
              </>
            ) : isGig ? (
              <>
                <div className="flex items-center gap-[12px] sm:gap-[16px] flex-wrap text-[13px]">
                  <div className="flex items-center gap-[4px]">
                    <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider">LOAD</span>
                    <span className="text-[14px] font-bold text-foreground leading-none">{loadInTime}</span>
                  </div>
                  <div className="flex items-center gap-[4px]">
                    <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider">SOUND</span>
                    <span className="text-[14px] font-bold text-foreground leading-none">{soundCheckTime}</span>
                  </div>
                  <div className="flex items-center gap-[4px]">
                    <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider">SHOW</span>
                    <span className="text-[14px] font-bold text-foreground leading-none">{showTime}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider leading-none mb-[2px]">
                    {getFeeLabel(event)}
                  </span>
                  <span className="text-[17px] font-bold text-foreground leading-none">
                    {getDisplayFee(event)}
                  </span>
                </div>
              </>
            ) : isQuote ? (
              <>
                <div className="flex items-center gap-[12px] sm:gap-[16px] flex-wrap text-[13px]">
                  <div className="flex items-center gap-[4px]">
                    <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider">CLIENT</span>
                    <span className="text-[14px] font-bold text-foreground uppercase leading-none truncate max-w-[140px] sm:max-w-[200px]">
                      {event.clientName || 'TBD'}
                    </span>
                  </div>
                  <div className="flex items-center gap-[4px]">
                    <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider">TEAM</span>
                    <span className="text-[14px] font-bold text-foreground leading-none">{memberCount}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider leading-none mb-[2px]">
                    {getFeeLabel(event)}
                  </span>
                  <span className="text-[17px] font-bold text-foreground leading-none">
                    {getDisplayFee(event)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-[6px]">
                  <span className="text-[11px] font-bold text-foreground/45 uppercase tracking-wider">STATUS</span>
                  <span className="text-[14px] font-bold text-foreground uppercase leading-none">DRAFT</span>
                </div>
                <div className="flex items-center gap-[6px]">
                  <span className="text-[11px] font-bold text-foreground/45 uppercase tracking-wider">TEAM</span>
                  <span className="text-[14px] font-bold text-foreground leading-none">{memberCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

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
                <div className="flex items-center gap-[8px] bg-black/10 rounded-[10px] px-[12px] py-[8px]">
                  <Search className="w-[16px] h-[16px] text-foreground/40 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events..."
                    className="bg-transparent text-[14px] font-medium text-[var(--fg)] placeholder:text-foreground/30 focus:outline-none flex-1"
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
              let activeBg = 'bg-white';
              let activeText = 'text-foreground';
              if (f === 'GIGS') { activeBg = 'bg-accent-gig'; activeText = 'text-accent-gig-foreground'; }
              else if (f === 'REHEARSAL') { activeBg = 'bg-accent-rehearsal'; activeText = 'text-accent-rehearsal-foreground'; }
              else if (f === 'QUOTE') { activeBg = 'bg-accent-quote'; activeText = 'text-accent-quote-foreground'; }
              else if (f === 'DRAFT') { activeBg = 'bg-black/50'; activeText = 'text-white'; }
              return (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={cn(
                  "px-[8px] py-[6px] rounded-[6px] text-[12px] whitespace-nowrap transition-all shrink-0",
                  isActive
                    ? `${activeBg} ${activeText} font-bold`
                    : "bg-black/20 text-foreground/40 font-medium"
                )}
              >
                {f}
              </button>);
            })}
            <button
              onClick={() => { setIsSearchOpen(!isSearchOpen); if (!isSearchOpen) setTimeout(() => searchRef.current?.focus(), 100); }}
              className={cn(
                "w-[32px] h-[32px] rounded-full border-[1.5px] flex items-center justify-center transition-all shrink-0",
                isSearchOpen ? "border-black bg-black text-white" : "border-black/30 bg-transparent text-foreground/50"
              )}
            >
              <Search className="w-[14px] h-[14px]" />
            </button>
          </div>

          {/* ═══ FEATURED EVENT CARD (when filter ≠ All) ═══ */}
          {eventFilter !== 'All' && (() => {
            const nextEvent = upcomingEvents.find(e => Boolean(e.date));
            if (!nextEvent) return null;
            const feat = nextEvent;
            const tags = getEventTags(feat);
            const status = feat.status?.toUpperCase();
            const isRehearsal = status === 'REHEARSAL';
            const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
            const isQuote = status === 'QUOTED' || status === 'QUOTE';
            const memberCount = feat.members?.length || 0;

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
                              <span className="text-[12px] font-bold uppercase whitespace-nowrap leading-tight">{tag}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Multi-band member: band name pill + event type pill */}
                      {!isAdmin && bands.length > 1 && (
                        <div className="flex gap-[4px] items-center flex-wrap">
                          {feat.band_name && (
                            <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                              <span className="text-[12px] font-bold uppercase whitespace-nowrap leading-tight">{feat.band_name}</span>
                            </div>
                          )}
                          <div className="inline-flex items-center justify-center rounded-[6px] px-[10px] py-[4px] leading-tight" style={{ backgroundColor: tagBg, color: tagTextColor }}>
                            <span className="text-[12px] font-bold uppercase whitespace-nowrap leading-tight">{isGig ? 'GIG' : isRehearsal ? 'REHEARSAL' : isQuote ? 'QUOTE' : 'DRAFT'}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <StatusBadge status={feat.status} />
                      </div>
                      <h3 className="text-[32px] font-bold text-foreground uppercase leading-tight truncate">{feat.title}</h3>
                      <div className="flex flex-col gap-[2px]">
                        <span className="text-[16px] font-bold text-foreground uppercase leading-tight">{feat.location?.split(',')[0] || 'TBD'}</span>
                        {feat.venueAddress && (
                          <span className="text-[12px] font-medium text-foreground/50 uppercase leading-tight">{feat.venueAddress}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                      <div className="bg-muted rounded-[10px] px-[10px] py-[10px]">
                        <span className="text-[12px] font-bold text-foreground uppercase whitespace-nowrap leading-tight">
                          {feat.date ? formatEventDate(feat.date) : 'TBD'}{feat.time ? ` - ${formatEventTime(feat.time)}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isGig ? (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-start">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">LOAD IN</span>
                        <span className="text-[22px] font-bold text-foreground leading-none">
                          {feat.loadInTime ? formatEventTime(feat.loadInTime) : feat.time ? formatEventTime(feat.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 3)))) : 'TBD'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">SOUNDCHECK</span>
                        <span className="text-[22px] font-bold text-foreground leading-none">
                          {feat.soundcheckTime ? formatEventTime(feat.soundcheckTime) : feat.time ? formatEventTime(feat.time.replace(/^(\d+)/, (_, h: string) => String(Math.max(1, parseInt(h) - 2)))) : 'TBD'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">SHOW</span>
                        <span className="text-[22px] font-bold text-foreground leading-none">{feat.time ? formatEventTime(feat.time) : 'TBD'}</span>
                      </div>
                    </div>
                  ) : isRehearsal ? (
                    <div className="flex gap-[20px] items-end">
                      <div className="flex-1 flex flex-col">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">CONFIRMED MEMBERS</span>
                        <span className="text-[22px] font-bold text-foreground leading-none">{memberCount}</span>
                      </div>
                    </div>
                  ) : isQuote ? (
                    <div className="grid grid-cols-2 gap-x-[20px]">
                      <div className="flex flex-col gap-[8px]">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">CLIENT</span>
                        <span className="text-[22px] font-bold text-foreground leading-none uppercase">{feat.clientName || 'TBD'}</span>
                      </div>
                      <div className="flex flex-col gap-[8px]">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">{isAdmin ? 'PRICING & FINANCE' : 'YOUR FEE'}</span>
                        <span className="text-[22px] font-bold text-foreground leading-none">{getDisplayFee(feat)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-[20px] items-end">
                      <div className="flex-1 flex flex-col">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">TEAM MEMBERS</span>
                        <span className="text-[22px] font-bold text-foreground leading-none">{memberCount}</span>
                      </div>
                      <div className="flex-1 flex flex-col">
                        <span className="text-[12px] font-bold text-foreground/70 leading-tight">{getFeeLabel(feat)}</span>
                        <span className="text-[22px] font-bold text-foreground leading-none">{getDisplayFee(feat)}</span>
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
                  className="border-[1.5px] border-border border-solid rounded-full p-[4px] flex items-center"
                >
                  <ChevronLeft className="w-[20px] h-[20px]" />
                </button>
                <button
                  onClick={nextMonth}
                  className="border-[1.5px] border-border border-solid rounded-full p-[4px] flex items-center"
                >
                  <ChevronRight className="w-[20px] h-[20px]" />
                </button>
              </div>
              <span className="text-[16px] font-bold text-foreground uppercase leading-tight">
                {monthName} {calendarYear}
              </span>
            </div>

            {/* Day Labels */}
            <div className="flex flex-col gap-[10px]">
              <div className="bg-black/10 rounded-[10px] flex">
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <div key={i} className="flex-1 py-[4px] text-center">
                    <span className="text-[10px] font-medium text-muted-foreground leading-tight">{d}</span>
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
                      let textColor = 'text-foreground';
                      let bgStyle: React.CSSProperties = { backgroundColor: bgColor };

                      if (hasEvents) {
                        const primary = eventsOnDay[0];
                        bgColor = getCalendarColor(primary);
                        const status = primary.status?.toUpperCase();
                        textColor = (status === 'REHEARSAL' || status === 'DRAFT' || status === 'PENDING' || status === 'QUOTE' || status === 'QUOTED')
                          ? 'text-white' : 'text-accent-gig-foreground';

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
                            <span className="absolute -top-1 -right-1 w-[14px] h-[14px] bg-[var(--surface-inverse)] text-[var(--surface-inverse-fg)] text-[8px] font-bold rounded-full flex items-center justify-center">
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
                          <span className="text-[16px] font-medium leading-none">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ═══ SECTION HEADER ═══ */}
          <div className="flex flex-col gap-[4px]">
            <span className="text-[12px] font-bold text-foreground/60 uppercase leading-none tracking-wider">
              {eyebrowLabel}
            </span>
            <div className="flex items-center gap-[10px]">
              <h2 className="text-[32px] font-bold text-foreground uppercase leading-none">
                UPCOMING
              </h2>
              {upcomingEvents.length > 0 && (
                <span className="px-[8px] py-[2px] rounded-full text-[12px] font-bold bg-foreground/10 text-foreground/80 leading-none">
                  {upcomingEvents.length}
                </span>
              )}
            </div>
          </div>

          {/* ═══ UPCOMING EVENT CARDS ═══ */}
          <div className="flex flex-col gap-[14px]">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => renderEventCard(event, false))
            ) : (
              <div className="rounded-[16px] border border-dashed border-foreground/15 bg-card/40 p-[28px] text-center flex flex-col items-center justify-center gap-[8px]">
                <p className="text-[13px] font-bold uppercase tracking-wider text-foreground/70">
                  NO UPCOMING {eyebrowLabel === 'SCHEDULE' ? 'EVENTS' : eyebrowLabel}
                </p>
                <p className="text-[12px] text-foreground/50 max-w-[280px]">
                  {pastEvents.length > 0
                    ? `All ${pastEvents.length} scheduled event${pastEvents.length > 1 ? 's are' : ' is'} in the past. Check the past events section below.`
                    : 'No events have been scheduled yet.'}
                </p>
                {isAdmin && onCreateEvent && (
                  <button
                    onClick={onCreateEvent}
                    className="mt-[6px] inline-flex items-center gap-[6px] px-[14px] py-[8px] rounded-[10px] bg-primary text-primary-foreground text-[12px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-[14px] h-[14px]" />
                    CREATE EVENT
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ═══ PAST EVENTS ARCHIVE QUICK ACCESS & COLLAPSIBLE ═══ */}
          {pastEvents.length > 0 && (
            <div className="flex flex-col gap-[12px] pt-[8px]">
              {/* Quick access hero card to full dedicated archive */}
              {onOpenPastEvents && (
                <div
                  onClick={onOpenPastEvents}
                  className="flex items-center justify-between p-[16px] rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/25 cursor-pointer shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-[12px]">
                    <div className="w-[42px] h-[42px] rounded-[12px] bg-foreground/5 flex items-center justify-center text-foreground/70 group-hover:scale-105 transition-transform">
                      <History className="w-[20px] h-[20px]" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-[6px]">
                        <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                          ARCHIVE
                        </span>
                        <span className="px-[6px] py-[1px] rounded-full text-[10px] font-bold bg-foreground/10 text-foreground/75">
                          {pastEvents.length}
                        </span>
                      </div>
                      <span className="text-[15px] font-bold text-foreground uppercase tracking-tight">
                        VIEW FULL ARCHIVE
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[4px] text-foreground/50 group-hover:text-foreground transition-colors">
                    <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">EXPLORE</span>
                    <ArrowUpRight className="w-[16px] h-[16px]" />
                  </div>
                </div>
              )}

              {/* Inline collapsible preview */}
              <button
                type="button"
                onClick={() => setShowPastEvents((prev) => !prev)}
                className="flex items-center justify-between px-[16px] py-[12px] rounded-[12px] bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-all text-left group"
              >
                <div className="flex items-center gap-[8px]">
                  <span className="text-[12px] font-bold uppercase text-foreground/60 tracking-wider">
                    QUICK PEEK ({pastEvents.length})
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-[16px] h-[16px] text-foreground/50 transition-transform duration-200",
                    showPastEvents && "rotate-180 text-foreground"
                  )}
                />
              </button>

              <AnimatePresence>
                {showPastEvents && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-[14px] overflow-hidden"
                  >
                    {pastEvents.map((event) => renderEventCard(event, true))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};