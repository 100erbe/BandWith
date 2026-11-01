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
import { APP_COPY } from '@/app/constants/copy';

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
  const upcomingEvents = dashboardData?.upcomingEvents || [];
  const displayEvents = upcomingEvents.slice(0, 2);
  const nextMemberGig = upcomingEvents.find((e: any) => e.event_type !== 'rehearsal');

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
        {/* Row 1: Confirmed Gigs | Upcoming Rehearsals — visible to all */}
        <div className="flex gap-3.5 sm:gap-4">
          {/* CARD: Confirmed Gigs — Red/Vermilion accent */}
          <div
            onClick={() => onFilterEvents ? onFilterEvents('GIGS') : onViewChange?.('Events')}
            className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden cursor-pointer relative"
          >
            <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-gig)' }} />
            <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                {APP_COPY.home.stats.confirmedGigs}
              </span>
              <div className="h-[64px] flex items-center">
                <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : confirmedCount}
                </span>
              </div>
            </div>
          </div>

          {/* CARD: Upcoming Rehearsals — Indigo/Violet accent */}
          <div
            onClick={() => onFilterEvents ? onFilterEvents('REHEARSALS') : onViewChange?.('Events')}
            className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden cursor-pointer relative"
          >
            <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-rehearsal)' }} />
            <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                {APP_COPY.home.stats.upcomingRehearsals}
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
              {/* CARD: Active Quotes — Emerald Green accent */}
              <div
                onClick={() => onFilterEvents ? onFilterEvents('QUOTES') : onViewChange?.('Events')}
                className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden cursor-pointer relative"
              >
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-quote)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate">
                      {APP_COPY.home.stats.activeQuotes}
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

              {/* CARD: Revenue — Royal Purple Brand accent */}
              <div className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden relative">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate">
                      {APP_COPY.home.stats.revenue}
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
              {/* CARD: Upcoming Pay — Emerald Green accent (member view) */}
              <div className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden relative">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--accent-quote)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                    {APP_COPY.home.stats.upcomingPay}
                  </span>
                  <div className="h-[64px] flex items-center">
                    <span className="text-[48px] sm:text-[54px] font-black leading-none text-foreground tracking-tight block truncate">
                      {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4 text-foreground/40" /> : formatRevenue(memberStats?.confirmedFee || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD: Total Earned — Royal Purple Brand accent (member view) */}
              <div className="flex-1 flex rounded-[16px] border border-foreground/12 bg-card shadow-sm hover:shadow-md hover:border-foreground/25 active:scale-[0.99] transition-all overflow-hidden relative">
                <div className="w-[5px] shrink-0" style={{ backgroundColor: 'var(--primary)' }} />
                <div className="flex-1 flex flex-col py-4 px-4.5 pl-4 items-start text-left min-w-0">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider uppercase truncate w-full">
                    {APP_COPY.home.stats.totalEarned}
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

      {/* ═══ NEXT GIG / UPCOMING EVENT CARD ═══ */}
      <motion.div variants={dashboardItemVariants}>
        {(() => {
          if (displayEvents.length === 0) {
            return (
              <div className="rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
                    {APP_COPY.home.nextEvents.nextGig}
                  </span>
                </div>
                <div className="rounded-[12px] bg-background/50 border border-dashed border-foreground/15 p-5 text-center flex flex-col items-center justify-center gap-1">
                  <span className="text-xs font-semibold text-foreground/70">
                    {APP_COPY.home.nextEvents.noUpcomingEvents}
                  </span>
                  <span className="text-[11px] text-foreground/45">
                    {isAdmin ? APP_COPY.home.nextEvents.adminEmptyHelper : APP_COPY.home.nextEvents.memberEmptyHelper}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-3.5">
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
                const cardTitle = isQuote
                  ? APP_COPY.home.nextEvents.activeQuote
                  : isRehearsal
                  ? APP_COPY.home.nextEvents.nextRehearsal
                  : APP_COPY.home.nextEvents.nextGig;
                const typeLabel = isQuote
                  ? APP_COPY.home.nextEvents.typeQuote
                  : isRehearsal
                  ? APP_COPY.home.nextEvents.typeRehearsal
                  : APP_COPY.home.nextEvents.typeGig;
                const dateFormatted = event.event_date
                  ? new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : APP_COPY.home.nextEvents.tbd;
                const eventTime = event.start_time ? formatEventTime(event.start_time) : null;
                const loadTime = event.load_in_time ? formatEventTime(event.load_in_time) : null;
                const locationName = event.venue_name || event.location || APP_COPY.home.nextEvents.tbd;
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
                    className="group relative flex flex-col rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/25 overflow-hidden p-4 sm:p-5 gap-3.5 cursor-pointer shadow-2xs hover:shadow-sm active:scale-[0.99] transition-all"
                  >
                    {/* Left Accent Rail */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[5px]"
                      style={{ backgroundColor: accentColor }}
                    />

                    {/* Inside Card Header Row: Smaller Card Title in Title Case + See All link */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
                        {index === 0 ? cardTitle : APP_COPY.home.nextEvents.upcomingEvent}
                      </span>
                      {index === 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewChange?.('Events');
                          }}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 transition-all cursor-pointer"
                        >
                          <span>{APP_COPY.home.nextEvents.seeAll}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Badges Row: Type Badge + Date Badge */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className="inline-flex items-center justify-center rounded-[6px] px-2.5 py-0.5 text-[11px] font-bold tracking-wide"
                          style={{ backgroundColor: accentColor, color: accentFg }}
                        >
                          {typeLabel}
                        </div>
                        {event.indoor_outdoor && (
                          <div className="inline-flex items-center justify-center rounded-[6px] px-2 py-0.5 text-[11px] font-medium bg-foreground/6 text-foreground/70 capitalize">
                            {event.indoor_outdoor}
                          </div>
                        )}
                      </div>

                      {/* Date Badge */}
                      <div
                        className="rounded-[8px] px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-2xs whitespace-nowrap"
                        style={{ backgroundColor: accentColor, color: accentFg }}
                      >
                        {dateFormatted}
                      </div>
                    </div>

                    {/* Card Body: Title & Location */}
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug line-clamp-1 group-hover:text-foreground/90 transition-colors">
                        {event.title || APP_COPY.home.nextEvents.untitledEvent}
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
                            <span className="text-[10px] font-bold text-foreground/45 tracking-wider">{APP_COPY.home.nextEvents.loadIn}</span>
                            <span className="font-bold text-foreground/80">{loadTime}</span>
                          </div>
                        )}
                        {eventTime && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-foreground/45 tracking-wider">{APP_COPY.home.nextEvents.start}</span>
                            <span className="font-bold text-foreground/80">{eventTime}</span>
                          </div>
                        )}
                        {!loadTime && !eventTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-foreground/40" />
                            <span className="text-[11px] font-medium text-foreground/50">{APP_COPY.home.nextEvents.timeTbd}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {event.fee != null && event.fee > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-foreground/45">
                              {isAdmin ? APP_COPY.home.nextEvents.fee : APP_COPY.home.nextEvents.yourFee}
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
          );
        })()}
      </motion.div>

      {/* ═══ SECONDARY OPERATIONAL CARDS ═══ */}
      <motion.div variants={dashboardItemVariants}>
        {isAdmin ? (
          <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4">
            {/* ADMIN: Schedule Overview */}
            <div className="flex-1 rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
                  {APP_COPY.home.operations.scheduleOverview}
                </span>
                <span className="text-[36px] sm:text-[40px] font-bold leading-tight text-foreground">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin text-foreground/40" /> : confirmedCount}
                </span>
                <span className="text-[11px] text-foreground/50">
                  {APP_COPY.home.operations.confirmedUpcomingShows}
                </span>
              </div>
              <button
                onClick={() => onQuickAction?.('View Calendar')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-primary text-primary-foreground w-full active:scale-95 transition-all shadow-xs hover:opacity-95 cursor-pointer font-bold text-xs"
              >
                <span>{APP_COPY.home.operations.openCalendar}</span>
                <ArrowUpRight className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>

            {/* ADMIN: Monthly Growth */}
            <div className="flex-1 rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
                  {APP_COPY.home.operations.monthlyGrowth}
                </span>
                <span className="text-[36px] sm:text-[40px] font-bold leading-tight text-foreground">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin text-foreground/40" /> : revenueChangeText}
                </span>
                <span className="text-[11px] text-foreground/50">
                  {APP_COPY.home.operations.vsPreviousMonth}
                </span>
              </div>
              <button
                onClick={() => onQuickAction?.('View Analytics')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-foreground/8 hover:bg-foreground/12 text-foreground w-full active:scale-95 transition-all border border-foreground/10 cursor-pointer font-bold text-xs"
              >
                <span>{APP_COPY.home.operations.viewAnalytics}</span>
                <ArrowUpRight className="w-4 h-4 text-foreground/70" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4">
            {/* MEMBER: Next Soundcheck / Load-In (Dynamic from actual upcoming gig) */}
            <div className="flex-1 rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-2xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-foreground/60" />
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
                    {APP_COPY.home.operations.nextSoundcheck}
                  </span>
                </div>
                {(() => {
                  const soundcheckDisplay = nextMemberGig?.soundcheck_time
                    ? formatEventTime(nextMemberGig.soundcheck_time)
                    : nextMemberGig?.load_in_time
                    ? formatEventTime(nextMemberGig.load_in_time)
                    : (confirmedCount > 0 ? APP_COPY.home.nextEvents.timeTbd : '—');
                  const soundcheckSubtitle = nextMemberGig?.start_time
                    ? `${APP_COPY.home.operations.doorsAt} ${formatEventTime(nextMemberGig.start_time)}`
                    : (confirmedCount > 0 ? APP_COPY.home.operations.checkEventDetails : APP_COPY.home.operations.noUpcomingGigs);

                  return (
                    <>
                      <span className="text-[28px] sm:text-[32px] font-bold leading-tight text-foreground">
                        {soundcheckDisplay}
                      </span>
                      <span className="text-[11px] text-foreground/50">
                        {soundcheckSubtitle}
                      </span>
                    </>
                  );
                })()}
              </div>
              {confirmedCount > 0 && (
                <button
                  onClick={() => onQuickAction?.('View Calendar')}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-primary text-primary-foreground w-full active:scale-95 transition-all shadow-xs hover:opacity-95 cursor-pointer font-bold text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {APP_COPY.home.operations.loadInMap}
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
                  <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
                    {APP_COPY.home.operations.mySetlist}
                  </span>
                </div>
                <span className="text-[28px] sm:text-[32px] font-bold leading-tight text-foreground">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin text-foreground/40" /> : '—'}
                </span>
                <span className="text-[11px] text-foreground/50">
                  {APP_COPY.home.operations.nextGigSongs}
                </span>
              </div>
              <button
                onClick={() => onQuickAction?.('Setlist & Repertoire')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-foreground/8 hover:bg-foreground/12 text-foreground w-full active:scale-95 transition-all border border-foreground/10 cursor-pointer font-bold text-xs"
              >
                <span>{APP_COPY.home.operations.viewSetlist}</span>
                <ChevronRight className="w-4 h-4 text-foreground/70" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ═══ QUICK ACTIONS CARD (VERTICAL STACK) ═══ */}
      <motion.div variants={dashboardItemVariants}>
        <div className="rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
          {/* Card Title inside the card in Title Case */}
          <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
            {APP_COPY.home.quickActions.title}
          </span>

          {/* Vertical Stack of Options */}
          <div className="flex flex-col divide-y divide-foreground/8">
            {filteredQuickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onQuickAction?.(action.label)}
                className="flex items-center justify-between py-3 first:pt-1 last:pb-1 group hover:opacity-80 active:scale-[0.99] transition-all cursor-pointer text-left w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[10px] bg-foreground/6 border border-foreground/8 flex items-center justify-center text-foreground/70 group-hover:bg-foreground/10 group-hover:text-foreground transition-colors shrink-0">
                    <action.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    {action.label}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom clearance spacer ensuring last card clears floating navbar */}
      <div className="h-12 shrink-0 pointer-events-none" aria-hidden="true" />
    </motion.div>
  );
};
