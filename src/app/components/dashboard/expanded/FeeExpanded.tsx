import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  Music,
  CheckCircle,
  Clock,
  Euro,
  BarChart3,
  Loader2
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';

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
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
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
    return events
      .filter(e => e.status === 'confirmed' && e.fee > 0)
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        title: e.title,
        date: e.date,
        amount: e.fee,
        type: e.type
      }));
  }, [events]);

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--accent-gig)"
      onClose={onClose}
      origin={{ top: '52%', left: '3%', right: '42%', bottom: '28%' }}
    >
      {/* Sticky Header */}
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-accent-gig/95 backdrop-blur-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center text-accent-foreground hover:bg-muted/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-accent-foreground/60 uppercase block">My Earnings</span>
          <span className="text-sm font-black text-accent-foreground">{bandName}</span>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5",
          earningsData.trend >= 0 ? "bg-muted/20 text-accent-foreground" : "bg-destructive/20 text-destructive"
        )}>
          {earningsData.trend >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {earningsData.trend >= 0 ? '+' : ''}{earningsData.trend}%
        </div>
      </motion.div>
      
      <div className="px-3 pb-32 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-accent-foreground" />
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-accent-gig/10 flex items-center justify-center">
                    <Euro className="w-4 h-4 text-accent-gig" />
                  </div>
                </div>
                <span className="text-2xl font-black text-foreground block">€{earningsData.totalEarned}</span>
                <span className="text-xs font-bold uppercase text-muted-foreground">Total Earned</span>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-accent-quote/10 flex items-center justify-center">
                    <Music className="w-4 h-4 text-accent-quote" />
                  </div>
                </div>
                <span className="text-2xl font-black text-foreground block">{earningsData.totalGigs}</span>
                <span className="text-xs font-bold uppercase text-muted-foreground">Total Gigs</span>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-amber/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-amber" />
                  </div>
                </div>
                <span className="text-2xl font-black text-foreground block">€{earningsData.avgPerGig}</span>
                <span className="text-xs font-bold uppercase text-muted-foreground">Avg / Gig</span>
              </motion.div>
            </div>

            {/* Earnings Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-card rounded-3xl p-5 shadow-sm"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase tracking-tight text-foreground">Earnings Overview</h3>
                <div className="flex gap-1 p-1 bg-muted rounded-full">
                  {(['month', 'quarter', 'year'] as const).map(period => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase transition-all",
                        selectedPeriod === period 
                          ? "bg-accent-gig text-accent-foreground" 
                          : "text-muted-foreground hover:text-muted-foreground"
                      )}
                    >
                      {period === 'month' ? '6M' : period === 'quarter' ? '1Y' : 'All'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Bar Chart */}
              <div className="flex items-end justify-between gap-2 h-32">
                {earningsData.monthlyEarnings.map((data, index) => {
                  const height = (data.amount / earningsData.maxAmount) * 100;
                  return (
                    <motion.div 
                      key={data.month}
                      className="flex-1 flex flex-col items-center gap-2"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
                      style={{ transformOrigin: 'bottom' }}
                    >
                      <motion.div 
                        className="w-full bg-gradient-to-t from-accent-gig to-accent-gig rounded-xl relative group cursor-pointer"
                        style={{ height: `${height}%`, minHeight: '8px' }}
                        whileHover={{ scale: 1.05 }}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-inverse text-accent-foreground px-2 py-1 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          €{data.amount}
                        </div>
                      </motion.div>
                      <span className="text-xs font-bold text-muted-foreground">{data.month}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Upcoming Payments */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card rounded-3xl p-5 shadow-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black uppercase tracking-tight text-foreground">Upcoming Payments</h3>
                <div className="px-2.5 py-1 bg-accent-gig/10 rounded-full">
                  <span className="text-xs font-bold text-accent-gig">{upcomingPayments.length} pending</span>
                </div>
              </div>
              
              {upcomingPayments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingPayments.map((payment, index) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + index * 0.05 }}
                      className="flex items-center justify-between p-3 bg-muted rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          payment.type === 'gig' ? "bg-accent-quote/10" : "bg-accent-gig/10"
                        )}>
                          {payment.type === 'gig' ? (
                            <Music className="w-4 h-4 text-accent-quote" />
                          ) : (
                            <Calendar className="w-4 h-4 text-accent-gig" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-foreground block">{payment.title}</span>
                          <span className="text-xs text-muted-foreground">{payment.date}</span>
                        </div>
                      </div>
                      <span className="font-black text-lg text-foreground">€{payment.amount}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">No upcoming payments</span>
                  <span className="text-xs text-muted-foreground mt-1">Payments will appear here when gigs are confirmed</span>
                </div>
              )}
            </motion.div>

            {/* Default Fee Info */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-accent-gig to-accent-gig rounded-3xl p-5 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-accent-foreground/70 text-xs font-bold uppercase tracking-widest block mb-1">Your Default Fee</span>
                  <span className="text-3xl font-black text-accent-foreground">€{memberFee || '--'}</span>
                  <span className="text-accent-foreground/60 text-xs block mt-1">per event</span>
                </div>
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-accent-foreground" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </ExpandedCardWrapper>
  );
};
