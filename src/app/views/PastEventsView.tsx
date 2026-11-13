import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/app/components/ui/utils';
import { EventData } from '@/app/components/dashboard/EventCard';
import { useT, dateName, intlLocale, localDecimal } from '@/lib/i18n';
import { parseLocalDate } from '@/lib/dates';
import { Metric } from '@/app/components/bw';
import { BackButton, Selector } from '@/app/components/bw/Form';
import { Card } from '@/app/components/bw/Screen';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';

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

const shortEuro = (v: number) => (v >= 1000 ? `${sym()}${localDecimal((v / 1000).toFixed(v % 1000 === 0 ? 0 : 1))}k` : `${sym()}${v.toLocaleString(intlLocale('en-US'))}`);

/** Rehearsals, quotes and drafts are not billable; they never carry a payment state. */
const isBillable = (e: EventData) => {
  const s = e.status?.toUpperCase();
  return s === 'CONFIRMED' || s === 'COMPLETED';
};

const PAY_FILTERS = ['All', 'Paid', 'Unpaid'] as const;
type PayFilter = (typeof PAY_FILTERS)[number];

export const PastEventsView: React.FC<PastEventsViewProps> = ({
  onClose,
  allEvents,
  onEventClick,
  isAdmin = true,
  bands = [],
  userFeeMap = {},
}) => {
  const t = useT();
  useCurrency(); // re-render money labels when the band currency changes
  const [payFilter, setPayFilter] = useState<PayFilter>('All');

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  const currentYear = todayStr.slice(0, 4);

  // Past events the viewer may see (members never see unconverted quotes)
  const rawPastEvents = useMemo(() => {
    return allEvents.filter((e) => {
      const norm = normalizeDateStr(e.date);
      if (!norm || norm >= todayStr) return false;
      if (!isAdmin && ((e.status as string) === 'QUOTE' || (e.status as string) === 'QUOTED' || e.eventType === 'quote')) return false;
      return true;
    });
  }, [allEvents, todayStr, isAdmin]);

  const unpaidCount = useMemo(
    () => rawPastEvents.filter((e) => isBillable(e) && e.paymentStatus !== 'paid').length,
    [rawPastEvents],
  );

  // Filtered past events (Figma: All / Paid / Unpaid)
  const filteredEvents = useMemo(() => {
    let result = [...rawPastEvents];
    if (payFilter === 'Paid') result = result.filter((e) => isBillable(e) && e.paymentStatus === 'paid');
    if (payFilter === 'Unpaid') result = result.filter((e) => isBillable(e) && e.paymentStatus !== 'paid');

    // Sort descending (most recent past first)
    result.sort((a, b) => {
      const dateA = normalizeDateStr(a.date) || '';
      const dateB = normalizeDateStr(b.date) || '';
      return dateB.localeCompare(dateA);
    });

    return result;
  }, [rawPastEvents, payFilter]);

  // Metrics: gigs played and earned this calendar year (rehearsals and quotes excluded)
  const metrics = useMemo(() => {
    let gigsCount = 0;
    let totalRevenue = 0;

    rawPastEvents.forEach((e) => {
      if (!isBillable(e)) return;
      if (!normalizeDateStr(e.date)?.startsWith(currentYear)) return;
      gigsCount++;
      if (isAdmin) {
        const val = parseFloat(e.price?.replace(/[^0-9.]/g, '') || '0');
        if (!isNaN(val)) totalRevenue += val;
      } else if (e.eventId && userFeeMap[e.eventId] != null) {
        totalRevenue += userFeeMap[e.eventId];
      }
    });

    const formattedRevenue =
      totalRevenue >= 1000
        ? `${sym()}${localDecimal((totalRevenue / 1000).toFixed(totalRevenue % 1000 === 0 ? 0 : 1))}K`
        : `${sym()}${totalRevenue}`;

    return { gigsCount, totalRevenue, formattedRevenue };
  }, [rawPastEvents, isAdmin, userFeeMap, currentYear]);

  // Group the list by month (Figma: "NOVEMBER 2026" headings).
  const groups = useMemo(() => {
    const out: { key: string; label: string; events: EventData[] }[] = [];
    filteredEvents.forEach((event) => {
      const norm = normalizeDateStr(event.date);
      const key = norm ? norm.slice(0, 7) : 'tbd';
      let label = t('Date TBD');
      if (norm) {
        const d = parseLocalDate(norm);
        if (!isNaN(d.getTime())) label = d.toLocaleDateString(intlLocale('en-US'), { month: 'long', year: 'numeric' });
      }
      const last = out[out.length - 1];
      if (last && last.key === key) last.events.push(event);
      else out.push({ key, label, events: [event] });
    });
    return out;
  }, [filteredEvents, t]);

  const feeFor = (event: EventData) =>
    !isAdmin && event.eventId && userFeeMap[event.eventId] != null ? userFeeMap[event.eventId] : parseFee(event.price);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto overflow-x-hidden"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* Figma "Top Bar": back + H2 title on one 56pt row */}
      <header className="sticky top-0 z-30 bg-background px-4" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="h-14 flex items-center gap-3">
          <BackButton onClick={onClose} />
          <h1 className="bw-h2 flex-1 min-w-0 truncate">{t('Past Events')}</h1>
        </div>
      </header>

      <div
        className="flex-1 flex flex-col gap-4 px-4 pt-2 max-w-[700px] w-full mx-auto"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}
      >
        {/* Metrics (Figma Metric: label, dot value, 4×12 meter) */}
        <div className="grid grid-cols-2 gap-8">
          {/* One dot per gig played */}
          <Metric label={t('Played in {year}', { year: currentYear })} value={metrics.gigsCount} fill={metrics.gigsCount / 48} />
          {/* One dot per 500 earned */}
          <Metric label={t('Earned')} value={metrics.formattedRevenue} fill={metrics.totalRevenue / (48 * 500)} />
        </div>

        {/* Payment filter (Figma Selector MD: All / Paid / Unpaid n) */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto -mx-4 px-4 [scrollbar-width:none]">
          {PAY_FILTERS.map((f) => (
            <Selector
              key={f}
              size="md"
              selected={payFilter === f}
              onClick={() => setPayFilter(f)}
              count={f === 'Unpaid' && unpaidCount > 0 ? unpaidCount : undefined}
            >
              {f === 'All' ? t('All') : f === 'Paid' ? t('Paid') : t('Unpaid')}
            </Selector>
          ))}
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
                // Every row here is in the past, so an unpaid gig is overdue.
                const isPaid = isGig && event.paymentStatus === 'paid';
                const statusLabel = isGig ? (isPaid ? t('Paid') : t('Overdue')) : isRehearsal ? t('Rehearsal') : isQuote ? t('Quote') : t('Draft');
                const norm = normalizeDateStr(event.date);
                const d = norm ? parseLocalDate(norm) : null;
                const valid = d && !isNaN(d.getTime());
                const day = valid ? String(d!.getDate()).padStart(2, '0') : '--';
                const mon = valid ? dateName(d!, { month: 'short' }) : t('TBD');
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
                    {isGig ? (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className={cn('w-2 h-2 rounded-full', isPaid ? 'bg-success' : 'bg-destructive')} aria-hidden />
                        <span className="bw-label-xs">{statusLabel}</span>
                      </span>
                    ) : (
                      <span className="bw-label-xs text-muted-foreground shrink-0">{statusLabel}</span>
                    )}
                  </motion.button>
                );
              })}
            </section>
          ))
        ) : (
          <Card className="items-center text-center py-10">
            <h2 className="bw-h3">{t('No past events found')}</h2>
            <p className="bw-body-sm text-muted-foreground max-w-[280px]">
              {payFilter === 'Paid'
                ? t('No paid gigs yet.')
                : payFilter === 'Unpaid'
                ? t('Every past gig is paid.')
                : t('No completed gigs or rehearsals recorded yet.')}
            </p>
          </Card>
        )}
      </div>
    </motion.div>
  );
};
