import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, LogOut, Truck, Volume2 } from "lucide-react";
import { cn } from "@/app/components/ui/utils";

// Data imports
import { USER } from "@/app/data/user";
import { BANDS, Band } from "@/app/data/bands";
import { EVENTS_DATA, EventItem } from "@/app/data/events";
import { CHATS_DATA, ChatType } from "@/app/data/chats";
import { INITIAL_NOTIFICATIONS, NotificationItem } from "@/app/data/notifications";

// Type imports
import { TabName, ExpandedCardType, CreateEventType, RehearsalViewMode } from "@/app/types";

// Layout components
import { Header } from "@/app/components/layout/Header";
import { BottomNavigation } from "@/app/components/layout/BottomNavigation";
import { IdentityHub } from "@/app/components/layout/IdentityHub";
import { ControlDeck } from "@/app/components/layout/ControlDeck";

// View components
import { HomeView } from "@/app/views/HomeView";
import { ChatView } from "@/app/views/ChatView";
import { EventsView } from "@/app/views/EventsView";

// Dashboard components
import { CreateEventModal } from "@/app/components/dashboard/CreateEventModal";
import { EventData } from "@/app/components/dashboard/EventCard";
import { EventDetail } from "@/app/components/dashboard/EventDetail";

// Expanded card components
import { 
  FinanceExpanded, 
  PendingExpanded, 
  QuotesExpanded, 
  ConfirmedExpanded,
  RehearsalExpanded
} from "@/app/components/dashboard/expanded";

// Rehearsal components
import { RehearsalLiveView } from "@/app/components/rehearsal/RehearsalLiveView";
import { RehearsalPostView } from "@/app/components/rehearsal/RehearsalPostView";

// Quote components
import { QuoteCreationWizard } from "@/app/components/quotes";
import { Quote, createQuote } from "@/app/data/quotes";

// Hooks
import { useBodyScrollLock } from "@/app/hooks";

// --- MAIN APP ---
export default function App() {
  // Core navigation state
  const [activeTab, setActiveTab] = useState<TabName>("Home");
  const [selectedBand, setSelectedBand] = useState<Band>(BANDS[0]);
  const [isBandSwitcherOpen, setIsBandSwitcherOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<ExpandedCardType>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  
  // Menu states
  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const [isControlDeckOpen, setIsControlDeckOpen] = useState(false);

  // Event states
  const [eventView, setEventView] = useState<'list' | 'calendar'>('list');
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState("All");
  const [events, setEvents] = useState(EVENTS_DATA);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [createEventType, setCreateEventType] = useState<CreateEventType>(null);
  
  // Chat states
  const [chatFilter, setChatFilter] = useState<ChatType>('direct');
  const [chatSearch, setChatSearch] = useState('');

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Rehearsal states
  const [rehearsalIndex, setRehearsalIndex] = useState(0);
  const [rehearsalViewMode, setRehearsalViewMode] = useState<RehearsalViewMode>('overview');
  const [isLive, setIsLive] = useState(false);
  const [liveInterval, setLiveInterval] = useState<NodeJS.Timeout | null>(null);

  // Rehearsal details (mock database)
  const [rehearsalDetails, setRehearsalDetails] = useState<{ [key: number]: any }>({
    105: {
      setlist: [
        { id: 's1', title: "Giant Steps", key: "Eb", bpm: 280, duration: "4:30" },
        { id: 's2', title: "Nardis", key: "Em", bpm: 140, duration: "6:15" },
        { id: 's3', title: "So What", key: "Dm", bpm: 135, duration: "9:00" },
        { id: 's4', title: "Spain", key: "Bm", bpm: 110, duration: "5:45" }
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
        { time: "22:00", label: "End", icon: LogOut }
      ]
    }
  });

  // --- COMPUTED VALUES ---
  
  // Notification groups
  const notificationGroups = useMemo(() => {
    const unread = notifications.filter(n => !n.read);
    const groups: { [key: string]: typeof unread } = {};
    
    unread.forEach(n => {
        if (!groups[n.type]) groups[n.type] = [];
        groups[n.type].push(n);
    });

    return Object.entries(groups).map(([type, items]) => ({ type, items }));
  }, [notifications]);

  // Filtered chats
  const filteredChats = useMemo(() => {
      return CHATS_DATA.filter(chat => {
          const matchesType = chat.type === chatFilter;
          const matchesSearch = chat.name.toLowerCase().includes(chatSearch.toLowerCase()) || 
                                chat.lastMessage.toLowerCase().includes(chatSearch.toLowerCase());
          return matchesType && matchesSearch;
      });
  }, [chatFilter, chatSearch]);

  // Filtered events
  const filteredEvents = useMemo(() => {
      return events.filter(event => {
          const matchesFilter = eventFilter === 'All' || 
                               (eventFilter === 'Confirmed' && event.status === 'CONFIRMED') ||
                               (eventFilter === 'Tentative' && event.status === 'TENTATIVE') ||
                               (eventFilter === 'Pending' && event.status === 'QUOTE') ||
                               (eventFilter === 'Rehearsal' && event.status === 'REHEARSAL');
          const matchesSearch = event.title.toLowerCase().includes(eventSearch.toLowerCase()) || 
                                event.location.toLowerCase().includes(eventSearch.toLowerCase());
          return matchesFilter && matchesSearch;
      });
  }, [events, eventFilter, eventSearch]);

  // Grouped events by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: typeof EVENTS_DATA } = {};
    filteredEvents.forEach(event => {
      if (!groups[event.date]) groups[event.date] = [];
      groups[event.date].push(event);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEvents]);

  // Upcoming rehearsals
  const upcomingRehearsals = useMemo(() => {
    return events
      .filter(e => e.status === 'REHEARSAL')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const currentRehearsal = upcomingRehearsals[rehearsalIndex] || upcomingRehearsals[0];
  const currentDetails = currentRehearsal 
    ? (rehearsalDetails[currentRehearsal.id] || rehearsalDetails[105]) 
    : null;

  // --- EFFECTS ---
  
  // Lock body scroll when menus are open
  useBodyScrollLock([!!expandedCard, isIdentityOpen, isControlDeckOpen]);

  // Reset rehearsal index if out of bounds
  useEffect(() => {
    if (rehearsalIndex >= upcomingRehearsals.length && upcomingRehearsals.length > 0) {
        setRehearsalIndex(upcomingRehearsals.length - 1);
    }
  }, [upcomingRehearsals.length, rehearsalIndex]);

  // Reset view mode when opening/closing rehearsal card
  useEffect(() => {
      if (expandedCard === 'rehearsal') {
           if (upcomingRehearsals.length > 1) {
               setRehearsalViewMode('index');
           } else {
               setRehearsalViewMode('overview');
           }
      } else {
      if (isLive) toggleLive();
          setRehearsalViewMode('overview');
      }
  }, [expandedCard]);

  // --- HANDLERS ---
  
  const openIdentity = () => { 
    setIsIdentityOpen(true); 
    setIsControlDeckOpen(false); 
    setIsBandSwitcherOpen(false); 
  };
  
  const closeIdentity = () => { 
    setIsIdentityOpen(false); 
  };
  
  const toggleControlDeck = () => { 
    if (isControlDeckOpen) { 
      setIsControlDeckOpen(false); 
      setActiveTab("Home"); 
    } else { 
      setIsControlDeckOpen(true); 
      setIsIdentityOpen(false); 
      setActiveTab("More"); 
    }
  };

  const closeMenus = () => {
    setIsControlDeckOpen(false);
    setIsIdentityOpen(false);
  };

  const handleGridNav = (item: string) => {
      if (item === 'Dashboard') { setIsControlDeckOpen(false); setActiveTab("Home"); }
      if (item === 'Messages') { setIsControlDeckOpen(false); setActiveTab("Chat"); }
      if (item === 'Finance') { setIsControlDeckOpen(false); setExpandedCard("finance"); }
      if (item === 'Events') { setIsControlDeckOpen(false); setActiveTab("Events"); }
  };

  const handleNotificationClick = (ids: number[], actionType: string) => {
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
    closeIdentity();
    setTimeout(() => {
        if (actionType === "NAV_CHAT") {
            setActiveTab("Chat");
        } else if (actionType === "NAV_EVENTS_CONFIRMED") {
            setActiveTab("Events");
            setEventFilter("Confirmed");
        } else if (actionType === "NAV_FINANCE") {
            setExpandedCard("finance");
        }
    }, 300);
  };

  const handleCreateEvent = (type: CreateEventType) => {
    setCreateEventType(type);
    setIsCreateEventOpen(true);
  };

  const handleRehearsalClick = () => {
                            setExpandedCard("rehearsal");
                            if (upcomingRehearsals.length > 1) {
                                setRehearsalViewMode('index');
                            } else {
                                setRehearsalViewMode('overview');
                            }
  };

  const handleRehearsalDecline = () => {
    setEvents(prev => prev.filter(e => e.id !== currentRehearsal?.id));
    if (upcomingRehearsals.length <= 1) {
      setExpandedCard(null);
    } else {
      if (rehearsalIndex === upcomingRehearsals.length - 1) {
        setRehearsalIndex(prev => prev - 1);
      }
    }
  };

  const toggleLive = () => {
    if (!isLive) {
      setIsLive(true);
      const interval = setInterval(() => {}, 1000);
      setLiveInterval(interval);
      setRehearsalViewMode('live');
    } else {
      if (liveInterval) clearInterval(liveInterval);
      setIsLive(false);
      setRehearsalViewMode('post');
    }
  };

  const handleEventCreate = (data: any) => {
                    console.log("New Event Created:", data);
                    const newEventId = Date.now();
                    
                    const isRehearsalWizard = !data.details && data.title;
                    
                    const title = isRehearsalWizard ? data.title : data.details?.title;
                    const date = isRehearsalWizard ? data.date : data.details?.date;
                    const time = isRehearsalWizard ? data.time : data.details?.time;
                    const location = isRehearsalWizard ? data.location : data.details?.venue;
                    const price = isRehearsalWizard ? data.totalCost : data.details?.pay || '0';
                    const eventType = isRehearsalWizard ? 'rehearsal' : data.eventType;

    const newEvent: EventItem = {
                        id: newEventId,
                        title: title,
                        status: eventType === 'rehearsal' ? 'REHEARSAL' : (data.status === 'tentative' ? 'TENTATIVE' : 'CONFIRMED'),
                        date: date,
                        time: time,
                        location: location,
                        price: price,
      members: data.members?.map((m: any) => "U" + m.id) || [],
                        color: eventType === 'rehearsal' ? "bg-black text-[#D4FB46]" : "bg-yellow-100 text-yellow-700"
                    };
                    
                    setEvents(prev => [...prev, newEvent]);

                    if (eventType === 'rehearsal') {
                        setRehearsalDetails(prev => ({
                            ...prev,
                            [newEventId]: {
          setlist: data.setlist?.filter((s: any) => s.type === 'song') || [],
          tasks: data.tasks || [],
          timeline: [
                                    { time: time, label: "Start", icon: Play, active: true },
                                    { time: "22:00", label: "End", icon: LogOut }
                                ]
                            }
                        }));
                    }
                    
                    setIsCreateEventOpen(false);
  };

  // --- RENDER ---
  
  const isMenuOpen = isIdentityOpen || isControlDeckOpen;
  const isHeaderHidden = !!expandedCard || isMenuOpen;
                                        
                                        return (
                                             <div className={cn(
      "min-h-screen text-[#1A1A1A] font-sans pb-32 overflow-x-hidden selection:bg-[#D4FB46]/50 transition-colors duration-500",
      isMenuOpen ? "bg-black" : "bg-[#E6E5E1]"
    )}>
      
      {/* Background Noise Texture */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply z-0" 
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
        }} 
      />

      {/* Main Container */}
      <div className="mx-auto max-w-md min-h-screen relative flex flex-col px-3 pt-8 z-10">
        
        {/* Header */}
        <Header
          activeTab={activeTab}
          selectedBand={selectedBand}
          bands={BANDS}
          isBandSwitcherOpen={isBandSwitcherOpen}
          setIsBandSwitcherOpen={setIsBandSwitcherOpen}
          setSelectedBand={setSelectedBand}
          filteredEventsCount={filteredEvents.length}
          totalEventsCount={EVENTS_DATA.length}
          eventView={eventView}
          setEventView={setEventView}
          onCreateEvent={() => { setCreateEventType(null); setIsCreateEventOpen(true); }}
          onOpenIdentity={openIdentity}
          unreadCount={unreadCount}
          isHidden={isHeaderHidden}
        />

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === 'Home' && (
            <HomeView
              key={`dashboard-${selectedBand.id}`}
              selectedBand={selectedBand}
              expandedCard={expandedCard}
              setExpandedCard={setExpandedCard}
              upcomingRehearsals={upcomingRehearsals}
              currentRehearsal={currentRehearsal}
              onRehearsalClick={handleRehearsalClick}
              isHidden={isMenuOpen}
            />
          )}

          {activeTab === 'Chat' && (
            <ChatView
              key="chat"
              chatFilter={chatFilter}
              setChatFilter={setChatFilter}
              chatSearch={chatSearch}
              setChatSearch={setChatSearch}
              filteredChats={filteredChats}
            />
          )}

          {activeTab === 'Events' && (
            <EventsView
              key="events"
              eventFilter={eventFilter}
              setEventFilter={setEventFilter}
              eventSearch={eventSearch}
              setEventSearch={setEventSearch}
              eventView={eventView}
              groupedEvents={groupedEvents}
              onEventClick={(event) => setSelectedEvent(event)}
            />
            )}
        </AnimatePresence>

        {/* Event Detail Modal */}
        <AnimatePresence>
          {selectedEvent && (
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          )}
        </AnimatePresence>
        
        {/* Create Event Page (Fullscreen) */}
        <AnimatePresence>
          {isCreateEventOpen && createEventType !== 'quote' && (
            <CreateEventModal 
              initialType={createEventType}
              layoutId={`create-button-${createEventType}`}
              onClose={() => setIsCreateEventOpen(false)} 
              onCreate={handleEventCreate}
            />
          )}
        </AnimatePresence>

        {/* Create Quote Page (Fullscreen) */}
        <AnimatePresence>
          {isCreateEventOpen && createEventType === 'quote' && (
            <QuoteCreationWizard
              onClose={() => setIsCreateEventOpen(false)}
              onCreate={(quoteData) => {
                console.log("Quote created from + button:", quoteData);
                setIsCreateEventOpen(false);
              }}
            />
          )}
        </AnimatePresence>

        {/* Identity Hub */}
        <IdentityHub
          isOpen={isIdentityOpen}
          onClose={closeIdentity}
          bands={BANDS}
          selectedBand={selectedBand}
          setSelectedBand={setSelectedBand}
          notificationGroups={notificationGroups}
          unreadCount={unreadCount}
          onNotificationClick={handleNotificationClick}
        />

        {/* Control Deck */}
        <ControlDeck
          isOpen={isControlDeckOpen}
          onClose={toggleControlDeck}
          onNavigate={handleGridNav}
        />

        {/* Expanded Cards */}
        <AnimatePresence>
            {expandedCard === "finance" && (
            <FinanceExpanded
              bandId={selectedBand.id}
              onClose={() => setExpandedCard(null)}
            />
          )}

          {expandedCard === "pending" && (
            <PendingExpanded
              bandId={selectedBand.id}
              onClose={() => setExpandedCard(null)}
              eventFilter={eventFilter}
              setEventFilter={setEventFilter}
            />
          )}

          {expandedCard === "quotes" && (
            <QuotesExpanded
              bandId={selectedBand.id}
              onClose={() => setExpandedCard(null)}
            />
          )}

          {expandedCard === "confirmed" && (
            <ConfirmedExpanded
              bandId={selectedBand.id}
              onClose={() => setExpandedCard(null)}
            />
          )}

          {expandedCard === "rehearsal" && currentRehearsal && (
            <RehearsalExpanded
              upcomingRehearsals={upcomingRehearsals}
              currentRehearsal={currentRehearsal}
              currentDetails={currentDetails}
              rehearsalIndex={rehearsalIndex}
              setRehearsalIndex={setRehearsalIndex}
              rehearsalViewMode={rehearsalViewMode}
              setRehearsalViewMode={setRehearsalViewMode}
              isLive={isLive}
              onClose={() => setExpandedCard(null)}
              onDecline={handleRehearsalDecline}
            />
          )}
        </AnimatePresence>

        {/* Bottom Navigation */}
        <BottomNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isPlusMenuOpen={isPlusMenuOpen}
          setIsPlusMenuOpen={setIsPlusMenuOpen}
          isControlDeckOpen={isControlDeckOpen}
          isIdentityOpen={isIdentityOpen}
          toggleControlDeck={toggleControlDeck}
          closeMenus={closeMenus}
          onCreateEvent={handleCreateEvent}
          isHidden={!!expandedCard}
        />

                                </div>

      {/* Rehearsal Live/Post Views */}
      <AnimatePresence>
        {rehearsalViewMode === 'live' && expandedCard === 'rehearsal' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200]"
          >
               <RehearsalLiveView 
                  onClose={() => setRehearsalViewMode('overview')} 
                  onFinish={() => setRehearsalViewMode('post')} 
               />
           </motion.div>
        )}
        {rehearsalViewMode === 'post' && expandedCard === 'rehearsal' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200]"
          >
               <RehearsalPostView onClose={() => setRehearsalViewMode('overview')} />
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
