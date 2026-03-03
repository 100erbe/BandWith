import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useBand } from '@/lib/BandContext';
import { useDashboardData } from '@/app/hooks/useData';

interface AnalyticsViewProps {
  onClose: () => void;
}

const AnalyticsDotGrid: React.FC<{ filled: number; color: string }> = ({ filled, color }) => {
  const total = 24;
  const count = Math.min(filled, total);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    if (count === 0) return;
    let c = 0;
    const iv = setInterval(() => {
      c++;
      setVisible(c);
      if (c >= count) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, [count]);

  return (
    <div className="grid grid-cols-6 grid-rows-4 gap-1 w-full h-[72px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{
            backgroundColor: i < count && i < visible ? color : '#CDCACA',
            transition: 'background-color 0.15s',
          }}
        />
      ))}
    </div>
  );
};

const MONTHLY_DATA = [
  { month: 'JAN', pct: 45 },
  { month: 'FEB', pct: 32 },
  { month: 'MAR', pct: 67 },
  { month: 'APR', pct: 55 },
  { month: 'MAY', pct: 78 },
  { month: 'JUN', pct: 42 },
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onClose }) => {
  const { selectedBand } = useBand();
  const { data: dashboardData, loading } = useDashboardData(selectedBand?.id || null);

  const fmt = (v: number) => (v >= 1000 ? `€${(v / 1000).toFixed(1)}k` : `€${v}`);

  const totalRevenue = dashboardData?.eventStats?.totalRevenue || 0;
  const totalEvents = dashboardData?.eventStats?.totalEvents || 0;
  const confirmed = dashboardData?.eventStats?.confirmedEvents || 0;
  const upcoming = dashboardData?.eventStats?.upcomingEvents || 0;
  const change = dashboardData?.eventStats?.revenueChangePercentage || 0;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto overflow-x-hidden"
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
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
            style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
          >
            <ArrowLeft className="w-[24px] h-[24px] text-black" />
          </button>
          <div className="flex flex-col leading-none">
            <span className="text-[32px] font-bold text-black leading-none">DATA</span>
            <span className="text-[32px] font-bold text-black leading-none">INSIGHTS</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/30" />
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
                  <span className="text-xs font-bold text-black tracking-wide">TOTAL REVENUE</span>
                  <div className="h-[62px] overflow-hidden">
                    <span className="text-[52px] font-bold leading-none text-black block">
                      {fmt(totalRevenue)}
                    </span>
                  </div>
                  <AnalyticsDotGrid
                    filled={Math.min(Math.ceil(totalRevenue / 500), 24)}
                    color="#D5FB46"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex-1 flex flex-col gap-2 items-start text-left"
                >
                  <span className="text-xs font-bold text-black tracking-wide">TOTAL EVENTS</span>
                  <div className="h-[62px] overflow-hidden">
                    <span className="text-[52px] font-bold leading-none text-black block">
                      {totalEvents}
                    </span>
                  </div>
                  <AnalyticsDotGrid filled={totalEvents} color="#0147FF" />
                </motion.div>
              </div>

              <div className="flex gap-5">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex-1 flex flex-col gap-2 items-start text-left"
                >
                  <span className="text-xs font-bold text-black tracking-wide">CONFIRMED</span>
                  <div className="h-[62px] overflow-hidden">
                    <span className="text-[52px] font-bold leading-none text-black block">
                      {confirmed}
                    </span>
                  </div>
                  <AnalyticsDotGrid filled={confirmed} color="#9A8878" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex-1 flex flex-col gap-2 items-start text-left"
                >
                  <span className="text-xs font-bold text-black tracking-wide">UPCOMING</span>
                  <div className="h-[62px] overflow-hidden">
                    <span className="text-[52px] font-bold leading-none text-black block">
                      {upcoming}
                    </span>
                  </div>
                  <AnalyticsDotGrid filled={upcoming} color="#050505" />
                </motion.div>
              </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="flex gap-2.5">
              <div className="flex flex-col flex-1">
                <span className="text-xs font-bold text-black tracking-wide">REVENUE CHANGE</span>
                <span className="text-[42px] font-bold leading-tight text-black">
                  {change !== 0
                    ? `${change > 0 ? '+' : ''}${change.toFixed(0)}%`
                    : '--'}
                </span>
                <span className="text-xs font-bold text-black tracking-wide">VS PREVIOUS PERIOD</span>
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-xs font-bold text-black tracking-wide">ALL TIME</span>
                <span className="text-[42px] font-bold leading-tight text-black">
                  {fmt(totalRevenue)}
                </span>
                <span className="text-xs font-bold text-black tracking-wide">TOTAL EARNINGS</span>
              </div>
            </div>

            {/* Monthly Breakdown */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col">
                <span className="text-[32px] font-bold leading-none text-black">MONTHLY</span>
                <span className="text-[32px] font-bold leading-none text-black">BREAKDOWN</span>
              </div>

              <div className="flex flex-col gap-0">
                {MONTHLY_DATA.map(({ month, pct }, i) => (
                  <motion.div
                    key={month}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="flex items-center gap-4 py-4 border-b border-black/10 last:border-0"
                  >
                    <span className="text-xs font-bold text-black w-10 tracking-wide">
                      {month}
                    </span>
                    <div className="flex-1 h-3 bg-[#CDCACA] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#D5FB46] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <span className="text-[10px] font-medium text-black/40 uppercase text-center">
                Detailed analytics coming soon
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
