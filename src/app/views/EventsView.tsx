import React, { useState, useMemo, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
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
  Calendar,
  MapPin,
  Clock,
  RefreshCw,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { StatusBadge } from '@/app/components/ui/StatusBadge';
import { EventData } from '@/app/components/dashboard/EventCard';
import { APP_COPY } from '@/app/constants/copy';
import { RehearsalPollCard } from '@/app/components/rehearsal/RehearsalPollCard';
import type { RehearsalPoll } from '@/lib/services/rehearsalPolls';
import { EventsSkeleton } from '@/app/components/ui/EventsSkeleton';

interface EventsViewProps {
  loading?: boolean;
  eventFilter: string;
  setEventFilter: (filter: string) => void;
  eventSearch: string;
  setEventSearch: (search: string) => void;
  eventView: 'list' | 'calendar';
  groupedEvents: [string, EventData[]][];
  allEvents: EventData[];
  rawEvents?: EventData[];
  onEventClick: (event: EventData) => void;
  onCreateEvent?: (type: 'gig' | 'rehearsal' | 'quote', date?: string) => void;
  onOpenPastEvents?: () => void;
  isAdmin?: boolean;
  onDayPickerOpen?: (open: boolean) => void;
  userFeeMap?: Record<string, number>;
  bands?: Array<{ id: string; name: string }>;
  selectedBandPill?: string;
  onBandPillClick?: (bandId: string) => void;
  rehearsalPolls?: RehearsalPoll[];
  onConvertProposal?: (poll: RehearsalPoll) => void;
  onPollUpdated?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  currentUserId?: string;
}

const FILTERS = ['ALL', 'GIGS', 'REHEARSALS', 'QUOTES', 'DRAFTS'] as const;

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

const formatEventDateShort = (dateStr?: string): string => {
  if (!dateStr) return 'TBD';
  const norm = normalizeDateStr(dateStr);
  if (!norm) return dateStr;
  const parts = norm.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  return dateStr;
};

const getPrimaryBadge = (event: EventData): string => {
  const s = event.status?.toUpperCase();
  if (s === 'REHEARSAL' || event.eventType === 'rehearsal') return 'REHEARSAL';
  if (s === 'QUOTED' || s === 'QUOTE' || event.eventType === 'quote') return 'QUOTE';
  if (s === 'DRAFT' || s === 'PENDING') return 'DRAFT';
  return 'GIG';
};

const getBadgeStyleClass = (event: EventData): string => {
  const badge = getPrimaryBadge(event);
  if (badge === 'REHEARSAL') return 'bg-accent-rehearsal/15 text-accent-rehearsal border border-accent-rehearsal/25';
  if (badge === 'QUOTE') return 'bg-accent-quote/15 text-accent-quote border border-accent-quote/25';
  if (badge === 'DRAFT') return 'bg-foreground/10 text-foreground/60 border border-foreground/15';
  return 'bg-accent-gig/15 text-accent-gig border border-accent-gig/25';
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
  if (!price) return '€0';
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return price;
  if (num >= 1000) return `€${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`;
  return `€${num}`;
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
  loading = false,
  eventFilter,
  setEventFilter,
  eventSearch,
  setEventSearch,
  selectedBandPill = 'all',
  onBandPillClick = () => {},
  allEvents,
  rawEvents = [],
  onEventClick,
  onCreateEvent,
  onOpenPastEvents,
  isAdmin = true,
  onDayPickerOpen,
  userFeeMap = {},
  bands = [],
  rehearsalPolls = [],
  onConvertProposal,
  onPollUpdated,
  onShowToast,
  currentUserId,
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

  const activePolls = useMemo(() => {
    if (!rehearsalPolls) return [];
    return rehearsalPolls.filter((p) => {
      if (p.status === 'polling') return true;
      if (p.status === 'proposed') {
        return isAdmin || p.created_by === currentUserId;
      }
      return false;
    });
  }, [rehearsalPolls, isAdmin, currentUserId]);

  const baseDateRef = useRef(new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const monthOffsetRef = useRef(monthOffset);
  monthOffsetRef.current = monthOffset;
  const [selectedEmptyDate, setSelectedEmptyDate] = useState<string | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    document.addEventListener('touchstart', handleClickOutside, { capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, { capture: true });
      document.removeEventListener('touchstart', handleClickOutside, { capture: true });
    };
  }, []);

  const [warningPopoverId, setWarningPopoverId] = useState<number | null>(null);
  const [suggestionPopoverId, setSuggestionPopoverId] = useState<number | null>(null);

  // Close warning/suggestion popovers automatically when scrolling begins
  useEffect(() => {
    if (warningPopoverId === null && suggestionPopoverId === null) return;
    const handleScroll = () => {
      setWarningPopoverId(null);
      setSuggestionPopoverId(null);
    };
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [warningPopoverId, suggestionPopoverId]);
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

  const visibleFilters = useMemo(() => {
    return isAdmin ? FILTERS : FILTERS.filter(f => f !== 'QUOTES' && f !== 'DRAFTS');
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && (eventFilter === 'QUOTES' || eventFilter === 'QUOTE' || eventFilter === 'DRAFTS' || eventFilter === 'DRAFT')) {
      setEventFilter('ALL');
    }
  }, [isAdmin, eventFilter, setEventFilter]);

  const filteredAllEvents = useMemo(() => {
    if (!isAdmin) {
      return allEvents.filter(e => e.status !== 'QUOTE' && e.status !== 'QUOTED' && e.eventType !== 'quote');
    }
    return allEvents;
  }, [allEvents, isAdmin]);

  const autocompleteResults = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();
    if (!query) return { upcomingMatches: [], pastMatches: [], totalCount: 0 };

    const pool = rawEvents && rawEvents.length > 0 ? rawEvents : filteredAllEvents;
    
    // Regular members must never see quotes
    const accessiblePool = isAdmin 
      ? pool 
      : pool.filter(e => (e.status as string) !== 'QUOTE' && (e.status as string) !== 'QUOTED' && e.eventType !== 'quote');

    const seen = new Set<string>();
    const matches: EventData[] = [];

    accessiblePool.forEach(e => {
      const key = String(e.eventId || e.id);
      if (seen.has(key)) return;

      const titleMatch = (e.title || '').toLowerCase().includes(query);
      const locMatch = (e.location || '').toLowerCase().includes(query);
      const clientMatch = (e.clientName || '').toLowerCase().includes(query);
      const notesMatch = (e.notes || '').toLowerCase().includes(query);

      if (titleMatch || locMatch || clientMatch || notesMatch) {
        seen.add(key);
        matches.push(e);
      }
    });

    const upcomingMatches: EventData[] = [];
    const pastMatches: EventData[] = [];

    matches.forEach(e => {
      const norm = normalizeDateStr(e.date);
      if (!norm || norm >= todayStr) {
        upcomingMatches.push(e);
      } else {
        pastMatches.push(e);
      }
    });

    upcomingMatches.sort((a, b) => (normalizeDateStr(a.date) || '9999').localeCompare(normalizeDateStr(b.date) || '9999'));
    pastMatches.sort((a, b) => (normalizeDateStr(b.date) || '').localeCompare(normalizeDateStr(a.date) || ''));

    return {
      upcomingMatches: upcomingMatches.slice(0, 6),
      pastMatches: pastMatches.slice(0, 6),
      totalCount: matches.length,
    };
  }, [eventSearch, rawEvents, filteredAllEvents, isAdmin, todayStr]);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const upcoming: EventData[] = [];
    const past: EventData[] = [];

    filteredAllEvents.forEach((event) => {
      const normDate = normalizeDateStr(event.date);
      if (!normDate) {
        // Undated drafts or unscheduled events stay in upcoming
        upcoming.push(event);
      } else if (normDate >= todayStr) {
        upcoming.push(event);
      } else {
        past.push(event);
      }

      // Expand recurring rehearsals into upcoming event cards
      const rec = event as any;
      if (rec.is_recurring && rec.recurrence_rule && normDate) {
        const rule = rec.recurrence_rule;
        const freq = (rule.freq || rule.frequency || '').toLowerCase();
        if (freq) {
          const [y, m, day] = normDate.split('-').map(Number);
          const until = rule.until ? new Date(rule.until) : new Date(new Date().getFullYear() + 1, 11, 31);
          const maxCount = rule.count || 24;
          let cursor = new Date(y, m - 1, day, 12, 0, 0);
          let generated = 0;
          while (cursor <= until && generated < maxCount) {
            if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7 * (rule.interval || 1));
            else if (freq === 'biweekly') cursor.setDate(cursor.getDate() + 14);
            else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
            else break;
            if (cursor > until) break;
            const occDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            if (occDate >= todayStr && occDate !== normDate) {
              upcoming.push({
                ...event,
                id: `${event.id}-occ-${occDate}` as any,
                eventId: event.eventId,
                date: occDate,
              });
            }
            generated++;
          }
        }
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
  }, [filteredAllEvents, todayStr]);

  const eyebrowLabel = useMemo(() => {
    if (eventFilter === 'All' || eventFilter === 'ALL') return 'SCHEDULE';
    if (eventFilter === 'GIGS') return 'GIGS';
    if (eventFilter === 'REHEARSALS' || eventFilter === 'REHEARSAL') return 'REHEARSALS';
    if (eventFilter === 'QUOTES' || eventFilter === 'QUOTE') return 'QUOTES';
    if (eventFilter === 'DRAFTS' || eventFilter === 'DRAFT') return 'DRAFTS';
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

  const getMonthForOffset = (offset: number) => {
    const base = baseDateRef.current;
    const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const name = d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
    const totalCells = firstDay + days;
    const numRows = Math.ceil(totalCells / 7);
    return { offset, year, month, daysInMonth: days, firstDayOfWeek: firstDay, monthName: name, numRows };
  };

  const currMonthInfo = useMemo(() => getMonthForOffset(monthOffset), [monthOffset]);
  const prevMonthInfo = useMemo(() => getMonthForOffset(monthOffset - 1), [monthOffset]);
  const nextMonthInfo = useMemo(() => getMonthForOffset(monthOffset + 1), [monthOffset]);

  const calendarYear = currMonthInfo.year;
  const calendarMonth = currMonthInfo.month;
  const daysInMonth = currMonthInfo.daysInMonth;
  const firstDayOfWeek = currMonthInfo.firstDayOfWeek;
  const monthName = currMonthInfo.monthName;

  const today = new Date();
  const isCurrentMonth = monthOffset === 0;

  const eventDatesMap = useMemo(() => {
    const map: Record<string, EventData[]> = {};
    const source = filteredAllEvents;

    const addToMap = (ev: EventData, dateObj: Date) => {
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
      if (!map[key]) map[key] = [];
      const occDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const evForDay: EventData = {
        ...ev,
        date: occDate,
        id: (ev.date === occDate ? ev.id : `${ev.id}-occ-${occDate}`) as any,
      };
      if (!map[key].some(e => e.eventId === ev.eventId || e.id === evForDay.id)) {
        map[key].push(evForDay);
      }
    };

    source.forEach(ev => {
      if (!ev.date) return;
      const normD = normalizeDateStr(ev.date);
      if (!normD) return;
      const [y, m, day] = normD.split('-').map(Number);
      if (!y || !m || !day) return;
      const d = new Date(y, m - 1, day, 12, 0, 0);
      addToMap(ev, d);

      const rec = ev as any;
      if (rec.is_recurring && rec.recurrence_rule && ev.date) {
        const rule = rec.recurrence_rule;
        const freq = (rule.freq || rule.frequency || '').toLowerCase();
        if (!freq) return;
        const until = rule.until ? new Date(rule.until) : new Date(new Date().getFullYear() + 2, 11, 31);
        const maxCount = rule.count || 104;
        let cursor = new Date(y, m - 1, day, 12, 0, 0);
        let generated = 0;
        while (cursor <= until && generated < maxCount) {
          if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7 * (rule.interval || 1));
          else if (freq === 'biweekly') cursor.setDate(cursor.getDate() + 14);
          else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
          else break;
          if (cursor > until) break;
          addToMap(ev, new Date(cursor));
          generated++;
        }
      }
    });
    return map;
  }, [filteredAllEvents]);

  const carouselContainerRef = useRef<HTMLDivElement>(null);
  const [carouselWidth, setCarouselWidth] = useState<number>(0);
  const x = useMotionValue(0);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    if (!carouselContainerRef.current) return;
    const updateWidth = () => {
      if (carouselContainerRef.current) {
        const w = carouselContainerRef.current.offsetWidth;
        if (w > 0 && w !== carouselWidth) {
          setCarouselWidth(w);
          x.set(-monthOffsetRef.current * w);
        }
      }
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(carouselContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [carouselWidth]);

  const prevMonth = () => {
    if (isAnimatingRef.current || carouselWidth <= 0) return;
    isAnimatingRef.current = true;
    setSelectedEmptyDate(null);
    const targetOffset = monthOffset - 1;
    animate(x, -targetOffset * carouselWidth, {
      duration: 0.24,
      ease: [0.25, 1, 0.5, 1],
      onComplete: () => {
        setMonthOffset(targetOffset);
        isAnimatingRef.current = false;
      },
    });
  };

  const nextMonth = () => {
    if (isAnimatingRef.current || carouselWidth <= 0) return;
    isAnimatingRef.current = true;
    setSelectedEmptyDate(null);
    const targetOffset = monthOffset + 1;
    animate(x, -targetOffset * carouselWidth, {
      duration: 0.24,
      ease: [0.25, 1, 0.5, 1],
      onComplete: () => {
        setMonthOffset(targetOffset);
        isAnimatingRef.current = false;
      },
    });
  };

  const jumpToToday = () => {
    if (isAnimatingRef.current || carouselWidth <= 0 || monthOffset === 0) return;
    isAnimatingRef.current = true;
    setSelectedEmptyDate(null);
    if (Math.abs(monthOffset) === 1) {
      animate(x, 0, {
        duration: 0.24,
        ease: [0.25, 1, 0.5, 1],
        onComplete: () => {
          setMonthOffset(0);
          isAnimatingRef.current = false;
        },
      });
    } else {
      x.set(0);
      setMonthOffset(0);
      isAnimatingRef.current = false;
    }
  };

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (carouselWidth <= 0) return;
    const currentVal = x.get();
    const restingX = -monthOffset * carouselWidth;
    const displacement = currentVal - restingX;
    const threshold = carouselWidth * 0.2;
    const velocityThreshold = 250;

    if (displacement < -threshold || info.velocity.x < -velocityThreshold) {
      isAnimatingRef.current = true;
      const targetOffset = monthOffset + 1;
      animate(x, -targetOffset * carouselWidth, {
        duration: 0.22,
        ease: [0.25, 1, 0.5, 1],
        onComplete: () => {
          setMonthOffset(targetOffset);
          isAnimatingRef.current = false;
        },
      });
    } else if (displacement > threshold || info.velocity.x > velocityThreshold) {
      isAnimatingRef.current = true;
      const targetOffset = monthOffset - 1;
      animate(x, -targetOffset * carouselWidth, {
        duration: 0.22,
        ease: [0.25, 1, 0.5, 1],
        onComplete: () => {
          setMonthOffset(targetOffset);
          isAnimatingRef.current = false;
        },
      });
    } else {
      animate(x, restingX, {
        duration: 0.2,
        ease: [0.25, 1, 0.5, 1],
      });
    }
  };

  const formatSelectedDate = (dateKey: string) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
              {!isAdmin && (
                !event.band_id ? (
                  <div className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[11px] font-bold uppercase tracking-wider leading-tight bg-accent-gig/15 text-accent-gig border border-accent-gig/30">
                    Personal
                  </div>
                ) : (bands.length > 1 && event.band_name && (
                  <div className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[11px] font-bold uppercase tracking-wider leading-tight bg-foreground/10 text-foreground/80">
                    {event.band_name}
                  </div>
                ))
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
              {event._isPendingSync && (
                <div className="inline-flex items-center gap-1 rounded-[6px] px-[8px] py-[3px] text-[11px] font-bold uppercase tracking-wider leading-tight bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Syncing</span>
                </div>
              )}
            </div>

            {/* Top-Right Badges: Warnings & Date */}
            <div className="flex items-center gap-[8px] shrink-0">
              {!isPast && warnings.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSuggestionPopoverId(null); setWarningPopoverId(warningPopoverId === event.id ? null : event.id); }}
                    aria-label="Missing event details"
                    title="Missing event details"
                    className="w-6 h-6 rounded-full bg-warning/15 text-warning border border-warning/30 flex items-center justify-center hover:bg-warning/25 active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                  <AnimatePresence>
                    {warningPopoverId === event.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        className="absolute top-full right-0 mt-2 bg-popover text-popover-foreground border border-foreground/15 rounded-[12px] p-3 z-50 min-w-[210px] shadow-xl backdrop-blur-md cursor-pointer hover:border-warning/50 transition-all group/popover"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWarningPopoverId(null);
                          setSuggestionPopoverId(null);
                          onEventClick(event);
                        }}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-2 border-b border-foreground/10 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 stroke-[2.5]" />
                            <span className="text-[10px] font-bold text-warning uppercase tracking-wider">Missing Info</span>
                          </div>
                          <span className="text-[10px] font-bold text-foreground/50 group-hover/popover:text-foreground flex items-center gap-0.5 uppercase tracking-wider transition-colors">
                            Edit <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {warnings.map((w, wi) => (
                            <div key={wi} className="flex items-center gap-2 py-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                              <span className="text-[11px] font-medium text-foreground/80">{w}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-foreground/10 text-[10px] font-semibold text-foreground/50 text-center">
                          Tap to update details
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {!isPast && isAdmin && suggestions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setWarningPopoverId(null); setSuggestionPopoverId(suggestionPopoverId === event.id ? null : event.id); }}
                    aria-label="Event suggestions"
                    title="Event suggestions"
                    className="w-6 h-6 rounded-full bg-warning/15 text-warning border border-warning/30 flex items-center justify-center hover:bg-warning/25 active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                  <AnimatePresence>
                    {suggestionPopoverId === event.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        className="absolute top-full right-0 mt-2 bg-popover text-popover-foreground border border-foreground/15 rounded-[12px] p-3 z-50 min-w-[210px] shadow-xl backdrop-blur-md cursor-pointer hover:border-warning/50 transition-all group/popover"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWarningPopoverId(null);
                          setSuggestionPopoverId(null);
                          onEventClick(event);
                        }}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-2 border-b border-foreground/10 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 stroke-[2.5]" />
                            <span className="text-[10px] font-bold text-warning uppercase tracking-wider">Suggestions</span>
                          </div>
                          <span className="text-[10px] font-bold text-foreground/50 group-hover/popover:text-foreground flex items-center gap-0.5 uppercase tracking-wider transition-colors">
                            Edit <ArrowUpRight className="w-3 h-3" />
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {suggestions.map((s, si) => (
                            <div key={si} className="flex items-center gap-2 py-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                              <span className="text-[11px] font-medium text-foreground/80">{s}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-foreground/10 text-[10px] font-semibold text-foreground/50 text-center">
                          Tap to view details
                        </div>
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
            {!event.band_id && (
              <div className="text-[11px] uppercase tracking-wider leading-tight text-foreground/60 mb-0.5">
                <span className="font-bold text-accent-gig">PERSONAL</span> • GIG
              </div>
            )}
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

  const renderMonthGrid = (
    info: ReturnType<typeof getMonthForOffset>,
    isInteractive: boolean
  ) => {
    const { offset, year, month, daysInMonth, firstDayOfWeek, numRows } = info;
    return (
      <div
        className="grid grid-cols-7 gap-[4px] w-full"
        style={{
          gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
          height: numRows * 30,
        }}
      >
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${offset}-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${year}-${month}-${day}`;
          const dateKeyStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const eventsOnDay = eventDatesMap[dateKey] || [];
          const hasEvents = eventsOnDay.length > 0;
          const multipleEvents = eventsOnDay.length > 1;
          const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
          const isSelected = selectedEmptyDate === dateKeyStr;

          let bgColor = 'rgba(0,0,0,0.1)';
          let textColor = 'text-foreground';
          let bgStyle: React.CSSProperties = { backgroundColor: bgColor };

          if (hasEvents) {
            const primary = eventsOnDay[0];
            bgColor = getCalendarColor(primary);
            const status = primary.status?.toUpperCase();
            textColor =
              status === 'REHEARSAL' || status === 'DRAFT' || status === 'PENDING' || status === 'QUOTE' || status === 'QUOTED'
                ? 'text-white'
                : 'text-accent-gig-foreground';

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
              key={`${year}-${month}-${day}`}
              type="button"
              disabled={!isInteractive}
              onClick={() => {
                if (!isInteractive) return;
                setSelectedEmptyDate(null);
                if (multipleEvents) {
                  openDayPicker(eventsOnDay);
                } else {
                  onEventClick(eventsOnDay[0]);
                }
              }}
              className={cn(
                "rounded-[10px] flex items-center justify-center transition-all cursor-pointer relative select-none",
                isInteractive && "hover:scale-105 active:scale-95",
                textColor,
                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background font-bold shadow-md"
              )}
              style={bgStyle}
            >
              <span className="text-[16px] font-medium leading-none">{day}</span>
              {multipleEvents && (
                <span className="absolute -top-1 -right-1 w-[14px] h-[14px] bg-[var(--surface-inverse)] text-[var(--surface-inverse-fg)] text-[8px] font-bold rounded-full flex items-center justify-center shadow-xs">
                  {eventsOnDay.length}
                </span>
              )}
              {isToday && !multipleEvents && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-white dark:bg-primary" />
              )}
            </button>
          ) : (
            <button
              key={`${year}-${month}-${day}`}
              type="button"
              disabled={!isInteractive}
              onClick={() => {
                if (!isInteractive) return;
                setSelectedEmptyDate(isSelected ? null : dateKeyStr);
              }}
              className={cn(
                "rounded-[10px] flex items-center justify-center transition-all cursor-pointer relative select-none",
                isSelected
                  ? "bg-foreground/20 text-foreground ring-2 ring-foreground/60 shadow-xs scale-105 z-10"
                  : isToday
                  ? "bg-primary/15 text-primary font-bold ring-2 ring-primary/80 ring-offset-1 ring-offset-background hover:bg-primary/25 active:scale-95"
                  : "text-foreground/60 dark:text-muted-foreground hover:bg-foreground/10 active:scale-95"
              )}
              style={!isSelected && !isToday ? { backgroundColor: 'var(--muted)' } : undefined}
            >
              <span className={cn("text-[16px] leading-none", isToday ? "font-bold" : "font-medium")}>
                {day}
              </span>
              {isToday && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div
      key="events"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col gap-[20px] relative z-10 min-h-[50vh]"
    >
      {/* ═══ SEARCH & FILTERS SECTION ═══ */}
      <div className="flex flex-col gap-2.5 shrink-0">
        {/* ═══ PERMANENT SEARCH BAR & AUTOCOMPLETE ═══ */}
        <div ref={searchContainerRef} className="relative z-30">
          <div className="flex items-center gap-[10px] bg-foreground/5 border border-foreground/10 hover:border-foreground/20 focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-foreground/5 rounded-[12px] px-[14px] py-[9px] transition-all">
            <Search className="w-[16px] h-[16px] text-foreground/45 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={eventSearch}
              onChange={(e) => {
                setEventSearch(e.target.value);
                setShowAutocomplete(true);
              }}
              onFocus={() => {
                if (eventSearch.trim().length > 0) {
                  setShowAutocomplete(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowAutocomplete(false);
                  searchRef.current?.blur();
                } else if (e.key === 'Escape') {
                  setShowAutocomplete(false);
                }
              }}
              placeholder="Search events by title, venue, client..."
              className="bg-transparent text-[13px] font-medium text-foreground placeholder:text-foreground/35 focus:outline-none flex-1 min-w-0"
            />
            {eventSearch && (
              <button 
                type="button"
                onClick={() => {
                  setEventSearch('');
                  setShowAutocomplete(false);
                  searchRef.current?.focus();
                }}
                className="p-1 text-foreground/40 hover:text-foreground transition-colors rounded-full shrink-0"
                aria-label="Clear search"
              >
                <X className="w-[14px] h-[14px]" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {showAutocomplete && eventSearch.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute top-full left-0 right-0 mt-2 bg-card text-card-foreground rounded-[16px] shadow-2xl border border-foreground/15 max-h-[380px] overflow-y-auto z-50 divide-y divide-foreground/10 backdrop-blur-md"
              >
                {autocompleteResults.totalCount === 0 ? (
                  <div className="px-4 py-8 text-center text-foreground/50 text-[12px] flex flex-col items-center gap-1.5">
                    <Search className="w-5 h-5 text-foreground/30 mb-0.5" />
                    <span className="font-bold uppercase text-[11px] tracking-wider text-foreground/70">
                      No matching events found
                    </span>
                    <span className="text-foreground/40 text-[11px]">
                      No events matching &ldquo;{eventSearch}&rdquo; were found
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Upcoming Matches */}
                    {autocompleteResults.upcomingMatches.length > 0 && (
                      <div>
                        <div className="px-3.5 py-2 bg-foreground/[0.03] text-[10px] font-bold uppercase tracking-wider text-foreground/50 sticky top-0 backdrop-blur-xs flex items-center justify-between">
                          <span>Upcoming Events</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-foreground/10 text-foreground/70">
                            {autocompleteResults.upcomingMatches.length}
                          </span>
                        </div>
                        <div className="divide-y divide-foreground/5">
                          {autocompleteResults.upcomingMatches.map((event) => (
                            <div
                              key={String(event.id || event.eventId)}
                              onClick={() => {
                                setShowAutocomplete(false);
                                onEventClick(event);
                              }}
                              className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-foreground/5 cursor-pointer transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className={cn(
                                  'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px] shrink-0',
                                  getBadgeStyleClass(event)
                                )}>
                                  {getPrimaryBadge(event)}
                                </span>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-[13px] font-bold text-foreground truncate uppercase group-hover:text-primary transition-colors">
                                    {event.title}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-foreground/50 truncate font-medium">
                                    {event.date && (
                                      <span>{formatEventDateShort(event.date)}</span>
                                    )}
                                    {event.time && <span>· {event.time}</span>}
                                    {event.location && (
                                      <>
                                        <span>·</span>
                                        <span className="truncate">{event.location}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ArrowUpRight className="w-4 h-4 text-foreground/30 group-hover:text-foreground shrink-0 transition-colors" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Past Matches */}
                    {autocompleteResults.pastMatches.length > 0 && (
                      <div>
                        <div className="px-3.5 py-2 bg-foreground/[0.03] text-[10px] font-bold uppercase tracking-wider text-foreground/50 sticky top-0 backdrop-blur-xs flex items-center justify-between">
                          <span>Past Events</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-foreground/10 text-foreground/70">
                            {autocompleteResults.pastMatches.length}
                          </span>
                        </div>
                        <div className="divide-y divide-foreground/5">
                          {autocompleteResults.pastMatches.map((event) => (
                            <div
                              key={String(event.id || event.eventId)}
                              onClick={() => {
                                setShowAutocomplete(false);
                                onEventClick(event);
                              }}
                              className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-foreground/5 cursor-pointer transition-colors group opacity-80 hover:opacity-100"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className={cn(
                                  'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px] shrink-0',
                                  getBadgeStyleClass(event)
                                )}>
                                  {getPrimaryBadge(event)}
                                </span>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-[13px] font-bold text-foreground truncate uppercase group-hover:text-primary transition-colors">
                                    {event.title}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-foreground/50 truncate font-medium">
                                    {event.date && (
                                      <span>{formatEventDateShort(event.date)}</span>
                                    )}
                                    {event.location && (
                                      <>
                                        <span>·</span>
                                        <span className="truncate">{event.location}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ArrowUpRight className="w-4 h-4 text-foreground/30 group-hover:text-foreground shrink-0 transition-colors" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ BAND FILTER PILLS ═══ (client-side, instant) */}
        {!isAdmin && (
          <div className="flex gap-[6px] items-center flex-wrap pb-0.5">
            <button
              key="all"
              onClick={() => onBandPillClick('all')}
              className={cn(
                'inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase shrink-0 transition-all leading-tight',
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
                    'inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase shrink-0 transition-all leading-tight',
                    isActive
                      ? 'bg-foreground text-background'
                      : 'bg-foreground/10 text-foreground/50'
                  )}
                >
                  {band.name}
                </button>
              );
            })}
            <button
              key="personal"
              onClick={() => onBandPillClick('personal')}
              className={cn(
                'inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase shrink-0 transition-all leading-tight',
                selectedBandPill === 'personal'
                  ? 'bg-foreground text-background'
                  : 'bg-foreground/10 text-foreground/50'
              )}
            >
              Personal
            </button>
          </div>
        )}

        {/* ═══ FILTER PILLS ═══ */}
        <div className="flex gap-[8px] items-center overflow-x-auto scrollbar-hide py-0.5">
            {visibleFilters.map((f) => {
              const isActive = eventFilter === f || (f === 'ALL' && eventFilter === 'All') || (f === 'REHEARSALS' && eventFilter === 'REHEARSAL') || (f === 'QUOTES' && eventFilter === 'QUOTE') || (f === 'DRAFTS' && eventFilter === 'DRAFT');
              let activeBg = 'bg-white';
              let activeText = 'text-foreground';
              if (f === 'GIGS') { activeBg = 'bg-accent-gig'; activeText = 'text-accent-gig-foreground'; }
              else if (f === 'REHEARSALS') { activeBg = 'bg-accent-rehearsal'; activeText = 'text-accent-rehearsal-foreground'; }
              else if (f === 'QUOTES') { activeBg = 'bg-accent-quote'; activeText = 'text-accent-quote-foreground'; }
              else if (f === 'DRAFTS') { activeBg = 'bg-black/50'; activeText = 'text-white'; }
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
          </div>
        </div>

          {/* ═══ ACTIVE REHEARSAL POLLS & PROPOSALS ═══ */}
          {activePolls.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase">
                Rehearsal Availability Polls ({activePolls.length})
              </span>
              <div className="flex flex-col gap-3">
                {activePolls.map((poll) => (
                  <RehearsalPollCard
                    key={poll.id}
                    poll={poll}
                    currentUserId={currentUserId || ''}
                    isAdmin={!!isAdmin}
                    onConvertProposal={onConvertProposal}
                    onPollUpdated={onPollUpdated}
                    onShowToast={onShowToast}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ═══ CALENDAR (GOOGLE CALENDAR LATERAL SCROLLING STYLE) ═══ */}
          <div className="flex flex-col gap-[16px]">
            {/* Calendar Header: Month Navigation, Title & Today Shortcut */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[12px]">
                <div className="flex gap-[6px] items-center">
                  <button
                    type="button"
                    onClick={prevMonth}
                    aria-label="Previous month"
                    className="border border-border/70 hover:border-foreground/30 bg-card active:scale-95 rounded-full p-[6px] flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-[18px] h-[18px] text-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    aria-label="Next month"
                    className="border border-border/70 hover:border-foreground/30 bg-card active:scale-95 rounded-full p-[6px] flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  >
                    <ChevronRight className="w-[18px] h-[18px] text-foreground" />
                  </button>
                </div>
                <span className="text-[16px] font-bold text-foreground uppercase tracking-tight leading-tight">
                  {monthName} {calendarYear}
                </span>
              </div>

              {/* Today jump button */}
              <button
                type="button"
                onClick={jumpToToday}
                className={cn(
                  "inline-flex items-center gap-[6px] px-[12px] py-[6px] rounded-full text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95",
                  isCurrentMonth
                    ? "bg-foreground/5 text-foreground/45 border border-foreground/10"
                    : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 shadow-2xs"
                )}
              >
                <Calendar className="w-[13px] h-[13px]" />
                <span>Today</span>
              </button>
            </div>

            {/* Day Labels & Lateral Swipable Grid */}
            <div className="flex flex-col gap-[10px]">
              {/* Day Labels (M T W T F S S) */}
              <div className="bg-black/10 dark:bg-white/5 rounded-[10px] flex">
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <div key={i} className="flex-1 py-[4px] text-center">
                    <span className="text-[10px] font-bold text-muted-foreground leading-tight">{d}</span>
                  </div>
                ))}
              </div>

              {/* Continuous Lateral Scrolling 3-Month Carousel (Physical 1:1 Peeking Track) */}
              <div
                ref={carouselContainerRef}
                className="overflow-hidden relative w-full touch-pan-y select-none"
                style={{
                  height: currMonthInfo.numRows * 30,
                  transition: 'height 0.2s ease',
                }}
              >
                <motion.div
                  style={{ x }}
                  drag="x"
                  dragConstraints={{
                    left: -(monthOffset + 1) * (carouselWidth || 360),
                    right: -(monthOffset - 1) * (carouselWidth || 360),
                  }}
                  dragElastic={0.25}
                  onDragEnd={handleDragEnd}
                  className="w-full h-full relative cursor-grab active:cursor-grabbing"
                >
                  {[prevMonthInfo, currMonthInfo, nextMonthInfo].map((info) => (
                    <div
                      key={info.offset}
                      style={{
                        position: 'absolute',
                        left: `${info.offset * (carouselWidth || 360)}px`,
                        width: carouselWidth > 0 ? carouselWidth : '100%',
                        top: 0,
                      }}
                      className={cn("px-[2px]", info.offset !== monthOffset && "pointer-events-none")}
                    >
                      {renderMonthGrid(info, info.offset === monthOffset)}
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Floating Context Pill: Two-Tier Layout (Date/Status + 3 Action Chips) */}
              <AnimatePresence>
                {selectedEmptyDate && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2.5 p-3 rounded-[16px] bg-card border border-foreground/15 shadow-sm">
                      {/* Top Tier: Date, Status & Dismiss */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-foreground/5 flex items-center justify-center shrink-0 text-foreground/70">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[12px] font-bold text-foreground truncate">
                              {formatSelectedDate(selectedEmptyDate)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium hidden xs:inline">
                              • No events scheduled
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedEmptyDate(null)}
                          className="p-1 rounded-full text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                          aria-label="Dismiss date selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bottom Tier: 3 Action Chips (+ Gig, + Rehearsal, + Quote) */}
                      {isAdmin && onCreateEvent && (
                        <div className="grid grid-cols-3 gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              onCreateEvent('gig', selectedEmptyDate);
                              setSelectedEmptyDate(null);
                            }}
                            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-[10px] bg-accent-gig text-accent-gig-foreground text-[11px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3 shrink-0" />
                            <span>Gig</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onCreateEvent('rehearsal', selectedEmptyDate);
                              setSelectedEmptyDate(null);
                            }}
                            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-[10px] bg-accent-rehearsal text-accent-rehearsal-foreground text-[11px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3 shrink-0" />
                            <span>Rehearsal</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onCreateEvent('quote', selectedEmptyDate);
                              setSelectedEmptyDate(null);
                            }}
                            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-[10px] bg-accent-quote text-accent-quote-foreground text-[11px] font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3 shrink-0" />
                            <span>Quote</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
            {loading && allEvents.length === 0 ? (
              <EventsSkeleton />
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => renderEventCard(event, false))
            ) : (
              <div className="rounded-[16px] border border-dashed border-foreground/15 bg-card/40 p-[28px] text-center flex flex-col items-center justify-center gap-[8px]">
                <p className="text-[13px] font-bold uppercase tracking-wider text-foreground/70">
                  NO UPCOMING {eyebrowLabel === 'SCHEDULE' ? 'EVENTS' : eyebrowLabel}
                </p>
                <p className="text-[12px] text-foreground/50 max-w-[280px]">
                  {eventFilter !== 'All' && eventFilter !== 'ALL'
                    ? `No upcoming ${eventFilter.toLowerCase()} scheduled.`
                    : pastEvents.length > 0
                    ? `All ${pastEvents.length} scheduled event${pastEvents.length > 1 ? 's are' : ' is'} in the past. Check the past events section below.`
                    : 'No events have been scheduled yet.'}
                </p>
                <div className="flex items-center gap-[8px] mt-[4px]">
                  {eventFilter !== 'All' && eventFilter !== 'ALL' && (
                    <button
                      onClick={() => setEventFilter('ALL')}
                      className="inline-flex items-center gap-[6px] px-[14px] py-[8px] rounded-[10px] bg-foreground/10 hover:bg-foreground/15 text-foreground text-[12px] font-bold uppercase tracking-wider transition-colors"
                    >
                      {APP_COPY.events.emptyState.showAllEvents}
                    </button>
                  )}
                  {isAdmin && onCreateEvent && (
                    <button
                      onClick={onCreateEvent}
                      className="inline-flex items-center gap-[6px] px-[14px] py-[8px] rounded-[10px] bg-primary text-primary-foreground text-[12px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-[14px] h-[14px]" />
                      {APP_COPY.events.emptyState.createEvent}
                    </button>
                  )}
                </div>
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
                          {APP_COPY.events.archive.eyebrow}
                        </span>
                        <span className="px-[6px] py-[1px] rounded-full text-[10px] font-bold bg-foreground/10 text-foreground/75">
                          {pastEvents.length}
                        </span>
                      </div>
                      <span className="text-[15px] font-bold text-foreground uppercase tracking-tight">
                        {APP_COPY.events.archive.viewFullArchive}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-[4px] text-foreground/50 group-hover:text-foreground transition-colors">
                    <span className="text-[11px] font-bold uppercase tracking-wider hidden sm:inline">{APP_COPY.events.archive.explore}</span>
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
                    {APP_COPY.events.archive.quickPeek} ({pastEvents.length})
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

      {/* Bottom clearance spacer ensuring last card cleanly clears floating navbar */}
      <div
        className="shrink-0 pointer-events-none"
        style={{ height: 'var(--content-bottom-clearance, 136px)' }}
        aria-hidden="true"
      />
    </motion.div>
  );
};