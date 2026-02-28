import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import * as bandsService from '@/lib/services/bands';
import * as eventsService from '@/lib/services/events';
import * as quotesService from '@/lib/services/quotes';
import * as songsService from '@/lib/services/songs';
import * as notificationsService from '@/lib/services/notifications';
import * as transactionsService from '@/lib/services/transactions';
import * as chatsService from '@/lib/services/chats';

// ============================================
// BANDS HOOKS
// ============================================

export const useBands = () => {
  const { isAuthenticated } = useAuth();
  const [bands, setBands] = useState<bandsService.BandWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBands = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    const { data, error } = await bandsService.getBands();
    setBands(data || []);
    setError(error);
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  return { bands, loading, error, refetch: fetchBands };
};

export const useBand = (bandId: string | null) => {
  const [band, setBand] = useState<bandsService.BandWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBand = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await bandsService.getBand(bandId);
    setBand(data);
    setError(error);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    fetchBand();
  }, [fetchBand]);

  return { band, loading, error, refetch: fetchBand };
};

export const useBandMembers = (bandId: string | null) => {
  const [members, setMembers] = useState<bandsService.BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await bandsService.getBandMembers(bandId);
    setMembers(data || []);
    setError(error);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers };
};

// ============================================
// EVENTS HOOKS
// ============================================

export const useEvents = (
  bandId: string | null,
  options?: Parameters<typeof eventsService.getEvents>[1]
) => {
  const [events, setEvents] = useState<eventsService.Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await eventsService.getEvents(bandId, options);
    setEvents(data || []);
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options)]);

  useEffect(() => {
    fetchEvents();
    
    // Poll for updates every 60 seconds to keep events in sync across devices
    // Polling is disabled when modals are open to prevent keyboard issues
    const pollInterval = setInterval(() => {
      if (bandId && document.visibilityState === 'visible') {
        const hasModalOpen = document.querySelector('[data-modal-open="true"]') || 
                            document.querySelector('.fixed.inset-0.z-\\[100\\]');
        if (!hasModalOpen) {
          eventsService.getEvents(bandId, options).then(({ data }) => {
            if (data) setEvents(data);
          });
        }
      }
    }, 60000); // 60 seconds
    
    return () => clearInterval(pollInterval);
  }, [fetchEvents, bandId]);

  return { events, loading, error, refetch: fetchEvents };
};

export const useEvent = (eventId: string | null) => {
  const [event, setEvent] = useState<eventsService.EventWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    
    setLoading(true);
    const { data, error } = await eventsService.getEvent(eventId);
    setEvent(data);
    setError(error);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, loading, error, refetch: fetchEvent };
};

export const useUpcomingEvents = (bandId?: string, limit: number = 10) => {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<eventsService.Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    const { data, error } = await eventsService.getUpcomingEvents(bandId, limit);
    setEvents(data || []);
    setError(error);
    setLoading(false);
  }, [isAuthenticated, bandId, limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
};

export const useEventStats = (bandId: string | null, year?: number) => {
  const [stats, setStats] = useState<{
    totalEvents: number;
    confirmedEvents: number;
    totalRevenue: number;
    upcomingEvents: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await eventsService.getEventStats(bandId, year);
    setStats(data);
    setError(error);
    setLoading(false);
  }, [bandId, year]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
};

// ============================================
// QUOTES HOOKS
// ============================================

export const useQuotes = (
  bandId: string | null,
  options?: Parameters<typeof quotesService.getQuotes>[1]
) => {
  const [quotes, setQuotes] = useState<quotesService.Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await quotesService.getQuotes(bandId, options);
    setQuotes(data || []);
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options)]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return { quotes, loading, error, refetch: fetchQuotes };
};

export const useQuote = (quoteId: string | null) => {
  const [quote, setQuote] = useState<quotesService.QuoteWithMusicians | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!quoteId) return;
    
    setLoading(true);
    const { data, error } = await quotesService.getQuote(quoteId);
    setQuote(data);
    setError(error);
    setLoading(false);
  }, [quoteId]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  return { quote, loading, error, refetch: fetchQuote };
};

export const useQuoteStats = (bandId: string | null) => {
  const [stats, setStats] = useState<{
    totalQuotes: number;
    pendingQuotes: number;
    acceptedQuotes: number;
    totalPipeline: number;
    acceptedRevenue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await quotesService.getQuoteStats(bandId);
    setStats(data);
    setError(error);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
};

// ============================================
// SONGS HOOKS
// ============================================

export const useSongs = (
  bandId: string | null,
  options?: Parameters<typeof songsService.getSongs>[1]
) => {
  const [songs, setSongs] = useState<songsService.Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSongs = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await songsService.getSongs(bandId, options);
    setSongs(data || []);
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options)]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  return { songs, loading, error, refetch: fetchSongs };
};

export const useSetlists = (
  bandId: string | null,
  options?: Parameters<typeof songsService.getSetlists>[1]
) => {
  const [setlists, setSetlists] = useState<songsService.Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSetlists = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await songsService.getSetlists(bandId, options);
    setSetlists(data || []);
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options)]);

  useEffect(() => {
    fetchSetlists();
  }, [fetchSetlists]);

  return { setlists, loading, error, refetch: fetchSetlists };
};

export const useSetlist = (setlistId: string | null) => {
  const [setlist, setSetlist] = useState<songsService.SetlistWithSongs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSetlist = useCallback(async () => {
    if (!setlistId) return;
    
    setLoading(true);
    const { data, error } = await songsService.getSetlist(setlistId);
    setSetlist(data);
    setError(error);
    setLoading(false);
  }, [setlistId]);

  useEffect(() => {
    fetchSetlist();
  }, [fetchSetlist]);

  return { setlist, loading, error, refetch: fetchSetlist };
};

// ============================================
// NOTIFICATIONS HOOKS
// ============================================

export const useNotifications = (options?: {
  unreadOnly?: boolean;
  limit?: number;
}) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<notificationsService.Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    const { data, error } = await notificationsService.getNotifications(options);
    if (data) {
      setNotifications(data);
    }
    setError(error);
    setLoading(false);
  }, [isAuthenticated, JSON.stringify(options)]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to realtime notifications (INSERT and UPDATE)
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = notificationsService.subscribeToNotifications(
      // On INSERT - add new notification
      (notification) => {
        console.log('[useNotifications] Realtime INSERT:', notification.title);
        setNotifications(prev => {
          // Avoid duplicates
          if (prev.some(n => n.id === notification.id)) return prev;
          return [notification, ...prev];
        });
      },
      // On UPDATE - update existing notification (e.g., marked as read)
      (updatedNotification) => {
        console.log('[useNotifications] Realtime UPDATE:', updatedNotification.id);
        setNotifications(prev => 
          prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
        );
      }
    );

    return unsubscribe;
  }, [isAuthenticated]);

  // Polling fallback - refresh every 60 seconds to catch missed realtime events
  // Polling is disabled when modals are open to prevent keyboard issues
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const pollInterval = setInterval(() => {
      // Only poll if document is visible
      if (document.visibilityState === 'visible') {
        // Check if any modal is open by looking for common modal classes
        const hasModalOpen = document.querySelector('[data-modal-open="true"]') || 
                            document.querySelector('.fixed.inset-0.z-\\[100\\]');
        if (!hasModalOpen) {
          console.log('[useNotifications] Polling for updates...');
          fetchNotifications();
        }
      }
    }, 60000); // 60 seconds - reduced frequency
    
    return () => clearInterval(pollInterval);
  }, [isAuthenticated, fetchNotifications]);

  return { notifications, loading, error, refetch: fetchNotifications };
};

export const useUnreadCount = () => {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    const { data } = await notificationsService.getUnreadCount();
    setCount(data || 0);
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = notificationsService.subscribeToNotifications(() => {
      setCount(prev => prev + 1);
    });

    return unsubscribe;
  }, [isAuthenticated]);

  return { count, loading, refetch: fetchCount };
};

// ============================================
// COMBINED DASHBOARD HOOK
// ============================================

export const useDashboardData = (bandId: string | null) => {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [data, setData] = useState<{
    eventStats: {
      totalEvents: number;
      confirmedEvents: number;
      totalRevenue: number;
      upcomingEvents: number;
    } | null;
    quoteStats: {
      totalQuotes: number;
      pendingQuotes: number;
      acceptedQuotes: number;
      totalPipeline: number;
      acceptedRevenue: number;
    } | null;
    upcomingEvents: eventsService.Event[];
    recentQuotes: quotesService.Quote[];
  }>({
    eventStats: null,
    quoteStats: null,
    upcomingEvents: [],
    recentQuotes: [],
  });

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !bandId) return;
    
    setLoading(true);
    
    try {
      const [eventStatsRes, quoteStatsRes, upcomingEventsRes, recentQuotesRes] = await Promise.all([
        eventsService.getEventStats(bandId),
        quotesService.getQuoteStats(bandId),
        eventsService.getUpcomingEvents(bandId, 5),
        quotesService.getQuotes(bandId, { limit: 5 }),
      ]);

      setData({
        eventStats: eventStatsRes.data,
        quoteStats: quoteStatsRes.data,
        upcomingEvents: upcomingEventsRes.data || [],
        recentQuotes: recentQuotesRes.data || [],
      });
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

// ============================================
// TRANSACTIONS HOOKS
// ============================================

export const useTransactions = (
  bandId: string | null,
  options?: Parameters<typeof transactionsService.getTransactions>[1]
) => {
  const [transactions, setTransactions] = useState<transactionsService.Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await transactionsService.getTransactions(bandId, options);
    setTransactions(data || []);
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options)]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
};

export const useFinancialStats = (bandId: string | null, year?: number, month?: number) => {
  const [stats, setStats] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!bandId) return;
    
    setLoading(true);
    const { data, error } = await transactionsService.getFinancialStats(bandId, year, month);
    setStats(data);
    setError(error);
    setLoading(false);
  }, [bandId, year, month]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
};

// ============================================
// EXPANDED CARDS DATA HOOKS
// ============================================

export const useExpandedFinanceData = (bandId: string | null) => {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [data, setData] = useState<{
    financialStats: {
      totalIncome: number;
      totalExpenses: number;
      netProfit: number;
    } | null;
    recentTransactions: transactionsService.Transaction[];
  }>({
    financialStats: null,
    recentTransactions: [],
  });

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !bandId) return;
    
    setLoading(true);
    
    try {
      const [statsRes, transactionsRes] = await Promise.all([
        transactionsService.getFinancialStats(bandId),
        transactionsService.getTransactions(bandId, { limit: 10 }),
      ]);

      setData({
        financialStats: statsRes.data ? {
          totalIncome: statsRes.data.totalIncome,
          totalExpenses: statsRes.data.totalExpenses,
          netProfit: statsRes.data.netProfit,
        } : null,
        recentTransactions: transactionsRes.data || [],
      });
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

export const useExpandedEventsData = (bandId: string | null, statusFilter?: string[]) => {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<eventsService.Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!isAuthenticated || !bandId) return;
    
    setLoading(true);
    
    try {
      const status = statusFilter as eventsService.EventStatus[] | undefined;
      const { data, error: fetchError } = await eventsService.getEvents(bandId, { 
        status,
        limit: 20 
      });

      if (fetchError) throw fetchError;
      setEvents(data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId, JSON.stringify(statusFilter)]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
};

export const useExpandedQuotesData = (bandId: string | null) => {
  const { isAuthenticated } = useAuth();
  const [quotes, setQuotes] = useState<quotesService.Quote[]>([]);
  const [stats, setStats] = useState<{
    totalQuotes: number;
    pendingQuotes: number;
    acceptedQuotes: number;
    totalPipeline: number;
    acceptedRevenue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !bandId) return;
    
    setLoading(true);
    
    try {
      const [quotesRes, statsRes] = await Promise.all([
        quotesService.getQuotes(bandId),
        quotesService.getQuoteStats(bandId),
      ]);

      setQuotes(quotesRes.data || []);
      setStats(statsRes.data);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { quotes, stats, loading, error, refetch: fetchData };
};

// ============================================
// CHATS HOOKS
// ============================================

export const useChats = (bandId?: string) => {
  const { isAuthenticated } = useAuth();
  const [chats, setChats] = useState<chatsService.ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChats = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    const { data, error } = await chatsService.getChats(bandId);
    setChats(data || []);
    setError(error);
    setLoading(false);
  }, [isAuthenticated, bandId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Subscribe to new messages for real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = chatsService.subscribeToNewMessages(() => {
      // Refetch chats to update last message and unread counts
      fetchChats();
    });

    return unsubscribe;
  }, [isAuthenticated, fetchChats]);

  return { chats, loading, error, refetch: fetchChats };
};

export const useChat = (chatId: string | null) => {
  const { isAuthenticated } = useAuth();
  const [chat, setChat] = useState<chatsService.ChatWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChat = useCallback(async () => {
    if (!isAuthenticated || !chatId) return;
    
    setLoading(true);
    const { data, error } = await chatsService.getChat(chatId);
    setChat(data);
    setError(error);
    setLoading(false);
  }, [isAuthenticated, chatId]);

  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  return { chat, loading, error, refetch: fetchChat };
};

export const useMessages = (chatId: string | null, options?: { limit?: number }) => {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<chatsService.Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!isAuthenticated || !chatId) return;
    
    setLoading(true);
    const { data, error } = await chatsService.getMessages(chatId, options);
    setMessages(data || []);
    setError(error);
    setLoading(false);
    
    // Mark chat as read when messages are loaded
    await chatsService.markChatAsRead(chatId);
  }, [isAuthenticated, chatId, JSON.stringify(options)]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to new messages in this chat
  useEffect(() => {
    if (!isAuthenticated || !chatId) return;

    const unsubscribe = chatsService.subscribeToChat(chatId, (newMessage) => {
      setMessages(prev => [...prev, newMessage]);
      // Mark as read when new message arrives and chat is open
      chatsService.markChatAsRead(chatId);
    });

    return unsubscribe;
  }, [isAuthenticated, chatId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!chatId) return { error: new Error('No chat selected') };
    return await chatsService.sendMessage(chatId, content);
  }, [chatId]);

  return { messages, loading, error, refetch: fetchMessages, sendMessage };
};
