import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Wallet,
  Calendar,
  Music,
  Loader2,
} from 'lucide-react';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import type { MemberEarnings } from '@/lib/services/events';

interface FeeExpandedProps {
  onClose: () => void;
  bandName?: string;
  memberFee?: number;
  loading?: boolean;
  earnings?: MemberEarnings | null;
}

export const FeeExpanded: React.FC<FeeExpandedProps> = ({
  onClose,
  bandName = 'Band',
  memberFee = 0,
  loading = false,
  earnings = null,
}) => {
  const past = earnings?.past || { total: 0, gigs: [] };
  const upcoming = earnings?.upcoming || { total: 0, gigs: [] };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
        <div className="w-10" />
      </motion.div>
      
      <div className="px-3 pb-32 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-accent-foreground" />
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-2xl p-4 shadow-sm"
              >
                <span className="text-2xl font-black text-foreground block">€{past.total.toLocaleString()}</span>
                <span className="text-xs font-bold uppercase text-muted-foreground">Total Earned</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card rounded-2xl p-4 shadow-sm"
              >
                <span className="text-2xl font-black text-foreground block">€{upcoming.total.toLocaleString()}</span>
                <span className="text-xs font-bold uppercase text-muted-foreground">Upcoming Revenue</span>
              </motion.div>
            </div>

            {/* Past Earnings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-3xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-tight text-foreground">Past Earnings</h3>
                <span className="text-xs font-bold text-accent-gig">{past.gigs.length} gigs</span>
              </div>
              {past.gigs.length > 0 ? (
                <div className="space-y-3">
                  {past.gigs.map((gig, i) => (
                    <div key={gig.eventId} className="flex items-center justify-between p-3 bg-muted rounded-2xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent-quote/10 shrink-0">
                          <Music className="w-4 h-4 text-accent-quote" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-foreground block truncate">{gig.title}</span>
                          <span className="text-xs text-muted-foreground">{formatShortDate(gig.event_date)}</span>
                        </div>
                      </div>
                      <span className="font-black text-lg text-foreground shrink-0 ml-2">€{gig.fee.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Wallet className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">No past earnings yet</span>
                </div>
              )}
            </motion.div>

            {/* Upcoming Revenue */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-3xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-tight text-foreground">Upcoming Revenue</h3>
                <span className="px-2.5 py-1 bg-accent-gig/10 rounded-full">
                  <span className="text-xs font-bold text-accent-gig">{upcoming.gigs.length} confirmed</span>
                </span>
              </div>
              {upcoming.gigs.length > 0 ? (
                <div className="space-y-3">
                  {upcoming.gigs.map((gig, i) => (
                    <div key={gig.eventId} className="flex items-center justify-between p-3 bg-muted rounded-2xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent-gig/10 shrink-0">
                          <Calendar className="w-4 h-4 text-accent-gig" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-foreground block truncate">{gig.title}</span>
                          <span className="text-xs text-muted-foreground">{formatShortDate(gig.event_date)}</span>
                        </div>
                      </div>
                      <span className="font-black text-lg text-foreground shrink-0 ml-2">€{gig.fee.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Calendar className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-bold text-muted-foreground">No upcoming gigs</span>
                  <span className="text-xs text-muted-foreground mt-1">Confirmed gigs will appear here</span>
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
