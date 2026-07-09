import React, { useEffect, useState } from 'react';
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
  isAdmin?: boolean;
  isSolo?: boolean;  // PLG: Solo mode hides collaborative features
}

// --- Equalizer Dot Grid for Stats (6×4) ---

type DotGridTheme = 'lime' | 'blue' | 'beige' | 'dark';

const DOT_THEME_COLORS: Record<DotGridTheme, string> = {
  lime: 'var(--accent-gig)',
  blue: 'var(--accent-rehearsal)',
  beige: 'var(--accent-quote)',
  dark: '#050505',
};

const REVENUE_CHART_PATTERN = [
  [false, false, false, true],
  [false, false, true, true],
  [false, true, true, true],
  [false, false, true, true],
  [false, true, true, true],
  [true, true, true, true],
];

const StatsDotGrid: React.FC<{ theme: DotGridTheme; filled?: number; isRevenue?: boolean }> = ({ 
  theme, filled = 0, isRevenue = false 
}) => {
  const themeColor = DOT_THEME_COLORS[theme];
  const totalDots = 24;
  const filledCount = Math.min(filled, totalDots);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const target = isRevenue ? totalDots : filledCount;
    if (target === 0) return;

    let current = 0;
    const interval = setInterval(() => {
      current++;
      setVisibleCount(current);
      if (current >= target) clearInterval(interval);
    }, 40);

    return () => clearInterval(interval);
  }, [filledCount, isRevenue]);

  if (isRevenue) {
    return (
      <div className="grid grid-cols-6 grid-rows-4 gap-1 w-full h-[72px]">
        {Array.from({ length: totalDots }).map((_, i) => {
          const col = i % 6;
          const row = Math.floor(i / 6);
          const isFilled = REVENUE_CHART_PATTERN[col][row];
          const dotIndex = col * 4 + row;
          const isVisible = dotIndex < visibleCount;
          return (
            <div
              key={i}
              className="rounded-[10px] transition-colors duration-200"
              style={{ 
                backgroundColor: isFilled && isVisible ? themeColor : 'var(--muted)',
                opacity: isVisible ? 1 : 0.4,
                transition: 'background-color 0.2s, opacity 0.3s',
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-6 grid-rows-4 gap-1 w-full h-[72px]">
      {Array.from({ length: totalDots }).map((_, i) => {
        const isActive = i < filledCount;
        const isVisible = i < visibleCount;
        return (
          <div
            key={i}
            className="rounded-[10px]"
            style={{ 
              backgroundColor: isActive && isVisible ? themeColor : 'var(--muted)',
              opacity: isVisible || !isActive ? 1 : 0.4,
              transition: 'background-color 0.15s, opacity 0.2s',
            }}
          />
        );
      })}
    </div>
  );
};

// --- Pixel Art Grid for Action Center (7×5 pattern grid) ---

type GridCell = {
  c: number;
  r: number;
  cs?: number;
  rs?: number;
  d: boolean;
};

const ACTION_PATTERNS: Record<string, GridCell[]> = {
  'Setlist & Repertoire': [
    { c:1, r:1, cs:3, d:true }, { c:1, r:2, d:true }, { c:1, r:3, cs:3, d:true },
    { c:3, r:4, d:true }, { c:1, r:5, cs:3, d:true }, { c:5, r:1, cs:3, d:true },
    { c:5, r:2, d:true }, { c:7, r:2, d:true }, { c:5, r:3, cs:3, d:true },
    { c:5, r:4, rs:2, d:true }, { c:6, r:4, d:true }, { c:7, r:5, d:true },
    { c:2, r:2, d:false }, { c:3, r:2, d:false }, { c:1, r:4, d:false },
    { c:2, r:4, d:false }, { c:4, r:1, d:false }, { c:4, r:2, d:false },
    { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    { c:6, r:2, d:false }, { c:7, r:4, d:false }, { c:6, r:5, d:false },
  ],
  'Band Members': [
    { c:1, r:1, cs:3, d:true }, { c:1, r:3, cs:3, d:true }, { c:1, r:5, cs:3, d:true },
    { c:1, r:2, d:true }, { c:3, r:2, d:true }, { c:3, r:4, d:true },
    { c:1, r:4, d:true }, { c:5, r:1, rs:5, d:true }, { c:6, r:1, rs:2, d:true },
    { c:7, r:1, rs:5, d:true },
    { c:2, r:2, d:false }, { c:2, r:4, d:false }, { c:6, r:4, d:false },
    { c:6, r:5, d:false }, { c:4, r:1, d:false }, { c:4, r:2, d:false },
    { c:4, r:3, d:false }, { c:4, r:4, d:false }, { c:4, r:5, d:false },
    { c:6, r:3, d:false },
  ],
  'Inventory': [
    { c:1, r:1, cs:3, d:true }, { c:1, r:2, rs:3, d:true }, { c:1, r:5, cs:3, d:true },
    { c:5, r:1, rs:4, d:true }, { c:5, r:5, cs:3, d:true }, { c:3, r:4, d:true },
    { c:2, r:2, d:false }, { c:3, r:2, d:false }, { c:6, r:1, d:false },
    { c:7, r:1, d:false }, { c:6, r:4, d:false }, { c:4, r:1, d:false },
    { c:4, r:2, d:false }, { c:4, r:3, d:false }, { c:4, r:4, d:false },
    { c:4, r:5, d:false }, { c:3, r:3, d:false }, { c:2, r:3, d:false },
    { c:2, r:4, d:false }, { c:6, r:3, d:false }, { c:6, r:2, d:false },
    { c:7, r:2, d:false }, { c:7, r:3, d:false }, { c:7, r:4, d:false },
  ],
  'Task Templates': [
    { c:1, r:1, cs:3, d:true }, { c:2, r:2, rs:4, d:true }, { c:5, r:1, cs:3, d:true },
    { c:6, r:2, rs:4, d:true },
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false },
    { c:4, r:4, d:false }, { c:4, r:5, d:false }, { c:1, r:5, d:false },
    { c:1, r:2, d:false }, { c:3, r:2, d:false }, { c:5, r:5, d:false },
    { c:7, r:2, d:false }, { c:7, r:3, d:false }, { c:7, r:4, d:false },
    { c:3, r:3, d:false }, { c:1, r:4, d:false }, { c:1, r:3, d:false },
    { c:3, r:4, d:false }, { c:3, r:5, d:false }, { c:5, r:2, d:false },
    { c:5, r:3, d:false }, { c:5, r:4, d:false }, { c:7, r:5, d:false },
  ],
  'Contracts & Riders': [
    { c:1, r:1, cs:3, d:true }, { c:1, r:2, rs:3, d:true }, { c:5, r:1, cs:3, d:true },
    { c:5, r:2, d:true }, { c:7, r:2, d:true }, { c:5, r:3, cs:3, d:true },
    { c:5, r:4, rs:2, d:true }, { c:7, r:5, d:true }, { c:1, r:5, cs:3, d:true },
    { c:6, r:4, d:true },
    { c:4, r:1, d:false }, { c:4, r:2, d:false }, { c:4, r:3, d:false },
    { c:4, r:4, d:false }, { c:4, r:5, d:false }, { c:2, r:2, d:false },
    { c:3, r:2, d:false }, { c:7, r:4, d:false }, { c:3, r:3, d:false },
    { c:2, r:4, d:false }, { c:2, r:3, d:false }, { c:3, r:4, d:false },
    { c:6, r:2, d:false }, { c:6, r:5, d:false },
  ],
};

const PixelArtGrid: React.FC<{ pattern: GridCell[] }> = ({ pattern }) => (
  <div
    className="grid gap-1 w-[100px] h-[91px]"
    style={{ gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(5, 1fr)' }}
  >
    {pattern.map((cell, i) => (
      <div
        key={i}
        className="rounded-[10px]"
        style={{
          gridColumn: cell.cs ? `${cell.c} / span ${cell.cs}` : cell.c,
          gridRow: cell.rs ? `${cell.r} / span ${cell.rs}` : cell.r,
          backgroundColor: cell.d ? 'var(--muted-fg)' : 'var(--muted)',
        }}
      />
    ))}
  </div>
);

// --- Action Center Item ---

const ACTION_LABELS: Record<string, [string, string]> = {
  'Setlist & Repertoire': ['SETLIST &', 'REPERTOIRE'],
  'Band Members': ['BAND', 'MEMBERS'],
  'Inventory': ['GEAR', 'LIST'],
  'Task Templates': ['TASK', 'TEMPLATES'],
  'Contracts & Riders': ['CONTRACTS', '& RIDERS'],
};

const ActionCenterItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
  const pattern = ACTION_PATTERNS[label];
  const lines = ACTION_LABELS[label] || [label.toUpperCase(), ''];

  if (!pattern) return null;

  return (
    <button onClick={onClick} className="flex flex-col gap-3 items-start shrink-0 active:opacity-70 transition-opacity">
      <div className="flex items-start justify-between w-full">
        <div className="flex flex-col leading-none text-left">
          <span className="text-xs font-bold text-foreground text-left">{lines[0]}</span>
          {lines[1] && <span className="text-xs font-bold text-foreground text-left">{lines[1]}</span>}
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-foreground" />
      </div>
      <PixelArtGrid pattern={pattern} />
    </button>
  );
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
      <motion.div variants={dashboardItemVariants} className="flex flex-col gap-10">
        {/* Row 1: Gigs Confirmed | Upcoming Rehearsal — visible to all */}
        <div className="flex gap-5">
          <div className="flex-1 flex flex-col gap-2 items-start text-left">
            <div className="flex flex-col w-full">
              <span className="text-xs font-bold text-foreground tracking-wide">GIGS CONFIRMED</span>
              <div className="h-[62px] overflow-hidden">
                <span className="text-[52px] font-bold leading-none text-foreground block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : confirmedCount}
                </span>
              </div>
            </div>
            <StatsDotGrid theme="lime" filled={confirmedCount} />
          </div>

          <div className="flex-1 flex flex-col gap-2 items-start text-left">
            <div className="flex flex-col w-full">
              <span className="text-xs font-bold text-foreground tracking-wide">UPCOMING REHEARSAL</span>
              <div className="h-[62px] overflow-hidden">
                <span className="text-[52px] font-bold leading-none text-foreground block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : rehearsalCount}
                </span>
              </div>
            </div>
            <StatsDotGrid theme="blue" filled={rehearsalCount} />
          </div>
        </div>

        {/* Row 2: Admin sees full business metrics / Member sees personal earnings */}
        <div className="flex gap-5">
          {isAdmin ? (
            <>
              {/* ADMIN: Quotes count */}
              <div className="flex-1 flex flex-col gap-2 items-start text-left">
                <div className="flex flex-col w-full">
                  <span className="text-xs font-bold text-foreground tracking-wide">QUOTES</span>
                  <span className="text-[52px] font-bold leading-none text-foreground">
                    {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : quotesCount}
                  </span>
                </div>
                <StatsDotGrid theme="beige" filled={quotesCount} />
              </div>

              {/* ADMIN: Total Revenue */}
              <div className="flex-1 flex flex-col gap-2 items-start text-left">
                <div className="flex flex-col w-full">
                  <span className="text-xs font-bold text-foreground tracking-wide">REVENUE</span>
                  <span className="text-[52px] font-bold leading-none text-foreground">
                    {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : formatRevenue(revenue)}
                  </span>
                </div>
                <StatsDotGrid theme="dark" filled={0} isRevenue={revenue > 0} />
              </div>
            </>
          ) : (
            <>
              {/* MEMBER: My Fee — confirmed fee per event */}
              <div className="flex-1 flex flex-col gap-2 items-start text-left">
                <div className="flex flex-col w-full">
                  <span className="text-xs font-bold text-foreground tracking-wide">MY FEE</span>
                  <span className="text-[52px] font-bold leading-none text-foreground">
                    {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : formatRevenue(memberStats?.confirmedFee || 0)}
                  </span>
                </div>
                <StatsDotGrid theme="beige" filled={(memberStats?.confirmedFee || 0) > 0 ? 6 : 0} />
              </div>

              {/* MEMBER: Total Personal Earnings YTD */}
              <div className="flex-1 flex flex-col gap-2 items-start text-left">
                <div className="flex flex-col w-full">
                  <span className="text-xs font-bold text-foreground tracking-wide">MY EARNINGS</span>
                  <span className="text-[52px] font-bold leading-none text-foreground">
                    {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : formatRevenue(memberStats?.totalEarned || 0)}
                  </span>
                </div>
                <StatsDotGrid theme="dark" filled={0} isRevenue={(memberStats?.totalEarned || 0) > 0} />
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* --- Snappy Next Event Block --- */}
      {(() => {
        const nextEvent = dashboardData?.upcomingEvents?.[0];
        const isRehearsal = nextEvent?.event_type === 'rehearsal';
        return (
          <div className="flex flex-col gap-3 px-4 my-4 bg-transparent">
            {/* Dynamic Header Row */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col leading-none">
                <span className="text-[32px] font-bold leading-none text-foreground">
                  {nextEvent ? (isRehearsal ? "Next Rehearsal" : "Next Gig") : "Next Gig"}
                </span>
              </div>
              <button
                onClick={() => onViewChange?.('Events')}
                className="text-xs font-semibold hover:underline"
                style={{ color: 'var(--brand-accent)' }}
              >
                See all
              </button>
            </div>
            {/* Transparent Info Block */}
            {nextEvent ? (
              <div
                onClick={() => onViewChange?.('Events')}
                className="py-3 border-b flex flex-col gap-1.5 cursor-pointer bg-transparent hover:opacity-80 transition-opacity"
                style={{ borderColor: 'rgba(0,0,0,0.1)' }}
              >
                <div className="flex justify-between items-baseline">
                  <span className="text-base font-bold truncate max-w-[75%]" style={{ color: 'var(--foreground)' }}>
                    {nextEvent.title || "Untitled Event"}
                  </span>
                  <span className="text-[10px] font-black tracking-widest uppercase opacity-75" style={{ color: 'var(--brand-accent)' }}>
                    {nextEvent.event_type || "EVENT"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 text-xs opacity-70" style={{ color: 'var(--foreground)' }}>
                  {nextEvent.event_date && (
                    <div className="flex items-center gap-1">
                      <span>📅 {new Date(nextEvent.event_date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      {nextEvent.start_time && <span>• {nextEvent.start_time}</span>}
                    </div>
                  )}
                  {nextEvent.venue_name && (
                    <div className="flex items-center gap-1 truncate">
                      <span>📍 {nextEvent.venue_name}</span>
                    </div>
                  )}
                </div>
            </div>
            ) : (
              <div className="text-xs py-4 italic opacity-50" style={{ color: 'var(--foreground)' }}>
                No upcoming events scheduled
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
                <ActionCenterItem
                  key={action.id}
                  label={action.label}
                  onClick={() => onQuickAction?.(action.label)}
                />
              ))}
            </div>
          </div>

          {/* Bottom Row — Member-specific operational cards vs Admin business cards */}
          {isAdmin ? (
            <div className="flex gap-2.5">
              {/* ADMIN: Upcoming Gigs */}
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground tracking-wide">UPCOMING GIGS</span>
                  <span className="text-[42px] font-bold leading-tight text-foreground">
                    {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : confirmedCount}
                  </span>
                  <span className="text-xs font-bold text-foreground tracking-wide">CONFIRMED EVENTS SCHEDULED</span>
                </div>
                <button
                  onClick={() => onQuickAction?.('View Calendar')}
                  className="flex items-center justify-between p-2.5 rounded-[10px] bg-accent w-full active:scale-95 transition-transform"
                >
                  <span className="text-xs font-bold text-accent-foreground">VIEW CALENDAR</span>
                  <ArrowUpRight className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* ADMIN: Revenue Growing */}
              <div className="flex flex-col justify-between flex-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground tracking-wide">REVENUE GROWING</span>
                  <span className="text-[42px] font-bold leading-tight text-foreground">
                    {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : revenueChangeText}
                  </span>
                  <span className="text-xs font-bold text-foreground tracking-wide">VS LAST MONTH</span>
                </div>
                <button
                  onClick={() => onQuickAction?.('View Analytics')}
                  className="flex items-center justify-between p-2.5 rounded-[10px] bg-black w-full active:scale-95 transition-transform"
                >
                  <span className="text-xs font-bold text-accent">VIEW ANALYTICS</span>
                  <ArrowUpRight className="w-5 h-5 text-accent" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5">
              {/* MEMBER: Next Soundcheck / Load-In */}
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-foreground" />
                  <span className="text-xs font-bold text-foreground tracking-wide">NEXT SOUNDCHECK</span>
                </div>
                <span className="text-[28px] font-bold leading-tight text-foreground">
                  {confirmedCount > 0 ? '2h 15m' : '—'}
                </span>
                <span className="text-[11px] font-bold text-foreground/50 tracking-wide">
                  {confirmedCount > 0 ? 'BEFORE DOORS OPEN' : 'NO UPCOMING GIGS'}
                </span>
                {confirmedCount > 0 && (
                  <button
                    onClick={() => onQuickAction?.('View Calendar')}
                    className="flex items-center justify-between p-2.5 rounded-[10px] bg-accent w-full active:scale-95 transition-transform"
                  >
                    <span className="text-xs font-bold text-accent-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      LOAD-IN MAP
                    </span>
                    <ChevronRight className="w-4 h-4 text-foreground" />
                  </button>
                )}
              </div>

              {/* MEMBER: My Setlist Snapshot */}
              <div className="flex flex-col justify-between flex-1">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-foreground" />
                  <span className="text-xs font-bold text-foreground tracking-wide">MY SETLIST</span>
                </div>
                <span className="text-[28px] font-bold leading-tight text-foreground">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : '—'}
                </span>
                <span className="text-[11px] font-bold text-foreground/50 tracking-wide">
                  NEXT GIG SONGS
                </span>
                <button
                  onClick={() => onQuickAction?.('Setlist & Repertoire')}
                  className="flex items-center justify-between p-2.5 rounded-[10px] bg-black w-full active:scale-95 transition-transform"
                >
                  <span className="text-xs font-bold text-accent">VIEW SETLIST</span>
                  <ChevronRight className="w-4 h-4 text-accent" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
