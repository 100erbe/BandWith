import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, MapPin } from '@/app/components/icons';
import { Metric, DotText, SectionHeader, ActionTile, UpcomingRow, eventKindOf, PillButton, Card } from '@/app/components/bw';
import { cn } from '@/app/components/ui/utils';
import { HomeSkeleton } from '@/app/components/ui/HomeSkeleton';
import { dashboardContainerVariants, dashboardItemVariants } from '@/styles/motion';
import { QUICK_ACTIONS } from '@/app/data/metrics';
import { EventItem } from '@/app/data/events';
import { Band } from '@/app/data/bands';
import { ExpandedCardType } from '@/app/types';
import { useBand } from '@/lib/BandContext';
import { APP_COPY } from '@/app/constants/copy';
import { RehearsalPollCard } from '@/app/components/rehearsal/RehearsalPollCard';
import type { RehearsalPoll } from '@/lib/services/rehearsalPolls';
import { parseLocalDate } from '@/lib/dates';
import { useEventDrafts, type EventDraft } from '@/lib/wizardDrafts';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { openMaps } from '@/app/components/ui/MapsLink';
import { BandDeskMode, type DeskActionItem, type DeskGig } from '@/app/components/duo';

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
  rehearsalPolls?: RehearsalPoll[];
  onConvertProposal?: (poll: RehearsalPoll) => void;
  onPollUpdated?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  currentUserId?: string;
  /** Member's own fee per event id (event_members.fee). Empty for admins. */
  userFeeMap?: Record<string, number>;
  /** Opens the Identity hub "Band assets & workflows" (Quick actions ↗). */
  onOpenAllAssets?: () => void;
  // ── iPhone Duo · Laptop pose (BandDeskMode) ──
  /** Line-up per event id (AuthenticatedApp `eventMembersMap`): the poster's names and pending RSVPs. */
  eventMembersMap?: Record<string, { name: string; userId?: string; status?: string }[]>;
  /** Opens a rehearsal poll (vote sheet) from the Band desk's action items. */
  onOpenPoll?: (poll: RehearsalPoll) => void;
  onCreateGig?: () => void;
  onCreateRehearsal?: () => void;
  onCreateQuote?: () => void;
  onCreateTask?: () => void;
  /** Reopens an unfinished "New gig" saved as a draft. */
  onOpenEventDraft?: (draft: EventDraft) => void;
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

/** "20:00" style clock for row meta; accepts "20:00:00", "8:00 PM" or "8 PM". */
const formatClock24 = (timeStr?: string): string => {
  if (!timeStr) return '';
  const match = String(timeStr).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  const m = match[2] ?? '00';
  const ampm = match[3]?.toUpperCase();
  if (!ampm && match[2] === undefined) return '';
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h > 23) return '';
  return `${String(h).padStart(2, '0')}:${m}`;
};

const toTitleCase = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/(?:^|\s|\/|-|\.)\S/g, (match) => match.toUpperCase());
};


/**
 * Logical rule for event location display in Upcoming Shows & Rehearsals:
 * The most important information shown to a performer is how far the gig is.
 *
 * Rule Hierarchy:
 * 1. Distance / Travel metric: If distance or travel time is available (calculated later or manually set),
 *    show distance first (with city context if present).
 * 2. City (Geographic Distance Context): If all venue info is being added (both venue and city are known),
 *    prioritize and show the CITY so members immediately know the destination city.
 * 3. Venue Name: If ONLY the venue is added (no city specified), show the VENUE.
 * 4. General fallback: Raw location string if neither city nor venue are explicitly parsed.
 */
const formatEventLocation = (event: any): string | null => {
  if (!event) return null;

  // 1. Distance / Travel time placeholder rule (for future distance calculation)
  const distance = (event.distance || event.travel_time || event.travelTime || '')?.toString().trim();

  // 2. Resolve city
  const city = (
    event.venue_city ||
    event.venueCity ||
    event.city ||
    (typeof event.location === 'string' && event.location.includes(',') ? event.location.split(',')[1].trim() : null)
  )?.toString().trim();

  // 3. Resolve venue
  const venue = (
    event.venue_name ||
    event.venueName ||
    (typeof event.location === 'string' && event.location !== 'TBD' ? event.location.split(',')[0].trim() : null)
  )?.toString().trim();

  const isCityValid = Boolean(city && city.toLowerCase() !== 'tbd');
  const isVenueValid = Boolean(venue && venue.toLowerCase() !== 'tbd');

  // Rule 1: How far the gig is (Distance / Travel time when available)
  if (distance) {
    if (isCityValid && city) {
      return `${distance} • ${toTitleCase(city)}`;
    }
    return distance;
  }

  // Rule 2: If all venue info is being added (both venue & city), or city is present -> shows city
  if (isCityValid && city) {
    return toTitleCase(city);
  }

  // Rule 3: If only venue is being added (no city) -> shows venue
  if (isVenueValid && venue) {
    return toTitleCase(venue);
  }

  // Fallback to raw location if not TBD
  const rawLocation = typeof event.location === 'string' ? event.location.trim() : null;
  if (rawLocation && rawLocation.toLowerCase() !== 'tbd') {
    return toTitleCase(rawLocation);
  }

  return null;
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
  rehearsalPolls = [],
  onConvertProposal,
  onPollUpdated,
  onShowToast,
  currentUserId,
  userFeeMap,
  onOpenAllAssets,
  eventMembersMap,
  onOpenPoll,
  onCreateGig,
  onCreateRehearsal,
  onCreateQuote,
  onCreateTask,
  onOpenEventDraft,
}) => {
  useCurrency(); // re-render money labels when the band currency changes
  // Use the band context for role, fall back to prop for backwards compatibility
  const { isAdmin: isAdminFromContext, selectedBand: contextBand } = useBand();
  const isAdmin = isAdminFromContext ?? _isAdminProp;
  // Unfinished wizards: gigs saved on this device, quotes saved as DRAFT.
  const eventDrafts = useEventDrafts(isAdmin && !isSolo ? currentUserId : null, contextBand?.id ?? null);



  // For admins: show all quick actions
  // For members: show only performance-relevant actions
  // PLG: Solo users have no band, and every quick action (setlist, members,
  // gear, templates, contracts) is band-scoped — the host ignores them in solo
  // mode — so no tiles are shown rather than dead ones.
  const filteredQuickActions = QUICK_ACTIONS.filter(action => {
    if (isSolo) return false;
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
      return `${sym()}${(value / 1000).toFixed(1)}k`;
    }
    return `${sym()}${value}`;
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

  // Filter strictly to upcoming confirmed gigs and rehearsals (max 3 in schedule)
  const upcomingGigsAndRehearsals = React.useMemo(() => {
    const raw = dashboardData?.upcomingEvents || [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Combine raw upcoming events and upcoming rehearsals
    const combined: any[] = [...raw];
    if (Array.isArray(upcomingRehearsals)) {
      upcomingRehearsals.forEach((reh: any) => {
        const rehId = reh.eventId || reh.id;
        const exists = combined.some((e: any) => (e.id && e.id === rehId) || (e.eventId && e.eventId === rehId));
        if (!exists) {
          combined.push(reh);
        }
      });
    }

    const filtered = combined.filter((e: any) => {
      const s = (e.status || '').toLowerCase();
      const type = (e.event_type || e.eventType || '').toLowerCase();
      const dateRaw = e.event_date || e.date;
      const d = dateRaw ? (dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw) : '';

      if (s === 'cancelled') return false;

      const isRehearsal = type === 'rehearsal' || s === 'rehearsal';
      if (isRehearsal) return true;

      const isConfirmedGig = (s === 'confirmed' || s === 'completed');
      const isQuoteOrDraft = s === 'quoted' || s === 'quote' || s === 'tentative' || s === 'draft' || s === 'pending';
      return isConfirmedGig && !isQuoteOrDraft && (!d || d >= todayStr);
    });

    // 1. Initial deduplication of identical database entries (e.g. duplicate title + date + time)
    const seenBase = new Set<string>();
    const uniqueBase: any[] = [];
    filtered.forEach((e: any) => {
      const rawDate = e.event_date || e.date || '';
      const normDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
      const normTitle = (e.title || '').trim().toLowerCase();
      const normTime = (e.start_time || e.time || '').trim().slice(0, 5);
      const dedupeKey = `${normTitle}::${normDate}::${normTime}`;
      if (!seenBase.has(dedupeKey)) {
        seenBase.add(dedupeKey);
        uniqueBase.push(e);
      }
    });

    // 2. Expand recurring rehearsals into individual upcoming events (e.g. weekly rehearsals)
    const expandedList: any[] = [];
    uniqueBase.forEach((e: any) => {
      const rawDate = e.event_date || e.date || '';
      const d = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
      const type = (e.event_type || e.eventType || '').toLowerCase();
      const s = (e.status || '').toLowerCase();
      const isRehearsal = type === 'rehearsal' || s === 'rehearsal';
      const isRecurring = Boolean(e.is_recurring || e.recurrence_rule || (e.recurrence && e.recurrence !== 'once'));

      // If base event date is today or future, add it
      if (d && d >= todayStr) {
        expandedList.push(e);
      }

      // If recurring rehearsal, generate its future weekly occurrences
      if (isRehearsal && isRecurring && d) {
        const rule = e.recurrence_rule || {};
        const freq = (rule.freq || rule.frequency || e.recurrence || 'weekly').toLowerCase();
        const [y, m, day] = d.split('-').map(Number);
        const until = rule.until ? new Date(rule.until) : new Date(now.getFullYear(), now.getMonth() + 4, 0);
        const maxCount = rule.count || 24;
        let cursor = new Date(y, m - 1, day, 12, 0, 0);
        let generated = 0;
        while (cursor <= until && generated < maxCount) {
          if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7 * (rule.interval || 1));
          else if (freq === 'biweekly') cursor.setDate(cursor.getDate() + 14);
          else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
          else break;
          if (cursor > until) break;
          const occDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
          if (occDate >= todayStr && occDate !== d) {
            expandedList.push({
              ...e,
              id: `${e.id || e.eventId}-occ-${occDate}`,
              eventId: e.eventId || e.id,
              event_date: occDate,
              date: occDate,
            });
          }
          generated++;
        }
      }
    });

    // 3. Final deduplication (ensures generated occurrences don't duplicate existing events)
    const seenFinal = new Set<string>();
    const finalEvents: any[] = [];
    expandedList.forEach((e: any) => {
      const rawDate = e.event_date || e.date || '';
      const normDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
      const normTitle = (e.title || '').trim().toLowerCase();
      const normTime = (e.start_time || e.time || '').trim().slice(0, 5);
      const dedupeKey = `${normTitle}::${normDate}::${normTime}`;
      if (!seenFinal.has(dedupeKey)) {
        seenFinal.add(dedupeKey);
        finalEvents.push(e);
      }
    });

    // 4. Sort chronologically: soonest date first; if same day, confirmed gig before rehearsal
    finalEvents.sort((a: any, b: any) => {
      const dateA = (a.event_date || a.date || '').replace(/T.*$/, '') || '9999-99-99';
      const dateB = (b.event_date || b.date || '').replace(/T.*$/, '') || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const isGigA = a.event_type !== 'rehearsal' && a.eventType !== 'rehearsal';
      const isGigB = b.event_type !== 'rehearsal' && b.eventType !== 'rehearsal';
      if (isGigA && !isGigB) return -1;
      if (!isGigA && isGigB) return 1;
      const timeA = a.start_time || a.time || '';
      const timeB = b.start_time || b.time || '';
      return timeA.localeCompare(timeB);
    });

    // Strictly upcoming 3 events
    return finalEvents.slice(0, 3);
  }, [dashboardData?.upcomingEvents, upcomingRehearsals]);

  const nextMemberGig = upcomingGigsAndRehearsals.find((e: any) => {
    const type = (e.event_type || e.eventType || '').toLowerCase();
    const s = (e.status || '').toLowerCase();
    return type !== 'rehearsal' && s !== 'rehearsal';
  });

  const revenueChangeText = revenueChange !== undefined && revenueChange !== 0
    ? `${revenueChange > 0 ? '+' : ''}${revenueChange}%`
    : '--';

  const activePolls = useMemo(() => {
    if (!rehearsalPolls || isSolo) return [];
    return rehearsalPolls.filter((p) => {
      if (p.status === 'polling') return true;
      if (p.status === 'proposed') {
        return isAdmin || p.created_by === currentUserId;
      }
      return false;
    });
  }, [rehearsalPolls, isAdmin, currentUserId, isSolo]);

  // ── iPhone Duo · Laptop pose: Band desk (renders nothing in other postures) ──
  const deskNextGig = useMemo<DeskGig | null>(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const upcoming = (dashboardData?.upcomingEvents || [])
      .filter((e: any) => {
        const d = String(e.event_date || e.date || '').slice(0, 10);
        return !!d && d >= todayStr && (e.status || '').toLowerCase() !== 'cancelled';
      })
      .sort((a: any, b: any) =>
        String(a.event_date || a.date).slice(0, 10).localeCompare(String(b.event_date || b.date).slice(0, 10)) ||
        String(a.start_time || a.time || '').localeCompare(String(b.start_time || b.time || '')),
      );
    const isRehearsal = (e: any) => (e.event_type || e.eventType || '').toLowerCase() === 'rehearsal';
    // The next confirmed gig; with none, the next rehearsal (Figma "Band desk":
    // the Display is never an empty grey page while something is planned).
    const gig =
      upcoming.find((e: any) => !isRehearsal(e) && ['confirmed', 'completed'].includes((e.status || '').toLowerCase())) ||
      upcoming.find(isRehearsal);
    if (!gig) return null;
    const id = String(gig.eventId || gig.id);
    const lineup = (eventMembersMap?.[id] || [])
      .filter((m) => m.status !== 'declined')
      .map((m) => m.name)
      .filter(Boolean);
    const fee = Number(gig.fee);
    return {
      id,
      kind: isRehearsal(gig) ? 'rehearsal' : 'gig',
      title: gig.title || APP_COPY.home.nextEvents.untitledEvent,
      date: String(gig.event_date || gig.date).slice(0, 10),
      venue: gig.venue_name || gig.venueName || (typeof gig.location === 'string' && gig.location !== 'TBD' ? gig.location : null) || null,
      city: gig.venue_city || gig.venueCity || null,
      loadIn: gig.load_in_time || gig.loadInTime || null,
      soundcheck: gig.soundcheck_time || gig.soundcheckTime || null,
      start: gig.start_time || gig.time || null,
      lineup,
      fee: Number.isFinite(fee) && fee > 0 ? fee : null,
    };
  }, [dashboardData?.upcomingEvents, eventMembersMap]);

  const deskActionItems = useMemo<DeskActionItem[]>(() => {
    const items: DeskActionItem[] = [];
    // Open polls you have not voted on yet; proposals waiting on an admin.
    for (const p of activePolls) {
      const voted = (p.options || []).some((o) => o.has_voted);
      if (p.status === 'polling' && voted) continue;
      items.push({
        id: `poll-${p.id}`,
        title: p.title || 'Rehearsal poll',
        detail: p.status === 'proposed' ? 'Rehearsal proposal · build a poll' : 'Rehearsal poll · vote on dates',
        kind: 'rehearsal',
        urgent: p.status === 'polling',
        onSelect: onOpenPoll ? () => onOpenPoll(p) : undefined,
      });
    }
    // Gigs waiting on your RSVP.
    if (currentUserId && eventMembersMap) {
      for (const e of dashboardData?.upcomingEvents || []) {
        const id = String(e.eventId || e.id || '');
        if (!id || id.includes('-occ-')) continue;
        const me = (eventMembersMap[id] || []).find((m) => m.userId === currentUserId);
        if (me?.status !== 'pending') continue;
        const raw = e.event_date || e.date;
        const d = raw ? parseLocalDate(raw) : null;
        items.push({
          id: `rsvp-${id}`,
          title: e.title || APP_COPY.home.nextEvents.untitledEvent,
          detail: ['RSVP', d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null]
            .filter(Boolean)
            .join(' · '),
          kind: (e.event_type || e.eventType) === 'rehearsal' ? 'rehearsal' : 'gig',
          urgent: true,
          onSelect: onSelectEvent ? () => onSelectEvent(id) : undefined,
        });
      }
    }
    return items;
  }, [activePolls, onOpenPoll, currentUserId, eventMembersMap, dashboardData?.upcomingEvents, onSelectEvent]);

  // Each create button shows only when the host passes its handler (role rules live there).
  const bandDesk = (
    <BandDeskMode
      nextGig={deskNextGig}
      isAdmin={!!isAdmin}
      actionItems={deskActionItems}
      loading={!!dashboardLoading && !deskNextGig}
      onOpenGig={deskNextGig?.id && onSelectEvent ? () => onSelectEvent(deskNextGig.id!) : undefined}
      onCreateGig={onCreateGig}
      onCreateRehearsal={onCreateRehearsal}
      onCreateQuote={onCreateQuote}
      onCreateTask={onCreateTask}
    />
  );

  if (dashboardLoading && !dashboardData?.eventStats && !dashboardData?.memberStats) {
    return (
      <div className={cn("flex flex-col gap-8 sm:gap-10 relative z-10", isHidden && "opacity-0 pointer-events-none")}>
        <HomeSkeleton />
        {bandDesk}
      </div>
    );
  }

  // ── Figma "Home" helpers ──────────────────────────────────────────────
  // Count metrics light one dot per item on the 4×12 meter.
  const countFill = (n: number) => n / 48;
  const revenueFill = revenue > 0 ? revenue / Math.max(revenue + quotesPipeline, revenue) : 0;
  const revenueDots = formatRevenue(revenue).replace('.0k', 'k');

  const gigsThisMonth = (() => {
    const now = new Date();
    return (dashboardData?.upcomingEvents || []).filter((e: any) => {
      const type = (e.event_type || e.eventType || '').toLowerCase();
      const s = (e.status || '').toLowerCase();
      if (type === 'rehearsal' || s === 'cancelled') return false;
      const raw = e.event_date || e.date;
      if (!raw) return false;
      const d = parseLocalDate(raw);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  })();

  const QUICK_LABELS: Record<string, string> = {
    'Setlist & Repertoire': 'Repertoire',
    'Band Members': 'Members',
    Inventory: 'Gear list',
    'Task Templates': 'To-do lists',
    'Contracts & Riders': 'Contracts',
  };

  const shortMoney = (value: number) => formatRevenue(value).replace('.0k', 'k');

  const isRehearsalEvent = (event: any): boolean => {
    const s = (event.status || '').toLowerCase();
    const type = (event.event_type || event.eventType || '').toLowerCase();
    return type === 'rehearsal' || s === 'rehearsal';
  };

  // Personal gigs (band_id null) read as "personal", same rule as EventsView.
  const upcomingKind = (event: any) =>
    !isRehearsalEvent(event) && !event.band_id ? 'personal' as const : eventKindOf(event);

  const venueOf = (event: any): string =>
    (event.venue_name || event.venueName || (typeof event.location === 'string' && event.location !== 'TBD' ? event.location.split(',')[0].trim() : '') || '').trim();

  /** The signed-in member's own fee for this event, if one is set. */
  const myFeeFor = (event: any): number | undefined => {
    if (!userFeeMap) return undefined;
    for (const id of [event.eventId, event.id]) {
      if (id == null) continue;
      const fee = Number(userFeeMap[String(id)]);
      if (fee > 0) return fee;
    }
    return undefined;
  };

  /** Personal gig fee: the user's own gig, so the event fee is theirs. */
  const personalFeeFor = (event: any): number | undefined => {
    const mine = myFeeFor(event);
    if (mine) return mine;
    const createdBy = event.created_by || event.createdBy;
    if (createdBy && currentUserId && createdBy !== currentUserId) return undefined;
    const fee = Number(event.fee);
    return fee > 0 ? fee : undefined;
  };

  const upcomingTime = (event: any): string | undefined => {
    const t = event.start_time || event.time;
    return t ? formatEventTime(t) || undefined : undefined;
  };

  const upcomingValue = (event: any): string | undefined => {
    if (isRehearsalEvent(event)) return upcomingTime(event);
    if (upcomingKind(event) === 'personal') {
      const fee = personalFeeFor(event);
      return fee ? shortMoney(fee) : upcomingTime(event);
    }
    if (isAdmin) {
      return event.fee != null && event.fee > 0 ? shortMoney(event.fee) : upcomingTime(event);
    }
    const fee = myFeeFor(event);
    return fee ? shortMoney(fee) : upcomingTime(event);
  };

  const upcomingMeta = (event: any): string | undefined => {
    const venue = venueOf(event);
    const where = formatEventLocation(event);
    const join = (parts: (string | null | undefined)[]) => {
      const list = parts.filter(Boolean) as string[];
      return list.length ? list.join(' · ') : undefined;
    };

    if (isRehearsalEvent(event)) {
      return join([venue || where, formatClock24(event.start_time || event.time)]);
    }
    if (upcomingKind(event) === 'personal') {
      return join([APP_COPY.home.nextEvents.soloGigMeta, where || venue]);
    }
    if (!isAdmin && myFeeFor(event)) {
      return join([APP_COPY.home.nextEvents.yourFeeMeta, venue || where]);
    }
    return join([venue, where && where.toLowerCase() !== venue.toLowerCase() ? where : '']);
  };

  return (
    <motion.div
      key={`dashboard-${selectedBand.id}`}
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className={cn(
        "flex flex-col gap-8 relative z-10 text-foreground",
        isHidden && "opacity-0 pointer-events-none"
      )}
    >
      {/* ═══ METRICS (2×2 dot meters) ═══ */}
      <motion.div variants={dashboardItemVariants} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-8 gap-y-8">
        <Metric
          label={APP_COPY.home.stats.confirmedGigs}
          value={dashboardLoading ? '-' : confirmedCount}
          fill={countFill(confirmedCount)}
          onClick={() => onFilterEvents ? onFilterEvents('GIGS') : onViewChange?.('Events')}
        />
        <Metric
          label={APP_COPY.home.stats.upcomingRehearsals}
          value={dashboardLoading ? '-' : rehearsalCount}
          fill={countFill(rehearsalCount)}
          onClick={() => onFilterEvents ? onFilterEvents('REHEARSALS') : onViewChange?.('Events')}
        />
        {isAdmin ? (
          <>
            <Metric
              label={APP_COPY.home.stats.activeQuotes}
              value={dashboardLoading ? '-' : quotesCount}
              fill={countFill(quotesCount)}
              onClick={() => setExpandedCard('quotes')}
            />
            <Metric
              label={APP_COPY.home.stats.revenue}
              value={dashboardLoading ? '-' : revenueDots}
              fill={revenueFill}
              onClick={() => setExpandedCard('finance')}
            />
          </>
        ) : (
          <>
            <Metric
              label={APP_COPY.home.stats.upcomingPay}
              value={dashboardLoading ? '-' : formatRevenue(memberStats?.confirmedFee || 0).replace('.0k', 'k')}
              fill={(memberStats?.confirmedFee || 0) / Math.max((memberStats?.confirmedFee || 0) + (memberStats?.pendingFee || 0), 1)}
            />
            <Metric
              label={APP_COPY.home.stats.totalEarned}
              value={dashboardLoading ? '-' : formatRevenue(memberStats?.totalEarned || 0).replace('.0k', 'k')}
              fill={(memberStats?.totalEarned || 0) > 0 ? 1 : 0}
            />
          </>
        )}
      </motion.div>

      {/* ═══ ACTION CENTER (rehearsal polls & proposals) ═══ */}
      {activePolls.length > 0 && (
        <motion.div variants={dashboardItemVariants} className="flex flex-col gap-8">
          <h2 className="bw-display-lg max-w-[300px]">Action center</h2>
          {isAdmin && (
            <span className="bw-label-md text-muted-foreground">
              Rehearsal scheduling ({activePolls.length})
            </span>
          )}
          <div className="flex flex-col gap-3">
            {activePolls.map((poll: RehearsalPoll) => (
              <RehearsalPollCard
                key={poll.id}
                poll={poll}
                currentUserId={currentUserId || ''}
                isAdmin={!!isAdmin}
                onConvertProposal={onConvertProposal}
                onPollUpdated={onPollUpdated}
                onShowToast={onShowToast}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ NEXT SOUNDCHECK + MY SETLIST (member) ═══ */}
      {!isAdmin && !isSolo && (
        <motion.div variants={dashboardItemVariants} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          {(() => {
            const raw = nextMemberGig?.soundcheck_time || nextMemberGig?.load_in_time || '';
            const m = String(raw).match(/^(\d{1,2}):(\d{2})/);
            let value = '--';
            let suffix = '';
            if (m) {
              let h = parseInt(m[1], 10);
              suffix = h >= 12 ? 'PM' : 'AM';
              h = h % 12 || 12;
              value = `${h}:${m[2]}`;
            }
            const mapQuery = [nextMemberGig?.venue_address, nextMemberGig?.venue_name, nextMemberGig?.venue_city]
              .filter(Boolean)
              .join(', ');
            const openLoadIn = () => {
              if (mapQuery) {
                openMaps(mapQuery);
              } else if (nextMemberGig && onSelectEvent) {
                onSelectEvent(nextMemberGig.eventId || nextMemberGig.id);
              } else {
                onViewChange?.('Events');
              }
            };
            return (
              <div className="rounded-[24px] p-4 flex flex-col gap-2 min-w-0 bg-accent text-accent-foreground">
                <span className="bw-label-md truncate">{APP_COPY.home.operations.nextSoundcheck}</span>
                <span className="flex items-end gap-1.5">
                  <DotText text={value} size={24} label={`${value}${suffix ? ` ${suffix}` : ''}`} />
                  {suffix && <span className="bw-body-lg leading-none">{suffix}</span>}
                </span>
                <span className="bw-label-sm truncate">
                  {nextMemberGig?.start_time
                    ? `${APP_COPY.home.operations.doorsAt} ${formatEventTime(nextMemberGig.start_time)}`
                    : (confirmedCount > 0 ? APP_COPY.home.operations.checkEventDetails : APP_COPY.home.operations.noUpcomingGigs)}
                </span>
                <PillButton
                  size="sm"
                  variant="dark"
                  fullWidth={false}
                  className="self-start mt-auto"
                  icon={<MapPin className="w-4 h-4" />}
                  onClick={openLoadIn}
                  disabled={!nextMemberGig}
                >
                  Load-in map
                </PillButton>
              </div>
            );
          })()}
          {(() => {
            const songCount: number | undefined =
              nextMemberGig?.setlist_song_count ?? nextMemberGig?.song_count ?? (Array.isArray(nextMemberGig?.setlist) ? nextMemberGig.setlist.length : undefined);
            return (
              <div className="rounded-[24px] p-4 flex flex-col gap-2 min-w-0 bg-card text-card-foreground">
                <span className="bw-label-md truncate">My setlist</span>
                <DotText text={songCount != null ? String(songCount) : '--'} size={24} label={songCount != null ? `${songCount} songs` : 'No song count'} />
                <span className="bw-label-sm text-muted-foreground truncate">
                  {songCount != null ? 'Next gig songs' : nextMemberGig?.setlist_id ? 'Setlist linked' : 'No setlist yet'}
                </span>
                <PillButton
                  size="sm"
                  variant="outline"
                  fullWidth={false}
                  className="self-start mt-auto"
                  onClick={() => onQuickAction?.('Setlist & Repertoire')}
                >
                  {APP_COPY.home.operations.viewSetlist}
                </PillButton>
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* ═══ UPCOMING ═══ */}
      <motion.div variants={dashboardItemVariants} className="flex flex-col gap-8">
        <SectionHeader title="Upcoming" onSeeAll={() => onViewChange?.('Events')} />
        {upcomingGigsAndRehearsals.length === 0 ? (
          <Card className="gap-1">
            <span className="bw-h3">{APP_COPY.home.nextEvents.noUpcomingEvents}</span>
            <span className="bw-body-sm text-muted-foreground">
              {isAdmin ? APP_COPY.home.nextEvents.adminEmptyHelper : APP_COPY.home.nextEvents.memberEmptyHelper}
            </span>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {upcomingGigsAndRehearsals.map((event: any, index: number) => {
              const kind = upcomingKind(event);
              const rawDate = event.event_date || event.date;
              const d = rawDate ? parseLocalDate(rawDate) : null;
              const valid = d && !isNaN(d.getTime());
              return (
                <UpcomingRow
                  key={event.id || event.eventId || index}
                  kind={kind}
                  typeLabel={kind === 'rehearsal' ? 'Rehearsal' : kind === 'quote' ? 'Quote' : kind === 'personal' ? 'Personal' : 'Gig'}
                  title={event.title || APP_COPY.home.nextEvents.untitledEvent}
                  meta={upcomingMeta(event)}
                  day={valid ? d!.getDate() : '–'}
                  month={valid ? d!.toLocaleDateString('en-US', { month: 'short' }) : APP_COPY.home.nextEvents.tbd}
                  value={upcomingValue(event)}
                  onClick={() => {
                    if (onSelectEvent && (event.id || event.eventId)) {
                      onSelectEvent(event.eventId || event.id);
                    } else {
                      onViewChange?.('Events');
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ═══ DRAFTS (unfinished gigs and quotes, desaturated) ═══ */}
      {(() => {
        const quoteDrafts = isAdmin
          ? (dashboardData?.recentQuotes || []).filter((q: any) => String(q?.status || '').toLowerCase() === 'draft')
          : [];
        if (eventDrafts.length === 0 && quoteDrafts.length === 0) return null;
        const tile = (raw?: string) => {
          const d = raw ? parseLocalDate(raw) : null;
          const ok = d && !isNaN(d.getTime());
          return {
            day: ok ? d!.getDate() : '–',
            month: ok ? d!.toLocaleDateString('en-US', { month: 'short' }) : APP_COPY.home.nextEvents.tbd,
          };
        };
        const saved = (iso: string) => {
          const d = new Date(iso);
          return isNaN(d.getTime())
            ? 'Draft'
            : `Draft · saved ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
        };
        return (
          <motion.div variants={dashboardItemVariants} className="flex flex-col gap-8">
            <SectionHeader title="Drafts" />
            <div className="flex flex-col gap-4 grayscale opacity-60">
              {eventDrafts.map((d) => (
                <UpcomingRow
                  key={d.id}
                  kind="gig"
                  typeLabel="Gig · Draft"
                  title={d.title || 'New gig'}
                  meta={[saved(d.savedAt), d.venue].filter(Boolean).join(' · ')}
                  {...tile(d.date)}
                  onClick={() => onOpenEventDraft?.(d)}
                />
              ))}
              {quoteDrafts.map((q: any) => (
                <UpcomingRow
                  key={q.id}
                  kind="quote"
                  typeLabel="Quote · Draft"
                  title={q.event_name || q.client_name || 'New quote'}
                  meta={[q.quote_number, q.client_name].filter(Boolean).join(' · ') || 'Draft'}
                  {...tile(q.event_date)}
                  onClick={() => setExpandedCard('quotes')}
                />
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* ═══ QUICK ACTIONS ═══ */}
      {filteredQuickActions.length > 0 && (
        <motion.div variants={dashboardItemVariants} className="flex flex-col gap-8">
          {/* Figma: ↗ only, no "See all" text — the label stays for screen readers. */}
          <SectionHeader
            title={APP_COPY.home.quickActions.title}
            onSeeAll={onOpenAllAssets}
            seeAllLabel={APP_COPY.home.quickActions.openAllAssets}
            className="[&_button>span]:sr-only"
          />
          <div
            className="grid gap-4 gap-y-6"
            style={{ gridTemplateColumns: `repeat(${Math.min(3, filteredQuickActions.length)}, minmax(0, 1fr))` }}
          >
            {filteredQuickActions.map((action) => (
              <ActionTile
                key={action.id}
                label={QUICK_LABELS[action.label] ?? action.label}
                onClick={() => onQuickAction?.(action.label)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══ GROWTH + SHORTCUTS (admin) ═══ */}
      {isAdmin && (
        <motion.div variants={dashboardItemVariants} className="flex flex-col gap-8">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-8">
            <Metric label="Gigs this month" value={gigsThisMonth} fill={countFill(gigsThisMonth)} />
            <Metric
              label="Revenue vs last month"
              value={revenueChangeText === '--' ? '0%' : revenueChangeText}
              fill={revenueChange ? Math.min(1, Math.abs(revenueChange) / 100) : 0}
            />
          </div>

          <div className="flex gap-3">
            <PillButton size="md" className="flex-1 min-w-0" onClick={() => onQuickAction?.('View Calendar')}>
              View calendar
              <ArrowUpRight className="w-4 h-4" />
            </PillButton>
            <PillButton size="md" variant="dark" className="flex-1 min-w-0" onClick={() => onQuickAction?.('View Analytics')}>
              {APP_COPY.home.operations.viewAnalytics}
            </PillButton>
          </div>
        </motion.div>
      )}

      {bandDesk}

      {/* Bottom clearance spacer ensuring last card cleanly clears floating navbar */}
      <div
        className="shrink-0 pointer-events-none"
        style={{ height: 'var(--content-bottom-clearance, 136px)' }}
        aria-hidden="true"
      />
    </motion.div>
  );
};
