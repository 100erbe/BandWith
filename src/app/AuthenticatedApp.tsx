import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, LogOut, Truck, Volume2, Loader2, MessageSquare, Music, ChevronLeft, Plus, CheckCircle2, AlertCircle, Info, X } from '@/app/components/icons';
import { cn } from "@/app/components/ui/utils";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

import { useAuth } from "@/lib/AuthContext";
import { useBand } from "@/lib/BandContext";
import { useScrollDirection } from "@/app/hooks/useScrollDirection";
import { syncSystemBarsAppearance } from "@/lib/systemBars";
import { supabase } from "@/lib/supabase";
import { getPermissions, type UserRole } from "@/lib/permissions";
import {
  useEvents,
  useUpcomingEvents,
  useNotifications,
  useQuotes,
  useDashboardData,
  useExpandedFinanceData,
  useExpandedEventsData,
  useExpandedQuotesData,
  useChats,
} from "@/app/hooks/useData";
import {
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
  notifyEventMembersCreated,
  notifyEventPendingConfirmations,
  notifyEventResponse,
} from "@/lib/services/notifications";
import {
  respondToEventInvite,
  getUserEventMembership,
  getEventMembers,
  inviteToEvent,
  createEvent,
  updateEvent,
  deletePersonalGig,
} from "@/lib/services/events";
import type { EventMember, Event } from "@/lib/services/events";
import { createSetlist } from "@/lib/services/songs";

import { USER } from "@/app/data/user";
import { EventItem, EventStatus } from "@/app/data/events";
import { ChatType, ChatFilterType, ChatItem } from "@/app/data/chats";
import { NotificationItem } from "@/app/data/notifications";
import type { Band } from "@/app/data/bands";
import type { BandWithMembers } from "@/lib/services/bands";
import { useOnlinePresence } from "@/lib/services/presence";

import { TabName, ExpandedCardType, CreateEventType, RehearsalViewMode } from "@/app/types";

import { Header } from "@/app/components/layout/Header";
import BottomNavigation from "@/app/components/layout/BottomNavigation";
import { IdentityHub } from "@/app/components/layout/IdentityHub";
import { SwitchBandPopup } from "@/app/components/layout/SwitchBandPopup";

import { HomeView } from "@/app/views/HomeView";
import { ChatView } from "@/app/views/ChatView";
import { EventsView } from "@/app/views/EventsView";

const BandMembersView = React.lazy(() => import("@/app/views/BandMembersView").then(m => ({ default: m.BandMembersView })));
const SetlistManagerView = React.lazy(() => import("@/app/views/SetlistManagerView").then(m => ({ default: m.SetlistManagerView })));
const SettingsView = React.lazy(() => import("@/app/views/SettingsView").then(m => ({ default: m.SettingsView })));
const AnalyticsView = React.lazy(() => import("@/app/views/AnalyticsView").then(m => ({ default: m.AnalyticsView })));
const InventoryView = React.lazy(() => import("@/app/views/InventoryView").then(m => ({ default: m.InventoryView })));
const ContractsView = React.lazy(() => import("@/app/views/ContractsView").then(m => ({ default: m.ContractsView })));
const PastEventsView = React.lazy(() => import("@/app/views/PastEventsView").then(m => ({ default: m.PastEventsView })));
const TaskTemplatesView = React.lazy(() => import("@/app/views/TaskTemplatesView").then(m => ({ default: m.TaskTemplatesView })));
const CreateEventModal = React.lazy(() => import("@/app/components/dashboard/CreateEventModal").then(m => ({ default: m.CreateEventModal })));
const RehearsalLiveView = React.lazy(() => import("@/app/components/rehearsal/RehearsalLiveView").then(m => ({ default: m.RehearsalLiveView })));
const RehearsalPostView = React.lazy(() => import("@/app/components/rehearsal/RehearsalPostView").then(m => ({ default: m.RehearsalPostView })));
const QuoteCreationWizard = React.lazy(() => import("@/app/components/quotes/QuoteCreationWizard").then(m => ({ default: m.QuoteCreationWizard })));
const BandPricingModal = React.lazy(() => import("@/app/components/quotes/BandPricingModal").then(m => ({ default: m.BandPricingModal })));

import { EventData } from "@/app/components/dashboard/EventCard";
import { EventDetail } from "@/app/components/dashboard/EventDetail";

import {
  FinanceExpanded,
  PendingExpanded,
  QuotesExpanded,
  ConfirmedExpanded,
  RehearsalExpanded,
  FeeExpanded,
  ExpandedCardWrapper,
} from "@/app/components/dashboard/expanded";

import { AdminGuidedTourModal } from "@/app/components/onboarding/AdminGuidedTourModal";
import { Quote } from "@/app/data/quotes";
import { createQuote as createQuoteDB } from "@/lib/services/quotes";

import { ChatDetailModal, NewChatModal } from "@/app/components/chat";
import { EditProfileModal, CreateBandModal } from "@/app/components/profile";
import { UpgradePricingSheet } from "@/app/components/modals/UpgradePricingSheet";
import { PersonalGigModal } from "@/app/components/modals/PersonalGigModal";
import { NotificationDetailModal } from "@/app/components/notifications/NotificationDetailModal";
import { EventRSVPSheet } from "@/app/components/notifications/EventRSVPSheet";
import { ProposeRehearsalModal } from "@/app/components/rehearsal/ProposeRehearsalModal";
import { RehearsalPollModal } from "@/app/components/rehearsal/RehearsalPollModal";
import { RehearsalPollVoteSheet } from "@/app/components/rehearsal/RehearsalPollVoteSheet";
import { UrgentNotificationPopup } from "@/app/components/notifications/UrgentNotificationPopup";
import { useRehearsalPolls } from "@/app/hooks/useData";
import type { RehearsalPoll } from "@/lib/services/rehearsalPolls";

import { useBodyScrollLock } from "@/app/hooks";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";

const mapEventStatus = (event: Event): EventStatus => {
  // event_type is the primary classifier
  if (event.event_type === "rehearsal") return "REHEARSAL";
  const s = event.status?.toLowerCase();
  if (s === "confirmed" || s === "completed") return "CONFIRMED";
  if (event.quote_id || (event.event_type as string) === "quote" || s === "tentative" || s === "quoted" || s === "quote") return "QUOTE";
  // Fall back to event status for legacy events
  if (s === "draft") return "DRAFT";
  if (s === "cancelled") return "DRAFT";
  return "CONFIRMED";
};

const eventToEventItem = (event: Event): EventItem => {
  const status = mapEventStatus(event);
  return {
    id: parseInt(event.id.replace(/-/g, "").slice(0, 8), 16) || Date.now(),
    eventId: event.id,
    title: event.title || "Untitled Event",
    status,
    date: event.event_date || new Date().toISOString().split("T")[0],
    time: event.start_time || "19:00",
    location: event.venue_name || event.venue_city || "TBD",
    price: event.fee?.toString() || "0",
    members: [],
    color:
      (status === "REHEARSAL") ? "bg-accent-rehearsal text-white"
        : (status === "QUOTE") ? "bg-accent-quote text-white"
        : (status === "DRAFT") ? "bg-black/20 text-foreground/60"
        : "bg-accent-gig text-accent-gig-foreground",
    notes: event.notes || undefined,
    createdBy: event.created_by || undefined,
    setlistId: event.setlist_id || undefined,
    clientName: event.client_name || undefined,
    venueAddress: event.venue_address || undefined,
    venueCity: event.venue_city || undefined,
    venueName: event.venue_name || undefined,
    distance: (event as any).distance || undefined,
    travelTime: (event as any).travel_time || (event as any).travelTime || undefined,
    eventType: event.event_type || undefined,
    loadInTime: event.load_in_time || undefined,
    soundcheckTime: event.soundcheck_time || undefined,
    endTime: event.end_time || undefined,
    quoteId: (event as any).quote_id || undefined,
    is_recurring: (event as any).is_recurring || false,
    recurrence_rule: (event as any).recurrence_rule || undefined,
  };
};

export default function AuthenticatedApp() {
  const { isAuthenticated, user, profile, userMode } = useAuth();
  const {
    selectedBand: realBand,
    bands: realBands,
    loading: bandsLoading,
    selectBand,
    refreshBands,
    isAdmin,
  } = useBand();

  const isAndroid = Capacitor.getPlatform() === "android";
  const isNative = Capacitor.isNativePlatform();

  const { initialize: initializePush, isSupported: pushSupported } =
    usePushNotifications();

  // Native plugin init — runs once when this component mounts (user is authenticated)
  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    const init = async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        if (!alive) return;
        // Sync system bars (both top status bar & bottom navigation bar) with the active theme
        const isDark = document.documentElement.classList.contains('dark');
        await syncSystemBarsAppearance(isDark ? 'dark' : 'light');
        if (Capacitor.getPlatform() === "ios") {
          const { StatusBar } = await import("@capacitor/status-bar");
          await StatusBar.setOverlaysWebView({ overlay: true });
        }
        try { await Keyboard.setAccessoryBarVisible({ isVisible: false }); } catch (_) {}
        try { await Keyboard.setScroll({ isDisabled: false }); } catch (_) {}

        document.addEventListener(
          "touchstart",
          (e) => {
            const t = e.target as HTMLElement;
            const a = document.activeElement as HTMLElement;
            if (
              a &&
              ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) &&
              !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)
            ) {
              Keyboard.hide().catch(() => {});
            }
          },
          { passive: true }
        );
      } catch (err) {
        console.log("Native plugin init:", err);
      }
    };
    init();
    return () => { alive = false; };
  }, [isNative]);

  // Push notifications
  useEffect(() => {
    if (isAuthenticated && pushSupported) {
      initializePush().catch(console.error);
    }
  }, [isAuthenticated, pushSupported, initializePush]);

  // PLG: Must be declared early for downstream memos
  const isSolo = userMode === 'solo';

  // Scroll direction for bottom nav label shrink
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingDown = useScrollDirection(scrollContainerRef);

  // Sticky header collapse state with robust 32px hysteresis deadband (collapses at >48px, expands at <16px)
  // This physically prevents any oscillation or flickering when stopped near the threshold
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const isHeaderScrolledRef = useRef(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const top = container.scrollTop;
        if (!isHeaderScrolledRef.current && top > 36) {
          isHeaderScrolledRef.current = true;
          setIsHeaderScrolled(true);
        } else if (isHeaderScrolledRef.current && top < 12) {
          isHeaderScrolledRef.current = false;
          setIsHeaderScrolled(false);
        }
        rafId = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Data hooks
  const { data: dashboardData, loading: dashboardLoading, refetch: refetchDashboard } = useDashboardData(realBand?.id || null, !isAdmin ? user?.id : null);
  const { data: financeData, loading: financeLoading } = useExpandedFinanceData(realBand?.id || null);
  const { events: confirmedEvents, loading: confirmedEventsLoading } = useExpandedEventsData(realBand?.id || null, ["confirmed"]);
  const { events: pendingEvents, loading: pendingEventsLoading } = useExpandedEventsData(realBand?.id || null, ["draft", "pending", "quoted"]);
  const { quotes: realQuotes, stats: quotesStats, loading: quotesLoading } = useExpandedQuotesData(realBand?.id || null);

  // Navigation
  const [activeTab, setActiveTab] = useState<TabName>("Home");
  useEffect(() => {
    isHeaderScrolledRef.current = false;
    setIsHeaderScrolled(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);
  const [isBandSwitcherOpen, setIsBandSwitcherOpen] = useState(false);
  const [isDayPickerOpen, setIsDayPickerOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<ExpandedCardType>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);

  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const [isControlDeckOpen, setIsControlDeckOpen] = useState(false);

  const [eventView, setEventView] = useState<"list" | "calendar">("list");
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [localEvents, setLocalEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [selectedEventMembership, setSelectedEventMembership] = useState<EventMember | null>(null);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [createEventType, setCreateEventType] = useState<CreateEventType>(null);
  const [editingEventData, setEditingEventData] = useState<EventData | null>(null);
  const [showPersonalGigModal, setShowPersonalGigModal] = useState(false);
  const [editingPersonalGig, setEditingPersonalGig] = useState<{
    id: string;
    title: string;
    eventDate: string;
    startTime?: string;
    endTime?: string;
    venueName?: string;
    fee?: number;
    notes?: string;
  } | null>(null);

  // Rehearsal Polls & Proposals
  const { polls: rehearsalPolls, refetch: refetchRehearsalPolls } = useRehearsalPolls(realBand?.id || null, user?.id || null);
  const [showProposeRehearsalModal, setShowProposeRehearsalModal] = useState(false);
  const [showRehearsalPollModal, setShowRehearsalPollModal] = useState(false);
  const [pollModalInitialProposal, setPollModalInitialProposal] = useState<RehearsalPoll | null>(null);
  const [saveToast, setSaveToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    minimal?: boolean;
    action?: {
      label: string;
      onClick: () => void | Promise<void>;
    };
    duration?: number;
  } | null>(null);
  useEffect(() => {
    if (!saveToast) return;
    const duration = saveToast.duration || (saveToast.action ? 8000 : 5000);
    const t = setTimeout(() => setSaveToast(null), duration);
    return () => clearTimeout(t);
  }, [saveToast]);

  const [chatFilter, setChatFilter] = useState<ChatFilterType>("all");
  const [chatSearch, setChatSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([]);

  // ═══ OPTIMISTIC UI: Track event IDs to hide instantly before DB refetch ═══
  const [optimisticallyHiddenEventIds, setOptimisticallyHiddenEventIds] = useState<string[]>([]);

  // ═══ OPTIMIZED: Single stable event subscription for all bands ═══
  // Always pass ALL band IDs to maintain one websocket + one global cache
  const allMyBandIds = React.useMemo(() => {
    return (realBands || []).map(b => b.id).filter(Boolean) as string[];
  }, [realBands]);
  
  const { events: masterEventsList, loading: eventsLoading, refetch: refetchEvents } = useEvents(allMyBandIds);
  
  // ═══ AUTO-CLEANUP: Deduplicate duplicate DB events ═══
  useEffect(() => {
    if (!masterEventsList || masterEventsList.length === 0 || !realBand?.id) return;

    const seenMap = new Map<string, string>();
    const duplicateIdsToDelete: string[] = [];

    masterEventsList.forEach(e => {
      if (e.band_id && e.band_id !== realBand.id) return;
      const title = (e.title || '').trim().toLowerCase();
      const date = (e.event_date || '').replace(/T.*$/, '');
      const time = (e.start_time || '').slice(0, 5);
      const key = `${title}::${date}::${time}`;

      if (seenMap.has(key)) {
        duplicateIdsToDelete.push(e.id);
      } else {
        seenMap.set(key, e.id);
      }
    });

    if (duplicateIdsToDelete.length > 0) {
      (async () => {
        try {
          for (const id of duplicateIdsToDelete) {
            await supabase.from('events').delete().eq('id', id);
          }
          if (refetchEvents) refetchEvents();
        } catch (err) {
          console.error('[Duplicate Auto-Sync]', err);
        }
      })();
    }
  }, [masterEventsList, realBand?.id, refetchEvents]);
  
  // ═══ LOCAL CLIENT-SIDE BAND PILL FILTER (instant, <1ms) ═══
  const [selectedBandPill, setSelectedBandPill] = useState<string>('all');
  const [urgentNotification, setUrgentNotification] = useState<import('@/lib/services/notifications').Notification | null>(null);
  const [rsvpNotification, setRsvpNotification] = useState<import('@/lib/services/notifications').Notification | null>(null);
  const [pollNotification, setPollNotification] = useState<import('@/lib/services/notifications').Notification | null>(null);
  const { notifications: realNotifications, refetch: refetchNotifications, setNotifications: setRealNotifications } = useNotifications({
    limit: 20,
    onNewEventInvite: (notif) => {
      if (notif.data?.creator_id !== user?.id) {
        setUrgentNotification(notif);
      }
    },
    onNewRehearsalPoll: (notif) => {
      setUrgentNotification(notif);
    },
  });

  // Check for initial unread event invite or rehearsal poll on mount (small non-intrusive pop up, prompt once per session)
  const hasPromptedInitialNotifs = useRef(false);
  useEffect(() => {
    if (!realNotifications?.length || hasPromptedInitialNotifs.current || rsvpNotification || pollNotification || urgentNotification) return;

    // Look for unread event invite (where user is not the creator)
    const unreadInvite = realNotifications.find(
      (n) => !n.read && n.type === 'event_invite' && n.data?.creator_id !== user?.id
    );
    if (unreadInvite) {
      hasPromptedInitialNotifs.current = true;
      setUrgentNotification(unreadInvite);
      return;
    }

    // Look for unread rehearsal poll
    const unreadPoll = realNotifications.find(
      (n) => !n.read && (n.type === 'rehearsal_poll' || n.type === 'rehearsal_proposal')
    );
    if (unreadPoll) {
      hasPromptedInitialNotifs.current = true;
      setUrgentNotification(unreadPoll);
    }
  }, [realNotifications, user?.id, rsvpNotification, pollNotification, urgentNotification]);

  const handleOpenUrgentNotification = useCallback(async (notif: import('@/lib/services/notifications').Notification) => {
    // 1. Immediately remove notification badge optimistically (zero delay)
    const targetEventId = notif.data?.event_id;
    const targetPollId = notif.data?.poll_id;
    
    setRealNotifications(prev => prev.map(n => {
      const match = n.id === notif.id || 
        (targetEventId && n.data?.event_id === targetEventId) || 
        (targetPollId && n.data?.poll_id === targetPollId);
      return match ? { ...n, read: true } : n;
    }));

    // 2. Mark as read on the backend for this notification and any related duplicates
    try {
      await markNotificationAsRead(notif.id);
      const related = realNotifications.filter(n => 
        n.id !== notif.id && !n.read && (
          (targetEventId && n.data?.event_id === targetEventId) || 
          (targetPollId && n.data?.poll_id === targetPollId)
        )
      );
      if (related.length > 0) {
        await Promise.all(related.map(r => markNotificationAsRead(r.id)));
      }
      refetchNotifications?.();
    } catch (e) {
      console.error('Failed to mark urgent notification read:', e);
    }

    // 3. Dismiss the small pop up
    setUrgentNotification(null);

    // 4. Open the corresponding interactive sheet
    if (notif.type === 'event_invite') {
      setRsvpNotification(notif);
    } else if (notif.type === 'rehearsal_poll' || notif.type === 'rehearsal_proposal') {
      setPollNotification(notif);
    }
  }, [realNotifications, refetchNotifications, setRealNotifications]);
  const { chats: realChats, loading: chatsLoading, refetch: refetchChats } = useChats();
  const onlineUserIds = useOnlinePresence(user?.id);

  const [eventMembersMap, setEventMembersMap] = useState<Record<string, { name: string; userId: string; fee?: number; status?: string }[]>>({});
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);

  // Filter confirmed events: admins see all, members only see events where they've been added
  const myConfirmedEvents = useMemo(() => {
    if (!user?.id) return confirmedEvents;
    return confirmedEvents.filter(e => {
      const members = eventMembersMap[e.id] || [];
      const myMembership = members.find(m => m.userId === user.id);
      if (!isAdmin) {
        return !!myMembership && myMembership.status !== 'declined';
      }
      return !myMembership || myMembership.status !== 'declined';
    });
  }, [confirmedEvents, eventMembersMap, user?.id, isAdmin]);

  useEffect(() => {
    if (!masterEventsList?.length) return;
    const fetchAllMembers = async () => {
      const eventIds = masterEventsList.map(e => e.id);
      const map: Record<string, { name: string; userId: string; fee?: number; status?: string }[]> = {};

      // Simple query WITHOUT profile join to avoid FK/schema issues
      const { data, error } = await supabase
        .from('event_members')
        .select('event_id, user_id, fee, status')
        .in('event_id', eventIds);

      if (error) {
        console.error('event_members query failed:', error.message);
        return; // Keep previous map rather than overwriting with empty
      }

      // Resolve names from band members already in memory
      const bandNameMap: Record<string, string> = {};
      realBand?.members?.forEach((m: any) => {
        if (m.user_id) bandNameMap[m.user_id] = m.profile?.full_name || m.profile?.email?.split('@')[0] || 'Member';
      });

      data?.forEach((em: any) => {
        if (!map[em.event_id]) map[em.event_id] = [];
        map[em.event_id].push({ name: bandNameMap[em.user_id] || 'Member', userId: em.user_id, fee: em.fee, status: em.status });
      });
      setEventMembersMap(map);
    };
    fetchAllMembers();
  }, [masterEventsList, membersRefreshKey, realBand?.members]);

  // Build band lookup for event mapping
  const bandLookup = useMemo(() => {
    const map: Record<string, string> = {};
    realBands?.forEach(b => { if (b.id) map[b.id] = b.name; });
    if (realBand?.id && realBand?.name) map[realBand.id] = realBand.name;
    return map;
  }, [realBands, realBand]);

  const events = useMemo(() => {
    if (masterEventsList && masterEventsList.length > 0) {
      let list = masterEventsList;
      // Regular members must not have access to quotes until converted to gigs
      // AND members only see gigs or rehearsals where they've been added by an admin
      if (!isAdmin) {
        list = list.filter(e => {
          if (!e.band_id && e.created_by === user?.id) return true;
          const s = e.status?.toLowerCase();
          const isQuote = (e.quote_id || (e.event_type as string) === 'quote' || s === 'tentative' || s === 'quoted' || s === 'quote') && s !== 'confirmed' && s !== 'completed';
          if (isQuote) return false;
          if (user?.id) {
            const members = eventMembersMap[e.id] || [];
            const myMembership = members.find(m => m.userId === user.id);
            if (!myMembership || myMembership.status === 'declined') return false;
          }
          return true;
        });
      }
      return list.map(e => {
        const item = eventToEventItem(e);
        const members = eventMembersMap[e.id] || [];
        if (members.length > 0) {
          item.members = members.map(m => {
            const parts = m.name.split(' ');
            return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
          });
          item.memberUserIds = members.map(m => m.userId);
        }
        item.band_id = e.band_id || undefined;
        item.band_name = e.band_id && bandLookup[e.band_id] ? bandLookup[e.band_id] : (!e.band_id ? 'Personal' : realBand?.name || undefined);
        return item;
      });
    }
    return [];
  }, [masterEventsList, eventMembersMap, isAdmin, user?.id, bandLookup, realBand?.name]);

  // ═══ INSTANT CLIENT-SIDE FILTERING (band pill + status + search + optimistic) ═══
  const visuallyFilteredEvents = useMemo(() => {
    let result = events;
    // Band pill filter
    if (selectedBandPill === 'personal') {
      result = result.filter(e => !e.band_id);
    } else if (selectedBandPill !== 'all') {
      result = result.filter(e => e.band_id === selectedBandPill);
    }
    // Optimistic UI: instantly strip events that should be visually hidden
    if (optimisticallyHiddenEventIds.length > 0) {
      result = result.filter(e => !optimisticallyHiddenEventIds.includes(e.eventId || ''));
    }
    // For members: strictly only include events where current user is added by admin and hasn't declined
    if (user?.id) {
      result = result.filter(e => {
        if (!e.band_id && e.createdBy === user.id) return true;
        if (!e.eventId) return true; // no UUID key, can't filter
        const members = eventMembersMap[e.eventId] || [];
        const myMembership = members.find(m => m.userId === user.id);
        if (!isAdmin) {
          return !!myMembership && myMembership.status !== 'declined';
        }
        return !myMembership || myMembership.status !== 'declined';
      });
    }
    // Double safety: regular members must never see unconverted quotes
    if (!isAdmin) {
      result = result.filter(e => (e.status as string) !== 'QUOTE' && (e.status as string) !== 'QUOTED' && e.eventType !== 'quote');
    }
    // Status filter
    result = result.filter((e) => {
      const s = e.status?.toUpperCase();
      let mf = eventFilter === "All" || eventFilter === "ALL";
      if (!mf) {
        if (eventFilter === "GIGS" || eventFilter === "Confirmed") mf = s === "CONFIRMED" || s === "COMPLETED";
        else if (eventFilter === "REHEARSALS" || eventFilter === "REHEARSAL" || eventFilter === "Rehearsal") mf = s === "REHEARSAL";
        else if (eventFilter === "QUOTES" || eventFilter === "QUOTE") mf = s === "QUOTE" || s === "QUOTED";
        else if (eventFilter === "DRAFTS" || eventFilter === "DRAFT") mf = s === "DRAFT" || s === "PENDING";
      }
      return mf;
    });
    // Search filter
    if (eventSearch) {
      const q = eventSearch.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.clientName || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, selectedBandPill, eventFilter, eventSearch, optimisticallyHiddenEventIds, eventMembersMap, user?.id]);

  const userFeeMap = useMemo(() => {
    if (isAdmin || !user?.id) return {};
    const map: Record<string, number> = {};
    Object.entries(eventMembersMap).forEach(([eventId, members]) => {
      const me = members.find(m => m.userId === user.id);
      if (me?.fee) map[eventId] = me.fee;
    });
    return map;
  }, [eventMembersMap, user?.id, isAdmin]);

  const eventsRef = useRef(events);
  eventsRef.current = events;
  const handleEventCardClickRef = useRef<(event: EventData) => void>(() => {});

  const navigateToEvent = useCallback(async (eventDbId: string) => {
    setActiveTab("Events");
    setTimeout(async () => {
      const ev = eventsRef.current.find(e => e.eventId === eventDbId);
      if (ev) {
        handleEventCardClickRef.current(ev);
      } else {
        await refetchEvents();
        setTimeout(() => {
          const evRetry = eventsRef.current.find(e => e.eventId === eventDbId);
          if (evRetry) handleEventCardClickRef.current(evRetry);
        }, 500);
      }
    }, 200);
  }, [refetchEvents]);

  // Push navigation - deep link to the relevant screen
  useEffect(() => {
    const handler = (ev: globalThis.Event) => {
      const d = (ev as CustomEvent).detail;
      if (d.screen === "chat" && d.chatId) {
        setActiveTab("Chat");
        setTimeout(() => {
          setSelectedChat({ id: Date.now(), uuid: d.chatId, type: "direct", name: "Chat", initials: "CH", lastMessage: "", time: "now", unread: 0, status: "received" });
        }, 100);
      } else if (d.screen === "event" && d.eventId) {
        navigateToEvent(d.eventId);
      } else if (d.screen === "event") {
        setActiveTab("Events");
      } else if (d.screen === "home") setActiveTab("Home");
    };
    window.addEventListener("push-navigate", handler);
    return () => window.removeEventListener("push-navigate", handler);
  }, [navigateToEvent]);

  const setEvents = (updater: typeof localEvents | ((prev: typeof localEvents) => typeof localEvents)) => {
    setLocalEvents(typeof updater === "function" ? updater : () => updater);
  };

  const notificationIdMap = useMemo(() => {
    const map = new Map<number, string>();
    realNotifications?.forEach((n) => {
      const numId = parseInt(n.id.replace(/-/g, "").slice(0, 8), 16) || Date.now();
      map.set(numId, n.id);
    });
    return map;
  }, [realNotifications]);

  const notifications = useMemo(() => {
    if (!realNotifications?.length) return [];
    const seen = new Set<string>();
    return realNotifications
      .filter((n) => {
        if (n.type.includes("chat")) return false;
        const pollId = (n.data as any)?.poll_id || '';
        const eventId = (n.data as any)?.event_id || '';
        const key = `${n.type}-${n.title}-${n.body}-${pollId || eventId || n.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((n) => {
        let uiType: "chat" | "event" | "finance" = "event";
        if (n.type.includes("quote") || n.type.includes("payment")) uiType = "finance";

        let actionType: "NAV_CHAT" | "NAV_EVENTS" | "NAV_EVENTS_CONFIRMED" | "NAV_FINANCE" = "NAV_EVENTS";
        if (uiType === "finance") actionType = "NAV_FINANCE";
        if (n.type === "event_confirmed") actionType = "NAV_EVENTS_CONFIRMED";

      const created = new Date(n.created_at);
      const diffMs = Date.now() - created.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      let timeStr = "now";
      if (diffDays > 0) timeStr = `${diffDays}d ago`;
      else if (diffHours > 0) timeStr = `${diffHours}h ago`;
      else if (diffMins > 0) timeStr = `${diffMins}m ago`;

      const chatId = (n.data as any)?.chat_id || (n.data as any)?.chatId;

      return {
        id: parseInt(n.id.replace(/-/g, "").slice(0, 8), 16) || Date.now(),
        type: uiType,
        title: n.title,
        message: n.body || "",
        time: timeStr,
        read: n.read,
        actionType,
        chatId,
      };
    }) as NotificationItem[];
  }, [realNotifications]);

  const setNotifications = setLocalNotifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const selectedBand: Band = useMemo(() => {
    // PLG: Solo mode — show a personal calendar placeholder
    if (isSolo) {
      return {
        id: 0,
        name: 'My Calendar',
        role: 'MEMBER',
        initials: 'P', // "Personal"
        members: 1,
        genre: 'Solo',
        plan: 'Free',
      } as Band;
    }
    if (realBand) {
      return {
        id: parseInt(realBand.id.replace(/-/g, "").slice(0, 8), 16) || 1,
        name: realBand.name,
        role: realBand.user_role === "admin" ? "ADMIN" : "MEMBER",
        initials: realBand.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        members: realBand.member_count,
        genre: "Rock",
        plan: realBand.plan === "pro" || realBand.plan === "enterprise" ? "Pro" : "Free",
      } as Band;
    }
    // Fallback: when no real band exists yet, create a placeholder from onboarding data
    return {
      id: 0,
      name: 'My Band',
      role: 'ADMIN',
      initials: 'MB',
      members: 1,
      genre: '',
      plan: 'Free',
    } as Band;
  }, [realBand, isSolo, user]);

  const setSelectedBand = (band: Band) => {
    const match = realBands.find((rb) => rb.name === band.name);
    if (match) selectBand(match.id);
  };

  // Rehearsal state
  const [rehearsalIndex, setRehearsalIndex] = useState(0);
  const [rehearsalViewMode, setRehearsalViewMode] = useState<RehearsalViewMode>("overview");
  const [isLive, setIsLive] = useState(false);

  const [showBandMembers, setShowBandMembers] = useState(false);
  const [showSetlistManager, setShowSetlistManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<"main" | "notifications" | "appearance" | "privacy" | "help" | "about" | "language">("main");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showContracts, setShowContracts] = useState(false);
  const [showTaskTemplates, setShowTaskTemplates] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [liveInterval, setLiveInterval] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCreateBand, setShowCreateBand] = useState(false);
  const [showUpgradePricing, setShowUpgradePricing] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingReturnTo, setPricingReturnTo] = useState<'settings' | 'control_deck' | 'identity_hub' | null>(null);
  const [showAdminTour, setShowAdminTour] = useState(false);

  // Auto-launch Admin Guided Tour for first-time admins
  useEffect(() => {
    if (isAdmin) {
      const hasSeenTour = localStorage.getItem('bandwith_admin_tour_seen');
      if (!hasSeenTour) {
        setShowAdminTour(true);
      }
    }
  }, [isAdmin]);

  // Tier-limit check before showing the create band modal
  const handleRequestCreateBand = useCallback(() => {
    const tier = profile?.sub_tier || 'free_member';

    // Count bands where the current user is admin
    const adminBandCount = realBands.filter((b) => b.user_role === 'admin').length;

    // Define limits per tier
    const limits: Record<string, number> = {
      free_member: 0,
      single_band: 1,
      multi_band: 5,
      unlimited: Infinity,
    };

    const limit = limits[tier] ?? 0;

    if (adminBandCount >= limit) {
      // Hit the ceiling — show upgrade pricing sheet instead
      setShowUpgradePricing(true);
    } else {
      setShowCreateBand(true);
    }
  }, [profile?.sub_tier, realBands]);

  const [entityCounts, setEntityCounts] = useState({ templates: 0, documents: 0, inventory: 0, repertoire: 0 });

  const [selectedNotification, setSelectedNotification] = useState<{
    id: string; type: string; title: string; body?: string;
    data?: Record<string, unknown>; band_id?: string; created_at: string; read: boolean;
  } | null>(null);

  const [selectedNotifications, setSelectedNotifications] = useState<Array<{
    id: string; type: string; title: string; body?: string;
    data?: Record<string, unknown>; band_id?: string; created_at: string; read: boolean;
  }>>([]);

  const isNotificationsOpen = !!selectedNotification || selectedNotifications.length > 0;

  const handleOpenNotifications = useCallback(() => {
    const seen = new Set<string>();
    const nonChatNotifs = (realNotifications || [])
      .filter((n) => !n.type.includes("chat"))
      .filter((n) => {
        const pollId = (n.data as any)?.poll_id || '';
        const eventId = (n.data as any)?.event_id || '';
        const key = `${n.type}-${n.title}-${n.body}-${pollId || eventId || n.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    setSelectedNotifications(nonChatNotifs);
    setSelectedNotification(null);
    if (unreadCount > 0) {
      markAllNotificationsAsRead().then(() => {
        refetchNotifications?.();
      });
    }
  }, [realNotifications, unreadCount, refetchNotifications]);

  const [rehearsalDetails, setRehearsalDetails] = useState<{ [key: number]: any }>({
    105: {
      setlist: [
        { id: "s1", title: "Giant Steps", key: "Eb", bpm: 280, duration: "4:30" },
        { id: "s2", title: "Nardis", key: "Em", bpm: 140, duration: "6:15" },
        { id: "s3", title: "So What", key: "Dm", bpm: 135, duration: "9:00" },
        { id: "s4", title: "Spain", key: "Bm", bpm: 110, duration: "5:45" },
      ],
      tasks: [
        { label: "Bring Chart for 'Spain'", assigned: "You", done: false },
        { label: "Confirm Drum Kit", assigned: "Marco", done: true },
        { label: "Send Setlist PDF", assigned: "Gianluca", done: true },
      ],
      timeline: [
        { time: "19:00", label: "In", icon: Truck },
        { time: "19:30", label: "Sound", icon: Volume2 },
        { time: "20:00", label: "Start", icon: Play, active: true },
        { time: "22:00", label: "End", icon: LogOut },
      ],
    },
  });

  // Computed values
  const notificationGroups = useMemo(() => {
    const unread = notifications.filter((n) => !n.read);
    const groups: { [key: string]: typeof unread } = {};
    unread.forEach((n) => { if (!groups[n.type]) groups[n.type] = []; groups[n.type].push(n); });
    return Object.entries(groups).map(([type, items]) => ({ type, items }));
  }, [notifications]);

  const convertedChats = useMemo(() => {
    if (!realChats?.length) return [];
    return realChats.map((chat) => {
      let type: "direct" | "band" | "event" = "direct";
      if (chat.type === "band") type = "band";
      if (chat.type === "event") type = "event";
      if (chat.type === "group") type = "band";

      const others = chat.participants.filter((p) => p.user_id !== user?.id);
      let displayName = "";
      let avatarUrl: string | undefined = undefined;
      if (type === "direct") {
        const otherWithProfile = others.find((p) => (p as any).profile?.full_name);
        displayName = otherWithProfile?.profile?.full_name || (chat.name && chat.name !== "New Chat" && chat.name !== "Chat" ? chat.name : (others[0] ? `User ${others[0].user_id.slice(0, 6)}` : "Direct Chat"));
        const otherWithAvatar = others.find((p) => (p as any).profile?.avatar_url);
        avatarUrl = (otherWithAvatar as any)?.profile?.avatar_url || undefined;
      } else if (type === "band") {
        displayName = (chat.name && chat.name !== "New Chat") ? chat.name : (realBand?.name || "Band Chat");
        avatarUrl = (chat as any).logo_url || (chat as any).avatar_url || realBand?.logo_url || undefined;
      } else if (type === "event") {
        displayName = (chat.name && chat.name !== "New Chat") ? chat.name : "Event Chat";
      }
      if (!displayName || displayName === "New Chat") {
        displayName = "Chat";
      }
      const initials = displayName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "C";

      const lastTime = chat.last_message?.created_at ? new Date(chat.last_message.created_at) : new Date(chat.created_at);
      const diffMs = Date.now() - lastTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeStr = "now";
      if (diffDays > 7) timeStr = lastTime.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      else if (diffDays > 1) timeStr = lastTime.toLocaleDateString("en-US", { weekday: "short" });
      else if (diffDays === 1) timeStr = "Yesterday";
      else if (diffHours > 0) timeStr = lastTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      else if (diffMins > 0) timeStr = `${diffMins}m`;

      const bandName = realBand?.name || "";
      let subtitle = "";
      if (type === "direct") subtitle = bandName;
      else if (type === "event") {
        const ed = chat.event_id ? "Event" : "";
        subtitle = bandName ? `${bandName}${ed ? " • " + ed : ""}` : ed;
      }

      let senderName = "";
      if ((type === "band" || type === "event") && chat.last_message?.sender) {
        senderName = chat.last_message.sender.id !== user?.id ? (chat.last_message.sender.full_name?.split(" ")[0] || "Someone") : "You";
      }

      let lastMessageDisplay = chat.last_message?.content || "No messages yet";
      if (senderName && chat.last_message?.content) lastMessageDisplay = `${senderName}: ${chat.last_message.content}`;

      let eventDateStr = "";
      let eventMonthStr = "";
      if (type === "event" && chat.created_at) {
        const d = new Date(chat.created_at);
        eventDateStr = d.getDate().toString();
        eventMonthStr = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
      }

      const isOnline = others.some((p) => {
        if (onlineUserIds.has(p.user_id)) return true;
        if (p.last_read_at) {
          const diff = Date.now() - new Date(p.last_read_at).getTime();
          return diff < 4 * 60 * 1000;
        }
        return false;
      });

      const isLastMessageMine = chat.last_message ? chat.last_message.sender_id === user?.id : false;
      const otherLastRead = others[0]?.last_read_at ? new Date(others[0].last_read_at) : null;
      const isLastMessageRead = isLastMessageMine && otherLastRead && chat.last_message?.created_at
        ? new Date(chat.last_message.created_at) <= otherLastRead
        : false;

      return {
        id: parseInt(chat.id.replace(/-/g, "").slice(0, 8), 16) || Date.now(),
        uuid: chat.id,
        type,
        name: displayName,
        initials,
        avatarUrl,
        lastMessage: lastMessageDisplay,
        time: timeStr,
        unread: chat.unread_count,
        status: chat.unread_count > 0 ? "received" : "read",
        members: chat.participants.length,
        subtitle,
        senderName,
        bandName,
        date: eventDateStr,
        month: eventMonthStr,
        lastMessageAt: lastTime,
        isOnline,
        isLastMessageMine,
        isLastMessageRead,
      };
    }) as ChatItem[];
  }, [realChats, realBand?.name, user?.id, onlineUserIds]);

  const filteredChats = useMemo(() => {
    return convertedChats
      .filter((c) => {
        const mt = chatFilter === "all" || c.type === chatFilter;
        const ms = !chatSearch.trim() || c.name.toLowerCase().includes(chatSearch.toLowerCase()) || c.lastMessage.toLowerCase().includes(chatSearch.toLowerCase()) || (c.subtitle?.toLowerCase().includes(chatSearch.toLowerCase()) ?? false);
        return mt && ms;
      })
      .sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1;
        if (a.unread === 0 && b.unread > 0) return 1;
        return (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0);
      });
  }, [convertedChats, chatFilter, chatSearch]);

  const chatUnreadCounts = useMemo(() => {
    const counts = { all: 0, direct: 0, band: 0, event: 0 };
    convertedChats.forEach((c) => {
      if (c.unread > 0) {
        counts.all += c.unread;
        if (c.type === "direct" || c.type === "band" || c.type === "event") {
          counts[c.type] += c.unread;
        }
      }
    });
    return counts;
  }, [convertedChats]);

  // ═══ GROUPED EVENTS (client-side, derived from visuallyFilteredEvents) ═══
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: EventItem[] } = {};
    visuallyFilteredEvents.forEach((e) => { const d = e.date || ''; if (!groups[d]) groups[d] = []; groups[d].push(e); });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visuallyFilteredEvents]);

  const upcomingRehearsals = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const rehearsals: EventItem[] = [];

    events.forEach((e) => {
      if (e.status !== "REHEARSAL") return;
      if (realBand?.id && e.band_id && e.band_id !== realBand.id) return;
      const normDate = (e.date || '').includes('T') ? e.date.split('T')[0] : (e.date || '');

      if (!normDate || normDate >= todayStr) {
        rehearsals.push(e);
      }

      if (e.is_recurring && e.recurrence_rule && normDate) {
        const rule = e.recurrence_rule;
        const freq = (rule.freq || rule.frequency || '').toLowerCase();
        if (freq) {
          const baseDate = new Date(normDate);
          const until = rule.until ? new Date(rule.until) : new Date(now.getFullYear(), now.getMonth() + 4, 0);
          const maxCount = rule.count || 24;
          let cursor = new Date(baseDate);
          let generated = 0;
          while (cursor <= until && generated < maxCount) {
            if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7 * (rule.interval || 1));
            else if (freq === 'biweekly') cursor.setDate(cursor.getDate() + 14);
            else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
            else break;
            if (cursor > until) break;
            const occDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            if (occDate >= todayStr && occDate !== normDate) {
              rehearsals.push({
                ...e,
                id: (e.id * 31 + generated) % 2147483647,
                eventId: e.eventId,
                date: occDate,
              });
            }
            generated++;
          }
        }
      }
    });

    // For members: only include rehearsals where current user is added by admin and hasn't declined
    let result = rehearsals;
    if (user?.id) {
      result = result.filter(e => {
        if (!e.eventId) return true;
        const members = eventMembersMap[e.eventId] || [];
        const myMembership = members.find(m => m.userId === user.id);
        if (!isAdmin) {
          return !!myMembership && myMembership.status !== 'declined';
        }
        return !myMembership || myMembership.status !== 'declined';
      });
    }

    // Deduplicate identical rehearsal instances
    const seenReh = new Set<string>();
    const uniqueRehearsals: EventItem[] = [];
    result.forEach((r) => {
      const normTitle = (r.title || '').trim().toLowerCase();
      const normDate = (r.date || '').replace(/T.*$/, '');
      const normTime = (r.time || '').trim().slice(0, 5);
      const key = `${normTitle}::${normDate}::${normTime}`;
      if (!seenReh.has(key)) {
        seenReh.add(key);
        uniqueRehearsals.push(r);
      }
    });

    return uniqueRehearsals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, eventMembersMap, user?.id, realBand?.id, isAdmin]);

  const currentRehearsal = upcomingRehearsals[rehearsalIndex] || upcomingRehearsals[0];
  const currentDetails = currentRehearsal ? rehearsalDetails[currentRehearsal.id] || rehearsalDetails[105] : null;

  const memoizedBandMembers = useMemo(() => {
    if (!realBand?.members) return [];
    return realBand.members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.profile?.full_name || m.profile?.email?.split("@")[0] || "Member",
      role: m.role || m.instrument || "Member",
      fee: String(m.default_fee || 0),
      initials: (m.profile?.full_name || m.profile?.email || "M").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));
  }, [realBand?.members]);

  // Effects
  useBodyScrollLock([!!expandedCard, isIdentityOpen, isControlDeckOpen]);

  useEffect(() => {
    if (!realBand?.id) return;
    const bandId = realBand.id;
    const fetchCounts = async () => {
      const [inv, docs, tpl, songs] = await Promise.all([
        supabase.from('inventory').select('id', { count: 'exact', head: true }).eq('band_id', bandId),
        supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('band_id', bandId),
        supabase.from('task_templates').select('id', { count: 'exact', head: true }).eq('band_id', bandId),
        supabase.from('songs').select('id', { count: 'exact', head: true }).eq('band_id', bandId),
      ]);
      setEntityCounts({
        inventory: inv.count ?? 0,
        documents: docs.count ?? 0,
        templates: tpl.count ?? 0,
        repertoire: songs.count ?? 0,
      });
    };
    fetchCounts();
  }, [realBand?.id]);

  useEffect(() => {
    if (rehearsalIndex >= upcomingRehearsals.length && upcomingRehearsals.length > 0) setRehearsalIndex(upcomingRehearsals.length - 1);
  }, [upcomingRehearsals.length, rehearsalIndex]);

  useEffect(() => {
    if (expandedCard === "rehearsal") {
      setRehearsalViewMode(upcomingRehearsals.length > 1 ? "index" : "overview");
    } else {
      if (isLive) toggleLive();
      setRehearsalViewMode("overview");
    }
  }, [expandedCard]);

  // Handlers
  const openIdentity = () => { setIsIdentityOpen(true); setIsControlDeckOpen(false); setIsBandSwitcherOpen(false); };
  const closeIdentity = () => { setIsIdentityOpen(false); if (activeTab === "More") setActiveTab("Home"); };

  const toggleIdentity = () => {
    setIsIdentityOpen(prev => !prev);
    setIsControlDeckOpen(false);
    setIsBandSwitcherOpen(false);
  };

  const toggleControlDeck = toggleIdentity;

  const closeMenus = () => {
    setIsControlDeckOpen(false);
    setIsIdentityOpen(false);
    if (activeTab === "More") setActiveTab("Home");
  };

  const handleGridNav = (item: string) => {
    setIsControlDeckOpen(false);
    if (activeTab === "More") setActiveTab("Home");
    if (item === "Home") setActiveTab("Home");
    if (item === "Messages") setActiveTab("Chat");
    if (item === "Finance") setExpandedCard("finance");
    if (item === "Events") setActiveTab("Events");
    if (item === "Settings") { setSettingsInitialSection("main"); setShowSettings(true); }
    if (item.startsWith("Settings:")) {
      setSettingsInitialSection(item.split(":")[1] as any);
      setShowSettings(true);
    }
    if (item === "Analytics") setShowAnalytics(true);
    if (item === "PricingSettings") {
      setPricingReturnTo('control_deck');
      setShowPricingModal(true);
    }
    if (item === "AdminTour") setShowAdminTour(true);
    if (item === "Quote" && isAdmin) { setCreateEventType("quote"); setIsCreateEventOpen(true); }
    if (item === "InviteMember") setShowBandMembers(true);
  };

  const handleNotificationClick = async (ids: number[], actionType: string) => {
    const clicked = notifications.filter((n) => ids.includes(n.id));
    const first = clicked[0];

    if (first && (first.type === "chat" || actionType === "NAV_CHAT")) {
      const realId = notificationIdMap.get(first.id);
      const realNotif = realNotifications?.find((rn) => rn.id === realId);
      const chatId = first.chatId || (realNotif?.data as any)?.chat_id || (realNotif?.data as any)?.chatId;

      if (chatId) {
        ids.forEach((nid) => { const rid = notificationIdMap.get(nid); if (rid) markNotificationAsRead(rid); });
        setTimeout(() => refetchNotifications?.(), 500);
        closeIdentity();
        setTimeout(() => {
          setActiveTab("Chat");
          const sn = (realNotif?.data as any)?.senderName || realNotif?.title?.replace("💬 ", "") || "Chat";
          setSelectedChat({ id: Date.now(), uuid: String(chatId), type: "direct", name: sn, initials: sn.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(), lastMessage: "", time: "now", unread: 0, status: "received" });
        }, 300);
        return;
      }
    }

    const realNotifForType = first ? realNotifications?.find((rn) => { const nid = parseInt(rn.id.replace(/-/g, "").slice(0, 8), 16) || 0; return nid === first.id; }) : null;
    const realType = realNotifForType?.type || first?.type;

    // 1. Direct Pop-up for Gig Invitation RSVP
    if (first && realType === 'event_invite') {
      const realId = notificationIdMap.get(first.id);
      const realNotif = (realId ? realNotifications?.find((rn) => rn.id === realId) : null) || realNotifForType;
      if (realNotif) {
        closeIdentity();
        markNotificationAsRead(realNotif.id).then(() => refetchNotifications?.());
        setRsvpNotification(realNotif);
        return;
      }
    }

    // 2. Direct Pop-up for Rehearsal Availability Poll / Proposal
    if (first && (realType === 'rehearsal_poll' || realType === 'rehearsal_proposal')) {
      const realId = notificationIdMap.get(first.id);
      const realNotif = (realId ? realNotifications?.find((rn) => rn.id === realId) : null) || realNotifForType;
      if (realNotif) {
        closeIdentity();
        markNotificationAsRead(realNotif.id).then(() => refetchNotifications?.());
        setPollNotification(realNotif);
        return;
      }
    }

    const detailTypes = ["invite_sent", "invite_received", "invite_accepted", "invite_declined", "member_joined", "member_left", "quote_received", "task_assigned", "payment_received", "payment_due"];

    if (first && realType && detailTypes.includes(realType)) {
      const realData = clicked.map((n) => { const rid = notificationIdMap.get(n.id); return realNotifications?.find((rn) => rn.id === rid); }).filter(Boolean).map((n) => ({ id: n!.id, type: n!.type, title: n!.title, body: n!.body, data: n!.data as Record<string, unknown>, band_id: n!.band_id, created_at: n!.created_at, read: n!.read }));
      if (realData.length > 0) {
        if (realData.length === 1) { setSelectedNotification(realData[0]); setSelectedNotifications([]); }
        else { setSelectedNotifications(realData); setSelectedNotification(null); }
        closeIdentity();
        return;
      }
    }

    // Don't auto-mark-as-read anymore — let the modal handle it explicitly
    closeIdentity();

    const realId = first ? notificationIdMap.get(first.id) : undefined;
    const realNotifNav = realId ? realNotifications?.find((rn) => rn.id === realId) : null;
    const navEventId = (realNotifNav?.data as any)?.event_id;
    if (navEventId && (actionType === "NAV_EVENTS" || actionType === "NAV_EVENTS_CONFIRMED")) {
      setTimeout(() => navigateToEvent(navEventId), 300);
      return;
    }

    setTimeout(() => {
      if (actionType === "NAV_CHAT") setActiveTab("Chat");
      else if (actionType === "NAV_EVENTS") { setActiveTab("Events"); setEventFilter("All"); }
      else if (actionType === "NAV_EVENTS_CONFIRMED") { setActiveTab("Events"); setEventFilter("Confirmed"); }
      else if (actionType === "NAV_FINANCE") setExpandedCard("finance");
    }, 300);
  };

  const handleMarkSingleAsRead = async (numericId: number) => {
    const rid = notificationIdMap.get(numericId);
    if (rid) { await markNotificationAsRead(rid); refetchNotifications?.(); }
  };

  const handleMarkGroupAsRead = async (numericIds: number[]) => {
    await Promise.all(numericIds.map((nid) => { const rid = notificationIdMap.get(nid); return rid ? markNotificationAsRead(rid) : Promise.resolve({ error: null }); }));
    refetchNotifications?.();
  };

  const handleCreateEvent = (type: CreateEventType) => {
    if (type === 'personal') {
      setEditingPersonalGig(null);
      setShowPersonalGigModal(true);
      return;
    }
    if (type === 'rehearsal' && !isAdmin) {
      setShowProposeRehearsalModal(true);
      return;
    }
    setCreateEventType(type);
    setIsCreateEventOpen(true);
  };

  const handleConvertProposal = (proposal: RehearsalPoll) => {
    setPollModalInitialProposal(proposal);
    setShowRehearsalPollModal(true);
  };

  const handleOpenPollBuilder = () => {
    setIsCreateEventOpen(false);
    setPollModalInitialProposal(null);
    setShowRehearsalPollModal(true);
  };

  const handleRehearsalClick = () => {
    setExpandedCard("rehearsal");
    setRehearsalViewMode(upcomingRehearsals.length > 1 ? "index" : "overview");
  };

  const handleRehearsalDecline = () => {
    setEvents((prev) => prev.filter((e) => e.id !== currentRehearsal?.id));
    if (upcomingRehearsals.length <= 1) setExpandedCard(null);
    else if (rehearsalIndex === upcomingRehearsals.length - 1) setRehearsalIndex((p) => p - 1);
  };

  const toggleLive = () => {
    if (!isLive) {
      setIsLive(true);
      setLiveInterval(setInterval(() => {}, 1000));
      setRehearsalViewMode("live");
    } else {
      if (liveInterval) clearInterval(liveInterval);
      setIsLive(false);
      setRehearsalViewMode("post");
    }
  };

  // Android hardware / gesture back button — hierarchical navigation
  const lastBackPressRef = useRef<number>(0);
  const backNavStateRef = useRef({
    urgentNotification,
    rsvpNotification,
    pollNotification,
    selectedNotifications,
    selectedNotification,
    showPersonalGigModal,
    showProposeRehearsalModal,
    showRehearsalPollModal,
    isCreateEventOpen,
    showNewChat,
    showEditProfile,
    showCreateBand,
    showUpgradePricing,
    showPricingModal,
    showAdminTour,
    isPlusMenuOpen,
    isDayPickerOpen,
    isBandSwitcherOpen,
    selectedChat,
    selectedEvent,
    expandedCard,
    rehearsalViewMode,
    isLive,
    showSettings,
    showBandMembers,
    showSetlistManager,
    showAnalytics,
    showInventory,
    showContracts,
    showTaskTemplates,
    showPastEvents,
    isControlDeckOpen,
    isIdentityOpen,
    activeTab,
  });

  // Keep ref synchronized with latest state on every render
  backNavStateRef.current = {
    urgentNotification,
    rsvpNotification,
    pollNotification,
    selectedNotifications,
    selectedNotification,
    showPersonalGigModal,
    showProposeRehearsalModal,
    showRehearsalPollModal,
    isCreateEventOpen,
    showNewChat,
    showEditProfile,
    showCreateBand,
    showUpgradePricing,
    showPricingModal,
    showAdminTour,
    isPlusMenuOpen,
    isDayPickerOpen,
    isBandSwitcherOpen,
    selectedChat,
    selectedEvent,
    expandedCard,
    rehearsalViewMode,
    isLive,
    showSettings,
    showBandMembers,
    showSetlistManager,
    showAnalytics,
    showInventory,
    showContracts,
    showTaskTemplates,
    showPastEvents,
    isControlDeckOpen,
    isIdentityOpen,
    activeTab,
  };

  useEffect(() => {
    if (!isNative) return;

    const handlerPromise = App.addListener('backButton', () => {
      const s = backNavStateRef.current;

      // 1. Transient Notifications & Popups
      if (s.urgentNotification) {
        setUrgentNotification(null);
        return;
      }
      if (s.rsvpNotification) {
        setRsvpNotification(null);
        return;
      }
      if (s.pollNotification) {
        setPollNotification(null);
        return;
      }
      if (s.selectedNotifications.length > 0) {
        setSelectedNotifications([]);
        return;
      }
      if (s.selectedNotification) {
        setSelectedNotification(null);
        return;
      }

      // 2. Modals, Sheets & Creation Flows
      if (s.showPersonalGigModal) {
        setShowPersonalGigModal(false);
        return;
      }
      if (s.showProposeRehearsalModal) {
        setShowProposeRehearsalModal(false);
        return;
      }
      if (s.showRehearsalPollModal) {
        setShowRehearsalPollModal(false);
        return;
      }
      if (s.isCreateEventOpen) {
        setIsCreateEventOpen(false);
        return;
      }
      if (s.showNewChat) {
        setShowNewChat(false);
        return;
      }
      if (s.showEditProfile) {
        setShowEditProfile(false);
        return;
      }
      if (s.showCreateBand) {
        setShowCreateBand(false);
        return;
      }
      if (s.showUpgradePricing || s.showPricingModal) {
        setShowUpgradePricing(false);
        setShowPricingModal(false);
        return;
      }
      if (s.showAdminTour) {
        setShowAdminTour(false);
        return;
      }
      if (s.isPlusMenuOpen) {
        setIsPlusMenuOpen(false);
        return;
      }
      if (s.isDayPickerOpen) {
        setIsDayPickerOpen(false);
        return;
      }
      if (s.isBandSwitcherOpen) {
        setIsBandSwitcherOpen(false);
        return;
      }

      // 3. Detail & Management Screens (Chat, Event, Expanded Cards, Tools)
      if (s.selectedChat) {
        setSelectedChat(null);
        refetchChats?.();
        return;
      }
      if (s.selectedEvent) {
        setSelectedEvent(null);
        setSelectedEventMembership(null);
        return;
      }
      if (s.expandedCard) {
        if (s.expandedCard === "rehearsal" && (s.rehearsalViewMode === "live" || s.rehearsalViewMode === "post")) {
          if (s.isLive) toggleLive();
          setRehearsalViewMode("overview");
        } else {
          setExpandedCard(null);
        }
        return;
      }
      if (s.showSettings) {
        setShowSettings(false);
        setSettingsInitialSection("main");
        return;
      }
      if (s.showBandMembers) {
        setShowBandMembers(false);
        return;
      }
      if (s.showSetlistManager) {
        setShowSetlistManager(false);
        return;
      }
      if (s.showAnalytics) {
        setShowAnalytics(false);
        return;
      }
      if (s.showInventory) {
        setShowInventory(false);
        return;
      }
      if (s.showContracts) {
        setShowContracts(false);
        return;
      }
      if (s.showTaskTemplates) {
        setShowTaskTemplates(false);
        return;
      }
      if (s.showPastEvents) {
        setShowPastEvents(false);
        return;
      }

      // 4. Slide-over Hubs & Panels
      if (s.isControlDeckOpen) {
        setIsControlDeckOpen(false);
        return;
      }
      if (s.isIdentityOpen) {
        closeIdentity();
        return;
      }

      // 5. Secondary Tabs -> Return to Home
      if (s.activeTab !== "Home") {
        setActiveTab("Home");
        return;
      }

      // 6. First Level (Home tab with no overlays) -> Double tap to exit
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        App.exitApp();
      } else {
        lastBackPressRef.current = now;
        setSaveToast({
          message: "Tap again to exit",
          type: "info",
          duration: 2000,
          minimal: true,
        });
      }
    });

    return () => {
      handlerPromise.then((h) => h.remove());
    };
  }, [isNative, closeIdentity, toggleLive, refetchChats]);

  const handleEventEdit = async () => {
    if (!selectedEvent) return;
    if (!selectedEvent.band_id) {
      setEditingPersonalGig({
        id: selectedEvent.eventId || String(selectedEvent.id),
        title: selectedEvent.title,
        eventDate: selectedEvent.date,
        startTime: selectedEvent.time,
        endTime: selectedEvent.endTime,
        venueName: (selectedEvent as any).venueName || selectedEvent.location,
        fee: selectedEvent.price ? parseFloat(selectedEvent.price.replace(/[^0-9.]/g, '')) : undefined,
        notes: selectedEvent.notes,
      });
      setSelectedEvent(null);
      setSelectedEventMembership(null);
      setShowPersonalGigModal(true);
      return;
    }

    const s = selectedEvent.status?.toUpperCase();
    let evType: CreateEventType;
    if (s === 'REHEARSAL') evType = 'rehearsal';
    else if (s === 'QUOTED' || s === 'QUOTE') evType = 'quote';
    else evType = 'gig';

    let memberUserIds: string[] = [];
    let memberFeeMap: Record<string, string> = {};
    if (selectedEvent.eventId) {
      // Try getEventMembers (has profile join)
      const { data: members } = await getEventMembers(selectedEvent.eventId);
      if (members?.length) {
        memberUserIds = members.map(m => m.user_id);
        members.forEach(m => { memberFeeMap[m.user_id] = m.fee?.toString() || '0'; });
      } else {
        // Fallback 1: simple query without profile join
        const { data: rawMembers } = await supabase
          .from('event_members')
          .select('user_id, fee')
          .eq('event_id', selectedEvent.eventId);
        if (rawMembers?.length) {
          memberUserIds = rawMembers.map((m: any) => m.user_id);
          rawMembers.forEach((m: any) => { memberFeeMap[m.user_id] = m.fee?.toString() || '0'; });
        } else {
          // Fallback 2: use cached eventMembersMap
          const cached = eventMembersMap[selectedEvent.eventId];
          if (cached?.length) {
            memberUserIds = cached.map(m => m.userId);
            cached.forEach(m => { memberFeeMap[m.userId] = m.fee?.toString() || '0'; });
          }
        }
      }
    }

    setEditingEventData({ ...selectedEvent, memberUserIds, memberFeeMap });
    setSelectedEvent(null);
    setSelectedEventMembership(null);
    setCreateEventType(evType);
    setIsCreateEventOpen(true);
  };

  const handleEventDelete = async () => {
    if (!selectedEvent?.eventId) return;
    try {
      if (!selectedEvent.band_id) {
        await deletePersonalGig(selectedEvent.eventId, user?.id);
      } else {
        await supabase.from('events').delete().eq('id', selectedEvent.eventId);
      }
      refetchEvents();
      refetchDashboard?.();
    } catch (err) {
      console.error('Delete error:', err);
    }
    setSelectedEvent(null);
    setSelectedEventMembership(null);
  };

  const handleEventChat = () => {
    if (!selectedEvent) return;
    setSelectedEvent(null);
    setSelectedEventMembership(null);
    setActiveTab('Chat');
  };

  const handleConfirmQuote = async (targetEvent?: EventData) => {
    const ev = targetEvent || selectedEvent;
    if (!ev?.eventId) return;

    try {
      const nextEventType = (ev.eventType && ev.eventType !== 'quote' && ev.eventType !== 'rehearsal') ? ev.eventType : 'gig';
      const { error: eventErr } = await supabase
        .from('events')
        .update({
          status: 'confirmed',
          event_type: nextEventType,
        })
        .eq('id', ev.eventId);

      if (eventErr) throw eventErr;

      // Update linked quote if present
      await supabase
        .from('quotes')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
          response_type: 'accepted',
        })
        .or(`converted_to_event_id.eq.${ev.eventId},id.eq.${ev.eventId}`);

      // Optimistically update the open detail modal so it transforms into a gig
      setSelectedEvent(prev => {
        if (!prev || prev.eventId !== ev.eventId) return prev;
        return {
          ...prev,
          status: 'CONFIRMED',
          eventType: nextEventType,
          color: 'bg-accent-gig text-accent-gig-foreground',
          indoorOutdoor: prev.indoorOutdoor || 'indoor',
        };
      });

      // Show confirmation toast with instant 1-tap UNDO action
      setSaveToast({
        message: 'Quote confirmed as Gig!',
        type: 'success',
        duration: 8000,
        action: {
          label: 'UNDO',
          onClick: () => handleRevertQuote(ev),
        },
      });

      // If user was on the Quotes filter, switch to Gigs so the new gig is immediately visible
      if (eventFilter === 'QUOTE') {
        setEventFilter('GIGS');
      }

      // Realign in background
      if (refetchEvents) await refetchEvents();
      setMembersRefreshKey(prev => prev + 1);
      if (refetchDashboard) await refetchDashboard();
    } catch (err: any) {
      console.error('Failed to confirm quote:', err);
      setSaveToast({ message: `Failed to confirm quote: ${err.message || 'Unknown error'}`, type: 'error' });
    }
  };

  const handleRevertQuote = async (targetEvent?: EventData) => {
    const ev = targetEvent || selectedEvent;
    if (!ev?.eventId) return;

    try {
      const { error: eventErr } = await supabase
        .from('events')
        .update({
          status: 'tentative',
          event_type: 'other',
        })
        .eq('id', ev.eventId);

      if (eventErr) throw eventErr;

      // Revert linked quote in quotes table
      await supabase
        .from('quotes')
        .update({
          status: 'draft',
          responded_at: null,
          response_type: null,
        })
        .or(`converted_to_event_id.eq.${ev.eventId},id.eq.${ev.eventId}`);

      // Optimistically update the open detail modal so it transforms back into a quote
      setSelectedEvent(prev => {
        if (!prev || prev.eventId !== ev.eventId) return prev;
        return {
          ...prev,
          status: 'QUOTE',
          eventType: 'quote',
          color: 'bg-accent-quote text-white',
        };
      });

      setSaveToast({ message: 'Reverted back to Quote', type: 'info' });

      // If user was on Gigs filter, switch back to Quotes
      if (eventFilter === 'GIGS') {
        setEventFilter('QUOTE');
      }

      // Realign in background
      if (refetchEvents) await refetchEvents();
      setMembersRefreshKey(prev => prev + 1);
      if (refetchDashboard) await refetchDashboard();
    } catch (err: any) {
      console.error('Failed to revert quote:', err);
      setSaveToast({ message: `Failed to revert quote: ${err.message || 'Unknown error'}`, type: 'error' });
    }
  };

  const handleEventCardClick = async (event: EventData) => {
    // If not admin, verify user is added to this event before opening
    if (!isAdmin && user?.id && event.eventId) {
      const cached = eventMembersMap[event.eventId] || [];
      const isMember = cached.some(m => m.userId === user.id && m.status !== 'declined');
      if (cached.length > 0 && !isMember) {
        return; // Member is not added to this event
      }
    }
    setSelectedEvent(event);
    setSelectedEventMembership(null);
    if (user?.id && event.eventId) {
      const { data: membership } = await getUserEventMembership(event.eventId, user.id);
      // If membership exists, use it; otherwise null (which hides accept/decline buttons)
      setSelectedEventMembership(membership);
    }
  };
  handleEventCardClickRef.current = handleEventCardClick;

  const handleEventAccept = async () => {
    if (!selectedEventMembership?.id || !selectedEvent) return;

    const eventId = selectedEvent.eventId || selectedEvent.id?.toString();

    // UI Dismissal: Snap modal closed
    setSelectedEvent(null);
    setSelectedEventMembership(null);

    // Optimistically mark membership confirmed in eventMembersMap so the event stays visible
    if (eventId && user?.id) {
      setEventMembersMap(prev => {
        const list = prev[eventId] || [];
        return {
          ...prev,
          [eventId]: list.map(m => m.userId === user.id ? { ...m, status: 'confirmed' } : m)
        };
      });
      setOptimisticallyHiddenEventIds(prev => prev.filter(id => id !== eventId));
    }

    // DB Payload Processing (runs in background)
    const { data: updated, error } = await respondToEventInvite(selectedEventMembership.id, "confirmed");
    if (error || !updated) {
      console.error('[handleEventAccept] Failed to update membership:', error);
      setSaveToast({ message: 'Failed to accept. Please check your connection and try again.', type: 'error' });
      return;
    }

    // DB succeeded — confirm with success toast
    setSaveToast({ message: "You're confirmed!", type: 'success' });

    // ═══════════════════════════════════════════════════════════════
    // STEP D — Safe Notification Sandbox (autonomous try/catch)
    // ═══════════════════════════════════════════════════════════════
    try {
      const realEventId = selectedEvent.eventId;
      if (realEventId) {
        const { data: members } = await getEventMembers(realEventId);
        const creator = members?.find((m) => m.role === "admin" || m.user_id === selectedEvent.createdBy);
        if (creator?.user_id && user?.id) {
          const memberName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Member";
          const eventType = selectedEvent.status === "REHEARSAL" ? "rehearsal" : selectedEvent.status === "QUOTE" || selectedEvent.status === "QUOTED" ? "quote" : "gig";
          await notifyEventResponse([creator.user_id], realBand?.id || "", realEventId, selectedEvent.title, eventType, memberName, "confirmed");
        }
      }
    } catch (pushErr) {
      // CORS / network failures must never interrupt the UI thread
      console.warn('[handleEventAccept] Push notification failed (CORS or network):', pushErr);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP E — Quiet Background Sync (realign DB cache behind scenes)
    // ═══════════════════════════════════════════════════════════════
    setSelectedEventMembership(updated);
    setMembersRefreshKey(prev => prev + 1);
    if (refetchEvents) await refetchEvents();
    if (refetchNotifications) await refetchNotifications();
    if (refetchDashboard) await refetchDashboard();
  };

  const handleEventDecline = async () => {
    if (!selectedEventMembership?.id || !selectedEvent) return;

    // ═══════════════════════════════════════════════════════════════
    // STEP A — Visual Shortcut: Hide the event card instantly (<1ms)
    // ═══════════════════════════════════════════════════════════════
    const eventIdToHide = selectedEvent.eventId || selectedEvent.id?.toString();
    if (eventIdToHide) {
      setOptimisticallyHiddenEventIds(prev => [...prev, eventIdToHide]);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP B — UI Dismissal: Snap modal closed, fire optimistic toast
    // ═══════════════════════════════════════════════════════════════
    setSelectedEvent(null);
    setSelectedEventMembership(null);

    // ═══════════════════════════════════════════════════════════════
    // STEP C — DB Payload Processing (runs in background)
    // ═══════════════════════════════════════════════════════════════
    const { data: updated, error } = await respondToEventInvite(selectedEventMembership.id, "declined");
    if (error || !updated) {
      console.error('[handleEventDecline] Failed to update membership:', error);
      setSaveToast({ message: 'Failed to drop out. Please check your connection and try again.', type: 'error' });
      // Rollback optimistic hide so the card re-appears on next render
      if (eventIdToHide) {
        setOptimisticallyHiddenEventIds(prev => prev.filter(id => id !== eventIdToHide));
      }
      return;
    }

    // DB succeeded — confirm with success toast
    setSaveToast({ message: 'You dropped out of this event.', type: 'success' });

    // ═══════════════════════════════════════════════════════════════
    // STEP D — Safe Notification Sandbox (autonomous try/catch)
    // ═══════════════════════════════════════════════════════════════
    try {
      const realEventId = selectedEvent.eventId;
      if (realEventId) {
        const { data: members } = await getEventMembers(realEventId);
        const creator = members?.find((m) => m.role === "admin" || m.user_id === selectedEvent.createdBy);
        if (creator?.user_id && user?.id) {
          const memberName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Member";
          const eventType = selectedEvent.status === "REHEARSAL" ? "rehearsal" : selectedEvent.status === "QUOTE" || selectedEvent.status === "QUOTED" ? "quote" : "gig";
          await notifyEventResponse([creator.user_id], realBand?.id || "", realEventId, selectedEvent.title, eventType, memberName, "declined");
        }
      }
    } catch (pushErr) {
      // CORS / network failures must never interrupt the UI thread
      console.warn('[handleEventDecline] Push notification failed (CORS or network):', pushErr);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP E — Quiet Background Sync (realign DB cache behind scenes)
    // ═══════════════════════════════════════════════════════════════
    setSelectedEventMembership(updated);
    setMembersRefreshKey(prev => prev + 1);
    if (refetchEvents) await refetchEvents();
    if (refetchNotifications) await refetchNotifications();
    if (refetchDashboard) await refetchDashboard();
  };

  const handleEventCreate = async (data: any) => {
    const isRehearsalWizard = !data.details && data.title;
    const title = isRehearsalWizard ? data.title : data.details?.title;
    const date = isRehearsalWizard ? data.date : data.details?.date;
    const time = isRehearsalWizard ? data.time : data.details?.time;
    const endTime = isRehearsalWizard ? data.endTime : data.details?.endTime;
    const location = isRehearsalWizard ? data.location : data.details?.venue;
    const price = isRehearsalWizard ? data.totalCost : data.details?.pay || "0";
    const eventType = isRehearsalWizard ? "rehearsal" : (data._originalEventType || data.eventType || "other");

    if (!realBand?.id) {
      setSaveToast({ message: 'No band selected', type: 'error' });
      setEditingEventData(null);
      setIsCreateEventOpen(false);
      return;
    }

    try {
      const venueAddress = isRehearsalWizard ? data.address : data.details?.address;
      const venueCity = isRehearsalWizard ? data.city : data.details?.city;
      const clientName = data.details?.clientName || data.clientName;

      const fullAddress = [venueAddress, venueCity].filter(Boolean).join(', ') || null;
      const venueFinal = location || "TBD";
      const timeFinal = time || "20:00";
      const eventData: Record<string, any> = {
        band_id: realBand.id,
        title: title || "Untitled Event",
        event_type: eventType,
        status: isRehearsalWizard ? (data.status === 'draft' ? 'confirmed' : (data.status || 'confirmed')) : (data.status || 'confirmed'),
        event_date: date,
        start_time: timeFinal,
        end_time: endTime || null,
        venue_name: venueFinal,
        venue: venueFinal,
        venue_address: fullAddress,
        venue_city: venueCity || null,
        client_name: clientName || null,
        fee: parseFloat(price) || 0,
        notes: data.notes || null,
        indoor_outdoor: data.setting || null,
        is_recurring: isRehearsalWizard
          ? Boolean(data.recurrence && data.recurrence !== 'once')
          : Boolean(data.is_recurring || (data.recurrence && data.recurrence !== 'once')),
        recurrence_rule: (data.recurrence && data.recurrence !== 'once')
          ? { frequency: data.recurrence === 'biweekly' ? 'weekly' : data.recurrence, interval: data.recurrence === 'biweekly' ? 2 : 1 }
          : (data.recurrence_rule || null),
      };

      const persistMembers = async (eventId: string, isEdit?: boolean): Promise<string> => {
        if (!data.members?.length) return 'no members in payload';
        let membersToInvite = data.members;
        if (isRehearsalWizard && data.audienceIds?.length > 0) {
          membersToInvite = data.members.filter((m: any) => data.audienceIds.includes(m.id));
        }
        if (!membersToInvite.length) return 'filtered to 0 members';

        // When editing, preserve existing membership statuses instead of resetting to pending
        const existingStatuses = isEdit ? await (async () => {
          const { data: existing } = await supabase
            .from('event_members')
            .select('user_id, status')
            .eq('event_id', eventId);
          const map: Record<string, string> = {};
          (existing || []).forEach((em: any) => { map[em.user_id] = em.status; });
          return map;
        })() : {};

        const { error: delErr } = await supabase.from('event_members').delete().eq('event_id', eventId);
        if (delErr) return `delete failed: ${delErr.message}`;

        const errors: string[] = [];
        for (const m of membersToInvite) {
          const isCreator = m.id === user?.id;
          const prevStatus = existingStatuses[m.id];
          // Use existing status if available (e.g. 'confirmed'), otherwise fall back to creator rule
          const status = prevStatus || (isCreator ? 'confirmed' : 'pending');
          const { error: insErr } = await supabase
            .from('event_members')
            .insert({ event_id: eventId, user_id: m.id, role: m.role || null, fee: parseFloat(m.fee) || 0, status });
          if (insErr) errors.push(`${m.id}: ${insErr.message}`);
        }

        if (errors.length > 0) return `insert errors: ${errors.join('; ')}`;

        // Verify: read back what we just inserted
        const { data: verify, error: verErr } = await supabase
          .from('event_members')
          .select('user_id')
          .eq('event_id', eventId);
        if (verErr) return `verify failed: ${verErr.message}`;
        return `OK: ${verify?.length || 0} members saved`;
      };

      // Persist setlist: create a DB setlist from form data and attach its ID
      const persistSetlist = async (): Promise<string | null> => {
        try {
          // Rehearsal flow: setlistSnapshotFinal has songs with songId
          if (isRehearsalWizard && data.setlistSnapshotFinal?.songs?.length > 0) {
            const songs = data.setlistSnapshotFinal.songs.map((s: any, i: number) => ({
              song_id: s.songId,
              position: i,
              set_number: 1,
            }));
            const { data: sl } = await createSetlist({
              band_id: realBand.id,
              name: `${title || 'Rehearsal'} setlist`,
              song_count: songs.length,
            }, songs);
            return sl?.id || null;
          }
          // Gig/Quote flow: setlist is array of sets with songs
          if (!isRehearsalWizard && data.setlist?.length > 0) {
            const allSongs: { song_id: string; position: number; set_number: number }[] = [];
            let pos = 0;
            for (let setIdx = 0; setIdx < data.setlist.length; setIdx++) {
              const set = data.setlist[setIdx];
              for (const song of (set.songs || [])) {
                if (song.songId) {
                  allSongs.push({ song_id: song.songId, position: pos++, set_number: setIdx + 1 });
                }
              }
            }
            if (allSongs.length === 0) return null;
            const { data: sl } = await createSetlist({
              band_id: realBand.id,
              name: `${title || 'Event'} setlist`,
              song_count: allSongs.length,
            }, allSongs);
            return sl?.id || null;
          }
          return null;
        } catch (err) {
          console.error('Setlist persist error:', err);
          return null;
        }
      };

      const setlistId = await persistSetlist();
      if (setlistId) {
        eventData.setlist_id = setlistId;
      }

      // Optimistically build member map from the form data
      const optimisticMembers = (data.members || []).map((m: any) => ({
        name: m.name || 'Member',
        userId: m.id,
        fee: parseFloat(m.fee) || 0,
      }));

      if (data._editing && data._editingEventId) {
        const { error } = await updateEvent(data._editingEventId, eventData);
        if (!error) {
          const memberResult = await persistMembers(data._editingEventId, true);
          if (optimisticMembers.length > 0) {
            setEventMembersMap(prev => ({ ...prev, [data._editingEventId]: optimisticMembers }));
          }
          const memberFailed = memberResult.startsWith('insert errors') || memberResult.startsWith('delete failed') || memberResult.startsWith('verify failed');
          if (memberFailed) {
            console.error('Member persist issue:', memberResult);
            setSaveToast({ message: 'Event updated, but there was a problem saving members.', type: 'error' });
          } else {
            setSaveToast({ message: 'Event updated!', type: 'success' });
          }
        } else {
          setSaveToast({ message: `Save failed: ${error.message || JSON.stringify(error)}`, type: 'error' });
        }
      } else {
        const { data: saved, error } = await createEvent(eventData);
        if (!error && saved) {
          const memberResult = await persistMembers(saved.id, false);
          // Optimistic update
          if (optimisticMembers.length > 0) {
            setEventMembersMap(prev => ({ ...prev, [saved.id]: optimisticMembers }));
          }
          if (user?.id) {
            try {
              const creatorName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";
              const invitedIds = data.audienceIds?.length > 0 ? data.audienceIds : data.members?.map((m: any) => m.id) || [];
              const perMemberFees: Record<string, number> = {};
              (data.members || []).forEach((m: any) => { if (m.id && m.fee) perMemberFees[m.id] = parseFloat(m.fee) || 0; });
              await notifyEventMembersCreated(realBand.id, saved.id, title || "Event", date, time || "20:00", eventType, user.id, creatorName, invitedIds, { venue: location, fee: parseFloat(price) || undefined, memberFees: perMemberFees });
              const invitedCount = invitedIds.length > 0 ? invitedIds.filter((id: string) => id !== user.id).length : (realBand.member_count || 1) - 1;
              if (invitedCount > 0) await notifyEventPendingConfirmations(user.id, realBand.id, saved.id, title || "Event", eventType, invitedCount);
            } catch (err) { console.error("Notify error:", err); }
          }
          const memberFailed2 = memberResult.startsWith('insert errors') || memberResult.startsWith('delete failed') || memberResult.startsWith('verify failed');
          if (memberFailed2) {
            console.error('Member persist issue:', memberResult);
            setSaveToast({ message: 'Event created, but there was a problem saving members.', type: 'error' });
          } else {
            setSaveToast({ message: 'Event created!', type: 'success' });
          }
        } else {
          setSaveToast({ message: `Create failed: ${error?.message || JSON.stringify(error)}`, type: 'error' });
        }
      }
      await refetchEvents();
      if (refetchDashboard) await refetchDashboard();
      setMembersRefreshKey(k => k + 1);
    } catch (err: any) {
      setSaveToast({ message: `Error: ${err?.message || String(err)}`, type: 'error' });
    }

    setEditingEventData(null);
    setIsCreateEventOpen(false);
  };

  // Render
  const isMenuOpen = isIdentityOpen || isControlDeckOpen;
  const isHeaderHidden = !!expandedCard || isMenuOpen;
  const userRole: UserRole = isAdmin ? "admin" : "member";
  const permissions = getPermissions(userRole);

  // Compute member & band dashboard stats from local masterEventsList + eventMembersMap to ensure
  // they always match the event card data (same source of truth) and strictly count UPCOMING items
  const computedMemberStats = useMemo(() => {
    if (!user?.id) return null;

    // Get today's local date
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let totalEarned = 0;
    let confirmedFee = 0;
    let pendingFee = 0;
    let confirmedCount = 0;

    // Use masterEventsList (same source as event cards) to ensure consistency
    const eventsList = masterEventsList || [];
    for (const event of eventsList) {
      if (realBand?.id && event.band_id && event.band_id !== realBand.id) continue;
      // Only include confirmed or completed events
      const evStatus = (event.status || '').toLowerCase();
      if (evStatus !== 'confirmed' && evStatus !== 'completed') continue;
      // Skip events without date
      if (!event.event_date) continue;
      // Skip rehearsals
      if (event.event_type === 'rehearsal') continue;

      const normDate = event.event_date.includes('T') ? event.event_date.split('T')[0] : event.event_date;
      const isUpcoming = normDate >= todayStr;

      const members = eventMembersMap[event.id || ''] || [];
      const myMembership = members.find((m: any) => m.userId === user.id);

      let fee = 0;
      let isConfirmed = false;
      let isPending = false;

      if (myMembership) {
        if (myMembership.status === 'confirmed') {
          fee = myMembership.fee || 0;
          isConfirmed = true;
        } else if (myMembership.status === 'pending') {
          fee = myMembership.fee || 0;
          isPending = true;
        }
      } else if (!event.band_id && event.created_by === user.id) {
        // Instant optimistic/fallback sync for personal gig before eventMembersMap populates
        fee = event.fee || 0;
        isConfirmed = true;
      }

      if (isPending) {
        pendingFee += fee;
      } else if (isConfirmed) {
        if (isUpcoming) {
          confirmedFee += fee;
          confirmedCount++;
        } else {
          totalEarned += fee;
        }
      }
    }

    return {
      totalEarned,
      confirmedFee,
      pendingFee,
      revenueChange: 0,
      confirmedCount,
    };
  }, [user?.id, masterEventsList, eventMembersMap, realBand?.id, realBand?.member_count]);

  const computedDashboardData = useMemo(() => {
    const now = new Date();
    const startOfYear = `${now.getFullYear()}-01-01`;
    const endOfYear = `${now.getFullYear()}-12-31`;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const bandEvents = (masterEventsList || []).filter(e => {
      if (optimisticallyHiddenEventIds.includes(e.id)) return false;
      if (realBand?.id && e.band_id && e.band_id !== realBand.id) return false;
      if (!isAdmin && user?.id) {
        const members = eventMembersMap[e.id] || [];
        const myMembership = members.find(m => m.userId === user.id);
        if (!myMembership || myMembership.status === 'declined') return false;
      }
      return true;
    });

    const getNormDate = (d?: string | null) => (!d ? '' : d.includes('T') ? d.split('T')[0] : d);

    // Upcoming confirmed gigs (strictly future or today, excluding rehearsals)
    const upcomingConfirmedGigs = bandEvents.filter(e => {
      const s = (e.status || '').toLowerCase();
      const d = getNormDate(e.event_date);
      return (s === 'confirmed' || s === 'completed') && e.event_type !== 'rehearsal' && d >= todayStr;
    });

    // Year-to-date / full-year confirmed gig revenue
    const yearConfirmedGigs = bandEvents.filter(e => {
      const s = (e.status || '').toLowerCase();
      const d = getNormDate(e.event_date);
      return (s === 'confirmed' || s === 'completed') && e.event_type !== 'rehearsal' && d >= startOfYear && d <= endOfYear;
    });
    const totalRevenue = yearConfirmedGigs.reduce((sum, e) => sum + (Number(e.fee) || 0), 0);

    // Upcoming quotes (tentative/quoted events with date >= todayStr)
    const upcomingQuoteEvents = bandEvents.filter(e => {
      const s = (e.status || '').toLowerCase();
      const d = getNormDate(e.event_date);
      return (s === 'tentative' || s === 'quoted' || s === 'quote') && (!d || d >= todayStr);
    });
    const quotesPipeline = upcomingQuoteEvents.reduce((sum, e) => sum + (Number(e.fee) || 0), 0);

    // Upcoming confirmed gigs or rehearsals (strictly excluding quotes/drafts/tentative/cancelled)
    const liveUpcomingEvents: any[] = [];
    bandEvents.forEach(e => {
      const s = (e.status || '').toLowerCase();
      const type = (e.event_type || '').toLowerCase();
      const d = getNormDate(e.event_date);
      if (s === 'cancelled') return;

      const isRehearsal = type === 'rehearsal' || s === 'rehearsal';
      const isConfirmedGig = (s === 'confirmed' || s === 'completed');
      const isQuoteOrDraft = s === 'quoted' || s === 'quote' || s === 'tentative' || s === 'draft' || s === 'pending';

      if (!isRehearsal && (!isConfirmedGig || isQuoteOrDraft)) {
        return;
      }

      if (d && d >= todayStr) {
        liveUpcomingEvents.push(e);
      }

      // Expand recurring rehearsals if any
      if (isRehearsal && (e as any).is_recurring && (e as any).recurrence_rule && d) {
        const rule = (e as any).recurrence_rule;
        const freq = (rule.freq || rule.frequency || '').toLowerCase();
        if (freq) {
          const baseDate = new Date(d);
          const until = rule.until ? new Date(rule.until) : new Date(now.getFullYear(), now.getMonth() + 4, 0);
          const maxCount = rule.count || 24;
          let cursor = new Date(baseDate);
          let generated = 0;
          while (cursor <= until && generated < maxCount) {
            if (freq === 'weekly') cursor.setDate(cursor.getDate() + 7 * (rule.interval || 1));
            else if (freq === 'biweekly') cursor.setDate(cursor.getDate() + 14);
            else if (freq === 'monthly') cursor.setMonth(cursor.getMonth() + (rule.interval || 1));
            else break;
            if (cursor > until) break;
            const occDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            if (occDate >= todayStr && occDate !== d) {
              liveUpcomingEvents.push({
                ...e,
                id: `${e.id}-occ-${occDate}`,
                eventId: e.id,
                event_date: occDate,
                date: occDate,
              });
            }
            generated++;
          }
        }
      }
    });

    // Deduplicate identical event instances
    const seenLive = new Set<string>();
    const uniqueLiveUpcomingEvents: any[] = [];
    liveUpcomingEvents.forEach(e => {
      const normDate = getNormDate(e.event_date);
      const normTitle = (e.title || '').trim().toLowerCase();
      const normTime = (e.start_time || '').trim().slice(0, 5);
      const key = `${normTitle}::${normDate}::${normTime}`;
      if (!seenLive.has(key)) {
        seenLive.add(key);
        uniqueLiveUpcomingEvents.push(e);
      }
    });

    uniqueLiveUpcomingEvents.sort((a, b) => {
      const dateA = getNormDate(a.event_date);
      const dateB = getNormDate(b.event_date);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const isGigA = a.event_type !== 'rehearsal';
      const isGigB = b.event_type !== 'rehearsal';
      if (isGigA && !isGigB) return -1;
      if (!isGigA && isGigB) return 1;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

    const fallbackUpcomingEvents = (dashboardData?.upcomingEvents || []).filter((e: any) => {
      const s = (e.status || '').toLowerCase();
      const type = (e.event_type || '').toLowerCase();
      const d = getNormDate(e.event_date);
      if (d && d < todayStr) return false;
      if (s === 'cancelled') return false;

      const isRehearsal = type === 'rehearsal' || s === 'rehearsal';
      if (isRehearsal) return true;

      const isConfirmedGig = (s === 'confirmed' || s === 'completed');
      const isQuoteOrDraft = s === 'quoted' || s === 'quote' || s === 'tentative' || s === 'draft' || s === 'pending';
      if (!isRehearsal && (!isConfirmedGig || isQuoteOrDraft)) return false;

      if (!isAdmin && user?.id && e.id) {
        const members = eventMembersMap[e.id] || [];
        const myMembership = members.find((m: any) => m.userId === user.id);
        if (!myMembership || myMembership.status === 'declined') return false;
      }

      return true;
    });

    return {
      ...dashboardData,
      eventStats: {
        totalEvents: bandEvents.length,
        confirmedEvents: upcomingConfirmedGigs.length,
        totalRevenue: bandEvents.length > 0 ? totalRevenue : (dashboardData?.eventStats?.totalRevenue || 0),
        upcomingEvents: uniqueLiveUpcomingEvents.length,
        revenueChange: dashboardData?.eventStats?.revenueChange || 0,
      },
      quoteStats: isAdmin ? {
        totalQuotes: upcomingQuoteEvents.length,
        pendingQuotes: upcomingQuoteEvents.length,
        acceptedQuotes: dashboardData?.quoteStats?.acceptedQuotes || 0,
        totalPipeline: quotesPipeline || (dashboardData?.quoteStats?.totalPipeline || 0),
        acceptedRevenue: dashboardData?.quoteStats?.acceptedRevenue || 0,
      } : {
        totalQuotes: 0,
        pendingQuotes: 0,
        acceptedQuotes: 0,
        totalPipeline: 0,
        acceptedRevenue: 0,
      },
      memberStats: computedMemberStats || (dashboardData?.memberStats || null),
      upcomingEvents: (masterEventsList && masterEventsList.length > 0) ? uniqueLiveUpcomingEvents : fallbackUpcomingEvents,
      recentQuotes: isAdmin ? (dashboardData?.recentQuotes || []) : [],
    };
  }, [dashboardData, masterEventsList, optimisticallyHiddenEventIds, realBand?.id, computedMemberStats, isAdmin, user?.id, eventMembersMap]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/50">
      <div className="fixed inset-0 z-0 bg-background" />
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

      <div ref={scrollContainerRef} className="w-full max-w-[680px] mx-auto relative flex flex-col z-10 overflow-y-auto" style={{
        paddingTop: "0px",
        paddingBottom: "0px",
        paddingLeft: "16px", paddingRight: "16px",
        height: '100vh',
        overflowAnchor: 'none',
        maskImage: (isCreateEventOpen || activeTab === 'Chat' || !!selectedChat) ? 'none' : 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)',
        WebkitMaskImage: (isCreateEventOpen || activeTab === 'Chat' || !!selectedChat) ? 'none' : 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)',
      }}>
        <Header
          activeTab={activeTab} selectedBand={selectedBand}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: parseInt(b.id.replace(/-/g, "").slice(0, 8), 16) || 1, name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: "Rock", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as Band)) : []}
          onOpenBandSwitcher={() => setIsBandSwitcherOpen(true)}
          filteredEventsCount={visuallyFilteredEvents.length} totalEventsCount={events.length}
          eventView={eventView} setEventView={setEventView}
          onCreateEvent={() => {
            if (!isAdmin || isSolo) {
              setEditingPersonalGig(null);
              setShowPersonalGigModal(true);
            } else {
              setCreateEventType(null);
              setIsCreateEventOpen(true);
            }
          }}
          onOpenIdentity={openIdentity} onOpenNotifications={handleOpenNotifications} unreadCount={isNotificationsOpen ? 0 : unreadCount} isHidden={isHeaderHidden}
          isScrolled={isHeaderScrolled}
        />

        <AnimatePresence mode="wait">
          {(activeTab === "Home" || activeTab === "More") && (
            <HomeView key={`dashboard-${isSolo ? 'solo' : selectedBand.id}`} selectedBand={selectedBand} expandedCard={expandedCard} setExpandedCard={setExpandedCard} upcomingRehearsals={upcomingRehearsals} currentRehearsal={currentRehearsal} onRehearsalClick={handleRehearsalClick} isHidden={isMenuOpen} dashboardData={computedDashboardData} dashboardLoading={dashboardLoading && !masterEventsList?.length} isAdmin={isAdmin} onViewChange={(tab) => setActiveTab(tab as TabName)} onSelectEvent={navigateToEvent} onFilterEvents={(filter) => {
              setEventFilter(filter);
              setActiveTab("Events");
            }} onQuickAction={(action) => {
              if (action === "View Calendar") {
                setEventFilter("ALL");
                setActiveTab("Events");
                return;
              }
              if (action === "View Analytics") {
                setShowAnalytics(true);
                return;
              }
              if (isSolo) return; // PLG: Solo mode has no band actions
              if (action === "Band Members") setShowBandMembers(true);
              if (action === "Setlist & Repertoire") setShowSetlistManager(true);
              if (action === "Inventory") setShowInventory(true);
              if (action === "Contracts & Riders") setShowContracts(true);
              if (action === "Task Templates") setShowTaskTemplates(true);
            }} isSolo={isSolo}
            rehearsalPolls={rehearsalPolls}
            onConvertProposal={handleConvertProposal}
            onPollUpdated={() => {
              refetchRehearsalPolls();
              refetchEvents();
            }}
            onShowToast={(msg, type) => setSaveToast({ message: msg, type })}
            currentUserId={user?.id}
            />
          )}
          {activeTab === "Chat" && !isSolo && (
            <ChatView key="chat" chatFilter={chatFilter} setChatFilter={setChatFilter} chatSearch={chatSearch} setChatSearch={setChatSearch} filteredChats={filteredChats} unreadCounts={chatUnreadCounts} onChatClick={(c) => { c.unread = 0; setSelectedChat(c); }} onStartChat={() => setShowNewChat(true)} />
          )}
          {activeTab === "Events" && (
            <EventsView key="events" eventFilter={eventFilter} setEventFilter={setEventFilter} eventSearch={eventSearch} setEventSearch={setEventSearch} eventView={eventView} groupedEvents={groupedEvents} allEvents={visuallyFilteredEvents} onEventClick={handleEventCardClick} onCreateEvent={() => {
              if (!isAdmin || isSolo) {
                setEditingPersonalGig(null);
                setShowPersonalGigModal(true);
              } else {
                setCreateEventType(null);
                setIsCreateEventOpen(true);
              }
            }} onOpenPastEvents={() => setShowPastEvents(true)} isAdmin={isAdmin} onDayPickerOpen={setIsDayPickerOpen} userFeeMap={userFeeMap} bands={realBands?.map(b => ({ id: b.id, name: b.name })) || []} selectedBandPill={selectedBandPill} onBandPillClick={setSelectedBandPill}
              rehearsalPolls={rehearsalPolls}
              onConvertProposal={handleConvertProposal}
              onPollUpdated={() => {
                refetchRehearsalPolls();
                refetchEvents();
              }}
              onShowToast={(msg, type) => setSaveToast({ message: msg, type })}
              currentUserId={user?.id}
            />
          )}
          {/* PLG: Solo mode fallback for Chat tab */}
          {activeTab === "Chat" && isSolo && (
            <EventsView key="events-solo" eventFilter={eventFilter} setEventFilter={setEventFilter} eventSearch={eventSearch} setEventSearch={setEventSearch} eventView={eventView} groupedEvents={groupedEvents} allEvents={visuallyFilteredEvents} onEventClick={handleEventCardClick} onCreateEvent={() => { setEditingPersonalGig(null); setShowPersonalGigModal(true); }} onOpenPastEvents={() => setShowPastEvents(true)} isAdmin={false} onDayPickerOpen={setIsDayPickerOpen} userFeeMap={userFeeMap} bands={realBands?.map(b => ({ id: b.id, name: b.name })) || []} selectedBandPill={selectedBandPill} onBandPillClick={setSelectedBandPill} />
          )}
        </AnimatePresence>

        <IdentityHub
          isOpen={isIdentityOpen}
          onClose={closeIdentity}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: parseInt(b.id.replace(/-/g, "").slice(0, 8), 16) || 1, name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: "Rock", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as Band)) : []}
          selectedBand={selectedBand}
          setSelectedBand={setSelectedBand}
          notificationGroups={notificationGroups}
          unreadCount={unreadCount}
          onNotificationClick={handleNotificationClick}
          onMarkAsRead={handleMarkSingleAsRead}
          onMarkGroupAsRead={handleMarkGroupAsRead}
          onEntityDetailClick={(l) => { if (l === "INVENTORY") setShowInventory(true); if (l === "REPERTOIRE") setShowSetlistManager(true); if (l === "TEMPLATES") setShowTaskTemplates(true); if (l === "DOCUMENTS") setShowContracts(true); }}
          entityCounts={entityCounts}
          onEditProfile={() => setShowEditProfile(true)}
          onEditBand={() => setShowBandMembers(true)}
          onAddEntity={handleRequestCreateBand}
          onOpenPricing={() => {
            setPricingReturnTo('identity_hub');
            setShowPricingModal(true);
          }}
        />

        <SwitchBandPopup
          isOpen={isBandSwitcherOpen}
          onClose={() => setIsBandSwitcherOpen(false)}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: parseInt(b.id.replace(/-/g, "").slice(0, 8), 16) || 1, name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: "Rock", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as Band)) : []}
          selectedBand={selectedBand}
          onSelectBand={setSelectedBand}
          onAddNewBand={handleRequestCreateBand}
        />

        <AnimatePresence>
          {expandedCard === "finance" && <FinanceExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} financialStats={financeData.financialStats} transactions={financeData.recentTransactions} loading={financeLoading} />}
          {expandedCard === "pending" && <PendingExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} eventFilter={eventFilter} setEventFilter={setEventFilter} events={pendingEvents} loading={pendingEventsLoading} />}
          {isAdmin && expandedCard === "quotes" && <QuotesExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} realQuotes={realQuotes} quoteStats={quotesStats} loading={quotesLoading} />}
          {expandedCard === "confirmed" && <ConfirmedExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} events={myConfirmedEvents} loading={confirmedEventsLoading} />}
          {expandedCard === "rehearsal" && currentRehearsal ? (
            <RehearsalExpanded upcomingRehearsals={upcomingRehearsals} currentRehearsal={currentRehearsal} currentDetails={currentDetails} rehearsalIndex={rehearsalIndex} setRehearsalIndex={setRehearsalIndex} rehearsalViewMode={rehearsalViewMode} setRehearsalViewMode={setRehearsalViewMode} isLive={isLive} onClose={() => setExpandedCard(null)} onDecline={handleRehearsalDecline} />
          ) : expandedCard === "rehearsal" ? (
            <ExpandedCardWrapper backgroundColor="#3B82F6" onClose={() => setExpandedCard(null)} origin={{ top: "18%", left: "3%", right: "42%", bottom: "52%" }}>
              <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style={{ paddingTop: isAndroid && isNative ? "60px" : "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
                <button onClick={() => setExpandedCard(null)} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><ChevronLeft className="w-6 h-6 text-white" /></button>
                <h1 className="text-lg font-bold text-white">My Rehearsals</h1>
                {isAdmin ? <button onClick={() => { setExpandedCard(null); setCreateEventType("rehearsal"); setIsCreateEventOpen(true); }} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><Plus className="w-5 h-5 text-white" /></button> : <div className="w-10" />}
              </div>
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6"><Music className="w-10 h-10 text-white" /></div>
                <h2 className="text-2xl font-black text-white mb-2">No Rehearsals</h2>
                <p className="text-white/70 text-center mb-8">{isAdmin ? "No upcoming rehearsals. Tap + to create one!" : "No upcoming rehearsals scheduled."}</p>
                {isAdmin && <button onClick={() => { setExpandedCard(null); setCreateEventType("rehearsal"); setIsCreateEventOpen(true); }} className="bg-white text-blue-600 px-6 py-3 rounded-full font-bold">Schedule Rehearsal</button>}
              </div>
            </ExpandedCardWrapper>
          ) : null}
          {expandedCard === "fee" && <FeeExpanded onClose={() => setExpandedCard(null)} bandName={realBand?.name || selectedBand.name} memberFee={realBand?.members?.find((m) => m.user_id === user?.id)?.default_fee || 0} loading={false} events={myConfirmedEvents.map((e) => ({ id: e.id, title: e.title, date: e.event_date, fee: e.fee || 0, status: e.status as "confirmed" | "pending" | "completed", type: e.event_type as "gig" | "rehearsal" }))} />}
        </AnimatePresence>
      </div>

      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPlusMenuOpen={isPlusMenuOpen}
        setIsPlusMenuOpen={setIsPlusMenuOpen}
        isControlDeckOpen={isIdentityOpen}
        isIdentityOpen={isIdentityOpen}
        toggleControlDeck={toggleIdentity}
        toggleIdentity={toggleIdentity}
        closeMenus={closeMenus}
        onCreateEvent={handleCreateEvent}
        isScrollingDown={isScrollingDown}
        unreadChatCount={chatUnreadCounts.all}
        isHidden={!!expandedCard || !!selectedChat || !!selectedEvent || !!selectedNotification || isBandSwitcherOpen || isDayPickerOpen || !!rsvpNotification || !!pollNotification || showSettings || showBandMembers || showSetlistManager || showAnalytics || showInventory || showContracts || showTaskTemplates || showPricingModal || showPastEvents || isCreateEventOpen || showEditProfile || showNewChat}
        isAdmin={isAdmin}
        isSolo={userMode === 'solo'}
      />

      <React.Suspense fallback={null}>
        <AnimatePresence>
          {rehearsalViewMode === "live" && expandedCard === "rehearsal" && (
            <motion.div key="rehearsal-live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200]">
              <RehearsalLiveView onClose={() => setRehearsalViewMode("overview")} onFinish={() => setRehearsalViewMode("post")} />
            </motion.div>
          )}
          {rehearsalViewMode === "post" && expandedCard === "rehearsal" && (
            <motion.div key="rehearsal-post" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200]">
              <RehearsalPostView onClose={() => setRehearsalViewMode("overview")} />
            </motion.div>
          )}

          {showBandMembers && <BandMembersView key="band-members" onClose={() => setShowBandMembers(false)} />}
          {showSetlistManager && <SetlistManagerView key="setlist-manager" onClose={() => setShowSetlistManager(false)} />}
          {showSettings && (
            <SettingsView
              key="settings"
              onClose={() => { setShowSettings(false); setSettingsInitialSection("main"); }}
              initialSection={settingsInitialSection}
              isAdmin={isAdmin}
            />
          )}
          {showAnalytics && <AnalyticsView key="analytics" onClose={() => setShowAnalytics(false)} />}
          {showInventory && realBand && <InventoryView key="inventory" onBack={() => setShowInventory(false)} bandId={realBand.id} />}
          {showContracts && realBand && <ContractsView key="contracts" onBack={() => setShowContracts(false)} bandId={realBand.id} />}
          {showTaskTemplates && realBand && <TaskTemplatesView key="task-templates" onBack={() => setShowTaskTemplates(false)} bandId={realBand.id} />}
          {showPastEvents && (
            <PastEventsView
              key="past-events"
              onClose={() => setShowPastEvents(false)}
              allEvents={visuallyFilteredEvents}
              onEventClick={handleEventCardClick}
              isAdmin={isAdmin}
              bands={realBands?.map(b => ({ id: b.id, name: b.name })) || []}
              userFeeMap={userFeeMap}
            />
          )}

          {showEditProfile && <EditProfileModal key="edit-profile" isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} />}
          {showPricingModal && isAdmin && (
            <BandPricingModal
              key="band-pricing"
              isOpen={showPricingModal}
              onClose={() => {
                setShowPricingModal(false);
                if (pricingReturnTo === 'control_deck' || pricingReturnTo === 'identity_hub') {
                  setIsIdentityOpen(true);
                }
                setPricingReturnTo(null);
              }}
              bandId={realBand?.id ? String(realBand.id) : (selectedBand?.id ? String(selectedBand.id) : 'default')}
              onSaved={() => {
                refreshBands();
              }}
            />
          )}
          {showAdminTour && (
            <AdminGuidedTourModal
              key="admin-tour"
              isOpen={showAdminTour}
              onClose={() => {
                localStorage.setItem('bandwith_admin_tour_seen', 'true');
                setShowAdminTour(false);
              }}
              onOpenPricing={() => {
                localStorage.setItem('bandwith_admin_tour_seen', 'true');
                setShowAdminTour(false);
                setPricingReturnTo(null);
                setShowPricingModal(true);
              }}
            />
          )}
          {showCreateBand && <CreateBandModal key="create-band" isOpen={showCreateBand} onClose={() => setShowCreateBand(false)} onBandCreated={(id) => { const nb = realBands.find((b) => b.id === id); if (nb) selectBand(nb.id); }} />}
          <UpgradePricingSheet isOpen={showUpgradePricing} onClose={() => setShowUpgradePricing(false)} currentTier={profile?.sub_tier} />
          {showPersonalGigModal && user?.id && (
            <PersonalGigModal
              isOpen={showPersonalGigModal}
              onClose={() => {
                setShowPersonalGigModal(false);
                setEditingPersonalGig(null);
              }}
              userId={user.id}
              initialData={editingPersonalGig}
              onSaved={() => {
                refetchEvents();
                refetchDashboard?.();
              }}
              onOpenUpgradeSheet={() => setShowUpgradePricing(true)}
            />
          )}

          <AnimatePresence>
            {isCreateEventOpen && (!!editingEventData || createEventType !== "quote") && (
              <CreateEventModal
                initialType={createEventType as any}
                layoutId={`create-button-${createEventType}`}
                onClose={() => { setIsCreateEventOpen(false); setEditingEventData(null); }}
                onCreate={handleEventCreate}
                currentUserId={user?.id}
                bandMembers={memoizedBandMembers}
                editingEvent={editingEventData}
                onOpenPollBuilder={handleOpenPollBuilder}
                onOpenProposeRehearsal={() => setShowProposeRehearsalModal(true)}
              />
            )}
          </AnimatePresence>

          {showProposeRehearsalModal && realBand && user && (
            <ProposeRehearsalModal
              isOpen={showProposeRehearsalModal}
              onClose={() => setShowProposeRehearsalModal(false)}
              bandId={realBand.id}
              userId={user.id}
              onSuccess={refetchRehearsalPolls}
              onShowToast={(msg, type) => setSaveToast({ message: msg, type })}
            />
          )}

          {showRehearsalPollModal && realBand && user && (
            <RehearsalPollModal
              isOpen={showRehearsalPollModal}
              onClose={() => {
                setShowRehearsalPollModal(false);
                setPollModalInitialProposal(null);
              }}
              bandId={realBand.id}
              adminId={user.id}
              initialProposal={pollModalInitialProposal}
              onSuccess={() => {
                refetchRehearsalPolls();
                refetchEvents();
              }}
              onShowToast={(msg, type) => setSaveToast({ message: msg, type })}
            />
          )}
          <AnimatePresence>{isCreateEventOpen && createEventType === "quote" && !editingEventData && <QuoteCreationWizard bandMembers={memoizedBandMembers} onClose={() => setIsCreateEventOpen(false)} onCreate={async (q) => {
            if (realBand?.id) {
              const createdEventId = q.eventId || (await (async () => {
                const evD: Record<string, any> = {
                  band_id: realBand.id,
                  title: q.eventName || q.clientName || 'Quote Event',
                  event_type: q.eventType || 'other',
                  status: 'tentative' as const,
                  event_date: q.eventDate || new Date().toISOString().split('T')[0],
                  start_time: q.eventTimeStart || '20:00',
                  end_time: q.eventTimeEnd || null,
                  venue_name: q.venueName || 'TBD',
                  venue: q.venueName || 'TBD',
                  venue_city: q.venueCity || null,
                  venue_address: q.venueAddress || null,
                  indoor_outdoor: q.indoorOutdoor || null,
                  fee: q.total || 0,
                  client_name: q.clientName || null,
                };
                const { data: ev } = await createEvent(evD);
                if (ev?.id && Array.isArray(q.musicians) && q.musicians.length > 0) {
                  const memberRows = q.musicians
                    .map((m: any) => {
                      const bandMember = realBand.members?.find((bm: any) => bm.id === m.id || bm.user_id === m.id);
                      const resolvedUserId = bandMember?.user_id || m.user_id || null;
                      if (!resolvedUserId) return null;
                      return {
                        event_id: ev.id,
                        user_id: resolvedUserId,
                        status: resolvedUserId === user?.id ? 'confirmed' : 'pending',
                        fee: Number(m.rate || m.customFee || 0),
                        role: m.instrument || bandMember?.role || 'Musician',
                      };
                    })
                    .filter(Boolean);
                  if (memberRows.length > 0) {
                    await supabase.from('event_members').upsert(memberRows as any[], { onConflict: 'event_id,user_id' });
                  }
                }
                return ev?.id || null;
              })());

              const quoteData = {
                band_id: realBand.id,
                quote_number: q.quoteNumber || `Q-${Date.now()}`,
                status: (q.status || 'draft').toLowerCase(),
                client_name: q.clientName || 'Unknown',
                client_email: q.clientEmail || null,
                client_phone: q.clientPhone || null,
                client_company: q.clientCompany || null,
                event_name: q.eventName || null,
                event_type: q.eventType || null,
                event_date: q.eventDate || null,
                venue_name: q.venueName || null,
                venue_city: q.venueCity || null,
                subtotal: q.subtotal || 0,
                vat_amount: q.vatAmount || 0,
                total: q.total || 0,
                deposit_percentage: q.depositPercentage ?? 30,
                converted_to_event_id: createdEventId,
              };
              await createQuoteDB(quoteData as any);
              await refetchEvents();
              setMembersRefreshKey(prev => prev + 1);
              if (refetchDashboard) await refetchDashboard();
            }
            setIsCreateEventOpen(false);
          }} />}</AnimatePresence>

          <NotificationDetailModal key="notification-detail"
            isOpen={isNotificationsOpen}
            onClose={() => { setSelectedNotification(null); setSelectedNotifications([]); }}
            notification={selectedNotification}
            notifications={selectedNotifications}
            onOpenRSVP={(notif) => {
              setSelectedNotification(null);
              setSelectedNotifications([]);
              markNotificationAsRead(notif.id).then(() => refetchNotifications?.());
              setRsvpNotification(notif as any);
            }}
            onOpenPoll={(notif) => {
              setSelectedNotification(null);
              setSelectedNotifications([]);
              markNotificationAsRead(notif.id).then(() => refetchNotifications?.());
              setPollNotification(notif as any);
            }}
            onMarkAsRead={(id) => { const nid = id || selectedNotification?.id; if (nid) markNotificationAsRead(nid).then(() => refetchNotifications?.()); if (!id) { setSelectedNotification(null); setSelectedNotifications([]); } }}
            onMarkAllAsRead={() => { markAllNotificationsAsRead().then(() => refetchNotifications?.()); }}
            onDelete={(id) => { if (id) setSelectedNotifications((p) => p.filter((n) => n.id !== id)); else { setSelectedNotification(null); setSelectedNotifications([]); } }}
            onAction={async (action, notificationId) => {
              const notif = selectedNotification || selectedNotifications.find((n) => n.id === notificationId);
              try {
                if (action === "accept_event" || action === "decline_event") {
                  const eventId = notif?.data?.event_id as string;
                  const eventTitle = notif?.data?.event_title as string || "Event";
                  const eventType = notif?.data?.event_type as string || "gig";
                  if (eventId && user?.id) {
                    const status = action === "accept_event" ? "confirmed" : "declined";
                    const memberName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Member";

                    const { data: membership } = await supabase
                      .from('event_members')
                      .select('id')
                      .eq('event_id', eventId)
                      .eq('user_id', user.id)
                      .maybeSingle();
                    if (membership) {
                      await respondToEventInvite(membership.id, status as 'confirmed' | 'declined');
                    }

                    const creatorId = notif?.data?.creator_id as string;
                    if (creatorId && creatorId !== user.id) {
                      await notifyEventResponse([creatorId], notif?.band_id || "", eventId, eventTitle, eventType, memberName, status);
                    }
                    if (notificationId) await markNotificationAsRead(notificationId);
                    refetchNotifications?.();
                    refetchEvents();
                  }
                }
              } catch (err) { console.error("Action error:", err); }
              const navId = notif?.data?.event_id as string;
              setSelectedNotification(null);
              setSelectedNotifications([]);
              if (navId) setTimeout(() => navigateToEvent(navId), 300);
            }}
          />
        </AnimatePresence>
      </React.Suspense>

      <AnimatePresence>
        {selectedChat && selectedChat.uuid && (
          <ChatDetailModal key="chat-detail" chat={{ id: selectedChat.uuid, type: selectedChat.type, name: selectedChat.name, initials: selectedChat.initials, avatarUrl: selectedChat.avatarUrl, unread: selectedChat.unread, members: selectedChat.members, isOnline: selectedChat.isOnline }} onClose={() => { setSelectedChat(null); refetchChats?.(); }} />
        )}
        {selectedChat && !selectedChat.uuid && (
          <motion.div key="demo-chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-xs flex items-center justify-center p-6" onClick={() => setSelectedChat(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card text-card-foreground border border-border rounded-3xl p-8 text-center max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4"><MessageSquare className="w-8 h-8" /></div>
              <h3 className="text-xl font-black text-foreground mb-2">Demo Chat</h3>
              <p className="text-muted-foreground text-sm mb-6">This is sample data. Start a real conversation using the + button!</p>
              <button onClick={() => { setSelectedChat(null); setShowNewChat(true); }} className="w-full bg-primary text-primary-foreground py-3 rounded-full font-bold text-sm shadow-xs hover:opacity-95 active:scale-95 transition-all">Start Real Chat</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            onClose={() => setShowNewChat(false)}
            onChatCreated={(id, details) => {
              setShowNewChat(false);
              const chatType = details?.type || "direct";
              const chatName = details?.name || "Chat";
              const chatInitials = details?.initials || chatName.slice(0, 2).toUpperCase();
              const chatAvatarUrl = details?.avatarUrl;
              setSelectedChat({
                id: Date.now(),
                uuid: id,
                type: chatType,
                name: chatName,
                initials: chatInitials,
                avatarUrl: chatAvatarUrl,
                lastMessage: "Start chatting...",
                time: "now",
                unread: 0,
                status: "read",
              });
              refetchChats?.();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEvent && (
          <EventDetail
            key="event-detail"
            event={selectedEvent}
            currentUserId={user?.id}
            onClose={() => { setSelectedEvent(null); setSelectedEventMembership(null); }}
            userResponse={selectedEventMembership?.status === "confirmed" ? "accepted" : selectedEventMembership?.status === "declined" ? "declined" : selectedEventMembership?.status === "pending" ? "pending" : "accepted"}
            onAccept={handleEventAccept}
            onDecline={handleEventDecline}
            onEdit={handleEventEdit}
            onDelete={handleEventDelete}
            onChat={handleEventChat}
            onConfirmQuote={handleConfirmQuote}
            onRevertQuote={handleRevertQuote}
            memberFee={selectedEventMembership?.fee}
            isAdmin={isAdmin}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rsvpNotification && (
          <EventRSVPSheet
            key={rsvpNotification.id}
            notification={rsvpNotification}
            calendarEvents={events}
            currentUserId={user?.id}
            onAccept={async () => {
              const eventId = rsvpNotification.data?.event_id as string;
              if (eventId && user?.id) {
                // Optimistically update eventMembersMap so the event card is immediately confirmed
                setEventMembersMap(prev => {
                  const list = prev[eventId] || [];
                  return {
                    ...prev,
                    [eventId]: list.map(m => m.userId === user.id ? { ...m, status: 'confirmed' } : m)
                  };
                });
                setOptimisticallyHiddenEventIds(prev => prev.filter(id => id !== eventId));

                const { data: membership } = await supabase
                  .from('event_members')
                  .select('id')
                  .eq('event_id', eventId)
                  .eq('user_id', user.id)
                  .maybeSingle();
                if (membership) await respondToEventInvite(membership.id, 'confirmed');
                const creatorId = rsvpNotification.data?.creator_id as string;
                if (creatorId) {
                  const memberName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Member";
                  const eventType = (rsvpNotification.data?.event_type as string) || 'gig';
                  await notifyEventResponse([creatorId], rsvpNotification.band_id || "", eventId, (rsvpNotification.data?.event_title as string) || "Event", eventType, memberName, "confirmed");
                }
                await markNotificationAsRead(rsvpNotification.id);
                setMembersRefreshKey(prev => prev + 1);
                refetchNotifications?.();
                refetchEvents();
              }
              const navId = rsvpNotification.data?.event_id as string;
              setRsvpNotification(null);
              if (navId) setTimeout(() => navigateToEvent(navId), 300);
            }}
            onDecline={async () => {
              const eventId = rsvpNotification.data?.event_id as string;
              if (eventId && user?.id) {
                // Optimistically hide declined event
                setOptimisticallyHiddenEventIds(prev => [...prev, eventId]);
                setEventMembersMap(prev => {
                  const list = prev[eventId] || [];
                  return {
                    ...prev,
                    [eventId]: list.map(m => m.userId === user.id ? { ...m, status: 'declined' } : m)
                  };
                });

                const { data: membership } = await supabase
                  .from('event_members')
                  .select('id')
                  .eq('event_id', eventId)
                  .eq('user_id', user.id)
                  .maybeSingle();
                if (membership) await respondToEventInvite(membership.id, 'declined');
                const creatorId = rsvpNotification.data?.creator_id as string;
                if (creatorId) {
                  const memberName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Member";
                  const eventType = (rsvpNotification.data?.event_type as string) || 'gig';
                  await notifyEventResponse([creatorId], rsvpNotification.band_id || "", eventId, (rsvpNotification.data?.event_title as string) || "Event", eventType, memberName, "declined");
                }
                await markNotificationAsRead(rsvpNotification.id);
                setMembersRefreshKey(prev => prev + 1);
                refetchNotifications?.();
                refetchEvents();
              }
              const navId = rsvpNotification.data?.event_id as string;
              setRsvpNotification(null);
              if (navId) setTimeout(() => navigateToEvent(navId), 300);
            }}
            onClose={() => setRsvpNotification(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pollNotification && (
          <RehearsalPollVoteSheet
            key={pollNotification.id}
            notification={pollNotification}
            currentUserId={user?.id || ''}
            isAdmin={isAdmin}
            onClose={() => setPollNotification(null)}
            onPollUpdated={() => {
              refetchRehearsalPolls?.();
              refetchEvents();
            }}
            onShowToast={(msg, type) => setSaveToast({ message: msg, type })}
            onOpenAdminWizard={(proposal) => {
              setPollNotification(null);
              handleConvertProposal(proposal);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {urgentNotification && !rsvpNotification && !pollNotification && (
          <UrgentNotificationPopup
            key={urgentNotification.id}
            notification={urgentNotification}
            onOpen={() => handleOpenUrgentNotification(urgentNotification)}
            onDismiss={() => setUrgentNotification(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saveToast && (
          saveToast.minimal ? (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[250] px-4 py-2 rounded-full text-xs font-semibold text-white/95 bg-black/65 dark:bg-zinc-900/75 backdrop-blur-md border border-white/10 shadow-lg text-center whitespace-nowrap pointer-events-none select-none max-w-[85vw]"
            >
              {saveToast.message}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "fixed bottom-24 left-4 right-4 max-w-[500px] mx-auto z-[250] p-4 rounded-2xl text-sm font-bold shadow-2xl flex items-center justify-between gap-3 border backdrop-blur-md",
                saveToast.type === 'error'
                  ? "bg-red-600/95 text-white border-red-500/40"
                  : saveToast.type === 'info'
                  ? "bg-zinc-900/95 text-white border-white/20"
                  : "bg-emerald-600/95 text-white border-emerald-500/40"
              )}
              onClick={() => !saveToast.action && setSaveToast(null)}
            >
              {saveToast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-white" />
              ) : saveToast.type === 'info' ? (
                <Info className="w-4 h-4 shrink-0 text-white/80" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
              )}
              <span className="flex-1 text-left truncate">{saveToast.message}</span>
              {saveToast.action && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const act = saveToast.action?.onClick;
                    setSaveToast(null);
                    act?.();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shrink-0 shadow-xs"
                >
                  {saveToast.action.label}
                </button>
              )}
              {!saveToast.action && (
                <button
                  onClick={() => setSaveToast(null)}
                  aria-label="Dismiss notification"
                  className="text-white/70 hover:text-white shrink-0 ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}


