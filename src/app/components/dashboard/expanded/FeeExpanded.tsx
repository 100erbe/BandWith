import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Loader2, TrendingDown, TrendingUp } from '@/app/components/icons';
import { Card, ListRow, Tag } from '@/app/components/bw/Screen';
import { Selector } from '@/app/components/bw/Form';
import { DotText, EventMark, Metric } from '@/app/components/bw';
import { ExpandedCardWrapper, ExpandedTopBar } from './ExpandedCardWrapper';
import { parseLocalDate } from '@/lib/dates';

interface FeeExpandedProps {
  onClose: () => void;
  bandName?: string;
  memberFee?: number;
  loading?: boolean;
  events?: Array<{
    id: string;
    title: string;
    date: string;
    fee: number;
    status: 'confirmed' | 'pending' | 'completed';
    type: 'gig' | 'rehearsal';
  }>;
}

const shortEuro = (v: number) => (v >= 1000 ? `€${(v / 1000).toFixed(1).replace('.0', '')}k` : `€${v}`);

/** "2026-11-12" → "Thu, Nov 12"; anything unparseable is shown as is. */
const formatDay = (d: string) => {
  if (!d) return 'Date TBD';
  const parsed = parseLocalDate(d);
  return isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/** One dot column per month, height = share of the best month (Figma set-flow dots). */
const DotColumn: React.FC<{ share: number; rows?: number }> = ({ share, rows = 8 }) => {
  const lit = share > 0 ? Math.max(1, Math.round(share * rows)) : 0;
  return (
    <span className="flex flex-col gap-1 items-center" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => {
        const fromBottom = rows - 1 - r;
        const on = fromBottom < lit;
        const peak = on && fromBottom === lit - 1;
        return (
          <span
            key={r}
            className="w-2.5 h-2.5 rounded-full block"
            style={{ backgroundColor: peak ? 'var(--accent-ink)' : on ? 'var(--dot-on)' : 'var(--dot-off)' }}
          />
        );
      })}
    </span>
  );
};

export const FeeExpanded: React.FC<FeeExpandedProps> = ({
  onClose,
  bandName = 'Band',
  memberFee = 0,
  loading = false,
  events = []
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Calculate earnings data
  const earningsData = useMemo(() => {
    // Mock monthly data - will be replaced with real data
    const monthlyEarnings = [
      { month: 'Jan', amount: 450, gigs: 3 },
      { month: 'Feb', amount: 380, gigs: 2 },
      { month: 'Mar', amount: 520, gigs: 4 },
      { month: 'Apr', amount: 290, gigs: 2 },
      { month: 'May', amount: 610, gigs: 5 },
      { month: 'Jun', amount: 440, gigs: 3 },
    ];

    const totalEarned = monthlyEarnings.reduce((sum, m) => sum + m.amount, 0);
    const totalGigs = monthlyEarnings.reduce((sum, m) => sum + m.gigs, 0);
    const avgPerGig = totalGigs > 0 ? Math.round(totalEarned / totalGigs) : 0;
    const maxAmount = Math.max(...monthlyEarnings.map(m => m.amount));

    // Calculate trend
    const lastMonth = monthlyEarnings[monthlyEarnings.length - 1].amount;
    const prevMonth = monthlyEarnings[monthlyEarnings.length - 2].amount;
    const trend = prevMonth > 0 ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : 0;

    return {
      monthlyEarnings,
      totalEarned,
      totalGigs,
      avgPerGig,
      maxAmount,
      trend
    };
  }, []);

  // Upcoming payments
  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return events
      .filter(e => e.status === 'confirmed' && e.fee > 0 && (!e.date || e.date >= todayStr))
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        title: e.title,
        date: e.date,
        amount: e.fee,
        type: e.type
      }));
  }, [events]);

  const trendUp = earningsData.trend >= 0;

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--bg)"
      onClose={onClose}
      origin={{ top: '52%', left: '3%', right: '42%', bottom: '28%' }}
    >
      <ExpandedTopBar
        title="My earnings"
        onBack={onClose}
        meta={
          <Tag variant={trendUp ? 'accent' : 'outline'} icon={trendUp ? <TrendingUp /> : <TrendingDown />} className={trendUp ? undefined : 'text-destructive border-destructive'}>
            {trendUp ? '+' : ''}{earningsData.trend}%
          </Tag>
        }
      />

      <div
        className="flex-1 flex flex-col gap-8 px-4 pt-2 max-w-[700px] w-full mx-auto bg-background text-foreground"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}
      >
        <p className="bw-label-sm text-muted-foreground -mb-4">{bandName}</p>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
              <Metric label="Total earned" value={shortEuro(earningsData.totalEarned)} fill={earningsData.totalEarned / (48 * 100)} />
              <Metric label="Gigs played" value={earningsData.totalGigs} fill={earningsData.totalGigs / 48} />
            </div>

            {/* Earnings overview (dot columns) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="bw-label-md">Earnings overview</h2>
                  <div className="flex gap-1">
                    {(['month', 'quarter', 'year'] as const).map(period => (
                      <Selector key={period} selected={selectedPeriod === period} onClick={() => setSelectedPeriod(period)}>
                        {period === 'month' ? '6M' : period === 'quarter' ? '1Y' : 'All'}
                      </Selector>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  {earningsData.monthlyEarnings.map((data) => (
                    <span key={data.month} className="flex flex-col items-center gap-2 min-w-0" title={`${data.month}: €${data.amount}`}>
                      <span className="bw-label-xs text-muted-foreground">€{data.amount}</span>
                      <DotColumn share={data.amount / earningsData.maxAmount} />
                      <span className="bw-label-xs">{data.month}</span>
                    </span>
                  ))}
                </div>
                <div className="h-px bg-border" />
                <span className="flex items-baseline justify-between gap-3">
                  <span className="bw-body-md text-muted-foreground">Average per gig</span>
                  <span className="bw-label-md">€{earningsData.avgPerGig}</span>
                </span>
              </Card>
            </motion.div>

            {/* Upcoming payments */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="bw-label-md">Upcoming payments</h2>
                <Tag variant="subtle">{upcomingPayments.length} pending</Tag>
              </div>
              {upcomingPayments.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {upcomingPayments.map((payment, index) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + index * 0.05 }}
                    >
                      <ListRow
                        icon={<EventMark kind={payment.type === 'rehearsal' ? 'rehearsal' : 'gig'} size={20} />}
                        title={payment.title}
                        subtitle={formatDay(payment.date)}
                        trailing={<span className="bw-label-md shrink-0">€{payment.amount.toLocaleString()}</span>}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="items-center text-center py-8 gap-1">
                  <h3 className="bw-h3">No upcoming payments</h3>
                  <p className="bw-body-sm text-muted-foreground">Payments appear here when gigs are confirmed.</p>
                </Card>
              )}
            </section>

            {/* Default fee (Figma Fee card, dark) */}
            <section className="dark bg-sheet text-sheet-foreground rounded-[24px] p-5 flex flex-col gap-2">
              <span className="bw-label-sm">Your default fee</span>
              <DotText text={memberFee ? `€${memberFee}` : '--'} size={32} label={memberFee ? `€${memberFee}` : 'Not set'} />
              <span className="bw-body-sm text-sheet-foreground/70">per event</span>
            </section>
          </>
        )}
      </div>
    </ExpandedCardWrapper>
  );
};
