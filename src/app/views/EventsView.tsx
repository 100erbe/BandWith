import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { 
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Plus,
  Search,
  X,
  ChevronRight,
  History,
  RefreshCw,
} from '@/app/components/icons';
import { createPortal } from 'react-dom';
import { IconButton, NavBackButton, Tag, SearchField, Card } from '@/app/components/bw/Screen';
import { useRailOwnsChrome, useRailSearch } from '@/lib/railActions';
import { PillButton, Selector } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { EventData } from '@/app/components/dashboard/EventCard';
import { t, useT, dateName, intlLocale, localDecimal, weekdayInitials, getLocale } from '@/lib/i18n';
import { RehearsalPollCard } from '@/app/components/rehearsal/RehearsalPollCard';
import type { RehearsalPoll } from '@/lib/services/rehearsalPolls';
import { EventsSkeleton } from '@/app/components/ui/EventsSkeleton';
import { parseLocalDate } from '@/lib/dates';
import { DotMeter, DotText, EventMark, SectionHeader, type EventKind } from '@/app/components/bw';
import { FIT, FitText } from '@/app/components/bw/FitText';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { PlannerMode, type PlannerEvent } from '@/app/components/duo';
import { keyboardSafeTap } from '@/lib/keyboardSafeTap';

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
  /** Members: open the "Propose rehearsal" flow (empty-schedule hero). */
  onProposeRehearsal?: () => void;
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
  /**
   * "YYYY-MM": show this month (month grid and Laptop pose planner), e.g. from
   * Analytics' month bars on the iPhone Duo book layout. Applied when it changes.
   */
  focusMonth?: string | null;
}

const FILTERS = ['ALL', 'GIGS', 'REHEARSALS', 'QUOTES', 'DRAFTS'] as const;



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
    tags.push((event.quoteStatus || 'draft').toUpperCase());
  } else if (status === 'DRAFT' || status === 'PENDING') {
    tags.push('DRAFT');
  }
  return tags;
};

/** Shown text for a tag from getEventTags (the tags themselves stay as ids). */
const tagLabel = (tag: string): string => {
  switch (tag) {
    case 'INDOOR': return t('INDOOR');
    case 'OUTDOOR': return t('OUTDOOR');
    case 'HYBRID': return t('HYBRID');
    case 'ONCE': return t('ONCE');
    case 'WEEKLY': return t('WEEKLY');
    case 'BI-WEEKLY': return t('BI-WEEKLY');
    case 'MONTHLY': return t('MONTHLY');
    case 'BI-MONTHLY': return t('BI-MONTHLY');
    case 'DRAFT': return t('DRAFT');
    case 'SENT': return t('SENT');
    case 'VIEWED': return t('VIEWED');
    case 'NEGOTIATING': return t('NEGOTIATING');
    case 'ARCHIVED': return t('ARCHIVED');
    case 'ACCEPTED': return t('ACCEPTED');
    case 'DECLINED': return t('DECLINED');
    case 'EXPIRED': return t('EXPIRED');
    default: return tag;
  }
};



const calendarKind = (event: EventData, isPast = false): EventKind => {
  if (isPast) return 'past';
  const status = event.status?.toUpperCase();
  if (status === 'REHEARSAL' || event.eventType === 'rehearsal') return 'rehearsal';
  if (status === 'QUOTED' || status === 'QUOTE' || status === 'DRAFT' || status === 'PENDING') return 'quote';
  if (!event.band_id) return 'personal';
  return 'gig';
};

const normalizeDateStr = (rawDate: string | undefined): string | null => {
  if (!rawDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
  if (rawDate.includes('T')) return rawDate.split('T')[0];
  const parsed = parseLocalDate(rawDate);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return rawDate;
};

const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return t('TBD');
  const d = parseLocalDate(dateStr);
  // Other languages put the day first ("20 MAR"); English stays "MAR 20".
  if (getLocale() !== 'en') return d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' }).toUpperCase();
  const month = dateName(d, { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${month} ${day}`;
};

const getPrimaryBadge = (event: EventData): string => {
  const s = event.status?.toUpperCase();
  if (s === 'REHEARSAL' || event.eventType === 'rehearsal') return 'REHEARSAL';
  if (s === 'QUOTED' || s === 'QUOTE' || event.eventType === 'quote') return 'QUOTE';
  if (s === 'DRAFT' || s === 'PENDING') return 'DRAFT';
  return 'GIG';
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
  if (!price) return `${sym()}0`;
  const num = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return price;
  if (num >= 1000) return `${sym()}${localDecimal((num / 1000).toFixed(num % 1000 === 0 ? 0 : 1))}K`;
  return `${sym()}${num}`;
};

const getEventWarnings = (event: EventData): string[] => {
  const warnings: string[] = [];
  const type = event.eventType?.toLowerCase() || event.status?.toLowerCase();
  if (!event.location || event.location === 'TBD') warnings.push(t('Missing venue'));
  if (!event.date) warnings.push(t('Missing date'));
  if (type !== 'rehearsal' && (!event.price || event.price === '0')) warnings.push(t('Missing fee'));
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
    if (!hasAddress && !hasLocation) suggestions.push(t('No venue address'));
    if (!hasMembers) suggestions.push(t('No team assigned'));
    if (!event.endTime) suggestions.push(t('No end time'));
    if (!event.clientName) suggestions.push(t('No client info'));
  }

  if (isRehearsal) {
    if (!hasAddress && !hasLocation) suggestions.push(t('No venue address'));
    if (!hasMembers) suggestions.push(t('No team assigned'));
  }

  if (isQuote) {
    if (!event.clientName) suggestions.push(t('No client info'));
    if (!hasMembers) suggestions.push(t('No team assigned'));
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
  onProposeRehearsal,
  isAdmin = true,
  userFeeMap = {},
  bands = [],
  rehearsalPolls = [],
  onConvertProposal,
  onPollUpdated,
  onShowToast,
  currentUserId,
  focusMonth,
}) => {
  const t = useT();
  useCurrency(); // re-render money labels when the band currency changes
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
  // Figma "Calendar / Search": a full-screen search opened from the header's
  // search button (Header dispatches `bw:open-event-search`).
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<'ALL' | 'GIGS' | 'REHEARSALS' | 'QUOTES' | 'PAST'>('ALL');

  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener('bw:open-event-search', open);
    return () => window.removeEventListener('bw:open-event-search', open);
  }, []);

  // iPhone Duo: the header's search button is the rail's Search; it opens the
  // same "Search events" screen, whose field then opens in the rail.
  const railOwnsChrome = useRailOwnsChrome();
  useRailSearch(searchOpen ? null : {
    label: t('Search events'),
    value: '',
    base: true,
    onChange: () => {},
    onActivate: () => setSearchOpen(true),
  });

  // The field is visible and focused as soon as the screen opens, so it's
  // clear you can type right away (the tap that opened it raised the keyboard).
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!searchOpen) return;
    const id = requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [searchOpen]);

  const closeSearch = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setSearchOpen(false);
    setSearchTab('ALL');
    setEventSearch('');
  };

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
  const [dayPickerEvents, setDayPickerEvents] = useState<EventData[] | null>(null);

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
      const locMatch = [e.location, e.venueName, e.venueAddress, e.venueCity]
        .some((v) => (v || '').toLowerCase().includes(query));
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
      upcomingMatches,
      pastMatches,
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

  const maxUpcomingFee = useMemo(
    () => Math.max(0, ...upcomingEvents.map((e) => parseFloat(String(e.price || '').replace(/[^0-9.]/g, '')) || 0)),
    [upcomingEvents]
  );

  const eyebrowLabel = useMemo(() => {
    if (eventFilter === 'All' || eventFilter === 'ALL') return 'SCHEDULE';
    if (eventFilter === 'GIGS') return 'GIGS';
    if (eventFilter === 'REHEARSALS' || eventFilter === 'REHEARSAL') return 'REHEARSALS';
    if (eventFilter === 'QUOTES' || eventFilter === 'QUOTE') return 'QUOTES';
    if (eventFilter === 'DRAFTS' || eventFilter === 'DRAFT') return 'DRAFTS';
    return 'SCHEDULE';
  }, [eventFilter]);

  // Shown text for the filter / search tab ids (the ids stay as they are).
  const filterLabel = (f: string): string => {
    switch (f) {
      case 'ALL': return t('ALL');
      case 'GIGS': return t('GIGS');
      case 'REHEARSALS': return t('REHEARSALS');
      case 'QUOTES': return t('QUOTES');
      case 'DRAFTS': return t('DRAFTS');
      case 'PAST': return t('PAST');
      default: return f;
    }
  };

  // A day with several events opens an inline panel under the grid (like the
  // free-day panel), so the bottom navigation stays put.
  const openDayPicker = (events: EventData[]) => {
    setDayPickerEvents(events);
  };

  const getMonthForOffset = (offset: number) => {
    const base = baseDateRef.current;
    const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const name = d.toLocaleDateString(intlLocale('en-US'), { month: 'long' }).toUpperCase();
    const totalCells = firstDay + days;
    const numRows = Math.ceil(totalCells / 7);
    return { offset, year, month, daysInMonth: days, firstDayOfWeek: firstDay, monthName: name, numRows };
  };

  const currMonthInfo = useMemo(() => getMonthForOffset(monthOffset), [monthOffset]);
  const prevMonthInfo = useMemo(() => getMonthForOffset(monthOffset - 1), [monthOffset]);
  const nextMonthInfo = useMemo(() => getMonthForOffset(monthOffset + 1), [monthOffset]);

  const calendarYear = currMonthInfo.year;
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

  // ── iPhone Duo · Laptop pose: Planner (renders nothing in other postures) ──
  // Same events as the month grid (current filter, recurring rehearsals expanded).
  const { plannerEvents, plannerSource } = useMemo(() => {
    const list: PlannerEvent[] = [];
    const source = new Map<string, EventData>();
    Object.values(eventDatesMap).forEach((dayEvents) => {
      dayEvents.forEach((ev) => {
        const date = normalizeDateStr(ev.date);
        if (!date) return;
        const id = String(ev.id);
        if (source.has(id)) return;
        source.set(id, ev);
        const fee = parseFloat(String(ev.price || '').replace(/[^0-9.]/g, ''));
        list.push({
          id,
          title: ev.title || t('Untitled event'),
          date,
          kind: calendarKind(ev),
          time: ev.time || null,
          venue: ev.venueName || (ev.location && ev.location !== 'TBD' ? ev.location : null),
          fee: Number.isFinite(fee) && fee > 0 ? fee : null,
          draft: !!ev.draftOf,
        });
      });
    });
    return { plannerEvents: list, plannerSource: source };
  }, [eventDatesMap, t]);
  const [plannerDate, setPlannerDate] = useState(todayStr);
  const selectPlannerDate = (date: string) => {
    setPlannerDate(date);
    setSelectedEmptyDate(null);
    // Keep the month grid underneath on the same month.
    const d = parseLocalDate(date);
    if (isNaN(d.getTime())) return;
    const base = baseDateRef.current;
    const offset = (d.getFullYear() - base.getFullYear()) * 12 + (d.getMonth() - base.getMonth());
    if (offset !== monthOffsetRef.current) {
      x.set(-offset * (carouselContainerRef.current?.offsetWidth || carouselWidth || 0));
      setMonthOffset(offset);
    }
  };
  const selectPlannerDateRef = useRef(selectPlannerDate);
  selectPlannerDateRef.current = selectPlannerDate;
  useEffect(() => {
    if (!focusMonth || !/^\d{4}-\d{2}$/.test(focusMonth)) return;
    selectPlannerDateRef.current(`${focusMonth}-01`);
  }, [focusMonth]);


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


  const renderEventCard = (event: EventData, isPast: boolean = false) => {
    const status = event.status?.toUpperCase();
    const isRehearsal = status === 'REHEARSAL';
    const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
    const isQuote = status === 'QUOTED' || status === 'QUOTE';
    const isDraft = !isRehearsal && !isGig && !isQuote;
    // A saved draft (gig / rehearsal) or a quote not shared yet: the type's
    // colour, desaturated and dashed, and "only you".
    const draftOf = event.draftOf;
    const memberCount = event.members?.length || 0;

    let typeLabel = event.band_id ? t('GIG') : t('PERSONAL');

    if (isRehearsal) {
      typeLabel = t('REHEARSAL');
    } else if (isQuote) {
      typeLabel = t('QUOTE');
    } else if (isDraft) {
      typeLabel = t('DRAFT');
    }

    const warnings = getEventWarnings(event);
    const suggestions = getEventSuggestions(event);
    const tags = getEventTags(event);
    const secondaryTags = tags.filter(tag => tag !== 'GIG' && tag !== 'REHEARSAL' && tag !== 'QUOTE' && tag !== 'DRAFT');





    // ── Figma "EventCard": the whole card is the event colour ──
    const kind: EventKind = isPast ? 'past' : isRehearsal ? 'rehearsal' : isQuote ? 'quote' : !event.band_id ? 'personal' : 'gig';
    const cardBg = isDraft && !isPast ? 'var(--muted)' : `var(--accent-${kind})`;
    const cardFg = isDraft && !isPast ? 'var(--fg)' : `var(--accent-${kind}-fg)`;
    const dimFg = `color-mix(in srgb, ${cardFg} 22%, transparent)`;
    const chipBg = `color-mix(in srgb, ${cardFg} 12%, transparent)`;
    const statusChip = isPast ? t('PAST') : draftOf ? (draftOf === 'quote' ? t('DRAFT · NOT SHARED') : t('DRAFT · ONLY YOU')) : (secondaryTags[0] ? tagLabel(secondaryTags[0]) : '') || (isGig ? t('CONFIRMED') : isDraft ? t('DRAFT') : '');
    const issues = [...warnings, ...(isAdmin ? suggestions : [])];
    const venue = event.location?.split(',')[0] || event.clientName || t('TBD');
    const address = event.venueAddress || event.location?.split(',').slice(1).join(',').trim();
    const dateLabel = [event.date ? formatEventDate(event.date) : t('TBD'), event.time ? formatEventTime(event.time) : null].filter(Boolean).join(' · ');

    const hours = (() => {
      const m1 = event.time?.match(/^(\d{1,2}):(\d{2})/);
      const m2 = event.endTime?.match(/^(\d{1,2}):(\d{2})/);
      if (!m1 || !m2) return null;
      let diff = (+m2[1] * 60 + +m2[2]) - (+m1[1] * 60 + +m1[2]);
      if (diff <= 0) diff += 24 * 60;
      return Math.round((diff / 60) * 10) / 10;
    })();
    const feeNum = parseFloat(String(event.price || '').replace(/[^0-9.]/g, '')) || 0;

    const left = { label: isRehearsal ? t('GOING') : isQuote || isGig ? t('LINEUP') : t('TEAM'), value: String(memberCount), fill: memberCount / 16 };
    const right = isRehearsal
      ? { label: t('LENGTH'), value: hours ? `${hours}H` : '--', fill: hours ? hours / 4 : 0 }
      : { label: isQuote ? t('QUOTE') : getFeeLabel(event) === 'YOUR FEE' ? t('YOUR FEE') : t('FEE'), value: feeNum > 0 ? getDisplayFee(event) : '--', fill: maxUpcomingFee > 0 ? feeNum / maxUpcomingFee : 0 };

    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEventClick(event); } }}
        aria-label={draftOf ? t('{title}, draft, only you can see it', { title: event.title }) : undefined}
        className={cn(
          'relative flex flex-col gap-4 rounded-[24px] p-5 cursor-pointer active:scale-[0.99] transition-transform',
          isPast && 'opacity-85'
        )}
        style={{
          backgroundColor: cardBg,
          color: cardFg,
          ...(draftOf
            ? { filter: 'saturate(0.3)', outline: `2px dashed color-mix(in srgb, ${cardFg} 45%, transparent)`, outlineOffset: -6 }
            : null),
        }}
        onClick={() => onEventClick(event)}
      >
        {/* Top: chips + title, open button (Figma "Event Card") */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <EventMark kind={kind} size={20} bare />
              <span className="bw-label-xs h-4 px-1.5 rounded-full inline-flex items-center">{typeLabel}</span>
              {statusChip && (
                <span className="bw-label-xs h-4 px-1.5 rounded-full inline-flex items-center" style={{ backgroundColor: chipBg }}>
                  {statusChip}
                </span>
              )}
              {!isAdmin && bands.length > 1 && event.band_name && (
                <span className="bw-label-xs h-4 px-1.5 rounded-full inline-flex items-center truncate max-w-[140px]" style={{ backgroundColor: chipBg }}>
                  {event.band_name}
                </span>
              )}
              {event._isPendingSync && (
                <span className="bw-label-xs h-4 px-1.5 rounded-full inline-flex items-center gap-1 bg-warning text-warning-foreground">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> {t('Sync')}
                </span>
              )}
              {!isPast && !draftOf && issues.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSuggestionPopoverId(null); setWarningPopoverId(warningPopoverId === event.id ? null : event.id); }}
                    aria-label={t('{count} details missing', { count: issues.length })}
                    className="relative h-4 px-1.5 rounded-full inline-flex items-center gap-1 bw-label-xs cursor-pointer after:absolute after:-inset-3 after:content-['']"
                    style={{ backgroundColor: chipBg }}
                  >
                    <AlertCircle className="w-2.5 h-2.5" />
                    {issues.length}
                  </button>
                  <AnimatePresence>
                    {warningPopoverId === event.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        className="absolute top-full left-0 mt-2 bg-popover text-popover-foreground rounded-[16px] p-3 z-50 min-w-[210px] shadow-lg cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setWarningPopoverId(null); onEventClick(event); }}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-border">
                          <span className="bw-label-xs text-warning">{t('Missing info')}</span>
                          <span className="bw-label-xs text-muted-foreground flex items-center gap-0.5">{t('Edit')} <ArrowUpRight className="w-3 h-3" /></span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {issues.map((w, wi) => (
                            <div key={wi} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                              <span className="bw-body-sm">{w}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
            <FitText as="h3" text={event.title} sizes={FIT.h1} maxLines={2} className="bw-h1" />
          </div>
          <span className="w-8 h-8 rounded-full bg-surface-inverse text-surface-inverse-foreground flex items-center justify-center shrink-0" aria-hidden="true">
            <ArrowUpRight className="w-[18px] h-[18px]" />
          </span>
        </div>

        {/* Venue + date */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="bw-label-md truncate">{venue}</span>
            {address && <span className="bw-label-xs truncate opacity-70">{address}</span>}
          </div>
          <span className="bw-label-xs h-5 px-2 rounded-[4px] inline-flex items-center whitespace-nowrap shrink-0" style={{ backgroundColor: chipBg }}>
            {dateLabel}
          </span>
        </div>

        {/* Metrics (Figma Metric, Layout=Card, Tone=On event) */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-8">
          {[left, right].map((m) => (
            <div key={m.label} className="flex flex-col gap-2 min-w-0">
              <DotMeter value={m.fill} rows={2} cols={10} dot={10} onColor={cardFg} offColor={dimFg} peakColor={cardFg} />
              <span className="bw-label-md">{m.label}</span>
              <DotText text={m.value} size={30} />
            </div>
          ))}
        </div>
      </motion.div>
    );
  };

  // Figma "Calendar Month": pill cells 24px high, 8px row gap.
  const CELL_H = 24;
  const ROW_GAP = 8;
  const gridHeight = (rows: number) => rows * CELL_H + (rows - 1) * ROW_GAP;

  const renderMonthGrid = (
    info: ReturnType<typeof getMonthForOffset>,
    isInteractive: boolean
  ) => {
    const { offset, year, month, daysInMonth, firstDayOfWeek, numRows } = info;
    const prevMonthDays = new Date(year, month, 0).getDate();
    const trailing = numRows * 7 - (firstDayOfWeek + daysInMonth);
    const fadedCell = (label: number, key: string) => (
      <div
        key={key}
        aria-hidden="true"
        className="rounded-full flex items-center justify-center bw-label-md bg-foreground/[0.08] text-muted-foreground"
      >
        {label}
      </div>
    );
    return (
      <div
        className="grid grid-cols-7 gap-x-[5px] w-full"
        style={{
          gridTemplateRows: `repeat(${numRows}, ${CELL_H}px)`,
          rowGap: ROW_GAP,
          height: gridHeight(numRows),
        }}
      >
        {Array.from({ length: firstDayOfWeek }).map((_, i) =>
          fadedCell(prevMonthDays - firstDayOfWeek + 1 + i, `prev-${offset}-${i}`)
        )}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${year}-${month}-${day}`;
          const dateKeyStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const eventsOnDay = eventDatesMap[dateKey] || [];
          const hasEvents = eventsOnDay.length > 0;
          const multipleEvents = eventsOnDay.length > 1;
          const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
          const isSelected = selectedEmptyDate === dateKeyStr
            || (!!dayPickerEvents?.length && normalizeDateStr(dayPickerEvents[0].date) === dateKeyStr);
          const isPastDay = dateKeyStr < todayStr;

          let style: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, var(--fg) 8%, transparent)', color: 'var(--fg)' };
          // Real events lead the day; a day with only drafts is desaturated and dashed.
          const onlyDrafts = hasEvents && eventsOnDay.every((e) => !!e.draftOf);
          if (hasEvents) {
            const primary = eventsOnDay.find((e) => !e.draftOf) || eventsOnDay[0];
            const k = calendarKind(primary, isPastDay);
            style = { backgroundColor: `var(--accent-${k})`, color: `var(--accent-${k}-fg)` };
            if (multipleEvents) {
              const ordered = [primary, ...eventsOnDay.filter((e) => e !== primary)];
              const colors = [...new Set(ordered.map((e) => `var(--accent-${calendarKind(e, isPastDay)})`))];
              if (colors.length > 1) style = { ...style, background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` };
            }
            if (onlyDrafts) {
              style = { ...style, filter: 'saturate(0.3)', outline: '1.5px dashed currentColor', outlineOffset: -3 };
            }
          } else if (isToday) {
            style = { backgroundColor: 'var(--surface-inverse)', color: 'var(--surface-inverse-fg)' };
          }

          return (
            <button
              key={`${year}-${month}-${day}`}
              type="button"
              disabled={!isInteractive}
              aria-label={`${dateKeyStr}${hasEvents ? `, ${eventsOnDay.length > 1 ? t('{count} events', { count: eventsOnDay.length }) : t('{count} event', { count: eventsOnDay.length })}` : ''}${onlyDrafts ? `, ${t('draft')}` : ''}${isToday ? `, ${t('today')}` : ''}`}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => {
                if (!isInteractive) return;
                if (hasEvents) {
                  setSelectedEmptyDate(null);
                  if (multipleEvents) openDayPicker(eventsOnDay);
                  else { setDayPickerEvents(null); onEventClick(eventsOnDay[0]); }
                } else {
                  setDayPickerEvents(null);
                  setSelectedEmptyDate(isSelected ? null : dateKeyStr);
                }
              }}
              className={cn(
                'rounded-full flex items-center justify-center relative select-none cursor-pointer transition-transform bw-label-md',
                isInteractive && 'active:scale-95',
                isSelected && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                isToday && hasEvents && 'ring-2 ring-foreground ring-offset-1 ring-offset-background'
              )}
              style={style}
            >
              {day}
              {multipleEvents && (
                <span className="absolute -top-1.5 -right-1 min-w-[14px] h-[14px] px-0.5 bg-surface-inverse text-surface-inverse-foreground bw-label-xs leading-none rounded-full flex items-center justify-center">
                  {eventsOnDay.length}
                </span>
              )}
            </button>
          );
        })}
        {Array.from({ length: trailing }).map((_, i) => fadedCell(i + 1, `next-${offset}-${i}`))}
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
      className="flex flex-col gap-5 relative z-10 min-h-[50vh]"
    >
      {/* ═══ FILTERS (Figma "Tabs": Selector MD) ═══ */}
      <div className="flex flex-col gap-3 shrink-0">
        {/* ═══ BAND FILTER PILLS ═══ (client-side, instant) */}
        {!isAdmin && (
          <div className="flex gap-2 items-center shrink-0 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <Selector size="sm" selected={selectedBandPill === 'all'} onClick={() => onBandPillClick('all')}>
              {t('All')}
            </Selector>
            {bands.map((band) => (
              <Selector key={band.id} size="sm" selected={selectedBandPill === band.id} onClick={() => onBandPillClick(band.id)}>
                {band.name}
              </Selector>
            ))}
            <Selector size="sm" selected={selectedBandPill === 'personal'} onClick={() => onBandPillClick('personal')}>
              {t('Personal')}
            </Selector>
          </div>
        )}

        <div className="flex gap-2 items-center shrink-0 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {visibleFilters.map((f) => {
            const isActive = eventFilter === f || (f === 'ALL' && eventFilter === 'All') || (f === 'REHEARSALS' && eventFilter === 'REHEARSAL') || (f === 'QUOTES' && eventFilter === 'QUOTE') || (f === 'DRAFTS' && eventFilter === 'DRAFT');
            return (
              <Selector key={f} size="md" selected={isActive} onClick={() => setEventFilter(f)} count={isActive ? allEvents.length : undefined}>
                {filterLabel(f)}
              </Selector>
            );
          })}
        </div>
      </div>

          {/* ═══ ACTIVE REHEARSAL POLLS & PROPOSALS ═══ */}
          {activePolls.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="bw-label-md text-muted-foreground">
                {t('Rehearsal scheduling ({count})', { count: activePolls.length })}
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
          <div className="flex flex-col gap-2">
            {/* Calendar Header: Month Navigation, Title & Today Shortcut */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <IconButton label={t('Previous month')} size="sm" icon={<ArrowLeft />} onClick={prevMonth} />
                <IconButton label={t('Next month')} size="sm" icon={<ArrowRight />} onClick={nextMonth} />
                <span className="bw-h3 truncate">
                  {monthName} {calendarYear}
                </span>
              </div>
              {!isCurrentMonth && (
                <Selector size="sm" selected={false} onClick={jumpToToday}>
                  {t('Today')}
                </Selector>
              )}
            </div>

            {/* Day Labels & Lateral Swipable Grid */}
            <div className="flex flex-col gap-2">
              {/* Day Labels (M T W T F S S) */}
              <div className="rounded-full flex h-5 items-center bg-foreground/[0.08]">
                {weekdayInitials().map((d, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className="bw-label-xs text-muted-foreground">{d}</span>
                  </div>
                ))}
              </div>

              {/* Continuous Lateral Scrolling 3-Month Carousel (Physical 1:1 Peeking Track) */}
              <div
                ref={carouselContainerRef}
                // overflow-clip (not hidden): focus or scrollIntoView on a day can't
                // scroll the track sideways and misalign the weekday columns.
                className="overflow-clip relative w-full touch-pan-y select-none"
                style={{
                  height: gridHeight(currMonthInfo.numRows),
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

              {/* Day with several events: pick one */}
              <AnimatePresence>
                {dayPickerEvents && dayPickerEvents.length > 0 && (
                  <motion.div
                    key="day-picker"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    {(() => {
                      const key = normalizeDateStr(dayPickerEvents[0].date) || '';
                      const [yy, mm, dd] = key.split('-').map(Number);
                      const sel = new Date(yy, (mm || 1) - 1, dd || 1);
                      return (
                        <div className="dark mt-4 rounded-[24px] bg-sheet text-sheet-foreground p-5 flex flex-col gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="bw-label-sm">{sel.toLocaleDateString(intlLocale('en-US'), { weekday: 'long' })}</span>
                              <span className="flex items-end gap-1.5">
                                <DotText text={dd} size={24} />
                                <span className="bw-body-lg leading-none">{sel.toLocaleDateString(intlLocale('en-US'), { month: 'long' })}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Tag variant="subtle">{t('{count} events', { count: dayPickerEvents.length })}</Tag>
                              <IconButton label={t('Close day')} variant="sheet" size="sm" icon={<X />} onClick={() => setDayPickerEvents(null)} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {dayPickerEvents.map((ev) => {
                              const kind = calendarKind(ev, key < todayStr);
                              return (
                                <button
                                  key={String(ev.id)}
                                  type="button"
                                  onClick={() => { setDayPickerEvents(null); onEventClick(ev); }}
                                  className="w-full flex items-center gap-3 rounded-[16px] bg-sheet-foreground/[0.08] p-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
                                >
                                  <EventMark kind={kind} size={24} />
                                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <span className="bw-h3 truncate">{ev.title}</span>
                                    <span className="bw-body-sm text-sheet-foreground/70 truncate">
                                      {ev.time ? formatEventTime(ev.time) : t('Time TBD')}{ev.location ? ` · ${ev.location}` : ''}
                                    </span>
                                  </span>
                                  <ArrowRight className="w-4 h-4 shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>

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
                    {(() => {
                      const [yy, mm, dd] = selectedEmptyDate.split('-').map(Number);
                      const sel = new Date(yy, mm - 1, dd);
                      const tiles: Array<{ type: 'gig' | 'rehearsal' | 'quote'; label: string }> = [
                        { type: 'gig', label: t('Gig') },
                        { type: 'rehearsal', label: t('Rehearsal') },
                        { type: 'quote', label: t('Quote') },
                      ];
                      return (
                        <div className="dark mt-4 rounded-[24px] bg-sheet text-sheet-foreground p-5 flex flex-col gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="bw-label-sm">{sel.toLocaleDateString(intlLocale('en-US'), { weekday: 'long' })}</span>
                              <span className="flex items-end gap-1.5">
                                <DotText text={dd} size={24} />
                                <span className="bw-body-lg leading-none">{sel.toLocaleDateString(intlLocale('en-US'), { month: 'long' })}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Tag variant="subtle">{t('Free day')}</Tag>
                              <IconButton label={t('Dismiss date selection')} variant="sheet" size="sm" icon={<X />} onClick={() => setSelectedEmptyDate(null)} />
                            </div>
                          </div>
                          {isAdmin && onCreateEvent ? (
                            <>
                              <p className="bw-body-md">{t('Nothing scheduled yet. Add something for the band:')}</p>
                              <div className="grid grid-cols-3 gap-2">
                                {tiles.map((tile) => (
                                  <button
                                    key={tile.type}
                                    type="button"
                                    onClick={() => { onCreateEvent(tile.type, selectedEmptyDate); setSelectedEmptyDate(null); }}
                                    className="h-[76px] rounded-[16px] px-3 py-4 flex flex-col justify-between text-left cursor-pointer active:scale-[0.97] transition-transform"
                                    style={{ backgroundColor: `var(--accent-${tile.type})`, color: `var(--accent-${tile.type}-fg)` }}
                                  >
                                    <span className="flex items-center justify-between">
                                      <EventMark kind={tile.type} size={20} bare />
                                      <Plus className="w-4 h-4" />
                                    </span>
                                    <span className="bw-button-sm">{tile.label}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="bw-body-md text-sheet-foreground/80">{t('Nothing scheduled on this day.')}</p>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ═══ LEGEND (Event Marks) ═══ */}
          <div className="flex items-center gap-4 flex-wrap">
            {(isAdmin ? (['gig', 'rehearsal', 'quote', 'personal'] as const) : (['gig', 'rehearsal', 'personal'] as const)).map((k) => (
              <span key={k} className="flex items-center gap-2">
                <EventMark kind={k} size={20} />
                <span className="bw-label-sm text-muted-foreground">{k === 'gig' ? t('gig') : k === 'rehearsal' ? t('rehearsal') : k === 'quote' ? t('quote') : t('personal')}</span>
              </span>
            ))}
            {/* Drafts: their type's colour, desaturated and dashed (admins only). */}
            {isAdmin && filteredAllEvents.some((e) => !!e.draftOf) && (
              <span className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-[6px] bg-[var(--accent-gig)] [filter:saturate(0.3)] outline-[1.5px] outline-dashed outline-offset-[-3px] outline-[var(--accent-gig-fg)]"
                  aria-hidden="true"
                />
                <span className="bw-label-sm text-muted-foreground">{t('draft · only you')}</span>
              </span>
            )}
          </div>

          {/* ═══ SECTION HEADER ═══ */}
          <div className="flex flex-col gap-2">
            {eyebrowLabel !== 'SCHEDULE' && (
              <span className="bw-label-sm text-muted-foreground">{filterLabel(eyebrowLabel)}</span>
            )}
            <SectionHeader title={t('Upcoming')} onSeeAll={onOpenPastEvents} />
          </div>

          {/* ═══ UPCOMING EVENT CARDS ═══ */}
          <div className="flex flex-col gap-4">
            {loading && allEvents.length === 0 ? (
              <EventsSkeleton />
            ) : upcomingEvents.length > 0 ? (
              upcomingEvents.map((event) => renderEventCard(event, false))
            ) : (
              // Figma "Calendar / Empty": "Nothing scheduled" hero with quick-create actions.
              <Card className="items-center text-center py-10 px-6 gap-3">
                <h3 className="bw-h2">{t('Nothing scheduled')}</h3>
                <p className="bw-body-md text-muted-foreground max-w-[280px]">
                  {eventFilter !== 'All' && eventFilter !== 'ALL'
                    ? eyebrowLabel === 'GIGS' ? t('No upcoming gigs.')
                      : eyebrowLabel === 'REHEARSALS' ? t('No upcoming rehearsals.')
                      : eyebrowLabel === 'QUOTES' ? t('No upcoming quotes.')
                      : eyebrowLabel === 'DRAFTS' ? t('No upcoming drafts.')
                      : t('No upcoming schedule.')
                    : isAdmin
                    ? t('Add your next gig or rehearsal.')
                    : onProposeRehearsal
                    ? t('Propose a rehearsal to the band.')
                    : t('New gigs and rehearsals will show up here.')}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                  {eventFilter !== 'All' && eventFilter !== 'ALL' && (
                    <PillButton size="sm" variant="outline" fullWidth={false} onClick={() => setEventFilter('ALL')}>
                      {t('Show All Events')}
                    </PillButton>
                  )}
                  {isAdmin && onCreateEvent && (
                    <>
                      <PillButton size="sm" variant="dark" fullWidth={false} icon={<Plus className="w-3.5 h-3.5" />} onClick={() => onCreateEvent('gig')}>
                        {t('Gig')}
                      </PillButton>
                      <PillButton size="sm" variant="outline" fullWidth={false} icon={<Plus className="w-3.5 h-3.5" />} onClick={() => onCreateEvent('rehearsal')}>
                        {t('Rehearsal')}
                      </PillButton>
                      <PillButton size="sm" variant="outline" fullWidth={false} icon={<Plus className="w-3.5 h-3.5" />} onClick={() => onCreateEvent('quote')}>
                        {t('Quote')}
                      </PillButton>
                    </>
                  )}
                  {!isAdmin && onProposeRehearsal && (
                    <PillButton size="sm" variant="dark" fullWidth={false} icon={<Plus className="w-3.5 h-3.5" />} onClick={onProposeRehearsal}>
                      {t('Propose rehearsal')}
                    </PillButton>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* ═══ PAST EVENTS: count + archive link (Figma) ═══ */}
          {pastEvents.length > 0 && (
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="bw-body-md text-muted-foreground">
                {pastEvents.length === 1 ? t('{count} past event', { count: pastEvents.length }) : t('{count} past events', { count: pastEvents.length })}
              </span>
              {onOpenPastEvents && (
                <button
                  type="button"
                  onClick={onOpenPastEvents}
                  className="h-9 flex items-center gap-2 bw-button-sm text-foreground cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  {/* Figma "Calendar": link to the past-events archive. */}
                  {t('Past events archive')}
                </button>
              )}
            </div>
          )}

      {/* ═══ SEARCH EVENTS (Figma "Calendar / Search") ═══ */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {searchOpen && (() => {
            const q = eventSearch.trim();
            const upcoming = autocompleteResults.upcomingMatches as EventData[];
            const past = autocompleteResults.pastMatches as EventData[];
            const all = [...upcoming, ...past];
            const isPastEv = (e: EventData) => past.includes(e);
            const tabs = (isAdmin
              ? (['ALL', 'GIGS', 'REHEARSALS', 'QUOTES', 'PAST'] as const)
              : (['ALL', 'GIGS', 'REHEARSALS', 'PAST'] as const));
            const inTab = (e: EventData, tab: typeof searchTab) => {
              if (tab === 'ALL') return true;
              if (tab === 'PAST') return isPastEv(e);
              if (isPastEv(e)) return false;
              const badge = getPrimaryBadge(e);
              if (tab === 'GIGS') return badge === 'GIG';
              if (tab === 'REHEARSALS') return badge === 'REHEARSAL';
              return badge === 'QUOTE';
            };
            const results = all.filter((e) => inTab(e, searchTab));
            return (
              <motion.div
                key="event-search"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                aria-label={t('Search events')}
                // iPhone Duo open: search stays on the leading page, the event
                // you pick opens on the trailing page (Figma "Calendar search").
                // Under the tab bar (z-80, like the other hub screens): you can
                // still switch tab or create from here. Back closes the search.
                className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col"
                style={{ paddingTop: 'var(--safe-top)' }}
              >
                {/* Top Bar (on iPhone Duo the Back sits in the rail, tabs stay) */}
                <div className="h-14 shrink-0 px-4 flex items-center gap-3 bw-status-clear">
                  <NavBackButton label={t('Close search')} size="sm" onClick={closeSearch} keepTabs />
                  <h2 className="bw-h2 truncate">{t('Search events')}</h2>
                </div>

                <div
                  className="flex-1 overflow-y-auto px-4 pt-2 flex flex-col gap-4 bw-status-clear"
                  style={{ paddingBottom: railOwnsChrome ? 'calc(var(--safe-bottom) + 48px)' : 'calc(var(--safe-bottom) + 112px)' }}
                >
                  {/* The field stays in the screen on every device: it's the screen's purpose. */}
                  <SearchField
                    inline
                    inputRef={searchInputRef}
                    value={eventSearch}
                    onChange={setEventSearch}
                    label={t('Search events')}
                    placeholder={t('Search title, venue, city, client…')}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') closeSearch();
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                    }}
                  />

                  <div className="flex gap-2 items-center shrink-0 overflow-x-auto scrollbar-hide -mx-4 px-4">
                    {tabs.map((tab) => (
                      <Selector
                        key={tab}
                        size="md"
                        selected={searchTab === tab}
                        onClick={() => setSearchTab(tab)}
                        count={searchTab === tab && q ? all.filter((e) => inTab(e, tab)).length : undefined}
                      >
                        {filterLabel(tab)}
                      </Selector>
                    ))}
                  </div>

                  {q ? (
                    <>
                      <p className="bw-label-sm text-muted-foreground">
                        {results.length === 1 ? t('{count} result for “{query}”', { count: results.length, query: q }) : t('{count} results for “{query}”', { count: results.length, query: q })}
                      </p>
                      <ul className="flex flex-col gap-4">
                        {results.map((ev) => {
                          const evPast = isPastEv(ev);
                          const kind = calendarKind(ev, evPast);
                          const norm = normalizeDateStr(ev.date);
                          const d = norm ? parseLocalDate(norm) : null;
                          const valid = d && !isNaN(d.getTime());
                          const badge = getPrimaryBadge(ev);
                          const typeWord = badge === 'GIG' && !ev.band_id ? t('Personal') : badge === 'GIG' ? t('Gig') : badge === 'REHEARSAL' ? t('Rehearsal') : badge === 'QUOTE' ? t('Quote') : t('Draft');
                          const sub = badge === 'QUOTE' ? ev.quoteStatus : evPast && badge === 'GIG' ? ev.paymentStatus : undefined;
                          const over = [evPast ? t('Past') : typeWord, sub ? String(sub).charAt(0).toUpperCase() + String(sub).slice(1) : null].filter(Boolean).join(' · ');
                          const meta = [ev.location?.split(',')[0] || ev.clientName, ev.time ? formatEventTime(ev.time) : null].filter(Boolean).join(' · ');
                          const feeNum = parseFloat(String(ev.price || '').replace(/[^0-9.]/g, '')) || 0;
                          const value = badge !== 'REHEARSAL' && feeNum > 0 ? getDisplayFee(ev) : null;
                          return (
                            <li key={String(ev.id || ev.eventId)}>
                              <button
                                type="button"
                                // Opens on the first tap even with the keyboard up.
                                {...keyboardSafeTap(() => onEventClick(ev))}
                                className="w-full flex items-center gap-4 p-3 rounded-[24px] bg-card text-left active:scale-[0.99] transition-transform cursor-pointer"
                              >
                                <span
                                  className="w-[52px] h-14 rounded-full flex flex-col items-center justify-center shrink-0"
                                  style={{ backgroundColor: `var(--accent-${kind})`, color: `var(--accent-${kind}-fg)` }}
                                >
                                  <span className="bw-num">{valid ? String(d!.getDate()).padStart(2, '0') : '–'}</span>
                                  <span className="bw-label-xs">{valid ? dateName(d!, { month: 'short' }) : t('TBD')}</span>
                                </span>
                                <span className="flex-1 min-w-0 flex flex-col gap-1">
                                  <span className="bw-label-xs text-muted-foreground truncate">{over}</span>
                                  <span className="bw-h3 line-clamp-2 [overflow-wrap:anywhere]">{ev.title}</span>
                                  {meta && <span className="bw-body-sm text-muted-foreground truncate">{meta}</span>}
                                </span>
                                {value ? (
                                  <span className="bw-label-md shrink-0">{value}</span>
                                ) : (
                                  <ChevronRight className="w-[18px] h-[18px] text-muted-foreground shrink-0" aria-hidden />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {results.length === 0 && (
                        <Card className="items-center text-center py-8 gap-2">
                          <Search className="w-6 h-6 text-muted-foreground" />
                          <p className="bw-h3">{t('No matching events')}</p>
                          <p className="bw-body-sm text-muted-foreground">{t('Try a title, venue or client name.')}</p>
                        </Card>
                      )}
                    </>
                  ) : (
                    <p className="bw-body-sm text-muted-foreground">{t('Search by title, venue, city, client or notes.')}</p>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        document.body,
      )}

      {!searchOpen && (
        <PlannerMode
          events={plannerEvents}
          isAdmin={isAdmin}
          selectedDate={plannerDate}
          onSelectDate={selectPlannerDate}
          onOpenEvent={(id) => {
            const ev = plannerSource.get(id);
            if (ev) onEventClick(ev);
          }}
          onAddGig={isAdmin && onCreateEvent ? (date) => onCreateEvent('gig', date) : undefined}
          onAddRehearsal={isAdmin && onCreateEvent ? (date) => onCreateEvent('rehearsal', date) : undefined}
        />
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