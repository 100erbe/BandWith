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
  onSelectEvent?: (eventId: string) => void;
  isAdmin?: boolean;
  isSolo?: boolean;  // PLG: Solo mode hides collaborative features
}

const formatEventTime = (timeStr?: string): string => {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m > 0 ? `${h}:${match[2]} ${ampm}` : `${h} ${ampm}`;
  }
  return timeStr;
};

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
  onSelectEvent,
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
        "flex flex-col gap-8 sm:gap-10 relative z-10 pb-44",
        isHidden && "opacity-0 pointer-events-none"
      )}
    >
      {/* ═══ STATS GRID (2×2) — PRIMARY DASHBOARD HERO ═══ */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col gap-3.5 sm:gap-4">
        {/* Row 1: Gigs Confirmed | Upcoming Rehearsal — visible to all */}
        <div className="flex gap-3.5 sm:gap-4">
          {/* CARD: GIGS CONFIRMED — Red/Vermilion accent */}
          <div
            onClick={() => onFilterEvents ? onFilterEvents('GIGS') : onViewChange?.('Events')}
            className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden cursor-pointer relative"
          >
            <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-gig)' }} />
            <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                GIGS CONFIRMED
              </span>
              <div className="h-[64px] flex items-center">
                <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : confirmedCount}
                </span>
              </div>
            </div>
          </div>

          {/* CARD: UPCOMING REHEARSAL — Indigo/Violet accent */}
          <div
            onClick={() => onFilterEvents ? onFilterEvents('REHEARSAL') : onViewChange?.('Events')}
            className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden cursor-pointer relative"
          >
            <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-rehearsal)' }} />
            <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                UPCOMING REHEARSAL
              </span>
              <div className="h-[64px] flex items-center">
                <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : rehearsalCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Admin sees full business metrics / Member sees personal earnings */}
        <div className="flex gap-3.5 sm:gap-4">
          {isAdmin ? (
            <>
              {/* CARD: QUOTES — Emerald Green accent */}
              <div
                onClick={() => onFilterEvents ? onFilterEvents('QUOTE') : onViewChange?.('Events')}
                className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden cursor-pointer relative"
              >
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-quote)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate">
                      QUOTES
                    </span>
                    {!dashboardLoading && quotesPipeline > 0 && (
                      <span
                        className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold tracking-wider uppercase shrink-0 shadow-2xs"
                        style={{ backgroundColor: 'var(--accent-quote)', color: 'var(--accent-quote-fg)' }}
                      >
                        {formatRevenue(quotesPipeline)}
                      </span>
                    )}
                  </div>
                  <div className="h-[64px] flex items-center">
                    <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : quotesCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD: REVENUE — Royal Purple Brand accent */}
              <div className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden relative">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate">
                      REVENUE
                    </span>
                    {!dashboardLoading && revenueChangeText !== '--' && (
                      <span className="px-1.5 py-0.5 rounded-[5px] text-[10px] font-bold tracking-wider uppercase bg-foreground/8 text-foreground/70 shrink-0">
                        {revenueChangeText}
                      </span>
                    )}
                  </div>
                  <div className="h-[64px] flex items-center">
                    <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block truncate">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : formatRevenue(revenue)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* CARD: MY FEE — Emerald Green accent (member view) */}
              <div className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden relative">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-quote)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                    MY FEE
                  </span>
                  <div className="h-[64px] flex items-center">
                    <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block truncate">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : formatRevenue(memberStats?.confirmedFee || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD: MY EARNINGS — Royal Purple Brand accent (member view) */}
              <div className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden relative">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                    MY EARNINGS
                  </span>
                  <div className="h-[64px] flex items-center">
                    <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block truncate">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : formatRevenue(memberStats?.totalEarned || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* ═══ NEXT GIG / NEXT EVENTS SECTION ═══ */}
      {(() => {
        const displayEvents = dashboardData?.upcomingEvents?.slice(0, 2) || [];
        let secondLabel = "GIG";
        if (displayEvents.length > 1) {
          const allRehearsals = displayEvents.every((e: any) => e.event_type === 'rehearsal');
          secondLabel = allRehearsals ? "REHEARSALS" : "EVENTS";
        } else if (displayEvents.length === 1) {
          secondLabel = displayEvents[0].event_type === 'rehearsal' ? "REHEARSAL" : "GIG";
        }

        return (
          <div className="flex flex-col gap-4">
            {/* Header Row */}
            <div className="flex justify-between items-end">
              <div className="flex flex-col select-none">
                <span className="text-[28px] sm:text-[32px] font-bold leading-none text-foreground">NEXT</span>
                <span className="text-[28px] sm:text-[32px] font-bold leading-none text-foreground">{secondLabel}</span>
              </div>
              <button
                onClick={() => onViewChange?.('Events')}
                className="text-xs font-bold tracking-wider uppercase text-primary hover:underline flex items-center gap-1 pb-1 transition-all cursor-pointer"
              >
                <span>See all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Event Cards List */}
            {displayEvents.length > 0 ? (
              <div className="flex flex-col gap-3">
                {displayEvents.map((event: any, index: number) => {
                  const isRehearsal = event.event_type === 'rehearsal';
                  const isQuote = event.event_type === 'quote';
                  const accentColor = isQuote
                    ? 'var(--accent-quote)'
                    : isRehearsal
                    ? 'var(--accent-rehearsal)'
                    : 'var(--accent-gig)';
                  const accentFg = isQuote
                    ? 'var(--accent-quote-fg)'
                    : isRehearsal
                    ? 'var(--accent-rehearsal-fg)'
                    : 'var(--accent-gig-fg)';
                  const typeLabel = (event.event_type || 'GIG').toUpperCase();
                  const dateFormatted = event.event_date
                    ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
                    : 'TBD';
                  const eventTime = event.start_time ? formatEventTime(event.start_time) : null;
                  const loadTime = event.load_in_time ? formatEventTime(event.load_in_time) : null;
                  const locationName = event.venue_name || event.location || 'TBD';
                  const locationAddress = event.venue_address || (event.venue_city ? `${event.venue_city}` : null);

                  return (
                    <div
                      key={event.id || event.eventId || index}
                      onClick={() => {
                        if (onSelectEvent && (event.id || event.eventId)) {
                          onSelectEvent(event.id || event.eventId);
                        } else {
                          onViewChange?.('Events');
                        }
                      }}
                      className="group relative flex flex-col rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/25 overflow-hidden p-4 sm:p-5 gap-3.5 cursor-pointer shadow-xs hover:shadow-sm active:scale-[0.99] transition-all"
                    >
                      {/* Left Accent Rail */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[5px]"
                        style={{ backgroundColor: accentColor }}
                      />

                      {/* Card Header: Type Badge + Date Badge */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className="inline-flex items-center justify-center rounded-[6px] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider leading-tight"
                            style={{ backgroundColor: accentColor, color: accentFg }}
                          >
                            {typeLabel}
                          </div>
                          {event.indoor_outdoor && (
                            <div className="inline-flex items-center justify-center rounded-[6px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-tight bg-foreground/8 text-foreground/70">
                              {event.indoor_outdoor}
                            </div>
                          )}
                        </div>

                        {/* Date Badge */}
                        <div
                          className="rounded-[8px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-2xs whitespace-nowrap"
                          style={{ backgroundColor: accentColor, color: accentFg }}
                        >
                          {dateFormatted}
                        </div>
                      </div>

                      {/* Card Body: Title & Location */}
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground uppercase tracking-tight leading-snug line-clamp-1 group-hover:text-foreground/90 transition-colors">
                          {event.title || 'UNTITLED EVENT'}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-foreground/60 font-medium truncate">
                          <MapPin className="w-3.5 h-3.5 text-foreground/45 shrink-0" />
                          <span className="font-semibold text-foreground/80 truncate">
                            {locationName}
                          </span>
                          {locationAddress && (
                            <>
                              <span className="text-foreground/30">•</span>
                              <span className="truncate text-foreground/50">{locationAddress}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Schedule / Fee Strip */}
                      <div className="border-t border-foreground/8 pt-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 text-foreground/60">
                          {loadTime && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider">LOAD IN</span>
                              <span className="font-bold text-foreground/80">{loadTime}</span>
                            </div>
                          )}
                          {eventTime && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-foreground/45 uppercase tracking-wider">START</span>
                              <span className="font-bold text-foreground/80">{eventTime}</span>
                            </div>
                          )}
                          {!loadTime && !eventTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-foreground/40" />
                              <span className="text-[11px] font-medium text-foreground/50">TIME TBD</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {event.fee != null && event.fee > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-foreground/45 uppercase">
                                {isAdmin ? 'FEE' : 'YOUR FEE'}
                              </span>
                              <span className="text-xs font-bold text-foreground">
                                {formatRevenue(event.fee)}
                              </span>
                            </div>
                          )}
                          <div className="w-6 h-6 rounded-full bg-foreground/5 group-hover:bg-foreground/10 flex items-center justify-center transition-colors">
                            <ArrowUpRight className="w-3.5 h-3.5 text-foreground/60 group-hover:text-foreground transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[16px] bg-card/60 border border-dashed border-foreground/15 p-6 text-center flex flex-col items-center justify-center gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  NO UPCOMING EVENTS SCHEDULED
                </span>
                <span className="text-[11px] text-foreground/40 font-medium">
                  {isAdmin ? 'Tap + in the bottom bar to schedule a gig or rehearsal' : 'Upcoming events will appear here once confirmed'}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ ACTION CENTER ═══ */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col gap-5">
        <div className="flex flex-col select-none">
          <span className="text-[28px] sm:text-[32px] font-bold leading-none text-foreground">ACTION</span>
          <span className="text-[28px] sm:text-[32px] font-bold leading-none text-foreground">CENTER</span>
        </div>

        <div className="flex flex-col gap-6">
          {/* Scrollable Quick Action Tiles */}
          <div className="overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <div className="flex gap-2.5 w-max">
              {filteredQuickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onQuickAction?.(action.label)}
                  className="rounded-[12px] bg-card border border-foreground/10 hover:border-foreground/20 px-3.5 py-2.5 flex items-center gap-2.5 shrink-0 active:scale-95 transition-all shadow-2xs group cursor-pointer"
                >
                  <action.icon className="w-4 h-4 text-foreground/60 group-hover:text-foreground transition-colors" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    {action.label}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40 group-hover:text-foreground transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Operational Cards */}
          {isAdmin ? (
            <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4">
              {/* ADMIN: Upcoming Gigs */}
              <div className="flex-1 rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase">UPCOMING GIGS</span>
                  <span className="text-[36px] sm:text-[40px] font-bold leading-tight text-foreground">
                    {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin text-foreground/40" /> : confirmedCount}
                  </span>
                  <span className="text-[10px] font-bold text-foreground/45 tracking-wide uppercase">CONFIRMED EVENTS SCHEDULED</span>
                </div>
                <button
                  onClick={() => onQuickAction?.('View Calendar')}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-primary text-primary-foreground w-full active:scale-95 transition-all shadow-xs hover:opacity-95 cursor-pointer"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">VIEW CALENDAR</span>
                  <ArrowUpRight className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>

              {/* ADMIN: Revenue Growing */}
              <div className="flex-1 rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase">REVENUE GROWING</span>
                  <span className="text-[36px] sm:text-[40px] font-bold leading-tight text-foreground">
                    {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin text-foreground/40" /> : revenueChangeText}
                  </span>
                  <span className="text-[10px] font-bold text-foreground/45 tracking-wide uppercase">VS LAST MONTH</span>
                </div>
                <button
                  onClick={() => onQuickAction?.('View Analytics')}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-foreground/8 hover:bg-foreground/12 text-foreground w-full active:scale-95 transition-all border border-foreground/10 cursor-pointer"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">VIEW ANALYTICS</span>
                  <ArrowUpRight className="w-4 h-4 text-foreground/70" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4">
              {/* MEMBER: Next Soundcheck / Load-In */}
              <div className="flex-1 rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-foreground/60" />
                    <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase">NEXT SOUNDCHECK</span>
                  </div>
                  <span className="text-[28px] sm:text-[32px] font-bold leading-tight text-foreground">
                    {confirmedCount > 0 ? '2h 15m' : '—'}
                  </span>
                  <span className="text-[10px] font-bold text-foreground/45 tracking-wide uppercase">
                    {confirmedCount > 0 ? 'BEFORE DOORS OPEN' : 'NO UPCOMING GIGS'}
                  </span>
                </div>
                {confirmedCount > 0 && (
                  <button
                    onClick={() => onQuickAction?.('View Calendar')}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-primary text-primary-foreground w-full active:scale-95 transition-all shadow-xs hover:opacity-95 cursor-pointer"
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
              <div className="flex-1 rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <ListMusic className="w-3.5 h-3.5 text-foreground/60" />
                    <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase">MY SETLIST</span>
                  </div>
                  <span className="text-[28px] sm:text-[32px] font-bold leading-tight text-foreground">
                    {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin text-foreground/40" /> : '—'}
                  </span>
                  <span className="text-[10px] font-bold text-foreground/45 tracking-wide uppercase">
                    NEXT GIG SONGS
                  </span>
                </div>
                <button
                  onClick={() => onQuickAction?.('Setlist & Repertoire')}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-foreground/8 hover:bg-foreground/12 text-foreground w-full active:scale-95 transition-all border border-foreground/10 cursor-pointer"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">VIEW SETLIST</span>
                  <ChevronRight className="w-4 h-4 text-foreground/70" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Bottom clearance spacer ensuring last card clears floating navbar */}
      <div className="h-12 shrink-0 pointer-events-none" aria-hidden="true" />
    </motion.div>
  );
};
