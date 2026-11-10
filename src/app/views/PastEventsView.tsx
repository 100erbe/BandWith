import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/app/components/ui/utils';
import { EventData } from '@/app/components/dashboard/EventCard';
import { APP_COPY } from '@/app/constants/copy';
import { parseLocalDate } from '@/lib/dates';
import { Metric } from '@/app/components/bw';
import { BackButton, Selector } from '@/app/components/bw/Form';
import { SearchField, Card } from '@/app/components/bw/Screen';

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
  const parsed = parseLocalDate(rawDate);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return rawDate;
};

const parseFee = (price?: string) => {
  const n = parseFloat(price?.replace(/[^0-9.]/g, '') || '0');
  return Number.isFinite(n) ? n : 0;
};

const shortEuro = (v: number) => (v >= 1000 ? `€${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `€${v.toLocaleString('en-US')}`);

const CATEGORIES = ['ALL', 'GIGS', 'REHEARSALS', 'QUOTES'] as const;
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

  const visibleCategories = useMemo(() => {
    return isAdmin ? CATEGORIES : CATEGORIES.filter(c => c !== 'QUOTES');
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && selectedCategory === 'QUOTES') {
      setSelectedCategory('ALL');
    }
  }, [isAdmin, selectedCategory]);

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

    // Regular members must not see unconverted quotes
    if (!isAdmin) {
      result = result.filter(e => (e.status as string) !== 'QUOTE' && (e.status as string) !== 'QUOTED' && e.eventType !== 'quote');
    }

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
        if (selectedCategory === 'REHEARSALS') return s === 'REHEARSAL';
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

    return { gigsCount, rehearsalsCount, totalRevenue, formattedRevenue };
  }, [rawPastEvents, isAdmin, userFeeMap]);

  // Group the list by month (Figma: "NOVEMBER 2026" headings).
  const groups = useMemo(() => {
    const out: { key: string; label: string; events: EventData[] }[] = [];
    filteredEvents.forEach((event) => {
      const norm = normalizeDateStr(event.date);
      const key = norm ? norm.slice(0, 7) : 'tbd';
      let label = 'Date TBD';
      if (norm) {
        const d = parseLocalDate(norm);
        if (!isNaN(d.getTime())) label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      const last = out[out.length - 1];
      if (last && last.key === key) last.events.push(event);
      else out.push({ key, label, events: [event] });
    });
    return out;
  }, [filteredEvents]);

  const feeFor = (event: EventData) =>
    !isAdmin && event.eventId && userFeeMap[event.eventId] != null ? userFeeMap[event.eventId] : parseFee(event.price);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto overflow-x-hidden"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* Figma "Top Bar": back + H2 title on one 56pt row */}
      <header className="sticky top-0 z-30 bg-background px-4" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="h-14 flex items-center gap-3">
          <BackButton onClick={onClose} />
          <h1 className="bw-h2 flex-1 min-w-0 truncate">{APP_COPY.events.archive.title}</h1>
          <span className="bw-label-sm text-muted-foreground shrink-0" aria-label={`${filteredEvents.length} events`}>
            {filteredEvents.length}
          </span>
        </div>
      </header>

      <div
        className="flex-1 flex flex-col gap-4 px-4 pt-2 max-w-[700px] w-full mx-auto"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}
      >
        {/* Metrics (Figma Metric: label, dot value, 4×12 meter) */}
        <div className="grid grid-cols-2 gap-8">
          {/* One dot per gig played */}
          <Metric label={APP_COPY.events.archive.gigsPlayed} value={metrics.gigsCount} fill={metrics.gigsCount / 48} />
          {/* One dot per €500 earned */}
          <Metric
            label={isAdmin ? APP_COPY.events.archive.totalEarnings : APP_COPY.events.archive.yourEarnings}
            value={metrics.formattedRevenue}
            fill={metrics.totalRevenue / (48 * 500)}
          />
        </div>

        <SearchField value={searchQuery} onChange={setSearchQuery} label="Search past events" placeholder="Search title or venue…" />

        {/* Filter tabs (Figma Selector MD) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 [scrollbar-width:none]">
            {visibleCategories.map((cat) => (
              <Selector key={cat} size="md" selected={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>
                {cat}
              </Selector>
            ))}
          </div>
          {availableYears.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 [scrollbar-width:none]">
              {['ALL', ...availableYears].map((yr) => (
                <Selector key={yr} selected={selectedYear === yr} onClick={() => setSelectedYear(yr)}>
                  {yr === 'ALL' ? 'All years' : yr}
                </Selector>
              ))}
            </div>
          )}
        </div>

        {/* Event rows grouped by month */}
        {groups.length > 0 ? (
          groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-4">
              <h2 className="bw-label-md text-foreground">{group.label}</h2>
              {group.events.map((event) => {
                const status = event.status?.toUpperCase();
                const isRehearsal = status === 'REHEARSAL';
                const isGig = status === 'CONFIRMED' || status === 'COMPLETED';
                const isQuote = status === 'QUOTED' || status === 'QUOTE';
                const typeLabel = isRehearsal ? 'Rehearsal' : isGig ? 'Played' : isQuote ? 'Quote' : 'Draft';
                const dotClass = isGig ? 'bg-success' : isQuote ? 'bg-warning' : 'bg-accent-past';
                const norm = normalizeDateStr(event.date);
                const d = norm ? parseLocalDate(norm) : null;
                const valid = d && !isNaN(d.getTime());
                const day = valid ? String(d!.getDate()).padStart(2, '0') : '--';
                const mon = valid ? d!.toLocaleDateString('en-US', { month: 'short' }) : 'TBD';
                const fee = isGig ? feeFor(event) : 0;
                const meta = [
                  !isAdmin && bands.length > 1 ? event.band_name : null,
                  event.location?.split(',')[0] || event.clientName,
                  fee > 0 ? shortEuro(fee) : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <motion.button
                    type="button"
                    key={event.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => onEventClick(event)}
                    className="w-full flex items-center gap-4 p-3 pr-4 rounded-[24px] bg-card text-card-foreground text-left active:scale-[0.99] transition-transform"
                  >
                    <span className="w-[52px] h-14 rounded-full bg-accent-past text-accent-past-foreground flex flex-col items-center justify-center shrink-0">
                      <span className="bw-num">{day}</span>
                      <span className="bw-label-xs">{mon}</span>
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="bw-h3 line-clamp-2 [overflow-wrap:anywhere]">{event.title}</span>
                      {meta && <span className="bw-body-sm text-muted-foreground truncate">{meta}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className={cn('w-2 h-2 rounded-full', dotClass)} aria-hidden />
                      <span className="bw-label-xs">{typeLabel}</span>
                    </span>
                  </motion.button>
                );
              })}
            </section>
          ))
        ) : (
          <Card className="items-center text-center py-10">
            <h2 className="bw-h3">No past events found</h2>
            <p className="bw-body-sm text-muted-foreground max-w-[280px]">
              {searchQuery || selectedCategory !== 'ALL' || selectedYear !== 'ALL'
                ? 'No completed gigs or rehearsals matched your search or filters.'
                : 'No completed gigs or rehearsals recorded yet.'}
            </p>
          </Card>
        )}
      </div>
    </motion.div>
  );
};
