import { handleBackFromStack } from '@/lib/backStack';
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { uuidToNumericId } from '@/lib/numericId';
import { AnimatePresence, motion } from "motion/react";
import { Loader2, MessageSquare, Music, ChevronLeft, Plus, CheckCircle2, AlertCircle, Info, X, XCircle, EyeOff } from '@/app/components/icons';
import { cn } from "@/app/components/ui/utils";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

import { useAuth } from "@/lib/AuthContext";
import { useBand } from "@/lib/BandContext";
import { useScrollDirection } from "@/app/hooks/useScrollDirection";
import { syncSystemBarsAppearance } from "@/lib/systemBars";
import { haptic } from "@/lib/haptics";
import { deleteEventDraft, useEventDrafts, type EventDraft } from "@/lib/wizardDrafts";
import { DraftPreviewSheet } from "@/app/components/drafts/DraftPreviewSheet";
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
  notifyMemberDroppedOut,
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
import { createSetlist, replaceSetlistSongs, updateSetlist } from "@/lib/services/songs";
import { receiptFor, deleteChat as deleteChatService, createChat as createChatService } from "@/lib/services/chats";
import { deleteNotification as deleteNotificationService, createNotification, getUnreadCount } from "@/lib/services/notifications";
import { syncAppBadge } from "@/lib/services/appBadge";
import { ErrorState } from "@/app/components/ui/ErrorState";
import { LeadingCompanionSlot } from "@/app/components/duo";
import { MiniPlayer } from "@/app/components/ui/MiniPlayer";
import { LyricsViewer } from "@/app/components/ui/LyricsViewer";

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
import { useRailLayout } from "@/lib/deviceRegions";
import { HeaderAction, NavBackButton } from "@/app/components/bw/Screen";
import { IdentityHub } from "@/app/components/layout/IdentityHub";
import { PendingInvitesPrompt } from "@/app/components/notifications/PendingInvitesPrompt";
import { SwitchBandPopup } from "@/app/components/layout/SwitchBandPopup";

import { HomeView } from "@/app/views/HomeView";
import { ChatView } from "@/app/views/ChatView";
import { EventsView } from "@/app/views/EventsView";
import { PastEventsView } from "@/app/views/PastEventsView";
import { OfflineBanner } from "@/app/components/ui/OfflineBanner";
import { useNetworkStatus, isOfflineError, reportNetworkStatus } from "@/lib/offline/useNetworkStatus";
import { enqueueMutation, getPendingMutations } from "@/lib/offline/syncQueue";
import { getOfflineItem, setOfflineItem, getCacheKey } from "@/lib/offline/storage";
import { todayLocal } from '../lib/dates';

const BandMembersView = React.lazy(() => import("@/app/views/BandMembersView").then(m => ({ default: m.BandMembersView })));
const SetlistManagerView = React.lazy(() => import("@/app/views/SetlistManagerView").then(m => ({ default: m.SetlistManagerView })));
const SettingsView = React.lazy(() => import("@/app/views/SettingsView").then(m => ({ default: m.SettingsView })));
const AnalyticsView = React.lazy(() => import("@/app/views/AnalyticsView").then(m => ({ default: m.AnalyticsView })));
const InventoryView = React.lazy(() => import("@/app/views/InventoryView").then(m => ({ default: m.InventoryView })));
const ContractsView = React.lazy(() => import("@/app/views/ContractsView").then(m => ({ default: m.ContractsView })));
const TaskTemplatesView = React.lazy(() => import("@/app/views/TaskTemplatesView").then(m => ({ default: m.TaskTemplatesView })));
const CreateEventModal = React.lazy(() => import("@/app/components/dashboard/CreateEventModal").then(m => ({ default: m.CreateEventModal })));
const RehearsalLiveView = React.lazy(() => import("@/app/components/rehearsal/RehearsalLiveView").then(m => ({ default: m.RehearsalLiveView })));
const RehearsalPostView = React.lazy(() => import("@/app/components/rehearsal/RehearsalPostView").then(m => ({ default: m.RehearsalPostView })));
const QuoteCreationWizard = React.lazy(() => import("@/app/components/quotes/QuoteCreationWizard").then(m => ({ default: m.QuoteCreationWizard })));
const BandPricingModal = React.lazy(() => import("@/app/components/quotes/BandPricingModal").then(m => ({ default: m.BandPricingModal })));
const QuoteShareModal = React.lazy(() => import("@/app/components/quotes/QuoteShareModal").then(m => ({ default: m.QuoteShareModal })));
import type { PricingModalTabType } from "@/app/components/quotes/BandPricingModal";

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
import { createQuote as createQuoteDB, appQuoteToDbRecord, appMusiciansToDb } from "@/lib/services/quotes";

import { ChatDetailModal, NewChatModal } from "@/app/components/chat";
import { EditProfileModal, CreateBandModal } from "@/app/components/profile";
import { UpgradePricingSheet } from "@/app/components/modals/UpgradePricingSheet";
import { PersonalGigModal } from "@/app/components/modals/PersonalGigModal";
import { NoBandRehearsalModal } from "@/app/components/modals/NoBandRehearsalModal";
import { ChooseBandProposalModal, type BandOption } from "@/app/components/modals/ChooseBandProposalModal";
import { NotificationDetailModal } from "@/app/components/notifications/NotificationDetailModal";
import { navigateToNotificationTarget, notificationBandId, notificationTarget } from "@/lib/notificationRouting";
import { IS_BETA } from "@/lib/beta";
import { BandSwitchPrompt, type BandSwitchChoice, type BandSwitchRequest } from "@/app/components/modals/BandSwitchPrompt";
import { EventRSVPSheet } from "@/app/components/notifications/EventRSVPSheet";
import { ProposeRehearsalModal } from "@/app/components/rehearsal/ProposeRehearsalModal";
import { RehearsalPollModal } from "@/app/components/rehearsal/RehearsalPollModal";
import { RehearsalPollVoteSheet } from "@/app/components/rehearsal/RehearsalPollVoteSheet";
import { UrgentNotificationPopup } from "@/app/components/notifications/UrgentNotificationPopup";
import { useRehearsalPolls } from "@/app/hooks/useData";
import type { RehearsalPoll } from "@/lib/services/rehearsalPolls";

import { useBodyScrollLock } from "@/app/hooks";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";
import { parseLocalDate } from '@/lib/dates';
import { MapsChooserHost } from '@/app/components/ui/MapsLink';
import { personName, personFirstName, personInitials } from "@/lib/personName";
import { t, useLocale } from "@/lib/i18n";
import { syncEventTasks, type EventTaskDraft } from "@/lib/services/eventTasks";
import { getEventMemberMoney, moneyLookup, saveEventLineup, type LineupRow } from "@/lib/services/eventMemberMoney";

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
    id: uuidToNumericId(event.id),
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
    paymentStatus: event.payment_status || undefined,
    depositAmount: event.deposit_amount ?? undefined,
    depositPaid: event.deposit_paid ?? undefined,
    dressCode: event.dress_code || undefined,
    clientEmail: event.client_email || undefined,
    clientPhone: event.client_phone || undefined,
    clientCompany: event.client_company || undefined,
    venueCoordinates: event.venue_coordinates || undefined,
    indoorOutdoor: event.indoor_outdoor || undefined,
    _isPendingSync: event._isPendingSync,
  };
};

export default function AuthenticatedApp() {
  const { isAuthenticated, user, profile, userMode } = useAuth();
  // Chat list labels below are built with t(); rebuild them when the language changes.
  const locale = useLocale();
  const {
    selectedBand: realBand,
    bands: realBands,
    loading: bandsLoading,
    selectBand,
    refreshBands,
    isAdmin,
  } = useBand();

  // Role in the band an item belongs to. Events, quotes and chats come from
  // every band, so the active band's role must not decide what is shown.
  const isAdminOfBand = useCallback((bandId?: string | null): boolean => {
    const band = bandId ? realBands?.find(b => b.id === bandId) : undefined;
    return band ? band.user_role === 'admin' : isAdmin;
  }, [realBands, isAdmin]);

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
        try { await Keyboard.setAccessoryBarVisible({ isVisible: false }); } catch (_) {}
        try { await Keyboard.setScroll({ isDisabled: false }); } catch (_) {}

        document.addEventListener(
          "touchstart",
          (e) => {
            const target = e.target as HTMLElement;
            const a = document.activeElement as HTMLElement;
            // Areas marked data-keep-keyboard (the chat) keep it up: there it
            // closes with a swipe down on the messages or Android Back.
            // data-keep-keyboard="android" keeps it up on Android only.
            const keep = target.closest?.('[data-keep-keyboard]') as HTMLElement | null;
            if (keep && (keep.dataset.keepKeyboard !== 'android' || Capacitor.getPlatform() === 'android')) return;
            if (
              a &&
              ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) &&
              !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
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
        if (!isHeaderScrolledRef.current && top > 20) {
          isHeaderScrolledRef.current = true;
          setIsHeaderScrolled(true);
        } else if (isHeaderScrolledRef.current && top < 8) {
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
  const { data: financeData, loading: financeLoading, refetch: refetchFinance } = useExpandedFinanceData(realBand?.id || null);
  const { events: confirmedEvents, loading: confirmedEventsLoading } = useExpandedEventsData(realBand?.id || null, ["confirmed"]);
  const { events: pendingEvents, loading: pendingEventsLoading } = useExpandedEventsData(realBand?.id || null, ["draft", "pending", "quoted"]);
  const { quotes: realQuotes, stats: quotesStats, loading: quotesLoading, refetch: refetchExpandedQuotes } = useExpandedQuotesData(realBand?.id || null);

  // Navigation
  const [activeTab, setActiveTab] = useState<TabName>("Home");
  // iPhone Duo rail (Figma "Duo"): the switch-band sheet keeps the tabs, the inbox hides them.
  const { twoPane, rail: railLayout } = useRailLayout();
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
  const [createEventInitialDate, setCreateEventInitialDate] = useState<string | null>(null);
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
  const [showNoBandRehearsalModal, setShowNoBandRehearsalModal] = useState(false);
  const [showChooseBandProposalModal, setShowChooseBandProposalModal] = useState(false);
  const [proposalTargetBand, setProposalTargetBand] = useState<BandOption | null>(null);
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
    if (saveToast.type === 'success') {
      haptic.confirm();
    } else if (saveToast.type === 'error') {
      haptic.delete();
    }
    const duration = saveToast.duration || (saveToast.action ? 8000 : 5000);
    const timer = setTimeout(() => setSaveToast(null), duration);
    return () => clearTimeout(timer);
  }, [saveToast]);

  const { isOnline, wasOffline, pendingSyncCount, triggerSync } = useNetworkStatus((msg) => {
    setSaveToast({ message: msg, type: 'success' });
    refetchEvents();
    if (refetchDashboard) refetchDashboard();
  });

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
  
  // (A client-side "dedupe" that silently deleted events sharing title, date
  // and time was removed: it deleted real rows for everyone. Creates are now
  // idempotent through a client-generated id, see handleEventCreate.)
  
  // ═══ LOCAL CLIENT-SIDE BAND PILL FILTER (instant, <1ms) ═══
  const [selectedBandPill, setSelectedBandPill] = useState<string>('all');
  const [urgentNotification, setUrgentNotification] = useState<import('@/lib/services/notifications').Notification | null>(null);
  const [rsvpNotification, setRsvpNotification] = useState<import('@/lib/services/notifications').Notification | null>(null);
  const [pollNotification, setPollNotification] = useState<import('@/lib/services/notifications').Notification | null>(null);
  const { notifications: realNotifications, loading: notificationsLoading, refetch: refetchNotifications, setNotifications: setRealNotifications } = useNotifications({
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

  // App icon badge = the exact unread count on the server, refreshed whenever
  // the list changes (read, deleted, new) and when the app comes back.
  useEffect(() => {
    if (!isNative || notificationsLoading) return;
    let cancelled = false;
    getUnreadCount().then(({ data }) => {
      if (!cancelled && data !== null) syncAppBadge(data);
    });
    return () => { cancelled = true; };
  }, [isNative, notificationsLoading, realNotifications]);
  useEffect(() => {
    if (!isNative) return;
    const sub = App.addListener("resume", () => {
      getUnreadCount().then(({ data }) => { if (data !== null) syncAppBadge(data); });
    });
    return () => { void sub.then((h) => h.remove()); };
  }, [isNative]);

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
  const membersMapCacheKey = getCacheKey(user?.id, 'global', 'event_members_map');

  // Seed eventMembersMap from offline cache on mount
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    getOfflineItem<Record<string, { name: string; userId: string; fee?: number; status?: string }[]>>(membersMapCacheKey)
      .then((cached) => {
        if (isMounted && cached && Object.keys(cached).length > 0) {
          setEventMembersMap(prev => ({ ...cached, ...prev }));
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [user?.id, membersMapCacheKey]);

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
      // Resolve names from band members already in memory
      const bandNameMap: Record<string, string> = {};
      realBand?.members?.forEach((m: any) => {
        if (m.user_id) bandNameMap[m.user_id] = personName(m.profile);
      });

      // Include pending offline event members from syncQueue
      const pendingMap: Record<string, { name: string; userId: string; fee?: number; status?: string }[]> = {};
      try {
        const pendingMutations = await getPendingMutations();
        pendingMutations.forEach(m => {
          if (m.type === 'create_event' && m.payload?.eventData?.id) {
            const evId = m.payload.eventData.id;
            const rawMembers = m.payload.memberIds || [];
            if (Array.isArray(rawMembers) && rawMembers.length > 0) {
              pendingMap[evId] = rawMembers.map((rm: any) => {
                const uid = rm.user_id || rm.id;
                return {
                  name: rm.name || bandNameMap[uid] || 'Member',
                  userId: uid,
                  fee: parseFloat(rm.fee) || 0,
                  status: rm.status || (uid === user?.id ? 'confirmed' : 'pending'),
                };
              });
            } else if (user?.id) {
              pendingMap[evId] = [{
                name: bandNameMap[user.id] || 'Me',
                userId: user.id,
                fee: Number(m.payload.eventData.fee) || 0,
                status: 'confirmed',
              }];
            }
          }
        });
      } catch {
        // Ignore queue read error
      }

      const dbEventIds = masterEventsList
        .map(e => e.id)
        .filter(id => id && !String(id).startsWith('offline_'));

      if (dbEventIds.length === 0) {
        if (Object.keys(pendingMap).length > 0) {
          setEventMembersMap(prev => ({ ...prev, ...pendingMap }));
        }
        return;
      }

      // Simple query WITHOUT profile join to avoid FK/schema issues
      const { data, error } = await supabase
        .from('event_members')
        .select('event_id, user_id, status')
        .in('event_id', dbEventIds);

      if (error) {
        console.error('event_members query failed:', error.message);
        const cached = await getOfflineItem<Record<string, { name: string; userId: string; fee?: number; status?: string }[]>>(membersMapCacheKey);
        setEventMembersMap(prev => ({ ...(cached || {}), ...prev, ...pendingMap }));
        return; // Keep previous/cached map rather than overwriting with empty
      }

      // Fees: all rows for events this user manages, only their own otherwise (071).
      const { data: money } = await getEventMemberMoney(dbEventIds);
      const feeOf = moneyLookup(money);
      const map: Record<string, { name: string; userId: string; fee?: number; status?: string }[]> = { ...pendingMap };
      data?.forEach((em: any) => {
        if (!map[em.event_id]) map[em.event_id] = [];
        const fee = feeOf(em.event_id, em.user_id)?.fee;
        map[em.event_id].push({ name: bandNameMap[em.user_id] || 'Member', userId: em.user_id, fee: fee ?? undefined, status: em.status });
      });
      setEventMembersMap(map);
      setOfflineItem(membersMapCacheKey, map).catch(() => {});
    };
    fetchAllMembers();
  }, [masterEventsList, membersRefreshKey, realBand?.members, user?.id, membersMapCacheKey]);

  // Build band lookup for event mapping
  const bandLookup = useMemo(() => {
    const map: Record<string, string> = {};
    realBands?.forEach(b => { if (b.id) map[b.id] = b.name; });
    if (realBand?.id && realBand?.name) map[realBand.id] = realBand.name;
    return map;
  }, [realBands, realBand]);

  const formattedBands = useMemo(() => realBands?.map(b => ({ id: b.id, name: b.name })) || [], [realBands]);

  const events = useMemo(() => {
    if (masterEventsList && masterEventsList.length > 0) {
      let list = masterEventsList;
      // Regular members must not have access to quotes until converted to gigs
      // AND members only see gigs or rehearsals where they've been added by an admin
      {
        list = list.filter(e => {
          if (isAdminOfBand(e.band_id)) return true;
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
  }, [masterEventsList, eventMembersMap, isAdminOfBand, user?.id, bandLookup, realBand?.name]);

  // ═══ INSTANT CLIENT-SIDE FILTERING (band pill + status + search + optimistic) ═══
  // To-do lists → "Add to an existing one": the band's upcoming gigs,
  // rehearsals and quotes (saved online, so they have tasks).
  const templateTargetEvents = useMemo(() => {
    const today = todayLocal();
    return (events || [])
      .filter((e: any) => (!realBand?.id || e.band_id === realBand.id) && !e._isPendingSync)
      .map((e: any) => {
        const id = String(e.eventId || e.id || '');
        const date = String(e.date || '').slice(0, 10);
        const kind: 'gig' | 'rehearsal' | 'quote' =
          e.eventType === 'rehearsal' || e.status === 'REHEARSAL' ? 'rehearsal' : e.status === 'TENTATIVE' || e.status === 'QUOTE' || e.eventType === 'quote' ? 'quote' : 'gig';
        return { id, title: e.title || 'Untitled', date, kind };
      })
      .filter((e) => /^[0-9a-f-]{36}$/i.test(e.id) && (!e.date || e.date >= today))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 60);
  }, [events, realBand?.id]);

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
        if (!isAdminOfBand(e.band_id)) {
          return !!myMembership && myMembership.status !== 'declined';
        }
        return !myMembership || myMembership.status !== 'declined';
      });
    }
    // Double safety: regular members must never see unconverted quotes
    result = result.filter(e => isAdminOfBand(e.band_id) || ((e.status as string) !== 'QUOTE' && (e.status as string) !== 'QUOTED' && e.eventType !== 'quote'));
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
  }, [events, selectedBandPill, eventFilter, eventSearch, optimisticallyHiddenEventIds, eventMembersMap, user?.id, isAdminOfBand]);

  // ── Drafts in the calendar ──────────────────────────────────
  // The admin's saved gig / rehearsal drafts and quotes not shared yet show
  // on their day (desaturated, "only you"); undated ones under Drafts.
  const myEventDrafts = useEventDrafts(isAdmin && realBand?.id ? user?.id : null, realBand?.id ?? null);
  // Quotes not shared yet, by quote id and by the tentative event they hold.
  const draftQuoteIds = useMemo(() => {
    const ids = new Set<string>();
    (realQuotes || [])
      .filter((q) => String(q.status).toLowerCase() === 'draft')
      .forEach((q) => {
        ids.add(q.id);
        if (q.converted_to_event_id) ids.add(q.converted_to_event_id);
      });
    return ids;
  }, [realQuotes]);
  const calendarEvents = useMemo(() => {
    if (!isAdmin || selectedBandPill === 'personal') return visuallyFilteredEvents;
    const f = String(eventFilter).toUpperCase();
    const wantDrafts = f === 'DRAFTS' || f === 'DRAFT';
    const q = eventSearch.trim().toLowerCase();
    const matches = (e: EventData) => !q || e.title.toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q);
    const isQuoteDraft = (e: EventData) =>
      (!!e.quoteId && draftQuoteIds.has(e.quoteId)) || (!!e.eventId && draftQuoteIds.has(e.eventId));
    // The quote's own status on its card (SENT, VIEWED…), same as its detail.
    const quoteStatusOf = (e: EventData) => {
      const q = (realQuotes || []).find(
        (x) => (e.quoteId && x.id === e.quoteId) || (e.eventId && x.converted_to_event_id === e.eventId),
      );
      return q?.status ? String(q.status).toLowerCase() : undefined;
    };
    const base: EventData[] = visuallyFilteredEvents.map((e) => {
      const qs = e.status === 'QUOTE' ? quoteStatusOf(e) : undefined;
      const withStatus = qs ? { ...e, quoteStatus: qs } : e;
      return isQuoteDraft(e) ? { ...withStatus, draftOf: 'quote' as const } : withStatus;
    });
    if (wantDrafts) {
      const have = new Set(base.map((e) => e.eventId));
      events
        .filter((e) => isQuoteDraft(e) && !have.has(e.eventId) && matches(e))
        .forEach((e) => base.push({ ...e, draftOf: 'quote' as const }));
    }
    const local = myEventDrafts
      .map((d): EventData => {
        const st = (d.state || {}) as Record<string, any>;
        const isReh = d.eventType === 'rehearsal';
        const time = isReh ? st.data?.time : st.details?.startTime;
        const endTime = isReh ? st.endTime : st.details?.endTime;
        let h = 7;
        for (let i = 0; i < d.id.length; i++) h = (h * 31 + d.id.charCodeAt(i)) | 0;
        return {
          id: -Math.abs(h || 1),
          eventId: `draft:${d.id}`,
          band_id: d.bandId || undefined,
          title: d.title || (isReh ? 'Untitled rehearsal' : 'Untitled gig'),
          status: isReh ? 'REHEARSAL' : 'CONFIRMED',
          date: d.date || '',
          // An undated draft's time is only the wizard's default.
          time: d.date && typeof time === 'string' ? time : '',
          endTime: d.date && typeof endTime === 'string' && endTime ? endTime : undefined,
          location: d.venue || '',
          price: '',
          members: [],
          color: '',
          eventType: isReh ? 'rehearsal' : d.eventType || undefined,
          draftOf: isReh ? 'rehearsal' : 'gig',
          draftId: d.id,
        };
      })
      .filter((e) => {
        if (!e.date && !wantDrafts) return false; // undated drafts live under Drafts
        if (f === 'ALL' || wantDrafts) return true;
        if (f === 'GIGS' || f === 'CONFIRMED') return e.draftOf === 'gig';
        if (f.startsWith('REHEARSAL')) return e.draftOf === 'rehearsal';
        return false;
      })
      .filter(matches);
    return local.length ? [...base, ...local] : base;
  }, [isAdmin, selectedBandPill, eventFilter, eventSearch, visuallyFilteredEvents, events, draftQuoteIds, myEventDrafts, realQuotes]);
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  const previewDraft = previewDraftId ? myEventDrafts.find((d) => d.id === previewDraftId) || null : null;

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

  /**
   * An event a notification points at that isn't on the user's calendar:
   * 'gone' (deleted / cancelled), 'hidden' (back to a quote, or declined),
   * or 'error' (couldn't check: offline). Only 'error' offers Try again.
   */
  const [eventLoadError, setEventLoadError] = useState<
    { id: string; kind: 'gone' | 'hidden' | 'error'; title?: string; message?: string } | null
  >(null);
  const missingCtxRef = useRef({ userId: user?.id, isAdminOfBand, eventMembersMap, bandLookup });
  missingCtxRef.current = { userId: user?.id, isAdminOfBand, eventMembersMap, bandLookup };
  /** Works out why an event isn't in the list, or opens it when it can. */
  const explainMissingEvent = useCallback(async (eventDbId: string) => {
    const { userId, isAdminOfBand: adminOf, eventMembersMap: membersMap, bandLookup: bands } = missingCtxRef.current;
    const { data: row, error } = await supabase.from('events').select('*').eq('id', eventDbId).maybeSingle();
    if (error) {
      setEventLoadError({ id: eventDbId, kind: 'error', message: error.message });
      return;
    }
    const dayOf = (d?: string | null) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
      return m
        ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        : null;
    };
    if (!row) {
      // Deleted: name it from the notifications the user got about it.
      let info: Record<string, any> = {};
      let cancelled = false;
      if (userId) {
        const { data: notes } = await supabase
          .from('notifications')
          .select('type, data')
          .eq('user_id', userId)
          .filter('data->>event_id', 'eq', eventDbId)
          .order('created_at', { ascending: false })
          .limit(10);
        for (const n of notes || []) {
          const d = (n.data || {}) as Record<string, any>;
          if (n.type === 'event_cancelled' || d.deleted) cancelled = true;
          info = { ...d, ...info, event_title: info.event_title || d.event_title, event_date: info.event_date || d.event_date };
        }
      }
      const isRehearsal = info.event_type === 'rehearsal';
      const name = info.event_title ? `“${info.event_title}”` : isRehearsal ? t('This rehearsal') : t('This gig');
      const day = dayOf(info.event_date);
      setEventLoadError({
        id: eventDbId,
        kind: 'gone',
        title: cancelled ? (isRehearsal ? t('Rehearsal cancelled') : t('Gig cancelled')) : isRehearsal ? t('Rehearsal removed') : t('Event removed'),
        message: cancelled
          ? day
            ? t("{name} on {day} was cancelled by an admin, so it's no longer on the calendar. Nothing else to do.", { name, day })
            : t("{name} was cancelled by an admin, so it's no longer on the calendar. Nothing else to do.", { name })
          : day
            ? t("{name} on {day} was deleted by an admin, so it's no longer on the calendar. Nothing else to do.", { name, day })
            : t("{name} was deleted by an admin, so it's no longer on the calendar. Nothing else to do.", { name }),
      });
      return;
    }
    const s = String(row.status || '').toLowerCase();
    const asQuote =
      (row.quote_id || row.event_type === 'quote' || ['tentative', 'quoted', 'quote'].includes(s)) && s !== 'confirmed' && s !== 'completed';
    const admin = adminOf(row.band_id);
    const mine = userId ? (membersMap[row.id] || []).find((m) => m.userId === userId) : undefined;
    if (!admin && row.band_id && asQuote) {
      setEventLoadError({
        id: eventDbId,
        kind: 'hidden',
        title: t('Not confirmed yet'),
        message: dayOf(row.event_date)
          ? t('“{title}” on {day} went back to being a quote. It comes back to your calendar as soon as an admin confirms it as a gig.', { title: row.title || t('This gig'), day: dayOf(row.event_date) ?? '' })
          : t('“{title}” went back to being a quote. It comes back to your calendar as soon as an admin confirms it as a gig.', { title: row.title || t('This gig') }),
      });
      return;
    }
    if (!admin && mine?.status === 'declined') {
      setEventLoadError({
        id: eventDbId,
        kind: 'hidden',
        title: t("You can't make it"),
        message: t("You declined “{title}”, so it's not on your calendar. Ask an admin if you'd like to join after all.", { title: row.title || t('this event') }),
      });
      return;
    }
    // On the server but not in the list yet (another band, still loading): open it.
    const item = eventToEventItem(row as Event);
    item.band_id = row.band_id || undefined;
    item.band_name = row.band_id ? bands[row.band_id] : 'Personal';
    handleEventCardClickRef.current(item);
  }, []);
  const navigateToEvent = useCallback(async (eventDbId: string) => {
    setActiveTab("Events");
    setEventLoadError(null);
    setTimeout(async () => {
      const ev = eventsRef.current.find(e => e.eventId === eventDbId);
      if (ev) {
        handleEventCardClickRef.current(ev);
      } else {
        try {
          await refetchEvents();
        } catch (err: any) {
          setEventLoadError({ id: eventDbId, kind: 'error', message: err?.message });
          return;
        }
        setTimeout(() => {
          const evRetry = eventsRef.current.find(e => e.eventId === eventDbId);
          if (evRetry) handleEventCardClickRef.current(evRetry);
          else
            void explainMissingEvent(eventDbId).catch((err: any) =>
              setEventLoadError({ id: eventDbId, kind: 'error', message: err?.message }),
            );
        }, 500);
      }
    }, 200);
  }, [refetchEvents, explainMissingEvent]);

  // ═══ Several bands: act in the band an item belongs to ═══
  // Viewing works from any band; changing something of another band asks to
  // switch to it first, so an edit never lands in the wrong band.
  const realBandRef = useRef(realBand);
  realBandRef.current = realBand;
  const realBandsRef = useRef(realBands);
  realBandsRef.current = realBands;
  const [bandSwitchRequest, setBandSwitchRequest] = useState<BandSwitchRequest | null>(null);
  const bandSwitchResolveRef = useRef<((choice: BandSwitchChoice) => void) | null>(null);
  const chooseBandSwitch = useCallback((choice: BandSwitchChoice) => {
    const resolve = bandSwitchResolveRef.current;
    bandSwitchResolveRef.current = null;
    setBandSwitchRequest(null);
    resolve?.(choice);
  }, []);
  /**
   * 'active' when the item's band is already the active one (or it has none /
   * isn't one of the user's bands), otherwise the user's choice. 'switch' has
   * already switched the band.
   */
  const askBandFor = useCallback(
    (bandId: string | null | undefined, action: string, allowStay = false): Promise<BandSwitchChoice | 'active'> => {
      const band = bandId ? realBandsRef.current.find((b) => b.id === bandId) : undefined;
      if (!band || band.id === realBandRef.current?.id) return Promise.resolve('active');
      bandSwitchResolveRef.current?.('cancel');
      return new Promise((resolve) => {
        bandSwitchResolveRef.current = (choice) => {
          if (choice === 'switch') selectBand(band.id);
          resolve(choice);
        };
        setBandSwitchRequest({ bandName: band.name, activeBandName: realBandRef.current?.name, action, allowStay });
      });
    },
    [selectBand],
  );
  /** Runs `run` in the item's band, switching first if the user agrees. */
  const inItemBand = useCallback(
    async (bandId: string | null | undefined, action: string, run: () => unknown) => {
      const choice = await askBandFor(bandId, action);
      if (choice === 'active' || choice === 'switch') await run();
    },
    [askBandFor],
  );
  const askBandForRef = useRef(askBandFor);
  askBandForRef.current = askBandFor;

  // Push navigation - deep link to the relevant screen
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  useEffect(() => {
    const handler = async (ev: globalThis.Event) => {
      const d = (ev as CustomEvent).detail;
      // Another band's notification: band screens (quotes, finance, members)
      // show the active band, so they need the switch; events and chats can
      // also just be viewed from here.
      if (d.bandId && d.screen !== "invites" && d.screen !== "home") {
        const viewable = d.screen === "event" || d.screen === "chat";
        const choice = await askBandForRef.current(
          d.bandId,
          viewable ? "act on it" : "open it",
          viewable,
        );
        if (choice === "cancel") return;
        // Let the switched band render before opening a band screen.
        if (choice === "switch") await new Promise((r) => setTimeout(r, 150));
      }
      if (d.screen === "chat" && d.chatId) {
        setActiveTab("Chat");
        setTimeout(() => {
          setSelectedChat({ id: Date.now(), uuid: d.chatId, type: "direct", name: "Chat", initials: "CH", lastMessage: "", time: "now", unread: 0, status: "received" });
        }, 100);
      } else if (d.screen === "event" && d.eventId) {
        navigateToEvent(d.eventId);
      } else if (d.screen === "event") {
        setActiveTab("Events");
      } else if (d.screen === "quotes") {
        if (isAdminRef.current) setExpandedCard("quotes");
        else setActiveTab("Home");
      } else if (d.screen === "finance") {
        if (isAdminRef.current) setExpandedCard("finance");
        else setActiveTab("Home");
      } else if (d.screen === "invites") {
        setActiveTab("Home");
        window.dispatchEvent(new CustomEvent("bw:refresh-invites"));
      } else if (d.screen === "bandMembers") {
        setShowBandMembers(true);
      } else if (d.screen === "repertoire") {
        setShowSetlistManager(true);
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
      const numId = uuidToNumericId(n.id);
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
        id: uuidToNumericId(n.id),
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
        id: uuidToNumericId(realBand.id),
        name: realBand.name,
        role: realBand.user_role === "admin" ? "ADMIN" : "MEMBER",
        initials: realBand.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        members: realBand.member_count,
        genre: realBand.genre || "",
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
  const [votePollId, setVotePollId] = useState<string | null>(null);
  const [showCreateBand, setShowCreateBand] = useState(false);
  const [showUpgradePricing, setShowUpgradePricing] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingModalInitialTab, setPricingModalInitialTab] = useState<PricingModalTabType>('rates');
  const [pricingReturnTo, setPricingReturnTo] = useState<'settings' | 'control_deck' | 'identity_hub' | null>(null);
  const [sharingQuote, setSharingQuote] = useState<Partial<Quote> | null>(null);
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

    // Define limits per tier. Paid plans aren't on sale yet, so everyone gets
    // the free Indie Act allowance (1 band) — before, solo users and members
    // had 0 and hit a paywall whose Upgrade button did nothing.
    const limits: Record<string, number> = {
      free_member: 1,
      single_band: 1,
      multi_band: 5,
      unlimited: Infinity,
    };

    // Beta: no band limit for anyone.
    const limit = IS_BETA ? Infinity : limits[tier] ?? 0;

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

  // The inbox stays open while empty (after Clear or the last swipe), so it
  // can show "No notifications yet" instead of not opening at all.
  const [inboxOpen, setInboxOpen] = useState(false);
  const isNotificationsOpen = inboxOpen || !!selectedNotification || selectedNotifications.length > 0;

  /** Deletes notifications for good (list, badge and other devices). */
  const removeNotifications = useCallback((ids: string[]) => {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    Promise.all(unique.map((nid) => deleteNotificationService(nid))).then((results) => {
      if (results.some((r) => r.error)) {
        setSaveToast({ message: unique.length > 1 ? t('Could not delete the notifications.') : t('Could not delete the notification.'), type: 'error' });
      }
      refetchNotifications?.();
    });
  }, [refetchNotifications]);

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
    setInboxOpen(true);
    setSelectedNotification(null);
    if (unreadCount > 0) {
      markAllNotificationsAsRead().then(() => {
        refetchNotifications?.();
      });
    }
  }, [realNotifications, unreadCount, refetchNotifications]);

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

      // The chat's own band; never label a chat with the active band.
      const chatBand = chat.band_id ? realBands.find((b) => b.id === chat.band_id) : undefined;
      const currentBandName = chatBand?.name;
      const currentBandLogo = chatBand?.logo_url;

      const others = chat.participants.filter((p) => p.user_id !== user?.id);
      let displayName = "";
      let avatarUrl: string | undefined = undefined;
      if (type === "direct") {
        const otherWithProfile = others.find((p) => (p as any).profile);
        // Always the other person's name, never a generic "Direct Chat".
        displayName = (otherWithProfile ? personName((otherWithProfile as any).profile, "") : "") || (chat.name && chat.name !== "New Chat" && chat.name !== "Chat" && chat.name !== "Direct Chat" ? chat.name : "Member");
        const otherWithAvatar = others.find((p) => (p as any).profile?.avatar_url);
        avatarUrl = (otherWithAvatar as any)?.profile?.avatar_url || undefined;
      } else if (type === "band") {
        displayName = currentBandName || (chat.name && chat.name !== "New Chat" ? chat.name : t("Band Chat"));
        avatarUrl = currentBandLogo || (chat as any).logo_url || (chat as any).avatar_url || undefined;
      } else if (type === "event") {
        displayName = (chat.name && chat.name !== "New Chat") ? chat.name : t("Event Chat");
      }
      if (!displayName || displayName === "New Chat") {
        displayName = t("Chat");
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

      let timeStr = t("now");
      if (diffDays > 7) timeStr = lastTime.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      else if (diffDays > 1) timeStr = lastTime.toLocaleDateString("en-US", { weekday: "short" });
      else if (diffDays === 1) timeStr = t("Yesterday");
      else if (diffHours > 0) timeStr = lastTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      else if (diffMins > 0) timeStr = t("{count}m", { count: diffMins });

      const bandName = currentBandName || "";
      let subtitle = "";
      if (type === "direct") subtitle = bandName;
      else if (type === "event") {
        const ed = chat.event_id ? "Event" : "";
        subtitle = bandName ? `${bandName}${ed ? " • " + ed : ""}` : ed;
      }

      let senderName = "";
      if ((type === "band" || type === "event") && chat.last_message?.sender) {
        senderName = chat.last_message.sender.id !== user?.id ? personFirstName(chat.last_message.sender, t("Someone")) : t("You");
      }

      let lastMessageDisplay = chat.last_message?.content || t("No messages yet");
      if (senderName && chat.last_message?.content) lastMessageDisplay = `${senderName}: ${chat.last_message.content}`;

      let eventDateStr = "";
      let eventMonthStr = "";
      if (type === "event" && chat.created_at) {
        const d = new Date(chat.created_at);
        eventDateStr = d.getDate().toString();
        eventMonthStr = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
      }

      // Presence is the source of truth once it has synced (our own id is in
      // the set); until then, someone who read a chat in the last minute counts.
      const presenceReady = !!user?.id && onlineUserIds.has(user.id);
      const isOnline = others.some((p) => {
        if (onlineUserIds.has(p.user_id)) return true;
        if (!presenceReady && p.last_read_at) {
          const diff = Date.now() - new Date(p.last_read_at).getTime();
          return diff < 60 * 1000;
        }
        return false;
      });

      const isLastMessageMine = chat.last_message ? chat.last_message.sender_id === user?.id : false;
      const lastMessageStatus = isLastMessageMine && chat.last_message?.created_at
        ? receiptFor(chat.last_message.created_at, others)
        : undefined;
      const isLastMessageRead = lastMessageStatus === "read";

      return {
        id: uuidToNumericId(chat.id),
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
        bandLabel: realBands.length > 1 && type !== "band" && bandName ? bandName : undefined,
        date: eventDateStr,
        month: eventMonthStr,
        lastMessageAt: lastTime,
        isOnline,
        isLastMessageMine,
        isLastMessageRead,
        lastMessageStatus,
      };
    }) as ChatItem[];
  }, [realChats, realBand?.name, realBand?.logo_url, realBands, user?.id, onlineUserIds, locale]);

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
          const baseDate = parseLocalDate(normDate);
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
        if (!isAdminOfBand(e.band_id)) {
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
  }, [events, eventMembersMap, user?.id, realBand?.id, isAdminOfBand]);

  const currentRehearsal = upcomingRehearsals[rehearsalIndex] || upcomingRehearsals[0];

  const memoizedBandMembers = useMemo(() => {
    if (!realBand?.members) return [];
    return realBand.members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: personName(m.profile),
      role: m.role || m.instrument || "Member",
      fee: String(m.default_fee || 0),
      initials: personInitials(m.profile, "M"),
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
    // Recount when a library screen closes or the hub opens, so the numbers
    // follow what was just added or removed.
  }, [realBand?.id, isIdentityOpen, isControlDeckOpen, showInventory, showContracts, showTaskTemplates, showSetlistManager]);

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
  const closeIdentity = () => { setIsIdentityOpen(false); if (twoPane) setShowEditProfile(false); if (activeTab === "More") setActiveTab("Home"); };
  // Duo open: the event thread opened from a gig keeps the gig on the left.
  useEffect(() => {
    const on = twoPane && !!selectedChat && !!selectedEvent;
    document.documentElement.toggleAttribute('data-bw-chat-over-event', on);
  }, [twoPane, selectedChat, selectedEvent]);

  // Duo open: a hub (members, library, gear, documents, templates, analytics,
  // settings, archive) takes the leading page; stale trailing details go.
  const hubOpen = showBandMembers || showSetlistManager || showInventory || showContracts || showTaskTemplates || showAnalytics || showSettings || showPastEvents;
  useEffect(() => {
    if (!twoPane || !hubOpen) return;
    setShowEditProfile(false);
    setSelectedEvent(null);
    setSelectedEventMembership(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoPane, hubOpen]);

  // Figma "Duo · Identity" (open): the profile editor sits on the trailing
  // page next to "Who you are", instead of an empty placeholder.
  useEffect(() => {
    if (twoPane && isIdentityOpen) setShowEditProfile(true);
  }, [twoPane, isIdentityOpen]);

  const toggleIdentity = () => {
    setIsIdentityOpen(prev => !prev);
    setIsControlDeckOpen(false);
    setIsBandSwitcherOpen(false);
  };

  const toggleControlDeck = toggleIdentity;

  // iPhone Duo rail profile: it is reachable from every screen, so opening it
  // first closes the browsing layers that would otherwise sit on top of it.
  // Create/edit flows keep it disabled so nothing typed is lost.
  const railProfileLocked =
    !isIdentityOpen && (isCreateEventOpen || showPersonalGigModal || showEditProfile || showUpgradePricing || showPricingModal || !!rsvpNotification || !!pollNotification || !!votePollId);
  const openRailProfile = () => {
    if (isIdentityOpen) { closeIdentity(); return; }
    if (railProfileLocked) return;
    setShowSettings(false);
    setShowBandMembers(false);
    setShowSetlistManager(false);
    setShowAnalytics(false);
    setShowInventory(false);
    setShowContracts(false);
    setShowTaskTemplates(false);
    setShowPastEvents(false);
    setShowNewChat(false);
    setIsBandSwitcherOpen(false);
    setIsDayPickerOpen(false);
    setSelectedChat(null);
    setSelectedEvent(null);
    setSelectedNotification(null);
    setExpandedCard(null);
    setIsPlusMenuOpen(false);
    openIdentity();
  };

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

    const realNotifForType = first ? realNotifications?.find((rn) => { const nid = uuidToNumericId(rn.id); return nid === first.id; }) : null;
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
        if (realData.length === 1) { setSelectedNotification(realData[0]); setSelectedNotifications([]); setInboxOpen(false); }
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

  const [createEventInitialTasks, setCreateEventInitialTasks] = useState<{ title: string; templateId?: string; dueOffset?: number }[] | undefined>(undefined);
  // "New gig" reopened from Drafts on the home screen (lib/wizardDrafts).
  const [activeEventDraft, setActiveEventDraft] = useState<EventDraft | null>(null);
  const openEventDraft = (d: EventDraft) => {
    setPreviewDraftId(null);
    setCreateEventInitialDate(null);
    setEditingEventData(null);
    setCreateEventInitialTasks(undefined);
    setActiveEventDraft(d);
    setCreateEventType(d.eventType === 'rehearsal' ? 'rehearsal' : null);
    setIsCreateEventOpen(true);
  };
  useEffect(() => {
    if (!isCreateEventOpen) setActiveEventDraft(null);
  }, [isCreateEventOpen]);
  const handleCreateEvent = (type: CreateEventType) => {
    if (type === 'personal') {
      setEditingPersonalGig(null);
      setShowPersonalGigModal(true);
      return;
    }
    if (type === 'rehearsal' && !isAdmin) {
      if (!realBands || realBands.length === 0) {
        setShowNoBandRehearsalModal(true);
        return;
      }
      if (realBands.length > 1) {
        setShowChooseBandProposalModal(true);
        return;
      }
      // User is in a single band
      setProposalTargetBand(realBands[0]);
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
    inboxOpen,
    showPersonalGigModal,
    showNoBandRehearsalModal,
    showChooseBandProposalModal,
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
    inboxOpen,
    showPersonalGigModal,
    showNoBandRehearsalModal,
    showChooseBandProposalModal,
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

      // 0. Screens that go back one level themselves (Settings sub-sections,
      //    the quote PDF sheet, pricing tabs…) get the press first.
      if (handleBackFromStack()) return;

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
      if (s.selectedNotifications.length > 0 || s.inboxOpen) {
        setSelectedNotifications([]); setInboxOpen(false);
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
      if (s.showNoBandRehearsalModal) {
        setShowNoBandRehearsalModal(false);
        return;
      }
      if (s.showChooseBandProposalModal) {
        setShowChooseBandProposalModal(false);
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
          message: t("Tap again to exit"),
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
        const { data: rawMembers } = await getEventMemberMoney([selectedEvent.eventId]);
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
    haptic.delete();
    try {
      if (!selectedEvent.band_id) {
        const { error } = await deletePersonalGig(selectedEvent.eventId, user?.id);
        if (error) throw error;
      } else {
        const { data: deleted, error } = await supabase
          .from('events')
          .delete()
          .eq('id', selectedEvent.eventId)
          .select('id');
        if (error) throw error;
        if (!deleted?.length) throw new Error('Only band admins can delete this event.');
        // The quote that holds this date: deleting a quote deletes it too (no
        // orphan draft left in Quotes); deleting a gig keeps the quote as a
        // record but drops its link to the gone event.
        const linkFilter = `converted_to_event_id.eq.${selectedEvent.eventId}${
          selectedEvent.quoteId ? `,id.eq.${selectedEvent.quoteId}` : ''
        }`;
        if (String(selectedEvent.status).toUpperCase() === 'QUOTE') {
          await supabase.from('quotes').delete().or(linkFilter);
          refetchExpandedQuotes?.();
        } else {
          await supabase.from('quotes').update({ converted_to_event_id: null }).eq('converted_to_event_id', selectedEvent.eventId);
        }
      }
      setSaveToast({ message: t('Event deleted'), type: 'success' });
      refetchEvents();
      refetchDashboard?.();
    } catch (err: any) {
      console.error('Delete error:', err);
      setSaveToast({ message: t('Could not delete the event: {error}', { error: err?.message || t('unknown error') }), type: 'error' });
      return; // keep the detail open
    }
    setSelectedEvent(null);
    setSelectedEventMembership(null);
  };

  // Opens (or creates) the event's own chat with its lineup.
  const handleEventChat = async () => {
    if (!selectedEvent) return;
    const ev = selectedEvent;
    if (isSolo || !ev.eventId || !ev.band_id) {
      setSaveToast({ message: t('Event chats are available for band events.'), type: 'info' });
      return;
    }
    const lineup = (eventMembersMap[ev.eventId] || [])
      .map((m: any) => m.userId)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
    const { data: chat, error } = await createChatService({
      type: 'event',
      name: ev.title,
      band_id: String(ev.band_id),
      event_id: ev.eventId,
      participant_ids: lineup,
    });
    if (error || !chat) {
      setSaveToast({ message: error?.message || t('Could not open the event chat.'), type: 'error' });
      return;
    }
    // Open display: the gig stays on the leading page next to its thread.
    if (!twoPane) {
      setSelectedEvent(null);
      setSelectedEventMembership(null);
      setActiveTab('Chat');
    }
    refetchChats?.();
    const name = ev.title || 'Event chat';
    setTimeout(() => {
      setSelectedChat({
        id: Date.now(),
        uuid: chat.id,
        type: 'event' as ChatType,
        name,
        initials: name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        lastMessage: '',
        time: 'now',
        unread: 0,
        status: 'received',
      } as ChatItem);
    }, 100);
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
        message: t('Quote confirmed as Gig!'),
        type: 'success',
        duration: 8000,
        action: {
          label: t('UNDO'),
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
      setSaveToast({ message: t('Failed to confirm quote: {error}', { error: err.message || t('Unknown error') }), type: 'error' });
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

      // Revert the linked quote to where it was before the client's yes: a
      // quote already sent (or opened) stays Sent / Viewed, only a quote never
      // shared goes back to Draft.
      const { data: linkedQuotes } = await supabase
        .from('quotes')
        .select('id, sent_at, viewed_at')
        .or(`converted_to_event_id.eq.${ev.eventId},id.eq.${ev.eventId}`);
      for (const q of linkedQuotes || []) {
        await supabase
          .from('quotes')
          .update({
            status: q.viewed_at ? 'viewed' : q.sent_at ? 'sent' : 'draft',
            responded_at: null,
            response_type: null,
          })
          .eq('id', q.id);
      }

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

      setSaveToast({ message: t('Back to a quote: confirm it as a gig again when the client says yes'), type: 'info' });

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
      setSaveToast({ message: t('Failed to revert quote: {error}', { error: err.message || t('Unknown error') }), type: 'error' });
    }
  };

  const handleEventCardClick = async (event: EventData) => {
    // A saved draft: its own sheet (only the author has it).
    if (event.draftId) {
      setPreviewDraftId(event.draftId);
      return;
    }
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

  // Figma "Duo · Home" (open): the next gig / commitment is already shown on
  // the trailing page, next to the dashboard. Once per visit to Home, so a
  // closed detail stays closed.
  const homeAutoDetailRef = useRef(false);
  useEffect(() => {
    if (!twoPane || activeTab !== 'Home') { homeAutoDetailRef.current = false; return; }
    if (homeAutoDetailRef.current || selectedEvent || eventsLoading) return;
    const today = new Date().toISOString().split('T')[0];
    const next = [...visuallyFilteredEvents]
      .filter((e) => e.date >= today && e.status !== 'DRAFT' && e.status !== 'QUOTE')
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
    if (!next) return;
    homeAutoDetailRef.current = true;
    handleEventCardClick(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoPane, activeTab, eventsLoading, visuallyFilteredEvents, selectedEvent]);

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
      setSaveToast({ message: t('Failed to accept. Please check your connection and try again.'), type: 'error' });
      return;
    }

    // DB succeeded — confirm with success toast
    setSaveToast({ message: t("You're confirmed!"), type: 'success' });

    // ═══════════════════════════════════════════════════════════════
    // STEP D — Safe Notification Sandbox (autonomous try/catch)
    // ═══════════════════════════════════════════════════════════════
    try {
      const realEventId = selectedEvent.eventId;
      if (realEventId) {
        const { data: members } = await getEventMembers(realEventId);
        const creator = members?.find((m) => m.role === "admin" || m.user_id === selectedEvent.createdBy);
        if (creator?.user_id && user?.id) {
          const memberName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Member");
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

  const handleEventMaybe = async () => {
    if (!selectedEventMembership?.id || !selectedEvent) return;
    const eventId = selectedEvent.eventId || selectedEvent.id?.toString();
    const { data: updated, error } = await respondToEventInvite(selectedEventMembership.id, "maybe");
    if (error || !updated) {
      throw new Error(error?.message || "Couldn't save your answer. Try again.");
    }
    setSelectedEventMembership((prev: any) => (prev ? { ...prev, status: "maybe" } : prev));
    if (eventId && user?.id) {
      setEventMembersMap(prev => {
        const list = prev[eventId] || [];
        return { ...prev, [eventId]: list.map(m => m.userId === user.id ? { ...m, status: 'maybe' } : m) };
      });
    }
    setSaveToast({ message: t("Saved as maybe"), type: 'success' });
  };

  /** Personal-gig conflict: tell the band's admins the user is booked that evening. */
  const handleNotifyConflict = async (bandId: string, eventId: string) => {
    const { data: admins, error } = await supabase
      .from('band_members')
      .select('user_id')
      .eq('band_id', bandId)
      .eq('role', 'admin')
      .eq('is_active', true);
    if (error) throw new Error(error.message);
    const ids = (admins || []).map((a: any) => a.user_id).filter((id: string) => id && id !== user?.id);
    if (!ids.length) throw new Error('This band has no other admin to notify.');
    const bandEvent = events.find((e) => e.eventId === eventId);
    const who = personFirstName(profile, 'A member');
    const when = bandEvent ? `${bandEvent.date}${bandEvent.time ? `, ${bandEvent.time}` : ''}` : '';
    const results = await Promise.all(ids.map((id: string) => createNotification(id, {
      type: 'event_update',
      title: 'Schedule conflict',
      body: `${who} is booked elsewhere${bandEvent ? ` on ${when}` : ''}${bandEvent ? ` (${bandEvent.title})` : ''}.`,
      band_id: bandId,
      data: { event_id: eventId, conflict_user_id: user?.id, kind: 'schedule_conflict' },
    })));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  };

  const handleEventDecline = async () => {
    if (!selectedEventMembership?.id || !selectedEvent) return;
    haptic.delete();

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
      setSaveToast({ message: t('Failed to drop out. Please check your connection and try again.'), type: 'error' });
      // Rollback optimistic hide so the card re-appears on next render
      if (eventIdToHide) {
        setOptimisticallyHiddenEventIds(prev => prev.filter(id => id !== eventIdToHide));
      }
      return;
    }

    // DB succeeded — confirm with success toast
    setSaveToast({ message: t('You dropped out of this event.'), type: 'success' });

    // ═══════════════════════════════════════════════════════════════
    // STEP D — Safe Notification Sandbox (autonomous try/catch)
    // ═══════════════════════════════════════════════════════════════
    try {
      const realEventId = selectedEvent.eventId;
      if (realEventId && user?.id) {
        const memberName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Member");
        await notifyMemberDroppedOut(
          realBand?.id || "",
          realEventId,
          selectedEvent.title,
          selectedEvent.date,
          memberName,
          user.id
        );
      }
    } catch (pushErr) {
      // CORS / network failures must never interrupt the UI thread
      console.warn('[handleEventDecline] Member dropout notification failed:', pushErr);
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
      setSaveToast({ message: t('No band selected'), type: 'error' });
      setEditingEventData(null);
      setIsCreateEventOpen(false);
      return;
    }

    // Close the wizard immediately so the UI feels instant even when offline or on slow connections
    setEditingEventData(null);
    setIsCreateEventOpen(false);
    setCreateEventInitialDate(null);

    // Declared outside `try` so the `catch` below can still queue the event
    // offline (it used to be block-scoped → ReferenceError on timeout and the
    // event was silently lost).
    let saveEventOffline: ((isEdit: boolean, editingId?: string) => Promise<void>) | null = null;

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
        ...(!isRehearsalWizard
          ? {
              load_in_time: data.details?.loadInTime || null,
              soundcheck_time: data.details?.soundcheckTime || null,
            }
          : {}),
        venue_name: venueFinal,
        venue: venueFinal,
        venue_address: fullAddress,
        venue_city: venueCity || null,
        client_name: clientName || null,
        fee: parseFloat(price) || 0,
        // "Fee TBD" (wizard toggle): confirmed date, money still to agree.
        ...(!isRehearsalWizard && data.feeTbd
          ? { payment_status: 'tbd' }
          : !isRehearsalWizard && data._wasFeeTbd
            ? { payment_status: 'pending' }
            : {}),
        notes: data.notes || null,
        indoor_outdoor: data.setting || null,
        is_recurring: isRehearsalWizard
          ? Boolean(data.recurrence && data.recurrence !== 'once')
          : Boolean(data.is_recurring || (data.recurrence && data.recurrence !== 'once')),
        recurrence_rule: (data.recurrence && data.recurrence !== 'once')
          ? { frequency: data.recurrence === 'biweekly' ? 'weekly' : data.recurrence, interval: data.recurrence === 'biweekly' ? 2 : 1 }
          : (data.recurrence_rule || null),
      };

      // Event to-dos (create modal, template or rehearsal wizard). Ids count
      // as saved only when the form loaded them from this event.
      const persistTasks = async (eventId: string): Promise<boolean> => {
        const originalTaskIds: string[] = Array.isArray(data._originalTaskIds) ? data._originalTaskIds : [];
        const knownUserIds = new Set((realBand?.members || []).map((m: any) => m.user_id).filter(Boolean));
        const drafts: EventTaskDraft[] = (Array.isArray(data.tasks) ? data.tasks : []).map((t: any) => {
          const assignees: string[] = Array.isArray(t.assignedTo) ? t.assignedTo : [];
          const single = assignees.length === 1 && knownUserIds.has(assignees[0]) ? assignees[0] : null;
          return {
            id: t.id && originalTaskIds.includes(t.id) ? t.id : undefined,
            title: String(t.title ?? t.text ?? ''),
            dueOffset: typeof t.dueOffset === 'number' ? t.dueOffset : undefined,
            assignedTo: single,
            notes: typeof t.notes === 'string' ? t.notes : null,
          };
        });
        if (drafts.length === 0 && originalTaskIds.length === 0) return true;
        try {
          const { error } = await syncEventTasks(eventId, drafts, date, originalTaskIds);
          if (error) console.error('Task persist error:', error);
          return !error;
        } catch (err) {
          console.error('Task persist error:', err);
          return false;
        }
      };

      let addedOnEdit: string[] = [];
      const persistMembers = async (eventId: string, isEdit?: boolean): Promise<string> => {
        if (!data.members?.length) return 'no members in payload';
        let membersToInvite = data.members;
        if (isRehearsalWizard && data.audienceIds?.length > 0) {
          membersToInvite = data.members.filter((m: any) => data.audienceIds.includes(m.id));
        }
        if (!membersToInvite.length) return 'filtered to 0 members';

        // Edit = diff: keep everyone's RSVP (status, responded_at, reason),
        // remove only who was taken out, add the new ones as pending.
        const { data: existingRows, error: readErr } = isEdit
          ? await supabase.from('event_members').select('user_id, status').eq('event_id', eventId)
          : { data: [] as { user_id: string; status: string }[], error: null };
        if (readErr) return `delete failed: ${readErr.message}`;
        const existingStatus = new Map((existingRows || []).map((r: any) => [r.user_id, r.status]));
        const wanted = new Set(membersToInvite.map((m: any) => m.id));

        const removed = [...existingStatus.keys()].filter((id) => !wanted.has(id));
        if (removed.length > 0) {
          const { error: delErr } = await supabase
            .from('event_members')
            .delete()
            .eq('event_id', eventId)
            .in('user_id', removed);
          if (delErr) return `delete failed: ${delErr.message}`;
        }

        const errors: string[] = [];
        const rows = membersToInvite.map((m: any) => ({
          event_id: eventId,
          user_id: m.id,
          role: m.role || null,
          fee: parseFloat(m.fee) || 0,
          status: existingStatus.get(m.id) || (m.id === user?.id ? 'confirmed' : 'pending'),
        }));
        const { error: upErr } = await saveEventLineup(eventId, rows);
        if (upErr) errors.push(upErr.message);
        if (isEdit) {
          addedOnEdit = membersToInvite
            .map((m: any) => m.id)
            .filter((id: string) => !existingStatus.has(id) && id !== user?.id);
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

      // Persist setlist: one setlist per event. Editing reuses the event's
      // setlist (no orphan copies, one "setlist updated" notification).
      const persistSetlist = async (): Promise<string | null> => {
        let songs: { song_id: string; position: number; set_number: number }[] = [];
        if (isRehearsalWizard) {
          const fromSnapshot = (data.setlistSnapshotFinal?.songs || [])
            .map((s: any) => s.songId)
            .filter(Boolean);
          // Songs picked one by one live in data.setlist (not in the snapshot).
          const picked = (data.setlist || [])
            .filter((s: any) => (s?.type ?? 'song') === 'song')
            .map((s: any) => s.songId || s.id)
            .filter((id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id));
          const ids: string[] = [];
          for (const id of [...fromSnapshot, ...picked]) if (!ids.includes(id)) ids.push(id);
          songs = ids.map((song_id, i) => ({ song_id, position: i, set_number: 1 }));
        } else if (Array.isArray(data.setlist)) {
          let pos = 0;
          data.setlist.forEach((set: any, setIdx: number) => {
            for (const song of (set?.songs || [])) {
              if (song?.songId) songs.push({ song_id: song.songId, position: pos++, set_number: setIdx + 1 });
            }
          });
        }
        if (songs.length === 0) return null;

        const name = `${title || (isRehearsalWizard ? 'Rehearsal' : 'Event')} setlist`;
        if (data._editing && data._editingEventId) {
          const { data: ev } = await supabase
            .from('events')
            .select('setlist_id')
            .eq('id', data._editingEventId)
            .maybeSingle();
          const existingId = (ev as { setlist_id?: string | null } | null)?.setlist_id;
          if (existingId) {
            const { error: replaceErr } = await replaceSetlistSongs(
              existingId,
              songs.map(({ song_id, set_number }) => ({ song_id, set_number }))
            );
            if (replaceErr) throw replaceErr;
            await updateSetlist(existingId, { name, song_count: songs.length });
            return existingId;
          }
        }
        const { data: sl, error: slErr } = await createSetlist({ band_id: realBand.id, name, song_count: songs.length }, songs);
        if (slErr) throw slErr;
        return sl?.id || null;
      };

      // One id for every attempt: a create that times out on the client but
      // lands on the server is recognised when the offline queue replays it.
      const newEventId: string =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            });
      const queuedMembers = (data.members || [])
        .filter((m: any) => !(isRehearsalWizard && data.audienceIds?.length > 0) || data.audienceIds.includes(m.id))
        .map((m: any) => ({
          id: m.id,
          role: m.role || null,
          fee: parseFloat(m.fee) || 0,
          status: m.id === user?.id ? 'confirmed' : 'pending',
        }));

      // Optimistically build member map from the form data
      const optimisticMembers = (data.members || []).map((m: any) => ({
        name: m.name || 'Member',
        userId: m.id,
        fee: parseFloat(m.fee) || 0,
        status: m.id === user?.id ? 'confirmed' : 'pending',
      }));

      saveEventOffline = async (isEdit: boolean, editingId?: string) => {
        reportNetworkStatus(false);
        if (isEdit && editingId) {
          await enqueueMutation('update_event', {
            eventId: editingId,
            updates: { ...eventData, _isPendingSync: true },
          });
          if (optimisticMembers.length > 0) {
            setEventMembersMap(prev => {
              const next = { ...prev, [editingId]: optimisticMembers };
              setOfflineItem(membersMapCacheKey, next).catch(() => {});
              return next;
            });
          }
        } else {
          const tempId = `offline_ev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const offlineEv: any = {
            ...eventData,
            id: tempId,
            eventId: tempId,
            created_by: user?.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _isPendingSync: true,
            _tempId: tempId,
          };
          await enqueueMutation('create_event', { eventData: offlineEv, memberIds: queuedMembers, clientId: newEventId }, tempId);
          if (optimisticMembers.length > 0) {
            setEventMembersMap(prev => {
              const next = { ...prev, [tempId]: optimisticMembers };
              setOfflineItem(membersMapCacheKey, next).catch(() => {});
              return next;
            });
          }
        }
        setSaveToast({ message: t('Saved offline • Will sync when connected'), type: 'info' });
        setMembersRefreshKey(k => k + 1);
        refetchEvents().catch(() => {});
        if (refetchDashboard) refetchDashboard().catch(() => {});
      };

      const withFastTimeout = <T,>(promise: Promise<T>, ms = 4000): Promise<T> =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('offline_timeout')), ms)
          ),
        ]);

      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        await saveEventOffline(Boolean(data._editing && data._editingEventId), data._editingEventId);
        return;
      }

      let setlistFailed = false;
      const setlistId = await withFastTimeout(persistSetlist(), 6000).catch((err) => {
        console.error('Setlist persist error:', err);
        setlistFailed = true;
        return null;
      });
      if (setlistId) {
        eventData.setlist_id = setlistId;
      }

      if (data._editing && data._editingEventId) {
        const { error } = await withFastTimeout(updateEvent(data._editingEventId, eventData), 4500);
        if (!error) {
          const memberResult = await persistMembers(data._editingEventId, true);
          const tasksSaved = await persistTasks(data._editingEventId);
          if (optimisticMembers.length > 0) {
            setEventMembersMap(prev => ({ ...prev, [data._editingEventId]: optimisticMembers }));
          }
          if (addedOnEdit.length > 0 && user?.id) {
            try {
              const creatorName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Someone");
              await notifyEventMembersCreated(realBand.id, data._editingEventId, title || "Event", date, time || "20:00", eventType, user.id, creatorName, addedOnEdit, { venue: location, fee: parseFloat(price) || undefined, feeTbd: !!data.feeTbd });
            } catch (err) { console.error("Notify error:", err); }
          }
          const memberFailed = memberResult.startsWith('insert errors') || memberResult.startsWith('delete failed') || memberResult.startsWith('verify failed');
          if (memberFailed) {
            console.error('Member persist issue:', memberResult);
            setSaveToast({ message: t('Event updated, but there was a problem saving members.'), type: 'error' });
          } else if (setlistFailed) {
            setSaveToast({ message: t('Event updated, but the setlist was not saved.'), type: 'error' });
          } else if (!tasksSaved) {
            setSaveToast({ message: t('Event updated, but the tasks were not saved.'), type: 'error' });
          } else {
            setSaveToast({ message: t('Event updated!'), type: 'success' });
          }
        } else if (isOfflineError(error)) {
          await saveEventOffline(true, data._editingEventId);
          return;
        } else {
          setSaveToast({ message: t('Save failed: {error}', { error: error.message || JSON.stringify(error) }), type: 'error' });
        }
      } else {
        const { data: saved, error } = await withFastTimeout(createEvent({ ...eventData, id: newEventId }), 4500);
        if (!error && saved) {
          const memberResult = await persistMembers(saved.id, false);
          const tasksSaved = await persistTasks(saved.id);
          // Optimistic update
          if (optimisticMembers.length > 0) {
            setEventMembersMap(prev => ({ ...prev, [saved.id]: optimisticMembers }));
          }
          if (user?.id) {
            try {
              const creatorName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Someone");
              const invitedIds = data.audienceIds?.length > 0 ? data.audienceIds : data.members?.map((m: any) => m.id) || [];
              const perMemberFees: Record<string, number> = {};
              (data.members || []).forEach((m: any) => { if (m.id && m.fee) perMemberFees[m.id] = parseFloat(m.fee) || 0; });
              await notifyEventMembersCreated(realBand.id, saved.id, title || "Event", date, time || "20:00", eventType, user.id, creatorName, invitedIds, { venue: location, fee: parseFloat(price) || undefined, memberFees: perMemberFees, feeTbd: !!data.feeTbd });
              const invitedCount = invitedIds.length > 0 ? invitedIds.filter((id: string) => id !== user.id).length : (realBand.member_count || 1) - 1;
              if (invitedCount > 0) await notifyEventPendingConfirmations(user.id, realBand.id, saved.id, title || "Event", eventType, invitedCount);
            } catch (err) { console.error("Notify error:", err); }
          }
          const memberFailed2 = memberResult.startsWith('insert errors') || memberResult.startsWith('delete failed') || memberResult.startsWith('verify failed');
          if (memberFailed2) {
            console.error('Member persist issue:', memberResult);
            setSaveToast({ message: t('Event created, but there was a problem saving members.'), type: 'error' });
          } else if (setlistFailed) {
            setSaveToast({ message: t('Event created, but the setlist was not saved.'), type: 'error' });
          } else if (!tasksSaved) {
            setSaveToast({ message: t('Event created, but the tasks were not saved.'), type: 'error' });
          } else {
            setSaveToast({ message: t('Event created!'), type: 'success' });
          }
        } else if (isOfflineError(error)) {
          await saveEventOffline(false);
          return;
        } else {
          setSaveToast({ message: t('Create failed: {error}', { error: error?.message || JSON.stringify(error) }), type: 'error' });
        }
      }
      setMembersRefreshKey(k => k + 1);
      refetchEvents().catch(() => {});
      if (refetchDashboard) refetchDashboard().catch(() => {});
    } catch (err: any) {
      if (saveEventOffline && (!isOnline || isOfflineError(err))) {
        try {
          await saveEventOffline(Boolean(data._editing && data._editingEventId), data._editingEventId);
        } catch (offlineErr: any) {
          console.error('Offline save failed:', offlineErr);
          setSaveToast({ message: t('Could not save the event. Please try again.'), type: 'error' });
        }
      } else {
        setSaveToast({ message: t('Error: {error}', { error: err?.message || String(err) }), type: 'error' });
      }
    }
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

  const scrollerMask =
    isCreateEventOpen || activeTab === 'Chat' || !!selectedChat || !!expandedCard || isIdentityOpen || isBandSwitcherOpen
      ? 'none'
      : 'linear-gradient(to bottom, black 0%, black calc(100% - 60px), transparent 100%)';

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/50">
      <MapsChooserHost />
      <OfflineBanner
        isOnline={isOnline}
        wasOffline={wasOffline}
        pendingCount={pendingSyncCount}
        onSyncNow={triggerSync}
      />
      <div className="fixed inset-0 z-0 bg-background" />
      {/* iPhone Duo, open: the trailing pane shows details; this fills it until
          one is open. Neutral canvas like the Figma "Open" panes, so the glass
          rail (lime Create, active dots) stays legible over it. */}
      <div aria-hidden="true" className="bw-pane-placeholder flex-col justify-end gap-3 p-6 pb-10 bg-background text-foreground select-none">
        <span className="bw-label-sm text-muted-foreground">BandWith · Duo</span>
        <span className="bw-display-lg">
          {activeTab === 'Chat' ? 'Pick a chat' : (activeTab === 'More' || isIdentityOpen) ? 'Your band, side by side' : 'Pick an event'}
        </span>
        <span className="bw-body-sm text-muted-foreground">Details open on this side.</span>
      </div>
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

      <div ref={scrollContainerRef} className="bw-pane-main w-full max-w-[680px] mx-auto relative flex flex-col z-10 overflow-y-auto" style={{
        paddingTop: "0px",
        paddingBottom: "0px",
        paddingLeft: "16px", paddingRight: "16px",
        height: '100vh',
        overflowAnchor: 'none',
        // The fade is for the tab content only; the overlays rendered inside this
        // scroller (identity hub, band switcher, expanded cards) must not fade.
        maskImage: scrollerMask,
        WebkitMaskImage: scrollerMask,
      }}>
        <Header
          activeTab={activeTab} selectedBand={selectedBand}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: uuidToNumericId(b.id), name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: b.genre || "", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as Band)) : []}
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
            userFeeMap={userFeeMap}
            onOpenAllAssets={isSolo ? undefined : openIdentity}
            eventMembersMap={eventMembersMap}
            onOpenPoll={(poll) => setVotePollId(poll.id)}
            onCreateGig={() => { setCreateEventInitialDate(null); setEditingEventData(null); if (!isAdmin || isSolo) { setEditingPersonalGig(null); setShowPersonalGigModal(true); } else { setCreateEventType(null); setIsCreateEventOpen(true); } }}
            onCreateRehearsal={isSolo ? undefined : () => { setCreateEventInitialDate(null); setEditingEventData(null); handleCreateEvent('rehearsal'); }}
            onCreateQuote={isAdmin && !isSolo ? () => { setCreateEventInitialDate(null); setEditingEventData(null); setCreateEventType('quote'); setIsCreateEventOpen(true); } : undefined}
            onOpenEventDraft={openEventDraft}
            />
          )}
          {activeTab === "Chat" && !isSolo && (
            <ChatView key="chat" chatFilter={chatFilter} setChatFilter={setChatFilter} chatSearch={chatSearch} setChatSearch={setChatSearch} filteredChats={filteredChats} unreadCounts={chatUnreadCounts} onChatClick={(c) => { c.unread = 0; setSelectedChat(c); }} onStartChat={() => setShowNewChat(true)} onDeleteChat={async (c) => { if (!c.uuid) return; const { error } = await deleteChatService(c.uuid); if (error) setSaveToast({ message: t('Could not delete the chat. Try again.'), type: 'error' }); else refetchChats?.(); }} />
          )}
          {activeTab === "Events" && (
            <EventsView key="events" loading={eventsLoading} eventFilter={eventFilter} setEventFilter={setEventFilter} eventSearch={eventSearch} setEventSearch={setEventSearch} eventView={eventView} groupedEvents={groupedEvents} allEvents={calendarEvents} rawEvents={events} onEventClick={handleEventCardClick} onCreateEvent={(type: 'gig' | 'rehearsal' | 'quote' = 'gig', date?: string) => {
              if (date) {
                setCreateEventInitialDate(date);
              } else {
                setCreateEventInitialDate(null);
              }
              if (!isAdmin || isSolo) {
                setEditingPersonalGig(date ? { id: '', title: '', eventDate: date } : null);
                setShowPersonalGigModal(true);
              } else {
                setCreateEventType(type === 'gig' ? null : type);
                setEditingEventData(null);
                setIsCreateEventOpen(true);
              }
            }} onOpenPastEvents={() => setShowPastEvents(true)} onProposeRehearsal={() => handleCreateEvent('rehearsal')} isAdmin={isAdmin} onDayPickerOpen={setIsDayPickerOpen} userFeeMap={userFeeMap} bands={formattedBands} selectedBandPill={selectedBandPill} onBandPillClick={setSelectedBandPill}
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
            <EventsView key="events-solo" loading={eventsLoading} eventFilter={eventFilter} setEventFilter={setEventFilter} eventSearch={eventSearch} setEventSearch={setEventSearch} eventView={eventView} groupedEvents={groupedEvents} allEvents={visuallyFilteredEvents} rawEvents={events} onEventClick={handleEventCardClick} onCreateEvent={(type?: string, date?: string) => { setEditingPersonalGig(date ? { id: '', title: '', eventDate: date } : null); setShowPersonalGigModal(true); }} onOpenPastEvents={() => setShowPastEvents(true)} isAdmin={false} onDayPickerOpen={setIsDayPickerOpen} userFeeMap={userFeeMap} bands={formattedBands} selectedBandPill={selectedBandPill} onBandPillClick={setSelectedBandPill} />
          )}
        </AnimatePresence>

        <IdentityHub
          isOpen={isIdentityOpen}
          onClose={closeIdentity}
          showCloseButton
          onBandUpdated={() => {
            refetchChats?.();
            refetchEvents();
          }}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: uuidToNumericId(b.id), name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: b.genre || "", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as Band)) : []}
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
          onOpenBandSettings={() => {
            setPricingModalInitialTab('branding');
            setPricingReturnTo('identity_hub');
            setShowPricingModal(true);
          }}
          onAddEntity={handleRequestCreateBand}
          onOpenPricing={() => {
            setPricingModalInitialTab('rates');
            setPricingReturnTo('identity_hub');
            setShowPricingModal(true);
          }}
          onOpenSettings={(section) => {
            closeIdentity();
            handleGridNav(section && section !== 'main' ? `Settings:${section}` : 'Settings');
          }}
        />

        <SwitchBandPopup
          isOpen={isBandSwitcherOpen}
          onClose={() => setIsBandSwitcherOpen(false)}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: uuidToNumericId(b.id), name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: b.genre || "", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as Band)) : []}
          selectedBand={selectedBand}
          onSelectBand={setSelectedBand}
          onAddNewBand={handleRequestCreateBand}
        />

        <AnimatePresence>
          {expandedCard === "finance" && <FinanceExpanded key="finance-expanded" bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} financialStats={financeData.financialStats} transactions={financeData.recentTransactions} loading={financeLoading} onTransactionAdded={() => { refetchFinance(); refetchDashboard?.(); }} />}
          {expandedCard === "pending" && <PendingExpanded key="pending-expanded" bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} eventFilter={eventFilter} setEventFilter={setEventFilter} events={pendingEvents} loading={pendingEventsLoading} />}
          {isAdmin && expandedCard === "quotes" && <QuotesExpanded key="quotes-expanded" bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} realQuotes={realQuotes} quoteStats={quotesStats} loading={quotesLoading} onShowToast={(msg, type) => setSaveToast({ message: msg, type })} onQuotesChanged={() => { refetchExpandedQuotes(); refetchDashboard?.(); }} onOpenBandSettings={() => { setPricingModalInitialTab('branding'); setPricingReturnTo(null); setShowPricingModal(true); }} />}
          {expandedCard === "confirmed" && <ConfirmedExpanded key="confirmed-expanded" bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} events={myConfirmedEvents} loading={confirmedEventsLoading} />}
          {expandedCard === "rehearsal" && currentRehearsal ? (
            <RehearsalExpanded key="rehearsal-expanded" upcomingRehearsals={upcomingRehearsals} currentRehearsal={currentRehearsal} rehearsalIndex={rehearsalIndex} setRehearsalIndex={setRehearsalIndex} rehearsalViewMode={rehearsalViewMode} setRehearsalViewMode={setRehearsalViewMode} isLive={isLive} onClose={() => setExpandedCard(null)} onDecline={handleRehearsalDecline} />
          ) : expandedCard === "rehearsal" ? (
            <ExpandedCardWrapper key="expanded-card-wrapper" backgroundColor="#3B82F6" onClose={() => setExpandedCard(null)} origin={{ top: "18%", left: "3%", right: "42%", bottom: "52%" }}>
              <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3">
                <NavBackButton onClick={() => setExpandedCard(null)} variant="ghost" className="w-10 h-10 bg-white/20 text-white" icon={<ChevronLeft className="w-6 h-6 text-white" />} />
                <h1 className="text-lg font-bold text-white">{t('My Rehearsals')}</h1>
                {isAdmin ? <HeaderAction label={t('New rehearsal')} variant="ghost" icon={<Plus />} onClick={() => { setExpandedCard(null); setCreateEventType("rehearsal"); setIsCreateEventOpen(true); }} className="w-10 h-10 bg-white/20 text-white" /> : <div className="w-10" />}
              </div>
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6"><Music className="w-10 h-10 text-white" /></div>
                <h2 className="bw-h2 uppercase text-white mb-2">{t('No Rehearsals')}</h2>
                <p className="text-white/70 text-center mb-8">{isAdmin ? t('No upcoming rehearsals. Tap + to create one!') : t('No upcoming rehearsals scheduled.')}</p>
                {isAdmin && <button onClick={() => { setExpandedCard(null); setCreateEventType("rehearsal"); setIsCreateEventOpen(true); }} className="bg-white text-blue-600 px-6 py-3 rounded-full font-bold">{t('Schedule Rehearsal')}</button>}
              </div>
            </ExpandedCardWrapper>
          ) : null}
          {expandedCard === "fee" && <FeeExpanded key="fee-expanded" onClose={() => setExpandedCard(null)} bandName={realBand?.name || selectedBand.name} memberFee={realBand?.members?.find((m) => m.user_id === user?.id)?.default_fee || 0} loading={false} events={myConfirmedEvents.map((e) => ({ id: e.id, title: e.title, date: e.event_date, fee: e.fee || 0, status: e.status as "confirmed" | "pending" | "completed", type: e.event_type as "gig" | "rehearsal" }))} />}
        </AnimatePresence>
      </div>

      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          // Duo open: details live in the trailing pane, so switching tab
          // clears them instead of leaving a stale detail beside a new list.
          if (twoPane) {
            setSelectedChat(null);
            setSelectedEvent(null);
            setSelectedNotification(null);
          }
          setActiveTab(tab);
        }}
        isPlusMenuOpen={isPlusMenuOpen}
        setIsPlusMenuOpen={setIsPlusMenuOpen}
        isControlDeckOpen={isIdentityOpen}
        isIdentityOpen={isIdentityOpen}
        toggleControlDeck={toggleIdentity}
        toggleIdentity={toggleIdentity}
        onRailProfile={openRailProfile}
        railProfileLocked={railProfileLocked}
        closeMenus={closeMenus}
        onCreateEvent={handleCreateEvent}
        isScrollingDown={isScrollingDown}
        unreadChatCount={chatUnreadCounts.all}
        isHidden={
          railLayout
            ? // iPhone Duo: layers that hand their Back/close to the rail hide
              // the tabs themselves (only on the pane they cover when open);
              // these few register nothing with it.
              !!expandedCard || isNotificationsOpen || isDayPickerOpen || (!twoPane && (!!rsvpNotification || !!pollNotification || !!votePollId))
            : !!expandedCard || (!twoPane && (!!selectedChat || !!selectedEvent || !!selectedNotification)) || isBandSwitcherOpen || isDayPickerOpen || !!rsvpNotification || !!pollNotification || !!votePollId || showSettings || showBandMembers || showSetlistManager || showAnalytics || showInventory || showContracts || showTaskTemplates || showPricingModal || showPastEvents || isCreateEventOpen || showEditProfile || showNewChat
        }
        isAdmin={isAdmin}
        isSolo={userMode === 'solo'}
      />

      <React.Suspense fallback={null}>
        <AnimatePresence>
          {/* z-185 like the views inside: under the iPhone Duo rail (190),
              where live mode puts its Exit. */}
          {rehearsalViewMode === "live" && expandedCard === "rehearsal" && (
            <motion.div key="rehearsal-live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[185]">
              <RehearsalLiveView onClose={() => setRehearsalViewMode("overview")} onFinish={() => setRehearsalViewMode("post")} />
            </motion.div>
          )}
          {rehearsalViewMode === "post" && expandedCard === "rehearsal" && (
            <motion.div key="rehearsal-post" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[185]">
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
          {showAnalytics && <AnalyticsView key="analytics" onClose={() => setShowAnalytics(false)} dashboardData={computedDashboardData as any} isAdmin={isAdmin} />}
          {showInventory && realBand && <InventoryView key="inventory" onBack={() => setShowInventory(false)} bandId={realBand.id} />}
          {showContracts && realBand && <ContractsView key="contracts" onBack={() => setShowContracts(false)} bandId={realBand.id} />}
          {showTaskTemplates && realBand && <TaskTemplatesView key="task-templates" onBack={() => setShowTaskTemplates(false)} bandId={realBand.id} userId={user?.id} events={isAdminOfBand(realBand.id) ? templateTargetEvents : []} onNotify={(message) => setSaveToast({ message, type: 'success' })} onUseTemplate={(template, kind) => {
            setShowTaskTemplates(false);
            setCreateEventInitialTasks((template.tasks || []).map((t) => ({ title: t.title, templateId: template.id, dueOffset: t.dueOffset })));
            handleCreateEvent(kind);
          }} />}
          {showPastEvents && (
            <PastEventsView
              key="past-events"
              onClose={() => setShowPastEvents(false)}
              allEvents={visuallyFilteredEvents}
              onEventClick={handleEventCardClick}
              isAdmin={isAdmin}
              bands={formattedBands}
              userFeeMap={userFeeMap}
            />
          )}

          {showEditProfile && <EditProfileModal key="edit-profile" isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} />}
          {showPricingModal && isAdmin && (
            <BandPricingModal
              key="band-pricing"
              isOpen={showPricingModal}
              initialTab={pricingModalInitialTab}
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
          {showCreateBand && <CreateBandModal key="create-band" isOpen={showCreateBand} onClose={() => setShowCreateBand(false)} onBandCreated={(id) => { selectBand(id); }} />}
          <UpgradePricingSheet key="upgrade-pricing-sheet" isOpen={showUpgradePricing} onClose={() => setShowUpgradePricing(false)} currentTier={profile?.sub_tier} limitReached />
          <PendingInvitesPrompt
            key="pending-invites"
            userId={user?.id}
            hidden={!!expandedCard || !!selectedChat || !!selectedEvent || showSettings || isCreateEventOpen || isIdentityOpen || showUpgradePricing}
            onToast={(message, type) => setSaveToast({ message, type })}
            onJoined={(bandId) => {
              refreshBands()
                .then(() => selectBand(bandId))
                .catch((e) => console.error('Error refreshing bands after joining:', e));
            }}
          />
          {showPersonalGigModal && user?.id && (
            <PersonalGigModal key="personal-gig-modal"
              isOpen={showPersonalGigModal}
              onClose={() => {
                setShowPersonalGigModal(false);
                setEditingPersonalGig(null);
              }}
              userId={user.id}
              initialData={editingPersonalGig}
              onSaved={() => {
                haptic.confirm();
                refetchEvents();
                refetchDashboard?.();
              }}
              onCreateBand={handleRequestCreateBand}
            />
          )}

          <AnimatePresence key="nested-presence-1">
            {isCreateEventOpen && (!!editingEventData || createEventType !== "quote") && (
              <CreateEventModal
                initialType={createEventType as any}
                initialDate={createEventInitialDate || undefined}
                layoutId={`create-button-${createEventType}`}
                onClose={() => { setIsCreateEventOpen(false); setEditingEventData(null); setCreateEventInitialDate(null); setCreateEventInitialTasks(undefined); setActiveEventDraft(null); }}
                onCreate={handleEventCreate}
                draft={editingEventData ? null : activeEventDraft}
                existingEvents={events}
                initialTasks={createEventInitialTasks}
                currentUserId={user?.id}
                bandMembers={memoizedBandMembers}
                editingEvent={editingEventData}
                onOpenPollBuilder={handleOpenPollBuilder}
                onOpenProposeRehearsal={() => {
                  setIsCreateEventOpen(false);
                  if (!realBands || realBands.length === 0) {
                    setShowNoBandRehearsalModal(true);
                  } else if (realBands.length > 1) {
                    setShowChooseBandProposalModal(true);
                  } else {
                    setProposalTargetBand(realBands[0]);
                    setShowProposeRehearsalModal(true);
                  }
                }}
              />
            )}
          </AnimatePresence>

          {showNoBandRehearsalModal && (
            <NoBandRehearsalModal key="no-band-rehearsal-modal"
              isOpen={showNoBandRehearsalModal}
              onClose={() => setShowNoBandRehearsalModal(false)}
              onOpenUpgrade={() => {
                setShowNoBandRehearsalModal(false);
                handleRequestCreateBand();
              }}
            />
          )}

          {showChooseBandProposalModal && (
            <ChooseBandProposalModal key="choose-band-proposal-modal"
              isOpen={showChooseBandProposalModal}
              onClose={() => setShowChooseBandProposalModal(false)}
              bands={realBands}
              onSelectBand={(band) => {
                setProposalTargetBand(band);
                setShowChooseBandProposalModal(false);
                setShowProposeRehearsalModal(true);
              }}
            />
          )}

          {showProposeRehearsalModal && (proposalTargetBand || realBand) && user && (
            <ProposeRehearsalModal key="propose-rehearsal-modal"
              isOpen={showProposeRehearsalModal}
              onClose={() => {
                setShowProposeRehearsalModal(false);
                setProposalTargetBand(null);
              }}
              bandId={(proposalTargetBand || realBand)!.id}
              bandName={(proposalTargetBand || realBand)!.name}
              userId={user.id}
              onSuccess={refetchRehearsalPolls}
              onShowToast={(msg, type) => setSaveToast({ message: msg, type })}
            />
          )}

          {showRehearsalPollModal && realBand && user && (
            <RehearsalPollModal key="rehearsal-poll-modal"
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
          <DraftPreviewSheet
            draft={previewDraft}
            onClose={() => setPreviewDraftId(null)}
            onContinue={openEventDraft}
            onDelete={(d) => {
              deleteEventDraft(d.id);
              setPreviewDraftId(null);
              setSaveToast({ message: t('Draft deleted'), type: 'success' });
            }}
          />
          <AnimatePresence key="nested-presence-2">{isCreateEventOpen && createEventType === "quote" && !editingEventData && <QuoteCreationWizard bandMembers={memoizedBandMembers} initialData={createEventInitialDate ? { eventDate: createEventInitialDate } : undefined} onClose={() => { setIsCreateEventOpen(false); setCreateEventInitialDate(null); setCreateEventInitialTasks(undefined); }} onCreate={async (q, opts) => {
            setIsCreateEventOpen(false);
            setCreateEventInitialDate(null);
            const templateTasks = createEventInitialTasks;
            setCreateEventInitialTasks(undefined);
            // The share sheet / PDF opens only after the quote is saved, so it
            // carries the number assigned by the database.
            const wantsShare = !!opts?.share;
            if (!realBand?.id) {
              setSaveToast({ message: t('Select a band before creating a quote.'), type: 'error' });
              return;
            }
            if (realBand?.id) {
              const createdEventId = q.eventId || (await (async () => {
                const evD: Record<string, any> = {
                  band_id: realBand.id,
                  title: q.eventName || q.clientName || 'Quote Event',
                  event_type: q.eventType || 'other',
                  status: 'tentative' as const,
                  event_date: q.eventDate || todayLocal(),
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
                const memberRows = Array.isArray(q.musicians)
                  ? q.musicians
                      .map((m: any) => {
                        const bandMember = realBand.members?.find((bm: any) => bm.id === m.id || bm.user_id === m.id);
                        const resolvedUserId = bandMember?.user_id || m.user_id || null;
                        if (!resolvedUserId) return null;
                        return {
                          user_id: resolvedUserId,
                          status: resolvedUserId === user?.id ? 'confirmed' : 'pending',
                          fee: Number(m.rate || m.customFee || 0),
                          role: m.instrument || bandMember?.role || 'Musician',
                        };
                      })
                      .filter(Boolean)
                  : [];

                const saveQuoteEventOffline = async () => {
                  reportNetworkStatus(false);
                  const tempId = `offline_ev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                  const offlineEv: any = {
                    ...evD,
                    id: tempId,
                    eventId: tempId,
                    created_by: user?.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    _isPendingSync: true,
                    _tempId: tempId,
                  };
                  await enqueueMutation('create_event', { eventData: offlineEv, memberIds: memberRows }, tempId);
                  setSaveToast({ message: t('Saved quote event offline • Will sync when connected'), type: 'info' });
                  return tempId;
                };

                if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
                  return await saveQuoteEventOffline();
                }

                try {
                  const { data: ev, error: evErr } = await Promise.race([
                    createEvent(evD),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('offline_timeout')), 4500)),
                  ]);
                  if (evErr && isOfflineError(evErr)) {
                    return await saveQuoteEventOffline();
                  }
                  if (ev?.id && memberRows.length > 0) {
                    await saveEventLineup(ev.id, memberRows as LineupRow[]);
                  }
                  return ev?.id || null;
                } catch (err) {
                  if (isOfflineError(err)) {
                    return await saveQuoteEventOffline();
                  }
                  return null;
                }
              })());

              const isOfflineTempId = typeof createdEventId === 'string' && createdEventId.startsWith('offline_');
              if (!isOfflineTempId && isOnline && (typeof navigator === 'undefined' || navigator.onLine)) {
                const { data: savedQuote, error: quoteErr } = await createQuoteDB(
                  { ...appQuoteToDbRecord(q, realBand.id), converted_to_event_id: createdEventId || undefined },
                  appMusiciansToDb(q.musicians)
                );
                if (quoteErr || !savedQuote) {
                  // Don't leave a tentative event without its quote.
                  if (createdEventId && !q.eventId) {
                    await supabase.from('events').delete().eq('id', createdEventId);
                  }
                  setSaveToast({ message: t('Quote not saved: {error}', { error: quoteErr?.message || t('unknown error') }), type: 'error' });
                } else {
                  setSaveToast({ message: t('Quote {number} saved', { number: savedQuote.quote_number }), type: 'success' });
                  // Started from a to-do list: the quote's event gets its tasks.
                  if (templateTasks?.length && createdEventId) {
                    const { error: taskErr } = await syncEventTasks(
                      createdEventId,
                      templateTasks.map((t) => ({ title: t.title, dueOffset: t.dueOffset })),
                      q.eventDate || todayLocal(),
                      [],
                    );
                    if (taskErr) setSaveToast({ message: t('Quote saved, but the to-do list was not added: {error}', { error: taskErr.message }), type: 'error' });
                  }
                  // Quote-stage RSVP: ask the lineup before the client confirms.
                  if (opts?.askAvailability && createdEventId && user?.id) {
                    const feeByUser: Record<string, number> = {};
                    const invited = (Array.isArray(q.musicians) ? q.musicians : [])
                      .map((m: any) => {
                        const bm = realBand.members?.find((x: any) => x.id === m.id || x.user_id === m.id);
                        const uid = bm?.user_id || m.user_id || null;
                        if (uid) feeByUser[uid] = Number(m.rate || m.customFee || 0);
                        return uid;
                      })
                      .filter((uid: string | null): uid is string => !!uid && uid !== user.id);
                    if (invited.length > 0) {
                      const creatorName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Someone");
                      const { error: rsvpErr } = await notifyEventMembersCreated(
                        realBand.id, createdEventId, q.eventName || q.clientName || 'Quote', q.eventDate || todayLocal(),
                        q.eventTimeStart || '20:00', q.eventType || 'other', user.id, creatorName, invited,
                        { venue: q.venueName, memberFees: feeByUser, tentative: true }
                      );
                      setSaveToast(rsvpErr
                        ? { message: t("Quote {number} saved, but the availability check wasn't sent.", { number: savedQuote.quote_number }), type: 'error' }
                        : { message: t('Quote {number} saved · availability asked to {count}', { number: savedQuote.quote_number, count: invited.length }), type: 'success' });
                    }
                  }
                  if (wantsShare) {
                    setSharingQuote({ ...q, id: savedQuote.id, quoteNumber: savedQuote.quote_number, status: 'DRAFT' });
                  }
                  refetchExpandedQuotes();
                }
              } else if (isOfflineTempId) {
                // Quotes need a database number, so they can't be queued offline yet.
                setSaveToast({ message: t('Offline: the event was saved, but the quote itself needs a connection. Create it again when you are back online.'), type: 'error' });
              }
              setMembersRefreshKey(prev => prev + 1);
              refetchEvents().catch(() => {});
              if (refetchDashboard) refetchDashboard().catch(() => {});
            }
          }} />}</AnimatePresence>

          <AnimatePresence key="nested-presence-3">
            {sharingQuote && (
              <QuoteShareModal
                isOpen={!!sharingQuote}
                onClose={() => setSharingQuote(null)}
                quote={sharingQuote}
                onSent={() => { refetchExpandedQuotes(); }}
                bandId={realBand?.id ? String(realBand.id) : (selectedBand?.id ? String(selectedBand.id) : 'default')}
                bandName={realBand?.name || selectedBand?.name || 'Band'}
                onOpenBandSettings={() => {
                  setPricingModalInitialTab('branding');
                  setShowPricingModal(true);
                }}
              />
            )}
          </AnimatePresence>

          <NotificationDetailModal key="notification-detail"
            isOpen={isNotificationsOpen}
            onClose={() => { setSelectedNotification(null); setSelectedNotifications([]); setInboxOpen(false); }}
            notification={selectedNotification}
            notifications={selectedNotifications}
            calendarEvents={events}
            bandNames={(realBands?.length ?? 0) > 1 ? bandLookup : undefined}
            // Opening the action a notification suggests (RSVP, poll, its
            // screen) also removes it: it has done its job.
            onOpenRSVP={(notif) => {
              setSelectedNotification(null);
              setSelectedNotifications([]); setInboxOpen(false);
              removeNotifications([notif.id]);
              setRsvpNotification(notif as any);
            }}
            onOpenPoll={(notif) => {
              setSelectedNotification(null);
              setSelectedNotifications([]); setInboxOpen(false);
              removeNotifications([notif.id]);
              setPollNotification(notif as any);
            }}
            onNavigate={(notif) => {
              setSelectedNotification(null);
              setSelectedNotifications([]); setInboxOpen(false);
              removeNotifications([notif.id]);
              navigateToNotificationTarget(notificationTarget(notif.type, notif.data), notificationBandId(notif));
            }}
            onClearAll={() => {
              const ids = [selectedNotification?.id, ...selectedNotifications.map((n) => n.id)].filter(Boolean) as string[];
              setSelectedNotification(null);
              setSelectedNotifications([]); // the inbox stays open, empty
              removeNotifications(ids);
            }}
            onMarkAsRead={(id) => { const nid = id || selectedNotification?.id; if (nid) markNotificationAsRead(nid).then(() => refetchNotifications?.()); if (!id) { setSelectedNotification(null); setSelectedNotifications([]); setInboxOpen(false); } }}
            onMarkAllAsRead={() => { markAllNotificationsAsRead().then(() => refetchNotifications?.()); }}
            onDelete={(id) => {
              // Deleted for real (it used to come back on the next refresh).
              const ids = id
                ? [id]
                : [selectedNotification?.id, ...selectedNotifications.map((n) => n.id)].filter(Boolean) as string[];
              if (id) setSelectedNotifications((p) => p.filter((n) => n.id !== id));
              else { setSelectedNotification(null); setSelectedNotifications([]); setInboxOpen(false); }
              removeNotifications(ids);
            }}
            onAction={async (action, notificationId) => {
              const notif = selectedNotification || selectedNotifications.find((n) => n.id === notificationId);
              try {
                if (action === "accept_event" || action === "decline_event") {
                  const eventId = notif?.data?.event_id as string;
                  const eventTitle = notif?.data?.event_title as string || "Event";
                  const eventType = notif?.data?.event_type as string || "gig";
                  if (eventId && user?.id) {
                    const status = action === "accept_event" ? "confirmed" : "declined";
                    const memberName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Member");

                    const { data: membership } = await supabase
                      .from('event_members')
                      .select('id')
                      .eq('event_id', eventId)
                      .eq('user_id', user.id)
                      .maybeSingle();
                    if (membership) {
                      await respondToEventInvite(membership.id, status as 'confirmed' | 'declined');
                    }

                    if (status === 'declined') {
                      await notifyMemberDroppedOut(
                        notif?.band_id || "",
                        eventId,
                        eventTitle,
                        notif?.data?.event_date as string | undefined,
                        memberName,
                        user.id
                      );
                    } else {
                      const creatorId = notif?.data?.creator_id as string;
                      if (creatorId && creatorId !== user.id) {
                        await notifyEventResponse([creatorId], notif?.band_id || "", eventId, eventTitle, eventType, memberName, status);
                      }
                    }
                    if (notificationId) await markNotificationAsRead(notificationId);
                    refetchNotifications?.();
                    refetchEvents();
                  }
                }
              } catch (err) { console.error("Action error:", err); }
              const navId = notif?.data?.event_id as string;
              setSelectedNotification(null);
              setSelectedNotifications([]); setInboxOpen(false);
              if (navId) setTimeout(() => navigateToEvent(navId), 300);
            }}
          />
        </AnimatePresence>
      </React.Suspense>

      <AnimatePresence>
        {selectedChat && selectedChat.uuid && (
          <ChatDetailModal key="chat-detail" chat={{ id: selectedChat.uuid, type: selectedChat.type, name: selectedChat.name, initials: selectedChat.initials, avatarUrl: selectedChat.avatarUrl, unread: selectedChat.unread, members: selectedChat.members, isOnline: selectedChat.isOnline, bandLabel: selectedChat.bandLabel ?? convertedChats.find((c) => c.uuid === selectedChat.uuid)?.bandLabel }} onClose={() => { setSelectedChat(null); refetchChats?.(); }} />
        )}
        {selectedChat && !selectedChat.uuid && (
          <motion.div key="demo-chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6" onClick={() => setSelectedChat(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-background text-foreground rounded-[24px] p-6 text-center max-w-[342px] w-full" onClick={(e) => e.stopPropagation()}>
              <div className="w-14 h-14 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4"><MessageSquare className="w-8 h-8" /></div>
              <h3 className="bw-h2 uppercase text-foreground mb-2">Demo Chat</h3>
              <p className="bw-body-md text-muted-foreground mb-6">This is sample data. Start a real conversation using the + button!</p>
              <button onClick={() => { setSelectedChat(null); setShowNewChat(true); }} className="w-full h-14 px-5 bg-accent text-accent-foreground rounded-full bw-button-md active:scale-[0.97] transition-transform">Start Real Chat</button>
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
            onOpenBandSettings={isAdmin ? () => { setPricingModalInitialTab('branding'); setPricingReturnTo(null); setShowPricingModal(true); } : undefined}
            userResponse={selectedEventMembership?.status === "confirmed" ? "accepted" : selectedEventMembership?.status === "declined" ? "declined" : selectedEventMembership?.status === "maybe" ? "maybe" : selectedEventMembership?.status === "pending" ? "pending" : "accepted"}
            onAccept={handleEventAccept}
            onDecline={handleEventDecline}
            onRespond={async (status) => {
              if (status === 'confirmed') return handleEventAccept();
              if (status === 'declined') return handleEventDecline();
              return handleEventMaybe();
            }}
            canRespond={!!selectedEventMembership}
            allEvents={events}
            onNotifyConflict={handleNotifyConflict}
            onEventUpdated={() => { refetchEvents(); }}
            onEdit={() => inItemBand(selectedEvent.band_id, "edit this event", handleEventEdit)}
            onDelete={() => inItemBand(selectedEvent.band_id, "delete this event", handleEventDelete)}
            onChat={handleEventChat}
            onConfirmQuote={(ev) => inItemBand(ev.band_id, "confirm this quote", () => handleConfirmQuote(ev))}
            onRevertQuote={(ev) => inItemBand(ev.band_id, "change this quote", () => handleRevertQuote(ev))}
            memberFee={selectedEventMembership?.fee}
            // Admin rights come from the event's own band, not the active one.
            isAdmin={
              selectedEvent.band_id
                ? realBands.find((b) => b.id === selectedEvent.band_id)?.user_role === "admin"
                : isAdmin
            }
          />
        )}
      </AnimatePresence>

      <BandSwitchPrompt request={bandSwitchRequest} onChoose={chooseBandSwitch} />

      {eventLoadError && (
        <div className="bw-pane-detail fixed inset-0 z-[100] bg-background flex items-center justify-center px-6" style={{ paddingTop: 'var(--safe-top)' }}>
          {eventLoadError.kind === 'error' ? (
            <ErrorState
              body={eventLoadError.message || t("Check your connection and try again.")}
              onRetry={() => { const id = eventLoadError.id; setEventLoadError(null); navigateToEvent(id); }}
              onBack={() => setEventLoadError(null)}
            />
          ) : (
            <ErrorState
              title={eventLoadError.title}
              body={eventLoadError.message}
              icon={eventLoadError.kind === 'gone' ? <XCircle className="w-7 h-7" /> : <EyeOff className="w-7 h-7 text-foreground" />}
              onBack={() => setEventLoadError(null)}
              backLabel="OK"
            />
          )}
        </div>
      )}

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
                  const memberName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Member");
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
                const memberName = personName({ full_name: profile?.full_name || user.user_metadata?.full_name, email: user.email }, "Member");
                const eventTitle = (rsvpNotification.data?.event_title as string) || "Event";
                const eventDate = (rsvpNotification.data?.event_date as string) || undefined;
                await notifyMemberDroppedOut(
                  rsvpNotification.band_id || "",
                  eventId,
                  eventTitle,
                  eventDate,
                  memberName,
                  user.id
                );
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
        {votePollId && !pollNotification && (
          <RehearsalPollVoteSheet
            key={`poll-${votePollId}`}
            pollId={votePollId}
            currentUserId={user?.id || ''}
            isAdmin={isAdmin}
            onClose={() => setVotePollId(null)}
            onPollUpdated={() => {
              refetchRehearsalPolls?.();
              refetchEvents();
            }}
            onShowToast={(msg, type) => setSaveToast({ message: msg, type })}
            onOpenAdminWizard={(proposal) => {
              setVotePollId(null);
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

      <LeadingCompanionSlot />
      <MiniPlayer />
      <LyricsViewer />
      <AnimatePresence>
        {saveToast && (
          saveToast.minimal ? (
            <motion.div key="layer-1"
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="bw-toast fixed -translate-x-1/2 z-[250] px-4 py-2 rounded-full bw-label-sm text-white/95 bg-black/65 dark:bg-zinc-900/75 backdrop-blur-md border border-white/10 shadow-lg text-center whitespace-nowrap pointer-events-none select-none max-w-[85vw]"
              style={{ bottom: 'calc(var(--content-bottom-clearance) + 8px)', left: 'var(--bw-toast-center, calc((100vw - var(--bw-rail-w, 0px)) / 2))' }}
            >
              {saveToast.message}
            </motion.div>
          ) : (
            <motion.div key="layer-2"
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "bw-toast bw-pane-float bw-status-clear-inset fixed left-4 right-4 max-w-[500px] mx-auto z-[250] p-4 rounded-2xl bw-label-md shadow-2xl flex items-center justify-between gap-3 border backdrop-blur-md",
                saveToast.type === 'error'
                  ? "bg-destructive-solid text-white border-white/10"
                  : saveToast.type === 'info'
                  ? "bg-zinc-900/95 text-white border-white/20"
                  : "bg-success text-success-foreground border-white/10"
              )}
              style={{ bottom: 'calc(var(--content-bottom-clearance) + 8px)' }}
              onClick={() => !saveToast.action && setSaveToast(null)}
            >
              {saveToast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-white" />
              ) : saveToast.type === 'info' ? (
                <Info className="w-4 h-4 shrink-0 text-white/80" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
              )}
              <span className="flex-1 text-left line-clamp-3 [overflow-wrap:anywhere]">{saveToast.message}</span>
              {saveToast.action && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const act = saveToast.action?.onClick;
                    setSaveToast(null);
                    act?.();
                  }}
                  className="h-8 px-3 rounded-full bg-white/20 hover:bg-white/30 active:scale-[0.97] text-white bw-button-sm transition-[transform,background-color] shrink-0"
                >
                  {saveToast.action.label}
                </button>
              )}
              {!saveToast.action && (
                <button
                  onClick={() => setSaveToast(null)}
                  aria-label={t("Dismiss notification")}
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


