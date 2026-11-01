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

const toTitleCase = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/(?:^|\s|\/|-|\.)\S/g, (match) => match.toUpperCase());
};

const formatEventRowDate = (rawDate?: string | null): string => {
  if (!rawDate) return APP_COPY.home.nextEvents.tbd;
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return APP_COPY.home.nextEvents.tbd;
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return `${month} ${day}`;
};

const formatEventLocation = (event: any): string | null => {
  const venue = event.venue_name || (event.location && event.location !== 'TBD' ? event.location.split(',')[0].trim() : null);
  const city = event.venue_city || (event.location && event.location.includes(',') ? event.location.split(',')[1].trim() : null);

  if (venue && city && !venue.toLowerCase().includes(city.toLowerCase())) {
    return `${toTitleCase(venue)}, ${toTitleCase(city)}`;
  }
  const single = venue || city || (event.location && event.location !== 'TBD' ? event.location : null);
  return single ? toTitleCase(single) : null;
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

  // Filter strictly to upcoming confirmed gigs and rehearsals (max 3)
  const upcomingGigsAndRehearsals = React.useMemo(() => {
    const raw = dashboardData?.upcomingEvents || [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return raw.filter((e: any) => {
      const s = (e.status || '').toLowerCase();
      const type = (e.event_type || e.eventType || '').toLowerCase();
      const dateRaw = e.event_date || e.date;
      const d = dateRaw ? (dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw) : '';

      if (d && d < todayStr) return false;
      if (s === 'cancelled' || s === 'quoted' || s === 'quote' || s === 'tentative' || s === 'draft' || s === 'pending') {
        return false;
      }
      const isRehearsal = type === 'rehearsal' || s === 'rehearsal';
      const isConfirmedGig = (s === 'confirmed' || s === 'completed') && type !== 'rehearsal';
      return isRehearsal || isConfirmedGig;
    }).slice(0, 3);
  }, [dashboardData?.upcomingEvents]);

  const nextMemberGig = upcomingGigsAndRehearsals.find((e: any) => {
    const type = (e.event_type || e.eventType || '').toLowerCase();
    const s = (e.status || '').toLowerCase();
    return type !== 'rehearsal' && s !== 'rehearsal';
  });

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

      {/* ═══ UPCOMING GIGS & REHEARSALS CARD ═══ */}
      <motion.div variants={dashboardItemVariants}>
        <div className="rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xs">
          {/* Card Title inside the card in Title Case + See All link */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
              {APP_COPY.home.nextEvents.upcomingSchedule}
            </span>
            <button
              onClick={() => onViewChange?.('Events')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 transition-all cursor-pointer"
            >
              <span>{APP_COPY.home.nextEvents.seeAll}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingGigsAndRehearsals.length === 0 ? (
            <div className="rounded-[12px] bg-background/50 border border-dashed border-foreground/15 p-5 text-center flex flex-col items-center justify-center gap-1">
              <span className="text-xs font-semibold text-foreground/70">
                {APP_COPY.home.nextEvents.noUpcomingEvents}
              </span>
              <span className="text-[11px] text-foreground/45">
                {isAdmin ? APP_COPY.home.nextEvents.adminEmptyHelper : APP_COPY.home.nextEvents.memberEmptyHelper}
              </span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-foreground/8">
              {upcomingGigsAndRehearsals.map((event: any, index: number) => {
                const s = (event.status || '').toLowerCase();
                const type = (event.event_type || event.eventType || '').toLowerCase();
                const isRehearsal = type === 'rehearsal' || s === 'rehearsal';
                const accentColor = isRehearsal ? 'var(--accent-rehearsal)' : 'var(--accent-gig)';
                const accentFg = isRehearsal ? 'var(--accent-rehearsal-fg)' : 'var(--accent-gig-fg)';
                const typeLabel = isRehearsal ? APP_COPY.home.nextEvents.typeRehearsal : APP_COPY.home.nextEvents.typeGig;
                const rawDate = event.event_date || event.date;
                const dateFormatted = formatEventRowDate(rawDate);
                const eventTime = event.start_time ? formatEventTime(event.start_time) : (event.time ? formatEventTime(event.time) : null);
                const locationText = formatEventLocation(event);

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
                    className="group flex items-center justify-between gap-3 py-3 first:pt-1.5 last:pb-1.5 -mx-2 px-2.5 rounded-[12px] hover:bg-foreground/[0.04] active:scale-[0.99] cursor-pointer transition-all"
                  >
                    {/* Left Column: Semantic Accent Rail + Fixed-Width Type Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="w-[3.5px] h-[18px] rounded-full shrink-0"
                        style={{ backgroundColor: accentColor }}
                      />
                      <span
                        className="w-[42px] inline-flex items-center justify-center rounded-[5px] py-0.5 text-[10px] font-bold tracking-wider uppercase shrink-0 leading-tight"
                        style={{ backgroundColor: accentColor, color: accentFg }}
                      >
                        {typeLabel}
                      </span>
                    </div>

                    {/* Middle Column: Date + Title + Location + Time (Locked on Baseline) */}
                    <div className="flex items-baseline gap-3 min-w-0 flex-1">
                      {/* Fixed-width Date */}
                      <span className="w-[58px] shrink-0 text-xs font-bold text-foreground/75 uppercase tracking-wide tabular-nums">
                        {dateFormatted}
                      </span>

                      {/* Event Title + Location (city / venue in Title Case) */}
                      <div className="flex items-baseline gap-1.5 min-w-0 flex-1 overflow-hidden">
                        <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors shrink-0 max-w-[180px] sm:max-w-[260px] capitalize">
                          {toTitleCase(event.title) || APP_COPY.home.nextEvents.untitledEvent}
                        </span>
                        {locationText && (
                          <span className="text-[11px] font-medium text-foreground/50 truncate flex-1 min-w-0 capitalize">
                            • {locationText}
                          </span>
                        )}
                      </div>

                      {/* Time / Fee */}
                      <div className="shrink-0 text-right">
                        {eventTime ? (
                          <span className="text-xs font-semibold text-foreground/65 tabular-nums">
                            {eventTime}
                          </span>
                        ) : event.fee != null && event.fee > 0 ? (
                          <span className="text-xs font-bold text-foreground tabular-nums">
                            {formatRevenue(event.fee)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Chevron Arrow (Vertically Centered in row) */}
                    <ChevronRight className="w-3.5 h-3.5 text-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══ 3. QUICK ACTIONS CARD (VERTICAL STACK) ═══ */}
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

      {/* ═══ 4. SECONDARY OPERATIONAL & ANALYTICS CARDS ═══ */}
      <motion.div variants={dashboardItemVariants}>
        {isAdmin ? (
          /* ADMIN: Performance & Analytics Banner */
          <div className="rounded-[16px] bg-card border border-foreground/10 p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-foreground/60 tracking-wider">
                {APP_COPY.home.operations.monthlyGrowth}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] sm:text-[36px] font-bold leading-none text-foreground">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin text-foreground/40" /> : revenueChangeText}
                </span>
                <span className="text-[11px] text-foreground/50">
                  {APP_COPY.home.operations.vsPreviousMonth}
                </span>
              </div>
            </div>
            <button
              onClick={() => onQuickAction?.('View Analytics')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-foreground/8 hover:bg-foreground/12 text-foreground active:scale-95 transition-all border border-foreground/10 cursor-pointer font-bold text-xs shrink-0"
            >
              <span>{APP_COPY.home.operations.viewAnalytics}</span>
              <ArrowUpRight className="w-4 h-4 text-foreground/70" />
            </button>
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

      {/* Bottom clearance spacer ensuring last card clears floating navbar */}
      <div className="h-12 shrink-0 pointer-events-none" aria-hidden="true" />
    </motion.div>
  );
};
