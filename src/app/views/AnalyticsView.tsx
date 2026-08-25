import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useBand } from '@/lib/BandContext';
import { useAuth } from '@/lib/AuthContext';
import { useDashboardData } from '@/app/hooks/useData';

interface AnalyticsViewProps {
  onClose: () => void;
}

const MONTHLY_DATA = [
  { month: 'JAN', pct: 45 },
  { month: 'FEB', pct: 32 },
  { month: 'MAR', pct: 67 },
  { month: 'APR', pct: 55 },
  { month: 'MAY', pct: 78 },
  { month: 'JUN', pct: 42 },
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onClose }) => {
  const { selectedBand, isAdmin } = useBand();
  const { user } = useAuth();
  const { data: dashboardData, loading } = useDashboardData(selectedBand?.id || null, isAdmin ? null : (user?.id || null));

  const fmt = (v: number) => (v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`);

  // Admins see band totals; members (defense-in-depth) only see personal earnings.
  const totalRevenue = isAdmin
    ? (dashboardData?.eventStats?.totalRevenue || 0)
    : (dashboardData?.memberStats?.totalEarned || 0);
  const totalEvents = isAdmin
    ? (dashboardData?.eventStats?.totalEvents || 0)
    : (dashboardData?.memberStats?.confirmedCount || 0);
  const confirmed = isAdmin
    ? (dashboardData?.eventStats?.confirmedEvents || 0)
    : (dashboardData?.memberStats?.confirmedCount || 0);
  const upcoming = isAdmin ? (dashboardData?.eventStats?.upcomingEvents || 0) : 0;
  const change = dashboardData?.memberStats?.revenueChange || 0;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-background overflow-y-auto overflow-x-hidden"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      {/* Header */}
      <div
        className="px-4 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
      >
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full flex items-center justify-center border border-border bg-muted shrink-0 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex flex-col leading-tight">
            <span className="text-3xl font-bold text-foreground leading-tight">DATA</span>
            <span className="text-3xl font-bold text-foreground leading-tight">INSIGHTS</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {/* Stats Grid (2×2) */}
            <div className="flex flex-col gap-10">
              <div className="flex gap-5">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="flex-1 flex flex-col gap-2 items-start text-left"
                >
                  <span className="text-xs font-bold text-foreground tracking-wide">TOTAL REVENUE</span>
                  <div className="h-16 overflow-hidden">
                    <span className="text-5xl font-bold leading-tight text-foreground block">
                      {fmt(totalRevenue)}
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex-1 flex flex-col gap-2 items-start text-left"
                >
                  <span className="text-xs font-bold text-foreground tracking-wide">TOTAL EVENTS</span>
                  <div className="h-16 overflow-hidden">
                    <span className="text-5xl font-bold leading-tight text-foreground block">
                      {totalEvents}
                    </span>
                  </div>
                </motion.div>
              </div>

              <div className="flex gap-5">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex-1 flex flex-col gap-2 items-start text-left"
                >
                  <span className="text-xs font-bold text-foreground tracking-wide">CONFIRMED</span>
                  <div className="h-16 overflow-hidden">
                    <span className="text-5xl font-bold leading-tight text-foreground block">
                      {confirmed}
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex-1 flex flex-col gap-2 items-start text-left"
                >
                  <span className="text-xs font-bold text-foreground tracking-wide">UPCOMING</span>
                  <div className="h-16 overflow-hidden">
                    <span className="text-5xl font-bold leading-tight text-foreground block">
                      {upcoming}
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="flex gap-2.5">
              <div className="flex flex-col flex-1">
                <span className="text-xs font-bold text-foreground tracking-wide">REVENUE CHANGE</span>
                <span className="text-4xl font-bold leading-tight text-foreground">
                  {change !== 0
                    ? `${change > 0 ? '+' : ''}${change.toFixed(0)}%`
                    : '--'}
                </span>
                <span className="text-xs font-bold text-foreground tracking-wide">VS PREVIOUS PERIOD</span>
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-xs font-bold text-foreground tracking-wide">ALL TIME</span>
                <span className="text-4xl font-bold leading-tight text-foreground">
                  {fmt(totalRevenue)}
                </span>
                <span className="text-xs font-bold text-foreground tracking-wide">TOTAL EARNINGS</span>
              </div>
            </div>

            {/* Monthly Breakdown */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-3xl font-bold leading-tight text-foreground">MONTHLY</span>
                <span className="text-3xl font-bold leading-tight text-foreground">BREAKDOWN</span>
              </div>

              <div className="flex flex-col gap-0">
                {MONTHLY_DATA.map(({ month, pct }, i) => (
                  <motion.div
                    key={month}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="flex items-center gap-4 py-4 border-b border-border last:border-0"
                  >
                    <span className="text-xs font-bold text-foreground w-10 tracking-wide">
                      {month}
                    </span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-accent rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <span className="text-xs font-medium text-foreground/40 uppercase text-center">
                Detailed analytics coming soon
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
