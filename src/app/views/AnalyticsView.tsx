import React from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Music2,
  Loader2,
  BarChart3
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useBand } from '@/lib/BandContext';
import { useDashboardData } from '@/app/hooks/useData';

interface AnalyticsViewProps {
  onClose: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onClose }) => {
  const { selectedBand } = useBand();
  const { data: dashboardData, loading } = useDashboardData(selectedBand?.id || null);

  const stats = [
    {
      label: 'Total Revenue',
      value: dashboardData?.eventStats?.totalRevenue || 0,
      format: 'currency',
      icon: DollarSign,
      change: dashboardData?.eventStats?.revenueChangePercentage || 0,
      color: 'bg-[#1A1A1A]',
      textColor: 'text-white'
    },
    {
      label: 'Total Events',
      value: dashboardData?.eventStats?.totalEvents || 0,
      format: 'number',
      icon: Calendar,
      change: 0,
      color: 'bg-[#D4FB46]',
      textColor: 'text-[#1A1A1A]'
    },
    {
      label: 'Confirmed Gigs',
      value: dashboardData?.eventStats?.confirmedEvents || 0,
      format: 'number',
      icon: Music2,
      change: 0,
      color: 'bg-white',
      textColor: 'text-black'
    },
    {
      label: 'Upcoming Events',
      value: dashboardData?.eventStats?.upcomingEvents || 0,
      format: 'number',
      icon: Calendar,
      change: 0,
      color: 'bg-white',
      textColor: 'text-black'
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-EU', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toString();
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Header */}
      <div className="px-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Insights</p>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase">ANALYTICS</h1>
            <p className="text-sm text-black/50 font-bold tracking-tight mt-1">{selectedBand?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"
          >
            <X className="w-6 h-6 text-black/50" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          </div>
        ) : (
          <>
            {/* Year Filter */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[2024, 2025, 2026].map((year) => (
                <button
                  key={year}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold transition-colors whitespace-nowrap",
                    year === 2026
                      ? "bg-black text-white"
                      : "bg-white/60 text-black/50 hover:bg-white"
                  )}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "rounded-2xl p-4 relative overflow-hidden",
                    stat.color,
                    i === 0 && "col-span-2"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      stat.color === 'bg-[#1A1A1A]' ? "bg-white/10" : "bg-black/5"
                    )}>
                      <stat.icon className={cn("w-5 h-5", stat.textColor)} />
                    </div>
                    {stat.change !== 0 && (
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                        stat.change > 0 
                          ? "bg-green-100 text-green-600" 
                          : "bg-red-100 text-red-600"
                      )}>
                        {stat.change > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {Math.abs(stat.change).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <p className={cn(
                    "text-xs font-bold uppercase tracking-wide mb-1 opacity-60",
                    stat.textColor
                  )}>
                    {stat.label}
                  </p>
                  <p className={cn("text-3xl font-black", stat.textColor)}>
                    {formatValue(stat.value, stat.format)}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Monthly Breakdown */}
            <div className="bg-white rounded-2xl p-6">
              <h3 className="font-bold text-black mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Monthly Breakdown
              </h3>
              <div className="space-y-4">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, i) => {
                  const percentage = Math.random() * 100;
                  return (
                    <div key={month} className="flex items-center gap-4">
                      <span className="text-xs font-medium text-black/50 w-10">{month}</span>
                      <div className="flex-1 h-3 bg-black/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[#D4FB46] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-black/30 mt-4 text-center">
                Detailed analytics coming soon
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
