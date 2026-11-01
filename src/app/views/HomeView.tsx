import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowUpRight,
  Loader2,
  MapPin,
  Clock,
  ListMusic,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { dashboardContainerVariants, dashboardItemVariants } from '@/styles/motion';
import { QUICK_ACTIONS } from '@/app/data/metrics';
import { EventItem } from '@/app/data/events';
import { Band } from '@/app/data/bands';
import { ExpandedCardType } from '@/app/types';
import { useBand } from '@/lib/BandContext';

interface DashboardData {
  eventStats: {
    totalEvents: number;
    confirmedEvents: number;
    totalRevenue: number;
    upcomingEvents: number;
    revenueChange?: number;
  } | null;
  quoteStats: {
    totalQuotes: number;
    pendingQuotes: number;
    acceptedQuotes: number;
    totalPipeline: number;
    acceptedRevenue: number;
  } | null;
  memberStats?: {
    totalEarned: number;
    confirmedFee: number;
    pendingFee: number;
    revenueChange: number;
    confirmedCount: number;
  } | null;
  upcomingEvents: any[];
  recentQuotes: any[];
}

interface HomeViewProps {
  selectedBand: Band;
  expandedCard: ExpandedCardType;
  setExpandedCard: (card: ExpandedCardType) => void;
  upcomingRehearsals: EventItem[];
  currentRehearsal: EventItem | null;
  onRehearsalClick: () => void;
  isHidden: boolean;
  dashboardData?: DashboardData;
  dashboardLoading?: boolean;
  onQuickAction?: (action: string) => void;
  onViewChange?: (tab: string) => void;
  onFilterEvents?: (filter: string) => void;
  isAdmin?: boolean;
  isSolo?: boolean;  // PLG: Solo mode hides collaborative features
}

// --- Main Dashboard ---

export const HomeView: React.FC<HomeViewProps> = ({
  selectedBand,
  expandedCard: _expandedCard,
  setExpandedCard,
  upcomingRehearsals,
  currentRehearsal: _currentRehearsal,
  onRehearsalClick: _onRehearsalClick,
  isHidden,
  dashboardData,
  dashboardLoading,
  onQuickAction,
  onViewChange,
  onFilterEvents,
  isAdmin: _isAdminProp = true,
  isSolo = false,
}) => {
  // Use the band context for role, fall back to prop for backwards compatibility
  const { isAdmin: isAdminFromContext } = useBand();
  const isAdmin = isAdminFromContext ?? _isAdminProp;



  // For admins: show all quick actions
  // For members: show only performance-relevant actions
  // PLG: For solo users: show only personal actions
  const filteredQuickActions = QUICK_ACTIONS.filter(action => {
    if (isSolo) {
      // Solo mode: show only personal actions
      const soloActions = ['Setlist & Repertoire'];
      return soloActions.includes(action.label);
    }
    if (!isAdmin) {
      const adminOnlyActions = [
        'Contracts & Riders',
        'Task Templates',
        'Inventory',
      ];
      return !adminOnlyActions.includes(action.label);
    }
    return true;
  });

  const formatRevenue = (value: number): string => {
    if (value >= 1000) {
      return `€${(value / 1000).toFixed(1)}k`;
    }
    return `€${value}`;
  };

  const memberStats = dashboardData?.memberStats;
  const revenue = isAdmin ? (dashboardData?.eventStats?.totalRevenue || 0) : (memberStats?.totalEarned || 0);
  const confirmedCount = isAdmin
    ? (dashboardData?.eventStats?.confirmedEvents || 0)
    : (memberStats?.confirmedCount || 0);
  const quotesCount = dashboardData?.quoteStats?.totalQuotes || 0;
  const quotesPipeline = dashboardData?.quoteStats?.totalPipeline || 0;
  const revenueChange = isAdmin ? dashboardData?.eventStats?.revenueChange : memberStats?.revenueChange;
  const rehearsalCount = upcomingRehearsals.length;

  const revenueChangeText = revenueChange !== undefined && revenueChange !== 0
    ? `${revenueChange > 0 ? '+' : ''}${revenueChange}%`
    : '--';

  return (
    <motion.div
      key={`dashboard-${selectedBand.id}`}
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className={cn(
        "flex flex-col gap-20 relative z-10 pb-32",
        isHidden && "opacity-0 pointer-events-none"
      )}
    >
      {/* ═══ STATS GRID (2×2) ═══ */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col gap-4 sm:gap-5">
        {/* Row 1: Gigs Confirmed | Upcoming Rehearsal — visible to all */}
        <div className="flex gap-4 sm:gap-5">
          {/* CARD: GIGS CONFIRMED — Red/Vermilion accent */}
          <div
            onClick={() => onFilterEvents ? onFilterEvents('GIGS') : onViewChange?.('Events')}
            className="flex-1 flex rounded-xl border border-foreground/10 bg-card shadow-xs overflow-hidden cursor-pointer hover:border-foreground/25 active:scale-[0.99] transition-all"
          >
            <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-gig)' }} />
            <div className="flex-1 flex flex-col py-3.5 px-4 pl-3.5 items-start text-left min-w-0">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">GIGS CONFIRMED</span>
              <div className="h-[62px] flex items-center">
                <span className="text-[46px] sm:text-[52px] font-bold leading-none text-foreground block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : confirmedCount}
                </span>
              </div>
            </div>
          </div>

          {/* CARD: UPCOMING REHEARSAL — Indigo/Violet accent */}
          <div
            onClick={() => onFilterEvents ? onFilterEvents('REHEARSAL') : onViewChange?.('Events')}
            className="flex-1 flex rounded-xl border border-foreground/10 bg-card shadow-xs overflow-hidden cursor-pointer hover:border-foreground/25 active:scale-[0.99] transition-all"
          >
            <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-rehearsal)' }} />
            <div className="flex-1 flex flex-col py-3.5 px-4 pl-3.5 items-start text-left min-w-0">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">UPCOMING REHEARSAL</span>
              <div className="h-[62px] flex items-center">
                <span className="text-[46px] sm:text-[52px] font-bold leading-none text-foreground block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : rehearsalCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Admin sees full business metrics / Member sees personal earnings */}
        <div className="flex gap-4 sm:gap-5">
          {isAdmin ? (
            <>
              {/* CARD: QUOTES — Emerald Green accent */}
              <div
                onClick={() => onFilterEvents ? onFilterEvents('QUOTE') : onViewChange?.('Events')}
                className="flex-1 flex rounded-xl border border-foreground/10 bg-card shadow-xs overflow-hidden cursor-pointer hover:border-foreground/25 active:scale-[0.99] transition-all"
              >
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-quote)' }} />
                <div className="flex-1 flex flex-col py-3.5 px-4 pl-3.5 items-start text-left min-w-0">
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate">QUOTES</span>
                    {!dashboardLoading && quotesPipeline > 0 && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shrink-0"
                        style={{ backgroundColor: 'var(--accent-quote)', color: 'var(--accent-quote-fg)' }}
                      >
                        {formatRevenue(quotesPipeline)}
                      </span>
                    )}
                  </div>
                  <div className="h-[62px] flex items-center">
                    <span className="text-[46px] sm:text-[52px] font-bold leading-none text-foreground block">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : quotesCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD: REVENUE — Royal Purple Brand accent */}
              <div className="flex-1 flex rounded-xl border border-foreground/10 bg-card shadow-xs overflow-hidden">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="flex-1 flex flex-col py-3.5 px-4 pl-3.5 items-start text-left min-w-0">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">REVENUE</span>
                  <div className="h-[62px] flex items-center">
                    <span className="text-[46px] sm:text-[52px] font-bold leading-none text-foreground block truncate">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : formatRevenue(revenue)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* CARD: MY FEE — Emerald Green accent (member view) */}
              <div className="flex-1 flex rounded-xl border border-foreground/10 bg-card shadow-xs overflow-hidden">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-quote)' }} />
                <div className="flex-1 flex flex-col py-3.5 px-4 pl-3.5 items-start text-left min-w-0">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">MY FEE</span>
                  <div className="h-[62px] flex items-center">
                    <span className="text-[46px] sm:text-[52px] font-bold leading-none text-foreground block truncate">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : formatRevenue(memberStats?.confirmedFee || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD: MY EARNINGS — Royal Purple Brand accent (member view) */}
              <div className="flex-1 flex rounded-xl border border-foreground/10 bg-card shadow-xs overflow-hidden">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="flex-1 flex flex-col py-3.5 px-4 pl-3.5 items-start text-left min-w-0">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">MY EARNINGS</span>
                  <div className="h-[62px] flex items-center">
                    <span className="text-[46px] sm:text-[52px] font-bold leading-none text-foreground block truncate">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : formatRevenue(memberStats?.totalEarned || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* --- Next Event Block with Fade Mask --- */}
      {(() => {
        const displayEvents = dashboardData?.upcomingEvents?.slice(0, 2) || [];
        // Compute stacked text labels dynamically
        let secondLabel = "GIG";
        if (displayEvents.length > 1) {
          const allRehearsals = displayEvents.every((e: any) => e.event_type === 'rehearsal');
          secondLabel = allRehearsals ? "REHEARSALS" : "EVENTS";
        } else if (displayEvents.length === 1) {
          secondLabel = displayEvents[0].event_type === 'rehearsal' ? "REHEARSAL" : "GIG";
        }
        return (
          <div className="flex flex-col gap-6 my-6 bg-transparent">
            {/* Structural Uppercase Header Row */}
            <div className="flex justify-between items-end">
              <div className="flex flex-col select-none">
                <span className="text-[32px] font-bold leading-none text-foreground">NEXT</span>
                <span className="text-[32px] font-bold leading-none text-foreground">{secondLabel}</span>
              </div>
              <button
                onClick={() => onViewChange?.('Events')}
                className="text-xs font-bold tracking-wider uppercase underline pb-1"
                style={{ color: 'var(--brand-accent)' }}
              >
                See all
              </button>
            </div>
            {/* Mask-Faded Content List Element Wrapper */}
            {displayEvents.length > 0 ? (
              <div
                className="flex flex-col bg-transparent"
                style={{
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)',
                  maxHeight: '210px',
                  overflow: 'hidden'
                }}
              >
                {displayEvents.map((event: any, index: number) => {
                  return (
                    <div
                      key={event.id || event.eventId || index}
                      onClick={() => onViewChange?.('Events')}
                      className="py-4 border-b flex flex-col gap-1 cursor-pointer bg-transparent hover:opacity-80 transition-opacity"
                      style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                    >
                      <div className="flex justify-between items-baseline">
                        <span className="text-base font-bold truncate max-w-[75%]" style={{ color: 'var(--foreground)' }}>
                          {event.title?.toUpperCase() || "UNTITLED EVENT"}
                        </span>
                        <span
                          className="text-[10px] font-black tracking-widest uppercase opacity-75"
                          style={{ color: 'var(--brand-accent)' }}
                        >
                          {event.event_type?.toUpperCase() || "EVENT"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-xs uppercase tracking-wide opacity-70" style={{ color: 'var(--foreground)' }}>
                        {event.event_date && (
                          <div className="flex items-center gap-1">
                            <span>📅 {new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })?.toUpperCase()}</span>
                            {event.start_time && <span>• {event.start_time}</span>}
                          </div>
                        )}
                        {event.venue_name && (
                          <div className="flex items-center gap-1 truncate">
                            <span>📍 {event.venue_name?.toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs py-4 font-bold tracking-wider uppercase opacity-40" style={{ color: 'var(--foreground)' }}>
                NO UPCOMING EVENTS SCHEDULED
              </div>
            )}
          </div>
        );
      })()}
      {/* ------------------------------- */}

      {/* ═══ ACTION CENTER ═══ */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col gap-10">
        <div className="flex flex-col">
          <span className="text-[32px] font-bold leading-none text-foreground">ACTION</span>
          <span className="text-[32px] font-bold leading-none text-foreground">CENTER</span>
        </div>

        <div className="flex flex-col gap-[60px]">
          {/* Scrollable Action Tiles */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-10 w-max">
              {filteredQuickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onQuickAction?.(action.label)}
                  className="flex flex-col gap-3 items-start shrink-0 active:opacity-70 transition-opacity"
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex flex-col leading-none text-left">
                      <span className="text-xs font-bold text-foreground text-left">{action.label.toUpperCase()}</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Row — Member-specific operational cards vs Admin business cards */}
          {isAdmin ? (
            <div className="flex gap-3 sm:gap-4">
              {/* ADMIN: Upcoming Gigs */}
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground/70 tracking-wide uppercase">UPCOMING GIGS</span>
                  <span className="text-[42px] font-bold leading-tight text-foreground">
                    {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : confirmedCount}
                  </span>
                  <span className="text-[11px] font-bold text-foreground/50 tracking-wide uppercase">CONFIRMED EVENTS SCHEDULED</span>
                </div>
                <button
                  onClick={() => onQuickAction?.('View Calendar')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-[12px] bg-primary text-primary-foreground w-full active:scale-95 transition-all shadow-xs hover:opacity-95"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">VIEW CALENDAR</span>
                  <ArrowUpRight className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>

              {/* ADMIN: Revenue Growing */}
              <div className="flex flex-col justify-between flex-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground/70 tracking-wide uppercase">REVENUE GROWING</span>
                  <span className="text-[42px] font-bold leading-tight text-foreground">
                    {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : revenueChangeText}
                  </span>
                  <span className="text-[11px] font-bold text-foreground/50 tracking-wide uppercase">VS LAST MONTH</span>
                </div>
                <button
                  onClick={() => onQuickAction?.('View Analytics')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-[12px] bg-foreground/10 hover:bg-foreground/15 text-foreground w-full active:scale-95 transition-all border border-foreground/10"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">VIEW ANALYTICS</span>
                  <ArrowUpRight className="w-4 h-4 text-foreground/70" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 sm:gap-4">
              {/* MEMBER: Next Soundcheck / Load-In */}
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-foreground" />
                  <span className="text-xs font-bold text-foreground/70 tracking-wide uppercase">NEXT SOUNDCHECK</span>
                </div>
                <span className="text-[28px] font-bold leading-tight text-foreground">
                  {confirmedCount > 0 ? '2h 15m' : '—'}
                </span>
                <span className="text-[11px] font-bold text-foreground/50 tracking-wide uppercase">
                  {confirmedCount > 0 ? 'BEFORE DOORS OPEN' : 'NO UPCOMING GIGS'}
                </span>
                {confirmedCount > 0 && (
                  <button
                    onClick={() => onQuickAction?.('View Calendar')}
                    className="flex items-center justify-between px-3.5 py-3 rounded-[12px] bg-primary text-primary-foreground w-full active:scale-95 transition-all shadow-xs hover:opacity-95"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      LOAD-IN MAP
                    </span>
                    <ChevronRight className="w-4 h-4 text-primary-foreground" />
                  </button>
                )}
              </div>

              {/* MEMBER: My Setlist Snapshot */}
              <div className="flex flex-col justify-between flex-1">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-foreground" />
                  <span className="text-xs font-bold text-foreground/70 tracking-wide uppercase">MY SETLIST</span>
                </div>
                <span className="text-[28px] font-bold leading-tight text-foreground">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : '—'}
                </span>
                <span className="text-[11px] font-bold text-foreground/50 tracking-wide uppercase">
                  NEXT GIG SONGS
                </span>
                <button
                  onClick={() => onQuickAction?.('Setlist & Repertoire')}
                  className="flex items-center justify-between px-3.5 py-3 rounded-[12px] bg-foreground/10 hover:bg-foreground/15 text-foreground w-full active:scale-95 transition-all border border-foreground/10"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">VIEW SETLIST</span>
                  <ChevronRight className="w-4 h-4 text-foreground/70" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
