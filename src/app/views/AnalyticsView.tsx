import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Loader2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import { useDashboardData } from '@/app/hooks/useData';
import { DotText } from '@/app/components/bw';
import { ScreenHeader, Card } from '@/app/components/bw/Screen';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { toLocalDateString } from '@/lib/dates';
import { useT, dateName, intlLocale, localDecimal } from '@/lib/i18n';

interface AnalyticsViewProps {
  onClose: () => void;
  /**
   * The dashboard stats Home already shows. When passed, Analytics reads the
   * same numbers instead of re-querying, so the two screens can't disagree.
   */
  dashboardData?: ReturnType<typeof useDashboardData>['data'];
  isAdmin?: boolean;
  /**
   * iPhone Duo book layout (Figma "Analytics → Calendar"): tapping a month bar
   * opens that month in the calendar on the other page. When passed, the bars
   * are buttons; the value is "YYYY-MM".
   */
  onSelectMonth?: (yyyyMm: string) => void;
}

/** Months shown in the breakdown, oldest first, current month last. */
const MONTH_SPAN = 6;
const LED_ROWS = 10;

/** Figma "LED Column": 10 dots of 10pt, 4pt apart, filled from the bottom. */
const LedColumn: React.FC<{ lit: number; current: boolean; index?: number }> = ({ lit, current, index = 0 }) => (
  <span className="flex flex-col gap-1" aria-hidden>
    {Array.from({ length: LED_ROWS }).map((_, i) => {
      const fromBottom = LED_ROWS - 1 - i;
      const on = fromBottom < lit;
      return (
        <span
          key={`${i}-${on ? 'on' : 'off'}`}
          className={cn('w-2.5 h-2.5 rounded-full', on && 'bw-dot-rise')}
          style={{
            backgroundColor: on ? (current ? 'var(--accent-ink)' : 'var(--dot-on)') : 'var(--dot-off)',
            ['--d' as string]: `${200 + index * 50 + fromBottom * 30}ms`,
          }}
        />
      );
    })}
  </span>
);

const StatCard: React.FC<{ label: string; value: string | number; accent?: boolean; delay: number }> = ({ label, value, accent, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={cn(
      'flex-1 min-w-0 flex flex-col gap-1 px-4 py-3 rounded-[24px]',
      accent ? 'bg-accent text-accent-foreground' : 'bg-card text-card-foreground',
    )}
  >
    <span className="bw-label-sm truncate">{label}</span>
    <DotText text={value} size={24} label={`${label}: ${value}`} />
  </motion.div>
);

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onClose, dashboardData: sharedData, isAdmin = true, onSelectMonth }) => {
  useCurrency(); // re-render money labels when the band currency changes
  const t = useT();
  const { selectedBand } = useBand();
  // Skip the query when Home's numbers were handed in.
  const { data: fetchedData, loading: fetching } = useDashboardData(sharedData ? null : selectedBand?.id || null);
  const dashboardData = sharedData ?? fetchedData;
  const loading = !sharedData && fetching;

  const fmt = (v: number) => (v >= 1000 ? `${sym()}${localDecimal((v / 1000).toFixed(1))}k` : `${sym()}${v}`);

  const totalRevenue = dashboardData?.eventStats?.totalRevenue || 0;
  const totalEvents = dashboardData?.eventStats?.totalEvents || 0;
  const confirmed = dashboardData?.eventStats?.confirmedEvents || 0;
  const upcoming = dashboardData?.eventStats?.upcomingEvents || 0;
  // Same source as Home: band-wide change for admins, the member's own otherwise.
  const change = (isAdmin ? dashboardData?.eventStats?.revenueChange : dashboardData?.memberStats?.revenueChange) || 0;
  const changeLabel = change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(0)}%` : '--';

  const now = new Date();

  // Real confirmed-gig fees per month for the last MONTH_SPAN months.
  const [monthlyFees, setMonthlyFees] = useState<number[] | null>(null);
  const bandId = selectedBand?.id;
  useEffect(() => {
    if (!bandId) return;
    let cancelled = false;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - (MONTH_SPAN - 1), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    supabase
      .from('events')
      .select('fee, event_date, status, event_type')
      .eq('band_id', bandId)
      .gte('event_date', toLocalDateString(start))
      .lte('event_date', toLocalDateString(end))
      .then(({ data, error }) => {
        if (cancelled) return;
        const sums = Array<number>(MONTH_SPAN).fill(0);
        if (!error) {
          for (const e of (data || []) as { fee: number | null; event_date: string; status: string; event_type: string }[]) {
            if (e.event_type === 'rehearsal' || !(e.status === 'confirmed' || e.status === 'completed')) continue;
            const [y, m] = e.event_date.split('-').map(Number);
            const idx = (y - start.getFullYear()) * 12 + (m - 1 - start.getMonth());
            if (idx >= 0 && idx < MONTH_SPAN) sums[idx] += Number(e.fee) || 0;
          }
        }
        setMonthlyFees(sums);
      });
    return () => {
      cancelled = true;
    };
  }, [bandId]);

  const fees = monthlyFees ?? Array<number>(MONTH_SPAN).fill(0);
  const maxFee = Math.max(0, ...fees);
  const monthly = fees.map((fee, i) => {
    const offset = MONTH_SPAN - 1 - i;
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const lit = fee > 0 && maxFee > 0 ? Math.max(1, Math.round((fee / maxFee) * LED_ROWS)) : 0;
    return {
      month: dateName(d, { month: 'short' }).toUpperCase(),
      yyyyMm: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      longLabel: d.toLocaleDateString(intlLocale('en-US'), { month: 'long', year: 'numeric' }),
      fee,
      lit,
      current: offset === 0,
    };
  });

  const overline = [selectedBand?.name, now.getFullYear()].filter(Boolean).join(' · ');

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground overflow-y-auto overflow-x-hidden"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      <ScreenHeader sticky onBack={onClose} overline={overline} title={(() => {
        // Two lines: the first word, then the rest ("Data / insights").
        const [first, ...rest] = t('Data insights').split(' ');
        return rest.length ? <>{first}<br />{rest.join(' ')}</> : first;
      })()} />

      <div className="px-4 pt-4 flex flex-col gap-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <StatCard label={t('Total revenue')} value={fmt(totalRevenue)} accent delay={0.05} />
              <StatCard label={t('Total events')} value={totalEvents} delay={0.1} />
            </div>
            <div className="flex gap-2">
              <StatCard label={t('Confirmed')} value={confirmed} delay={0.15} />
              <StatCard label={t('Upcoming')} value={upcoming} delay={0.2} />
            </div>

            {/* Revenue change (Figma: inverse card, 32pt dot value, lime chart icon) */}
            <div className="flex items-center gap-3 px-5 py-4 rounded-[24px] bg-surface-inverse text-surface-inverse-foreground">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="bw-label-sm">{t('Revenue vs previous period')}</span>
                <DotText text={changeLabel} size={32} label={t('Revenue change: {value}', { value: changeLabel })} />
              </div>
              <BarChart3 className="w-7 h-7 shrink-0 text-accent" aria-hidden />
            </div>

            {/* Monthly breakdown */}
            <Card className="p-5 gap-4">
              <h2 className="bw-label-md">{t('Monthly breakdown')}</h2>
              <div
                className="flex items-end justify-between"
                {...(onSelectMonth
                  ? { role: 'group', 'aria-label': t('Monthly revenue, last six months. Choose a month to open it in the calendar.') }
                  : { role: 'img', 'aria-label': t('Monthly revenue, last six months: {months}', { months: monthly.map((x) => `${x.month} ${sym()}${x.fee}`).join(', ') }) })}
              >
                {monthly.map(({ month, yyyyMm, longLabel, fee, lit, current }, i) => {
                  const bar = (
                    <>
                      <span className="flex gap-1">
                        <LedColumn lit={lit} current={current} index={i * 2} />
                        <LedColumn lit={lit} current={current} index={i * 2 + 1} />
                      </span>
                      <span className={cn('bw-label-sm', current ? 'text-foreground' : 'text-muted-foreground')}>{month}</span>
                    </>
                  );
                  const motionProps = {
                    initial: { opacity: 0, y: 6 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: 0.25 + i * 0.04 },
                    title: `${month}: ${sym()}${fee.toLocaleString(intlLocale('en-US'))}`,
                  };
                  return onSelectMonth ? (
                    <motion.button
                      key={yyyyMm}
                      type="button"
                      {...motionProps}
                      onClick={() => onSelectMonth(yyyyMm)}
                      aria-label={t('{label}: {amount}. Open in calendar', { label: longLabel, amount: `${sym()}${fee.toLocaleString(intlLocale('en-US'))}` })}
                      className="flex flex-col items-center gap-2 rounded-[12px] p-1 -m-1 cursor-pointer active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                    >
                      {bar}
                    </motion.button>
                  ) : (
                    <motion.div key={yyyyMm} {...motionProps} className="flex flex-col items-center gap-2">
                      {bar}
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="bw-body-lg text-muted-foreground">{t('Total earnings {year}', { year: now.getFullYear() })}</span>
                <span className="bw-label-md shrink-0">{sym()}{totalRevenue.toLocaleString(intlLocale('en-US'))}</span>
              </div>
            </Card>

          </>
        )}
      </div>
    </motion.div>
  );
};
