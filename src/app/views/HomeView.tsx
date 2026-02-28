import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { dashboardContainerVariants, dashboardItemVariants } from '@/styles/motion';
import { QUICK_ACTIONS } from '@/app/data/metrics';
import { EventItem } from '@/app/data/events';
import { Band } from '@/app/data/bands';
import { ExpandedCardType } from '@/app/types';
import { getPermissions, type UserRole } from '@/lib/permissions';

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
  isAdmin?: boolean;
}

// --- Equalizer Dot Grid for Stats (6×4) ---

type DotGridTheme = 'lime' | 'blue' | 'beige' | 'dark';

const DOT_THEME_COLORS: Record<DotGridTheme, string> = {
  lime: '#D5FB46',
  blue: '#0147FF',
  beige: '#9A8878',
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
                backgroundColor: isFilled && isVisible ? themeColor : '#CDCACA',
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
              backgroundColor: isActive && isVisible ? themeColor : '#CDCACA',
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
          backgroundColor: cell.d ? '#737373' : '#CDCACA',
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
          <span className="text-xs font-bold text-black text-left">{lines[0]}</span>
          {lines[1] && <span className="text-xs font-bold text-black text-left">{lines[1]}</span>}
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-black" />
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
  isAdmin = true
}) => {
  const _userRole: UserRole = isAdmin ? 'admin' : 'member';
  const _permissions = getPermissions(_userRole);

  const filteredQuickActions = QUICK_ACTIONS.filter(action => {
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

  const revenue = dashboardData?.eventStats?.totalRevenue || 0;
  const confirmedCount = dashboardData?.eventStats?.confirmedEvents || 0;
  const quotesCount = dashboardData?.quoteStats?.totalQuotes || 0;
  const revenueChange = dashboardData?.eventStats?.revenueChange;
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
        {/* Row 1: Gigs Confirmed | Upcoming Rehearsal */}
        <div className="flex gap-5">
          <div className="flex-1 flex flex-col gap-2 items-start text-left">
            <div className="flex flex-col w-full">
              <span className="text-xs font-bold text-black tracking-wide">GIGS CONFIRMED</span>
              <div className="h-[62px] overflow-hidden">
                <span className="text-[52px] font-bold leading-none text-black block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : confirmedCount}
                </span>
              </div>
            </div>
            <StatsDotGrid theme="lime" filled={confirmedCount} />
          </div>

          <div className="flex-1 flex flex-col gap-2 items-start text-left">
            <div className="flex flex-col w-full">
              <span className="text-xs font-bold text-black tracking-wide">UPCOMING REHEARSAL</span>
              <div className="h-[62px] overflow-hidden">
                <span className="text-[52px] font-bold leading-none text-black block">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : rehearsalCount}
                </span>
              </div>
            </div>
            <StatsDotGrid theme="blue" filled={rehearsalCount} />
          </div>
        </div>

        {/* Row 2: Quotes | Revenue */}
        <div className="flex gap-5">
          {isAdmin ? (
            <div className="flex-1 flex flex-col gap-2 items-start text-left">
              <div className="flex flex-col w-full">
                <span className="text-xs font-bold text-black tracking-wide">QUOTES</span>
                <span className="text-[52px] font-bold leading-none text-black">
                  {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : quotesCount}
                </span>
              </div>
              <StatsDotGrid theme="beige" filled={quotesCount} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-2 items-start text-left">
              <div className="flex flex-col w-full">
                <span className="text-xs font-bold text-black tracking-wide">MY FEE</span>
                <span className="text-[52px] font-bold leading-none text-black">€--</span>
              </div>
              <StatsDotGrid theme="beige" filled={0} />
            </div>
          )}

          <div className="flex-1 flex flex-col gap-2 items-start text-left">
            <div className="flex flex-col w-full">
              <span className="text-xs font-bold text-black tracking-wide">REVENUE</span>
              <span className="text-[52px] font-bold leading-none text-black">
                {dashboardLoading ? <Loader2 className="w-8 h-8 animate-spin mt-4" /> : formatRevenue(revenue)}
              </span>
            </div>
            <StatsDotGrid theme="dark" filled={0} isRevenue={revenue > 0} />
          </div>
        </div>
      </motion.div>

      {/* ═══ ACTION CENTER ═══ */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col gap-10">
        <div className="flex flex-col">
          <span className="text-[32px] font-bold leading-none text-black">ACTION</span>
          <span className="text-[32px] font-bold leading-none text-black">CENTER</span>
        </div>

        {/* Scrollable Action Tiles */}
        <div className="flex flex-col gap-[60px]">
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

          {/* Bottom Stats Row */}
          <div className="flex gap-2.5">
            {/* Upcoming Gigs */}
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-black tracking-wide">UPCOMING GIGS</span>
                <span className="text-[42px] font-bold leading-tight text-black">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : confirmedCount}
                </span>
                <span className="text-xs font-bold text-black tracking-wide">CONFIRMED EVENTS SCHEDULED</span>
              </div>
              <button
                onClick={() => onQuickAction?.('View Calendar')}
                className="flex items-center justify-between p-2.5 rounded-[10px] bg-[#D5FB46] w-full active:scale-95 transition-transform"
              >
                <span className="text-xs font-bold text-black">VIEW CALENDAR</span>
                <ArrowUpRight className="w-5 h-5 text-black" />
              </button>
            </div>

            {/* Revenue Growing */}
            <div className="flex flex-col justify-between flex-1">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-black tracking-wide">REVENUE GROWING</span>
                <span className="text-[42px] font-bold leading-tight text-black">
                  {dashboardLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : revenueChangeText}
                </span>
                <span className="text-xs font-bold text-black tracking-wide">VS LAST MONTH</span>
              </div>
              <button
                onClick={() => onQuickAction?.('View Analytics')}
                className="flex items-center justify-between p-2.5 rounded-[10px] bg-black w-full active:scale-95 transition-transform"
              >
                <span className="text-xs font-bold text-[#D5FB46]">VIEW ANALYTICS</span>
                <ArrowUpRight className="w-5 h-5 text-[#D5FB46]" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
