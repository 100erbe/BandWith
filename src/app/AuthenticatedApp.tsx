import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, LogOut, Truck, Volume2, Loader2, MessageSquare, Music, ChevronLeft, Plus } from "lucide-react";
import { cn } from "@/app/components/ui/utils";
import { Capacitor } from "@capacitor/core";

import { useAuth } from "@/lib/AuthContext";
import { useBand } from "@/lib/BandContext";
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
  notifyEventMembersCreated,
  notifyEventPendingConfirmations,
  notifyEventResponse,
} from "@/lib/services/notifications";
import {
  respondToEventInvite,
  getUserEventMembership,
  getEventMembers,
  createEvent,
} from "@/lib/services/events";
import type { EventMember, Event } from "@/lib/services/events";

import { USER } from "@/app/data/user";
import { BANDS, Band as MockBand } from "@/app/data/bands";
import { EventItem } from "@/app/data/events";
import { ChatType, ChatItem } from "@/app/data/chats";
import { NotificationItem } from "@/app/data/notifications";
import type { BandWithMembers } from "@/lib/services/bands";

import { TabName, ExpandedCardType, CreateEventType, RehearsalViewMode } from "@/app/types";

import { Header } from "@/app/components/layout/Header";
import { BottomNavigation } from "@/app/components/layout/BottomNavigation";
import { IdentityHub } from "@/app/components/layout/IdentityHub";
import { ControlDeck } from "@/app/components/layout/ControlDeck";
import { SwitchBandPopup } from "@/app/components/layout/SwitchBandPopup";

import { HomeView } from "@/app/views/HomeView";
import { ChatView } from "@/app/views/ChatView";
import { EventsView } from "@/app/views/EventsView";
import { BandMembersView } from "@/app/views/BandMembersView";
import { SetlistManagerView } from "@/app/views/SetlistManagerView";
import { SettingsView } from "@/app/views/SettingsView";
import { AnalyticsView } from "@/app/views/AnalyticsView";
import { InventoryView } from "@/app/views/InventoryView";
import { ContractsView } from "@/app/views/ContractsView";
import { TaskTemplatesView } from "@/app/views/TaskTemplatesView";

import { CreateEventModal } from "@/app/components/dashboard/CreateEventModal";
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

import { RehearsalLiveView } from "@/app/components/rehearsal/RehearsalLiveView";
import { RehearsalPostView } from "@/app/components/rehearsal/RehearsalPostView";

import { QuoteCreationWizard } from "@/app/components/quotes";
import { Quote, createQuote } from "@/app/data/quotes";

import { ChatDetailModal, NewChatModal } from "@/app/components/chat";
import { EditProfileModal, CreateBandModal } from "@/app/components/profile";
import { NotificationDetailModal } from "@/app/components/notifications/NotificationDetailModal";

import { useBodyScrollLock } from "@/app/hooks";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";

const eventToEventItem = (event: Event): EventItem => ({
  id: parseInt(event.id.replace(/-/g, "").slice(0, 8), 16) || Date.now(),
  eventId: event.id,
  title: event.title || "Untitled Event",
  status: event.event_type === "rehearsal" ? "REHEARSAL" : "CONFIRMED",
  date: event.event_date || new Date().toISOString().split("T")[0],
  time: event.start_time || "19:00",
  location: event.venue_name || event.venue_city || "TBD",
  price: event.fee?.toString() || "0",
  members: [],
  color:
    event.event_type === "rehearsal"
      ? "bg-black text-[#D4FB46]"
      : "bg-green-100 text-green-700",
  notes: event.notes || undefined,
  createdBy: event.created_by || undefined,
  setlistId: event.setlist_id || undefined,
  clientName: event.client_name || undefined,
  venueAddress: event.venue_address || undefined,
  venueCity: event.venue_city || undefined,
  eventType: event.event_type || undefined,
  loadInTime: event.load_in_time || undefined,
  soundcheckTime: event.soundcheck_time || undefined,
  endTime: event.end_time || undefined,
});

export default function AuthenticatedApp() {
  const { isAuthenticated, user } = useAuth();
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
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        const { Keyboard } = await import("@capacitor/keyboard");
        if (!alive) return;
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#000000" });
        if (Capacitor.getPlatform() === "ios") {
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

  // Data hooks
  const { data: dashboardData, loading: dashboardLoading } = useDashboardData(realBand?.id || null);
  const { data: financeData, loading: financeLoading } = useExpandedFinanceData(realBand?.id || null);
  const { events: confirmedEvents, loading: confirmedEventsLoading } = useExpandedEventsData(realBand?.id || null, ["confirmed"]);
  const { events: pendingEvents, loading: pendingEventsLoading } = useExpandedEventsData(realBand?.id || null, ["draft", "pending", "quoted"]);
  const { quotes: realQuotes, stats: quotesStats, loading: quotesLoading } = useExpandedQuotesData(realBand?.id || null);

  // Navigation
  const [activeTab, setActiveTab] = useState<TabName>("Home");
  const [mockSelectedBand, setMockSelectedBand] = useState<MockBand>(BANDS[0]);
  const [isBandSwitcherOpen, setIsBandSwitcherOpen] = useState(false);
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

  const [chatFilter, setChatFilter] = useState<ChatType>("direct");
  const [chatSearch, setChatSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  // Push navigation
  useEffect(() => {
    const handler = (ev: globalThis.Event) => {
      const d = (ev as CustomEvent).detail;
      if (d.screen === "chat" && d.chatId) {
        setActiveTab("Chat");
        setTimeout(() => {
          setSelectedChat({ id: Date.now(), uuid: d.chatId, type: "direct", name: "Chat", initials: "CH", lastMessage: "", time: "now", unread: 0, status: "received" });
        }, 100);
      } else if (d.screen === "event") setActiveTab("Events");
      else if (d.screen === "home") setActiveTab("Home");
    };
    window.addEventListener("push-navigate", handler);
    return () => window.removeEventListener("push-navigate", handler);
  }, []);

  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([]);

  const { events: realEvents, loading: eventsLoading, refetch: refetchEvents } = useEvents(realBand?.id || null);
  const { notifications: realNotifications, refetch: refetchNotifications } = useNotifications({ limit: 20 });
  const { chats: realChats, loading: chatsLoading, refetch: refetchChats } = useChats();

  const events = useMemo(() => {
    if (realEvents && realEvents.length > 0) return realEvents.map(eventToEventItem);
    return [];
  }, [realEvents]);

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
    return realNotifications.map((n) => {
      let uiType: "chat" | "event" | "finance" = "event";
      if (n.type.includes("quote") || n.type.includes("payment")) uiType = "finance";
      if (n.type.includes("chat") || n.type.includes("member") || n.type === "custom") uiType = "chat";

      let actionType: "NAV_CHAT" | "NAV_EVENTS" | "NAV_EVENTS_CONFIRMED" | "NAV_FINANCE" = "NAV_EVENTS";
      if (uiType === "finance") actionType = "NAV_FINANCE";
      if (uiType === "chat") actionType = "NAV_CHAT";
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

  const selectedBand: MockBand = useMemo(() => {
    if (realBand) {
      return {
        id: parseInt(realBand.id.replace(/-/g, "").slice(0, 8), 16) || 1,
        name: realBand.name,
        role: realBand.user_role === "admin" ? "ADMIN" : "MEMBER",
        initials: realBand.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        members: realBand.member_count,
        genre: "Rock",
        plan: realBand.plan === "pro" || realBand.plan === "enterprise" ? "Pro" : "Free",
      } as MockBand;
    }
    return mockSelectedBand;
  }, [realBand, mockSelectedBand]);

  const setSelectedBand = (band: MockBand) => {
    setMockSelectedBand(band);
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
  const [liveInterval, setLiveInterval] = useState<NodeJS.Timeout | null>(null);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCreateBand, setShowCreateBand] = useState(false);

  const [entityCounts, setEntityCounts] = useState({ templates: 0, documents: 0, inventory: 0, repertoire: 0 });

  const [selectedNotification, setSelectedNotification] = useState<{
    id: string; type: string; title: string; body?: string;
    data?: Record<string, unknown>; band_id?: string; created_at: string; read: boolean;
  } | null>(null);

  const [selectedNotifications, setSelectedNotifications] = useState<Array<{
    id: string; type: string; title: string; body?: string;
    data?: Record<string, unknown>; band_id?: string; created_at: string; read: boolean;
  }>>([]);

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

      const others = chat.participants.filter((p) => p.profile && p.user_id !== user?.id);
      const displayName = chat.name || others.map((p) => p.profile?.full_name || "Unknown").join(", ") || "Chat";
      const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

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

      return {
        id: parseInt(chat.id.replace(/-/g, "").slice(0, 8), 16) || Date.now(),
        uuid: chat.id,
        type,
        name: displayName,
        initials,
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
      };
    }) as ChatItem[];
  }, [realChats, realBand?.name, user?.id]);

  const filteredChats = useMemo(() => {
    return convertedChats
      .filter((c) => {
        const mt = c.type === chatFilter;
        const ms = c.name.toLowerCase().includes(chatSearch.toLowerCase()) || c.lastMessage.toLowerCase().includes(chatSearch.toLowerCase()) || (c.subtitle?.toLowerCase().includes(chatSearch.toLowerCase()) ?? false);
        return mt && ms;
      })
      .sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1;
        if (a.unread === 0 && b.unread > 0) return 1;
        return (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0);
      });
  }, [convertedChats, chatFilter, chatSearch]);

  const chatUnreadCounts = useMemo(() => {
    const counts = { direct: 0, band: 0, event: 0 };
    convertedChats.forEach((c) => { if (c.unread > 0) counts[c.type] += c.unread; });
    return counts;
  }, [convertedChats]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const mf = eventFilter === "All" || (eventFilter === "Confirmed" && e.status === "CONFIRMED") || (eventFilter === "Rehearsal" && e.status === "REHEARSAL");
      const ms = e.title.toLowerCase().includes(eventSearch.toLowerCase()) || e.location.toLowerCase().includes(eventSearch.toLowerCase());
      return mf && ms;
    });
  }, [events, eventFilter, eventSearch]);

  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: EventItem[] } = {};
    filteredEvents.forEach((e) => { if (!groups[e.date]) groups[e.date] = []; groups[e.date].push(e); });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEvents]);

  const upcomingRehearsals = useMemo(() => {
    return events.filter((e) => e.status === "REHEARSAL").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const currentRehearsal = upcomingRehearsals[rehearsalIndex] || upcomingRehearsals[0];
  const currentDetails = currentRehearsal ? rehearsalDetails[currentRehearsal.id] || rehearsalDetails[105] : null;

  const memoizedBandMembers = useMemo(() => {
    if (!realBand?.members) return [];
    return realBand.members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.profile?.full_name || m.profile?.email?.split("@")[0] || "Member",
      role: m.role || m.profile?.instrument || "Member",
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
  const closeIdentity = () => setIsIdentityOpen(false);

  const toggleControlDeck = () => {
    if (isControlDeckOpen) { setIsControlDeckOpen(false); setActiveTab("Home"); }
    else { setIsControlDeckOpen(true); setIsIdentityOpen(false); setActiveTab("More"); }
  };

  const closeMenus = () => { setIsControlDeckOpen(false); setIsIdentityOpen(false); };

  const handleGridNav = (item: string) => {
    setIsControlDeckOpen(false);
    setActiveTab("Home");
    if (item === "Messages") setActiveTab("Chat");
    if (item === "Finance") setExpandedCard("finance");
    if (item === "Events") setActiveTab("Events");
    if (item === "Settings") { setSettingsInitialSection("main"); setShowSettings(true); }
    if (item.startsWith("Settings:")) {
      setSettingsInitialSection(item.split(":")[1] as any);
      setShowSettings(true);
    }
    if (item === "Analytics") setShowAnalytics(true);
    if (item === "Quote") { setCreateEventType("quote"); setIsCreateEventOpen(true); }
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

    const detailTypes = ["invite_sent", "invite_received", "invite_accepted", "invite_declined", "member_joined", "member_left", "quote_received", "task_assigned", "event_invite", "payment_received", "payment_due"];
    const realNotifForType = first ? realNotifications?.find((rn) => { const nid = parseInt(rn.id.replace(/-/g, "").slice(0, 8), 16) || 0; return nid === first.id; }) : null;
    const realType = realNotifForType?.type || first?.type;

    if (first && realType && detailTypes.includes(realType)) {
      const realData = clicked.map((n) => { const rid = notificationIdMap.get(n.id); return realNotifications?.find((rn) => rn.id === rid); }).filter(Boolean).map((n) => ({ id: n!.id, type: n!.type, title: n!.title, body: n!.body, data: n!.data as Record<string, unknown>, band_id: n!.band_id, created_at: n!.created_at, read: n!.read }));
      if (realData.length > 0) {
        if (realData.length === 1) { setSelectedNotification(realData[0]); setSelectedNotifications([]); }
        else { setSelectedNotifications(realData); setSelectedNotification(null); }
        closeIdentity();
        return;
      }
    }

    ids.forEach((nid) => { const rid = notificationIdMap.get(nid); if (rid) markNotificationAsRead(rid); });
    setTimeout(() => refetchNotifications?.(), 500);
    closeIdentity();
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

  const handleCreateEvent = (type: CreateEventType) => { setCreateEventType(type); setIsCreateEventOpen(true); };

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

  const handleEventEdit = () => {
    if (!selectedEvent) return;
    const eventType = selectedEvent.status === 'REHEARSAL' ? 'rehearsal' : 'gig';
    setSelectedEvent(null);
    setSelectedEventMembership(null);
    setCreateEventType(eventType as CreateEventType);
    setIsCreateEventOpen(true);
  };

  const handleEventDelete = async () => {
    if (!selectedEvent?.eventId) return;
    try {
      await supabase.from('events').delete().eq('id', selectedEvent.eventId);
      refetchEvents();
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

  const handleEventCardClick = async (event: EventData) => {
    setSelectedEvent(event);
    setSelectedEventMembership(null);
    if (user?.id && event.eventId) {
      const { data: membership } = await getUserEventMembership(event.eventId, user.id);
      setSelectedEventMembership(membership);
    }
  };

  const handleEventAccept = async () => {
    if (!selectedEventMembership?.id || !selectedEvent) return;
    await respondToEventInvite(selectedEventMembership.id, "confirmed");
    const realEventId = selectedEvent.eventId;
    if (realEventId) {
      const { data: members } = await getEventMembers(realEventId);
      const creator = members?.find((m) => m.role === "admin" || m.user_id === selectedEvent.createdBy);
      if (creator?.user_id && user?.id) {
        await notifyEventResponse(realEventId, selectedEvent.title, selectedEvent.status === "REHEARSAL" ? "rehearsal" : "gig", user.id, creator.user_id, "accepted");
      }
    }
    await refetchEvents?.();
    await refetchNotifications?.();
  };

  const handleEventDecline = async () => {
    if (!selectedEventMembership?.id || !selectedEvent) return;
    await respondToEventInvite(selectedEventMembership.id, "declined");
    const realEventId = selectedEvent.eventId;
    if (realEventId) {
      const { data: members } = await getEventMembers(realEventId);
      const creator = members?.find((m) => m.role === "admin" || m.user_id === selectedEvent.createdBy);
      if (creator?.user_id && user?.id) {
        await notifyEventResponse(realEventId, selectedEvent.title, selectedEvent.status === "REHEARSAL" ? "rehearsal" : "gig", user.id, creator.user_id, "declined");
      }
    }
    await refetchEvents?.();
    await refetchNotifications?.();
  };

  const handleEventCreate = async (data: any) => {
    const isRehearsalWizard = !data.details && data.title;
    const title = isRehearsalWizard ? data.title : data.details?.title;
    const date = isRehearsalWizard ? data.date : data.details?.date;
    const time = isRehearsalWizard ? data.time : data.details?.time;
    const location = isRehearsalWizard ? data.location : data.details?.venue;
    const price = isRehearsalWizard ? data.totalCost : data.details?.pay || "0";
    const eventType = isRehearsalWizard ? "rehearsal" : data.eventType;

    if (realBand?.id) {
      const venueAddress = isRehearsalWizard ? data.address : data.details?.address;
      const venueCity = isRehearsalWizard ? data.city : data.details?.city;
      const clientName = data.details?.clientName || data.clientName;

      const eventData = {
        band_id: realBand.id,
        title: title || "Untitled Event",
        event_type: eventType as "gig" | "rehearsal",
        status: "confirmed" as const,
        date, time: time || "20:00",
        event_date: date, start_time: time || "20:00",
        venue_name: location || "TBD",
        venue_address: venueAddress || null,
        venue_city: venueCity || null,
        client_name: clientName || null,
        fee: parseFloat(price) || 0,
        notes: data.notes || null,
        description: location ? `Location: ${location}` : null,
      };

      const { data: saved, error } = await createEvent(eventData);
      if (!error && saved) {
        if (user?.id) {
          try {
            const creatorName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";
            const invitedIds = data.audienceIds?.length > 0 ? data.audienceIds : data.members?.map((m: any) => m.id) || [];
            await notifyEventMembersCreated(realBand.id, saved.id, title || "Event", date, time || "20:00", eventType, user.id, creatorName, invitedIds, { venue: location, fee: parseFloat(price) || undefined });
            const invitedCount = invitedIds.length > 0 ? invitedIds.filter((id: string) => id !== user.id).length : (realBand.member_count || 1) - 1;
            if (invitedCount > 0) await notifyEventPendingConfirmations(user.id, realBand.id, saved.id, title || "Event", eventType, invitedCount);
          } catch (err) { console.error("Notify error:", err); }
        }
        refetchEvents();
      }
    }

    const newId = Date.now();
    setEvents((prev) => [...prev, {
      id: newId, title, status: eventType === "rehearsal" ? "REHEARSAL" : "CONFIRMED",
      date, time, location, price, members: data.members?.map((m: any) => "U" + m.id) || [],
      color: eventType === "rehearsal" ? "bg-black text-[#D4FB46]" : "bg-yellow-100 text-yellow-700",
    }]);

    if (eventType === "rehearsal") {
      setRehearsalDetails((prev) => ({
        ...prev,
        [newId]: {
          setlist: data.setlist?.filter((s: any) => s.type === "song") || [],
          tasks: data.tasks || [],
          timeline: [
            { time, label: "Start", icon: Play, active: true },
            { time: "22:00", label: "End", icon: LogOut },
          ],
        },
      }));
    }
    setIsCreateEventOpen(false);
  };

  // Render
  const isMenuOpen = isIdentityOpen || isControlDeckOpen;
  const isHeaderHidden = !!expandedCard || isMenuOpen;
  const userRole: UserRole = isAdmin ? "admin" : "member";
  const permissions = getPermissions(userRole);
  const roleBgColor = isAdmin ? "#E6E5E1" : "#F0F7D8";

  return (
    <div className="min-h-screen text-[#1A1A1A] font-sans selection:bg-[#D4FB46]/50">
      <div className={cn("fixed inset-0 transition-colors duration-500 z-0", isMenuOpen && "bg-black")} style={{ backgroundColor: isMenuOpen ? undefined : roleBgColor }} />
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

      <div className="w-full relative flex flex-col z-10" style={{
        paddingTop: isAndroid && isNative ? "56px" : "max(env(safe-area-inset-top, 0px), 12px)",
        paddingBottom: isAndroid && isNative ? "calc(100px + 24px)" : "calc(100px + env(safe-area-inset-bottom, 0px))",
        paddingLeft: "16px", paddingRight: "16px",
      }}>
        <Header
          activeTab={activeTab} selectedBand={selectedBand}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: parseInt(b.id.replace(/-/g, "").slice(0, 8), 16) || 1, name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: "Rock", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as MockBand)) : BANDS}
          onOpenBandSwitcher={() => setIsBandSwitcherOpen(true)}
          filteredEventsCount={filteredEvents.length} totalEventsCount={events.length}
          eventView={eventView} setEventView={setEventView}
          onCreateEvent={() => { setCreateEventType(null); setIsCreateEventOpen(true); }}
          onOpenIdentity={openIdentity} unreadCount={unreadCount} isHidden={isHeaderHidden}
        />

        <AnimatePresence mode="wait">
          {activeTab === "Home" && (
            <HomeView key={`dashboard-${selectedBand.id}`} selectedBand={selectedBand} expandedCard={expandedCard} setExpandedCard={setExpandedCard} upcomingRehearsals={upcomingRehearsals} currentRehearsal={currentRehearsal} onRehearsalClick={handleRehearsalClick} isHidden={isMenuOpen} dashboardData={dashboardData} dashboardLoading={dashboardLoading} isAdmin={isAdmin} onQuickAction={(action) => { if (action === "Band Members") setShowBandMembers(true); if (action === "Setlist & Repertoire") setShowSetlistManager(true); if (action === "Inventory") setShowInventory(true); if (action === "Contracts & Riders") setShowContracts(true); if (action === "Task Templates") setShowTaskTemplates(true); }} />
          )}
          {activeTab === "Chat" && (
            <ChatView key="chat" chatFilter={chatFilter} setChatFilter={setChatFilter} chatSearch={chatSearch} setChatSearch={setChatSearch} filteredChats={filteredChats} unreadCounts={chatUnreadCounts} onChatClick={(c) => setSelectedChat(c)} onStartChat={() => setShowNewChat(true)} />
          )}
          {activeTab === "Events" && (
            <EventsView key="events" eventFilter={eventFilter} setEventFilter={setEventFilter} eventSearch={eventSearch} setEventSearch={setEventSearch} eventView={eventView} groupedEvents={groupedEvents} allEvents={events} onEventClick={handleEventCardClick} onCreateEvent={() => { setCreateEventType(null); setIsCreateEventOpen(true); }} isAdmin={isAdmin} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedEvent && (
            <EventDetail event={selectedEvent} onClose={() => { setSelectedEvent(null); setSelectedEventMembership(null); }}
              userResponse={selectedEventMembership?.status === "confirmed" ? "accepted" : selectedEventMembership?.status === "declined" ? "declined" : selectedEventMembership?.status === "invited" ? "pending" : "accepted"}
              onAccept={handleEventAccept} onDecline={handleEventDecline}
              onEdit={handleEventEdit} onDelete={handleEventDelete} onChat={handleEventChat}
              memberFee={selectedEventMembership?.fee} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedChat && selectedChat.uuid && (
            <ChatDetailModal chat={{ id: selectedChat.uuid, type: selectedChat.type, name: selectedChat.name, initials: selectedChat.initials, unread: selectedChat.unread, members: selectedChat.members }} onClose={() => { setSelectedChat(null); refetchChats?.(); }} />
          )}
          {selectedChat && !selectedChat.uuid && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6" onClick={() => setSelectedChat(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 text-center max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="w-16 h-16 bg-[#D4FB46] rounded-full flex items-center justify-center mx-auto mb-4"><MessageSquare className="w-8 h-8 text-black" /></div>
                <h3 className="text-xl font-black mb-2">Demo Chat</h3>
                <p className="text-stone-500 text-sm mb-6">This is sample data. Start a real conversation using the + button!</p>
                <button onClick={() => { setSelectedChat(null); setShowNewChat(true); }} className="w-full bg-black text-[#D4FB46] py-3 rounded-full font-bold text-sm">Start Real Chat</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onChatCreated={(id) => { setShowNewChat(false); setSelectedChat({ id: Date.now(), uuid: id, type: "direct", name: "New Chat", initials: "NC", lastMessage: "Start chatting...", time: "now", unread: 0, status: "read" }); refetchChats?.(); }} />}</AnimatePresence>

        <AnimatePresence>{isCreateEventOpen && createEventType !== "quote" && <CreateEventModal initialType={createEventType} layoutId={`create-button-${createEventType}`} onClose={() => setIsCreateEventOpen(false)} onCreate={handleEventCreate} currentUserId={user?.id} bandMembers={memoizedBandMembers} />}</AnimatePresence>
        <AnimatePresence>{isCreateEventOpen && createEventType === "quote" && <QuoteCreationWizard onClose={() => setIsCreateEventOpen(false)} onCreate={(q) => { setIsCreateEventOpen(false); }} />}</AnimatePresence>

        <IdentityHub isOpen={isIdentityOpen} onClose={closeIdentity}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: parseInt(b.id.replace(/-/g, "").slice(0, 8), 16) || 1, name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: "Rock", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as MockBand)) : BANDS}
          selectedBand={selectedBand} setSelectedBand={setSelectedBand} notificationGroups={notificationGroups} unreadCount={unreadCount} onNotificationClick={handleNotificationClick} onMarkAsRead={handleMarkSingleAsRead} onMarkGroupAsRead={handleMarkGroupAsRead}
          onEntityDetailClick={(l) => { if (l === "INVENTORY") setShowInventory(true); if (l === "REPERTOIRE") setShowSetlistManager(true); if (l === "TEMPLATES") setShowTaskTemplates(true); if (l === "DOCUMENTS") setShowContracts(true); }}
          entityCounts={entityCounts}
          onEditProfile={() => setShowEditProfile(true)} onEditBand={() => setShowBandMembers(true)} onAddEntity={() => setShowCreateBand(true)} />

        <ControlDeck isOpen={isControlDeckOpen} onClose={toggleControlDeck} onNavigate={handleGridNav} isAdmin={isAdmin} />

        <SwitchBandPopup
          isOpen={isBandSwitcherOpen}
          onClose={() => setIsBandSwitcherOpen(false)}
          bands={realBands.length > 0 ? realBands.map((b) => ({ id: parseInt(b.id.replace(/-/g, "").slice(0, 8), 16) || 1, name: b.name, role: b.user_role === "admin" ? "ADMIN" : "MEMBER", initials: b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(), members: b.member_count, genre: "Rock", plan: (b.plan === "pro" || b.plan === "enterprise") ? "Pro" : "Free" } as MockBand)) : BANDS}
          selectedBand={selectedBand}
          onSelectBand={setSelectedBand}
          onAddNewBand={() => setShowCreateBand(true)}
        />

        <AnimatePresence>
          {expandedCard === "finance" && <FinanceExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} financialStats={financeData.financialStats} transactions={financeData.recentTransactions} loading={financeLoading} />}
          {expandedCard === "pending" && <PendingExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} eventFilter={eventFilter} setEventFilter={setEventFilter} events={pendingEvents} loading={pendingEventsLoading} />}
          {expandedCard === "quotes" && <QuotesExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} realQuotes={realQuotes} quoteStats={quotesStats} loading={quotesLoading} />}
          {expandedCard === "confirmed" && <ConfirmedExpanded bandId={realBand?.id || selectedBand.id.toString()} onClose={() => setExpandedCard(null)} events={confirmedEvents} loading={confirmedEventsLoading} />}
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
          {expandedCard === "fee" && <FeeExpanded onClose={() => setExpandedCard(null)} bandName={realBand?.name || selectedBand.name} memberFee={realBand?.members?.find((m) => m.user_id === user?.id)?.default_fee || 0} loading={false} events={confirmedEvents.map((e) => ({ id: e.id, title: e.title, date: e.event_date, fee: e.fee || 0, status: e.status as "confirmed" | "pending" | "completed", type: e.event_type as "gig" | "rehearsal" }))} />}
        </AnimatePresence>

        <BottomNavigation activeTab={activeTab} setActiveTab={setActiveTab} isPlusMenuOpen={isPlusMenuOpen} setIsPlusMenuOpen={setIsPlusMenuOpen} isControlDeckOpen={isControlDeckOpen} isIdentityOpen={isIdentityOpen} toggleControlDeck={toggleControlDeck} closeMenus={closeMenus} onCreateEvent={handleCreateEvent} isHidden={!!expandedCard || !!selectedChat || !!selectedEvent || !!selectedNotification || isBandSwitcherOpen || isIdentityOpen} />
      </div>

      <AnimatePresence>
        {rehearsalViewMode === "live" && expandedCard === "rehearsal" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200]">
            <RehearsalLiveView onClose={() => setRehearsalViewMode("overview")} onFinish={() => setRehearsalViewMode("post")} />
          </motion.div>
        )}
        {rehearsalViewMode === "post" && expandedCard === "rehearsal" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200]">
            <RehearsalPostView onClose={() => setRehearsalViewMode("overview")} />
          </motion.div>
        )}

        {showBandMembers && <BandMembersView onClose={() => setShowBandMembers(false)} />}
        {showSetlistManager && <SetlistManagerView onClose={() => setShowSetlistManager(false)} />}
        {showSettings && <SettingsView onClose={() => { setShowSettings(false); setSettingsInitialSection("main"); }} initialSection={settingsInitialSection} />}
        {showAnalytics && <AnalyticsView onClose={() => setShowAnalytics(false)} />}
        {showInventory && realBand && <InventoryView onBack={() => setShowInventory(false)} bandId={realBand.id} />}
        {showContracts && realBand && <ContractsView onBack={() => setShowContracts(false)} bandId={realBand.id} />}
        {showTaskTemplates && realBand && <TaskTemplatesView onBack={() => setShowTaskTemplates(false)} bandId={realBand.id} />}

        {showEditProfile && <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} />}
        {showCreateBand && <CreateBandModal isOpen={showCreateBand} onClose={() => setShowCreateBand(false)} onBandCreated={(id) => { const nb = realBands.find((b) => b.id === id); if (nb) selectBand(nb.id); }} />}

        <NotificationDetailModal
          isOpen={!!selectedNotification || selectedNotifications.length > 0}
          onClose={() => { setSelectedNotification(null); setSelectedNotifications([]); }}
          notification={selectedNotification}
          notifications={selectedNotifications}
          onMarkAsRead={(id) => { const nid = id || selectedNotification?.id; if (nid) markNotificationAsRead(nid).then(() => refetchNotifications?.()); if (!id) { setSelectedNotification(null); setSelectedNotifications([]); } }}
          onMarkAllAsRead={() => { Promise.all(selectedNotifications.map((n) => markNotificationAsRead(n.id))).then(() => refetchNotifications?.()); setSelectedNotification(null); setSelectedNotifications([]); }}
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
            setSelectedNotification(null);
            setSelectedNotifications([]);
          }}
        />
      </AnimatePresence>
    </div>
  );
}
