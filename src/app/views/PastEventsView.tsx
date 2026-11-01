import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, X, Calendar, DollarSign, Music, Check, ArrowUpRight } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { EventData } from '@/app/components/dashboard/EventCard';

interface PastEventsViewProps {
  onClose: () => void;
  allEvents: EventData[];
  onEventClick: (event: EventData) => void;
  isAdmin?: boolean;
  bands?: Array<{ id: string; name: string }>;
  userFeeMap?: Record<string, number>;
}

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

const CATEGORIES = ['ALL', 'GIGS', 'REHEARSAL', 'QUOTES'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

export const PastEventsView: React.FC<PastEventsViewProps> = ({
  onClose,
  allEvents,
  onEventClick,
  isAdmin = true,
  bands = [],
  userFeeMap = {},
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Filter only past events
  const rawPastEvents = useMemo(() => {
    return allEvents.filter((e) => {
      const norm = normalizeDateStr(e.date);
      return norm && norm < todayStr;
    });
  }, [allEvents, todayStr]);

  // Available years from past events
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rawPastEvents.forEach((e) => {
      const norm = normalizeDateStr(e.date);
      if (norm) {
        years.add(norm.slice(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [rawPastEvents]);

  // Filtered past events
  const filteredEvents = useMemo(() => {
    let result = [...rawPastEvents];

    // Year filter
    if (selectedYear !== 'ALL') {
      result = result.filter((e) => {
        const norm = normalizeDateStr(e.date);
        return norm && norm.startsWith(selectedYear);
      });
    }

    // Category filter
    if (selectedCategory !== 'ALL') {
      result = result.filter((e) => {
        const s = e.status?.toUpperCase();
        if (selectedCategory === 'GIGS') return s === 'CONFIRMED' || s === 'COMPLETED';
        if (selectedCategory === 'REHEARSAL') return s === 'REHEARSAL';
        if (selectedCategory === 'QUOTES') return s === 'QUOTE' || s === 'QUOTED';
        return true;
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => {
        return (
          e.title?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.venueAddress?.toLowerCase().includes(q) ||
          e.clientName?.toLowerCase().includes(q) ||
          e.band_name?.toLowerCase().includes(q)
        );
      });
    }

    // Sort descending (most recent past first)
    result.sort((a, b) => {
      const dateA = normalizeDateStr(a.date) || '';
      const dateB = normalizeDateStr(b.date) || '';
      return dateB.localeCompare(dateA);
    });

    return result;
  }, [rawPastEvents, selectedYear, selectedCategory, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    let gigsCount = 0;
    let rehearsalsCount = 0;
    let totalRevenue = 0;

    rawPastEvents.forEach((e) => {
      const s = e.status?.toUpperCase();
      if (s === 'REHEARSAL') {
        rehearsalsCount++;
      } else {
        gigsCount++;
        if (isAdmin) {
          const val = parseFloat(e.price?.replace(/[^0-9.]/g, '') || '0');
          if (!isNaN(val)) totalRevenue += val;
        } else if (e.eventId && userFeeMap[e.eventId] != null) {
          totalRevenue += userFeeMap[e.eventId];
        }
      }
    });

    const formattedRevenue =
      totalRevenue >= 1000
        ? `€${(totalRevenue / 1000).toFixed(totalRevenue % 1000 === 0 ? 0 : 1)}K`
        : `€${totalRevenue}`;

    return { gigsCount, rehearsalsCount, formattedRevenue };
  }, [rawPastEvents, isAdmin, userFeeMap]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{
        maskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)',
      }}
    >
      {/* ═══ STICKY HEADER ═══ */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-foreground/10 px-[16px] py-[14px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[14px]">
            <button
              onClick={onClose}
              className="w-[44px] h-[44px] rounded-full flex items-center justify-center border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 transition-colors"
            >
              <ArrowLeft className="w-[20px] h-[20px] text-foreground" />
            </button>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50 leading-none">
                HISTORY & ARCHIVE
              </span>
              <div className="flex items-center gap-[8px] mt-[3px]">
                <h1 className="text-[24px] font-bold uppercase text-foreground leading-none">
                  PAST EVENTS
                </h1>
                <span className="px-[8px] py-[2px] rounded-full text-[11px] font-bold bg-foreground/10 text-foreground/75 leading-none">
                  {filteredEvents.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-[28px] p-[16px] pb-[160px] max-w-[700px] w-full mx-auto">
        {/* ═══ METRICS SUMMARY BANNER ═══ */}
        <div className="grid grid-cols-3 gap-[10px]">
          <div className="p-[14px] rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-[4px] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
              GIGS PLAYED
            </span>
            <span className="text-[22px] font-black text-foreground leading-none">
              {metrics.gigsCount}
            </span>
          </div>
          <div className="p-[14px] rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-[4px] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
              REHEARSALS
            </span>
            <span className="text-[22px] font-black text-foreground leading-none">
              {metrics.rehearsalsCount}
            </span>
          </div>
          <div className="p-[14px] rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-[4px] shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
              {isAdmin ? 'TOTAL EARNINGS' : 'YOUR EARNINGS'}
            </span>
            <span className="text-[22px] font-black text-foreground leading-none truncate">
              {metrics.formattedRevenue}
            </span>
          </div>
        </div>

        {/* ═══ SEARCH & FILTERS ═══ */}
        <div className="flex flex-col gap-[12px]">
          {/* Search bar */}
          <div className="flex items-center gap-[10px] bg-foreground/5 border border-foreground/10 rounded-[12px] px-[14px] py-[10px]">
            <Search className="w-[16px] h-[16px] text-foreground/40 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past events by title or venue..."
              className="bg-transparent text-[13px] font-medium text-foreground placeholder:text-foreground/35 focus:outline-none flex-1"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1 text-foreground/40 hover:text-foreground">
                <X className="w-[14px] h-[14px]" />
              </button>
            )}
          </div>

          {/* Category & Year Filter Pills */}
          <div className="flex items-center justify-between gap-[10px] flex-wrap">
            {/* Category pills */}
            <div className="flex items-center gap-[6px] overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-[12px] py-[6px] rounded-full text-[11px] font-bold uppercase tracking-wider transition-all leading-tight shrink-0',
                      isActive
                        ? 'bg-foreground text-background shadow-xs'
                        : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/60'
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Year selector pills */}
            {availableYears.length > 1 && (
              <div className="flex items-center gap-[4px] shrink-0">
                <button
                  onClick={() => setSelectedYear('ALL')}
                  className={cn(
                    'px-[8px] py-[4px] rounded-[8px] text-[10px] font-bold uppercase transition-all',
                    selectedYear === 'ALL'
                      ? 'bg-foreground/15 text-foreground font-black'
                      : 'text-foreground/40 hover:text-foreground/70'
                  )}
                >
                  ALL
                </button>
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={cn(
                      'px-[8px] py-[4px] rounded-[8px] text-[10px] font-bold uppercase transition-all',
                      selectedYear === yr
                        ? 'bg-foreground/15 text-foreground font-black'
                        : 'text-foreground/40 hover:text-foreground/70'
                    )}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ PAST EVENT CARDS LIST ═══ */}
        <div className="flex flex-col gap-[14px]">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => {
              const status = event.status?.toUpperCase();
              const isRehearsal = status === 'REHEARSAL';
              const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
              const isQuote = status === 'QUOTED' || status === 'QUOTE';
              const typeLabel = isRehearsal ? 'REHEARSAL' : isGig ? 'GIG' : isQuote ? 'QUOTE' : 'DRAFT';
              const memberCount = event.members?.length || 0;

              const showTime = event.time ? formatEventTime(event.time) : '';

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onEventClick(event)}
                  className="relative flex flex-col rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/25 overflow-hidden cursor-pointer shadow-2xs hover:shadow-sm transition-all active:scale-[0.99] group opacity-90 hover:opacity-100"
                >
                  {/* Left Slate Accent Rail */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[5px]"
                    style={{ backgroundColor: 'var(--accent-past)' }}
                  />

                  <div className="flex flex-col gap-[12px] p-[16px] pl-[20px]">
                    {/* Header: Tags & Date */}
                    <div className="flex items-start justify-between gap-[10px]">
                      <div className="flex items-center gap-[6px] flex-wrap">
                        {/* Multi-band member name pill */}
                        {!isAdmin && bands.length > 1 && event.band_name && (
                          <div className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[10px] font-bold uppercase tracking-wider leading-tight bg-foreground/10 text-foreground/80">
                            {event.band_name}
                          </div>
                        )}
                        {/* Primary Tag in Slate */}
                        <div
                          className="inline-flex items-center justify-center rounded-[6px] px-[8px] py-[3px] text-[10px] font-bold uppercase tracking-wider leading-tight"
                          style={{ backgroundColor: 'var(--accent-past)', color: 'var(--accent-past-fg)' }}
                        >
                          PAST {typeLabel}
                        </div>
                        {/* Completed status chip */}
                        <div className="inline-flex items-center gap-1 rounded-[6px] px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-wider leading-tight bg-foreground/5 text-foreground/60 border border-foreground/10">
                          <Check className="w-3 h-3 text-foreground/50" />
                          COMPLETED
                        </div>
                      </div>

                      {/* Date Badge */}
                      <div
                        className="rounded-[8px] px-[10px] py-[4px] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap shadow-xs"
                        style={{ backgroundColor: 'var(--accent-past)', color: 'var(--accent-past-fg)' }}
                      >
                        {event.date ? formatEventDate(event.date) : 'TBD'}
                      </div>
                    </div>

                    {/* Body: Title & Location */}
                    <div className="flex flex-col gap-[2px]">
                      <h3 className="text-[18px] font-bold text-foreground uppercase tracking-tight leading-snug line-clamp-1">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-[6px] text-[12px] text-foreground/60 font-medium truncate">
                        <span className="font-semibold text-foreground/80">
                          {event.location?.split(',')[0] || event.clientName || 'TBD'}
                        </span>
                        {event.venueAddress && (
                          <>
                            <span className="text-foreground/30">•</span>
                            <span className="truncate text-foreground/50">{event.venueAddress}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Footer: Metadata */}
                    <div className="border-t border-foreground/10 pt-[10px] flex items-center justify-between gap-[10px] text-[12px]">
                      <div className="flex items-center gap-[12px] text-foreground/60">
                        {showTime && (
                          <div className="flex items-center gap-[4px]">
                            <span className="text-[10px] font-bold uppercase text-foreground/40">TIME</span>
                            <span className="font-bold text-foreground/80">{showTime}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-[4px]">
                          <span className="text-[10px] font-bold uppercase text-foreground/40">TEAM</span>
                          <span className="font-bold text-foreground/80">{memberCount}</span>
                        </div>
                      </div>

                      {isGig && (
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-[9px] font-bold uppercase text-foreground/40 leading-none mb-[2px]">
                            {isAdmin ? 'TOTAL FEE' : 'YOUR FEE'}
                          </span>
                          <span className="text-[15px] font-bold text-foreground leading-none">
                            {isAdmin
                              ? event.price || '$0'
                              : event.eventId && userFeeMap[event.eventId] != null
                              ? `€${userFeeMap[event.eventId]}`
                              : event.price || '$0'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-[16px] border border-dashed border-foreground/15 bg-card/40 p-[32px] text-center flex flex-col items-center justify-center gap-[8px]">
              <p className="text-[13px] font-bold uppercase tracking-wider text-foreground/70">
                NO PAST EVENTS FOUND
              </p>
              <p className="text-[12px] text-foreground/50 max-w-[280px]">
                {searchQuery || selectedCategory !== 'ALL' || selectedYear !== 'ALL'
                  ? 'No completed gigs or rehearsals matched your active search or filters.'
                  : 'No completed gigs or rehearsals recorded yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Bottom clearance spacer */}
        <div className="h-12 shrink-0 pointer-events-none" aria-hidden="true" />
      </div>
    </motion.div>
  );
};
