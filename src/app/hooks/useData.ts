import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import * as bandsService from '@/lib/services/bands';
import * as eventsService from '@/lib/services/events';
import * as quotesService from '@/lib/services/quotes';
import * as songsService from '@/lib/services/songs';
import * as notificationsService from '@/lib/services/notifications';
import * as transactionsService from '@/lib/services/transactions';
import * as chatsService from '@/lib/services/chats';
import * as rehearsalPollsService from '@/lib/services/rehearsalPolls';
import { supabase, getSafeUser } from '@/lib/supabase';
import { getOfflineItem, setOfflineItem, getCacheKey } from '@/lib/offline/storage';
import { getPendingMutations } from '@/lib/offline/syncQueue';
import { getIsNetworkOnline } from '@/lib/offline/useNetworkStatus';

// ============================================
// BANDS HOOKS
// ============================================

export const useBands = () => {
  const { isAuthenticated, user } = useAuth();
  const [bands, setBands] = useState<bandsService.BandWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, 'global', 'bands_list');

  useEffect(() => {
    let isMounted = true;
    getOfflineItem<bandsService.BandWithMembers[]>(cacheKey).then((cached) => {
      if (isMounted && cached?.length) {
        setBands(cached);
        setLoading(false);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [cacheKey]);

  const fetchBands = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    
    const { data, error } = await bandsService.getBands();
    if (data) {
      setBands(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [isAuthenticated, cacheKey]);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  return { bands, loading, error, refetch: fetchBands };
};

export const useBand = (bandId: string | null) => {
  const { user } = useAuth();
  const [band, setBand] = useState<bandsService.BandWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, 'band_detail');

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<bandsService.BandWithMembers>(cacheKey).then((cached) => {
        if (isMounted && cached) {
          setBand(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchBand = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    const { data, error } = await bandsService.getBand(bandId);
    if (data) {
      setBand(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, cacheKey]);

  useEffect(() => {
    fetchBand();
  }, [fetchBand]);

  const updatePricing = useCallback(async (pricingUpdates: Partial<bandsService.Band>) => {
    if (!bandId) return { data: null, error: new Error('No bandId provided') };
    const res = await bandsService.updateBandPricing(bandId, pricingUpdates);
    if (!res.error) {
      await fetchBand();
    }
    return res;
  }, [bandId, fetchBand]);

  return { band, loading, error, refetch: fetchBand, updatePricing };
};

export const useBandMembers = (bandId: string | null) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<bandsService.BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, 'band_members');

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<bandsService.BandMember[]>(cacheKey).then((cached) => {
        if (isMounted && cached?.length) {
          setMembers(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchMembers = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    const { data, error } = await bandsService.getBandMembers(bandId);
    if (data) {
      setMembers(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, cacheKey]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers };
};

// ============================================
// EVENTS HOOKS
// ============================================

export const useEvents = (
  bandId: string | string[] | null,
  options?: any
) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<eventsService.Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnce = useRef(false);
  const eventsRef = useRef<eventsService.Event[]>([]);
  eventsRef.current = events;

  const bandKey = Array.isArray(bandId) ? bandId.slice().sort().join(',') : (bandId || 'all');
  const optionsKey = JSON.stringify(options || {});
  const cacheKey = getCacheKey(user?.id, bandKey || 'all', `events_${optionsKey}`);
  const fallbackCacheKey = getCacheKey(user?.id, 'global', `events_fallback_${optionsKey}`);

  const mergePendingEvents = useCallback(async (baseEvents: eventsService.Event[]) => {
    try {
      const mutations = await getPendingMutations();
      if (mutations.length === 0) return baseEvents;

      const deletedIds = new Set(
        mutations
          .filter(m => m.type === 'delete_event' && m.payload?.eventId)
          .map(m => m.payload.eventId as string)
      );

      const updatesMap = new Map<string, Partial<eventsService.Event>>();
      mutations
        .filter(m => m.type === 'update_event' && m.payload?.eventId && m.payload?.updates)
        .forEach(m => {
          const prev = updatesMap.get(m.payload.eventId) || {};
          updatesMap.set(m.payload.eventId, { ...prev, ...m.payload.updates, _isPendingSync: true });
        });

      const pendingEvents = mutations
        .filter(m => m.type === 'create_event' && m.payload?.eventData)
        .map(m => ({ ...m.payload.eventData, _isPendingSync: true } as eventsService.Event));

      const relevant = pendingEvents.filter(pe => {
        if (deletedIds.has(pe.id)) return false;
        if (!pe.band_id) return true;
        if (Array.isArray(bandId)) return bandId.length === 0 || bandId.includes(pe.band_id);
        if (bandId) return pe.band_id === bandId;
        return true;
      });

      const processedBase = baseEvents
        .filter(e => !deletedIds.has(e.id))
        .map(e => (updatesMap.has(e.id) ? { ...e, ...updatesMap.get(e.id) } : e));

      const existingIds = new Set(processedBase.map(e => e.id));
      const toAdd = relevant
        .filter(pe => !existingIds.has(pe.id))
        .map(pe => (updatesMap.has(pe.id) ? { ...pe, ...updatesMap.get(pe.id) } : pe));

      return [...toAdd, ...processedBase];
    } catch {
      return baseEvents;
    }
  }, [bandId]);

  // Seed from cache immediately on mount or key change
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getOfflineItem<eventsService.Event[]>(cacheKey),
      getOfflineItem<eventsService.Event[]>(fallbackCacheKey),
    ]).then(async ([cached, fallbackCached]) => {
      if (!isMounted) return;
      const source = (cached && cached.length > 0) ? cached : fallbackCached;
      if (!source) return;
      const merged = await mergePendingEvents(source);
      if (isMounted) {
        setEvents(merged);
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [cacheKey, fallbackCacheKey, mergePendingEvents]);

  const fetchEvents = useCallback(async (isBackground = false) => {
    const resolvedUser = user || (await getSafeUser()).data?.user;
    const hasBands = Array.isArray(bandId) ? bandId.length > 0 : !!bandId;
    if (!hasBands && !resolvedUser) {
      setLoading(false);
      return;
    }
    
    // Skip visual loading indicator if we already have cached/loaded data
    if (!isBackground && !hasLoadedOnce.current && eventsRef.current.length === 0) {
      setLoading(true);
    }

    if (!getIsNetworkOnline()) {
      const cached = (await getOfflineItem<eventsService.Event[]>(cacheKey))
        || (await getOfflineItem<eventsService.Event[]>(fallbackCacheKey))
        || eventsRef.current.filter(e => !e._isPendingSync);
      const merged = await mergePendingEvents(cached || []);
      setEvents(merged);
      if (merged.length > 0) {
        hasLoadedOnce.current = true;
      }
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await eventsService.getEvents(bandId || [], {
      ...options,
      userId: resolvedUser?.id,
    });

    if (!fetchError && data) {
      // Guard against overwriting cached band events when bandId is temporarily [] while bands load or offline
      const isEmptyBandArray = Array.isArray(bandId) && bandId.length === 0;
      if (isEmptyBandArray && data.length === 0) {
        const fallback = await getOfflineItem<eventsService.Event[]>(fallbackCacheKey);
        if (fallback && fallback.length > 0) {
          const mergedFallback = await mergePendingEvents(fallback);
          setEvents(mergedFallback);
          hasLoadedOnce.current = true;
          setLoading(false);
          return;
        }
      }

      const merged = await mergePendingEvents(data);
      setEvents(merged);
      setOfflineItem(cacheKey, data).catch(() => {});
      if (data.length > 0 || hasBands) {
        setOfflineItem(fallbackCacheKey, data).catch(() => {});
      }
      hasLoadedOnce.current = true;
      setError(null);
    } else {
      // Offline or fetch error: preserve cached/current events and merge any newly enqueued offline events
      if (fetchError) setError(fetchError);
      const cached = (await getOfflineItem<eventsService.Event[]>(cacheKey))
        || (await getOfflineItem<eventsService.Event[]>(fallbackCacheKey))
        || eventsRef.current.filter(e => !e._isPendingSync);
      const merged = await mergePendingEvents(cached || []);
      setEvents(merged);
      if (merged.length > 0) {
        hasLoadedOnce.current = true;
      }
    }
    setLoading(false);
  }, [bandId, user, optionsKey, cacheKey, fallbackCacheKey, mergePendingEvents]);

  useEffect(() => {
    fetchEvents();
    
    // Poll for updates every 60 seconds to keep events in sync across devices
    // Polling is disabled when modals are open to prevent keyboard issues
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const hasModalOpen = document.querySelector('[data-modal-open="true"]') || 
                            document.querySelector('.fixed.inset-0.z-\\[100\\]');
        if (!hasModalOpen) {
          fetchEvents(true);
        }
      }
    }, 60000); // 60 seconds
    
    return () => clearInterval(pollInterval);
  }, [fetchEvents, bandId]);

  // Subscribe to realtime events updates
  useEffect(() => {
    const uniqueChannelName = `events-list-${Math.random().toString(36).substring(2, 9)}`;

    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: Array.isArray(bandId) ? undefined : (bandId ? `band_id=eq.${bandId}` : undefined),
        },
        () => {
          // Refetch events on any insert/update/delete (silent background)
          fetchEvents(true);
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.log('[useEvents] Realtime subscription status:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bandId, fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
};

export const useEvent = (eventId: string | null) => {
  const { user } = useAuth();
  const [event, setEvent] = useState<eventsService.EventWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, 'global', `event_detail_${eventId}`);

  useEffect(() => {
    let isMounted = true;
    if (eventId) {
      getOfflineItem<eventsService.EventWithMembers>(cacheKey).then((cached) => {
        if (isMounted && cached) {
          setEvent(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [eventId, cacheKey]);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    
    setLoading(true);
    const { data, error } = await eventsService.getEvent(eventId);
    if (data) {
      setEvent(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [eventId, cacheKey]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, loading, error, refetch: fetchEvent };
};

export const useUpcomingEvents = (bandId?: string, limit: number = 10) => {
  const { isAuthenticated, user } = useAuth();
  const [events, setEvents] = useState<eventsService.Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnce = useRef(false);
  const cacheKey = getCacheKey(user?.id, bandId || 'all', `upcoming_events_${limit}`);

  useEffect(() => {
    let isMounted = true;
    getOfflineItem<eventsService.Event[]>(cacheKey).then((cached) => {
      if (isMounted && cached?.length) {
        setEvents(cached);
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [cacheKey]);

  const fetchEvents = useCallback(async (isBackground = false) => {
    if (!isAuthenticated) { setLoading(false); return; }
    
    // Skip visual loading indicator during background refreshes
    if (!isBackground || !hasLoadedOnce.current) {
      setLoading(true);
    }
    const { data, error } = await eventsService.getUpcomingEvents(bandId, limit);
    if (data) {
      setEvents(data);
      setOfflineItem(cacheKey, data).catch(() => {});
      hasLoadedOnce.current = true;
    }
    setError(error);
    setLoading(false);
  }, [isAuthenticated, bandId, limit, cacheKey]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Subscribe to realtime events updates
  useEffect(() => {
    if (!bandId || (Array.isArray(bandId) && bandId.length === 0)) return;

    const uniqueChannelName = `events-upcoming-${Math.random().toString(36).substring(2, 9)}`;

    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: Array.isArray(bandId) ? undefined : `band_id=eq.${bandId}`,
        },
        () => {
          // Refetch events on any insert/update/delete (silent background)
          fetchEvents(true);
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.log('[useUpcomingEvents] Realtime status:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bandId, fetchEvents]);

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
    if (!bandId) { setLoading(false); return; }
    
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
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<quotesService.Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, `quotes_${JSON.stringify(options || {})}`);

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<quotesService.Quote[]>(cacheKey).then((cached) => {
        if (isMounted && cached?.length) {
          setQuotes(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchQuotes = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    setLoading(true);
    const { data, error } = await quotesService.getQuotes(bandId, options);
    if (data) {
      setQuotes(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options), cacheKey]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return { quotes, loading, error, refetch: fetchQuotes };
};

export const useQuote = (quoteId: string | null) => {
  const { user } = useAuth();
  const [quote, setQuote] = useState<quotesService.QuoteWithMusicians | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, 'global', `quote_${quoteId}`);

  useEffect(() => {
    let isMounted = true;
    if (quoteId) {
      getOfflineItem<quotesService.QuoteWithMusicians>(cacheKey).then((cached) => {
        if (isMounted && cached) {
          setQuote(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [quoteId, cacheKey]);

  const fetchQuote = useCallback(async () => {
    if (!quoteId) return;
    
    setLoading(true);
    const { data, error } = await quotesService.getQuote(quoteId);
    if (data) {
      setQuote(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [quoteId, cacheKey]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  return { quote, loading, error, refetch: fetchQuote };
};

export const useQuoteStats = (bandId: string | null) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    totalQuotes: number;
    pendingQuotes: number;
    acceptedQuotes: number;
    totalPipeline: number;
    acceptedRevenue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, 'quote_stats');

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<typeof stats>(cacheKey).then((cached) => {
        if (isMounted && cached) {
          setStats(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchStats = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    setLoading(true);
    const { data, error } = await quotesService.getQuoteStats(bandId);
    if (data) {
      setStats(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, cacheKey]);

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
  const { user } = useAuth();
  const [songs, setSongs] = useState<songsService.Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, `songs_${JSON.stringify(options || {})}`);

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<songsService.Song[]>(cacheKey).then((cached) => {
        if (isMounted && cached?.length) {
          setSongs(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchSongs = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    setLoading(true);
    const { data, error } = await songsService.getSongs(bandId, options);
    if (data) {
      setSongs(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options), cacheKey]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  return { songs, loading, error, refetch: fetchSongs };
};

export const useSetlists = (
  bandId: string | null,
  options?: Parameters<typeof songsService.getSetlists>[1]
) => {
  const { user } = useAuth();
  const [setlists, setSetlists] = useState<songsService.Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, `setlists_${JSON.stringify(options || {})}`);

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<songsService.Setlist[]>(cacheKey).then((cached) => {
        if (isMounted && cached?.length) {
          setSetlists(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchSetlists = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    setLoading(true);
    const { data, error } = await songsService.getSetlists(bandId, options);
    if (data) {
      setSetlists(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options), cacheKey]);

  useEffect(() => {
    fetchSetlists();
  }, [fetchSetlists]);

  return { setlists, loading, error, refetch: fetchSetlists };
};

export const useSetlist = (setlistId: string | null) => {
  const { user } = useAuth();
  const [setlist, setSetlist] = useState<songsService.SetlistWithSongs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, 'global', `setlist_${setlistId}`);

  useEffect(() => {
    let isMounted = true;
    if (setlistId) {
      getOfflineItem<songsService.SetlistWithSongs>(cacheKey).then((cached) => {
        if (isMounted && cached) {
          setSetlist(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [setlistId, cacheKey]);

  const fetchSetlist = useCallback(async () => {
    if (!setlistId) return;
    
    setLoading(true);
    const { data, error } = await songsService.getSetlist(setlistId);
    if (data) {
      setSetlist(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [setlistId, cacheKey]);

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
  /** Inbox only: chat rows stay out of the list (and of realtime inserts). */
  excludeChat?: boolean;
  onNewEventInvite?: (notification: notificationsService.Notification) => void;
  onNewRehearsalPoll?: (notification: notificationsService.Notification) => void;
}) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<notificationsService.Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnce = useRef(false);
  const onNewEventInviteRef = useRef(options?.onNewEventInvite);
  onNewEventInviteRef.current = options?.onNewEventInvite;
  const onNewRehearsalPollRef = useRef(options?.onNewRehearsalPoll);
  onNewRehearsalPollRef.current = options?.onNewRehearsalPoll;
  const excludeChatRef = useRef(options?.excludeChat);
  excludeChatRef.current = options?.excludeChat;

  const fetchNotifications = useCallback(async (isBackground = false) => {
    if (!isAuthenticated) { setLoading(false); return; }
    
    // Skip visual loading indicator during background refreshes
    if (!isBackground || !hasLoadedOnce.current) {
      setLoading(true);
    }
    const { data, error } = await notificationsService.getNotifications(options);
    if (data) {
      setNotifications(data);
      hasLoadedOnce.current = true;
    }
    setError(error);
    setLoading(false);
  }, [isAuthenticated, JSON.stringify(options)]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to realtime notifications (INSERT and UPDATE)
  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }

    const unsubscribe = notificationsService.subscribeToNotifications(
      // On INSERT - add new notification
      (notification) => {
        console.log('[useNotifications] Realtime INSERT:', notification.title);
        if (excludeChatRef.current && notificationsService.isChatNotificationType(notification.type)) return;
        setNotifications(prev => {
          if (prev.some(n => n.id === notification.id)) return prev;
          const eventId = notification.data?.event_id;
          if (notification.type === 'event_invite' && eventId && prev.some(n => n.type === 'event_invite' && n.data?.event_id === eventId)) {
            return prev;
          }
          return [notification, ...prev];
        });
        if (notification.type === 'event_invite' && onNewEventInviteRef.current) {
          onNewEventInviteRef.current(notification);
        }
        if ((notification.type === 'rehearsal_poll' || notification.type === 'rehearsal_proposal') && onNewRehearsalPollRef.current) {
          onNewRehearsalPollRef.current(notification);
        }
      },
      // On UPDATE - update existing notification (e.g., marked as read)
      (updatedNotification) => {
        console.log('[useNotifications] Realtime UPDATE:', updatedNotification.id);
        setNotifications(prev => 
          prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
        );
      }
    );

    console.log('[useNotifications] Realtime subscription set up, isAuthenticated:', isAuthenticated);
    return unsubscribe;
  }, [isAuthenticated]);

  // Polling fallback - refresh every 60 seconds to catch missed realtime events
  // Polling is disabled when modals are open to prevent keyboard issues
  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    
    const pollInterval = setInterval(() => {
      // Only poll if document is visible
      if (document.visibilityState === 'visible') {
        // Check if any modal is open by looking for common modal classes
        const hasModalOpen = document.querySelector('[data-modal-open="true"]') || 
                            document.querySelector('.fixed.inset-0.z-\\[100\\]');
        if (!hasModalOpen) {
          console.log('[useNotifications] Polling for updates...');
          fetchNotifications(true);
        }
      }
    }, 60000); // 60 seconds - reduced frequency
    
    return () => clearInterval(pollInterval);
  }, [isAuthenticated, fetchNotifications]);

  return { notifications, loading, error, refetch: fetchNotifications, setNotifications };
};

export const useUnreadCount = () => {
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    
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
    if (!isAuthenticated) { setLoading(false); return; }

    const unsubscribe = notificationsService.subscribeToNotifications(() => {
      setCount(prev => prev + 1);
    });

    console.log('[useNotifications] Realtime subscription set up, isAuthenticated:', isAuthenticated);
    return unsubscribe;
  }, [isAuthenticated]);

  return { count, loading, refetch: fetchCount };
};

// ============================================
// COMBINED DASHBOARD HOOK
// ============================================

export const useDashboardData = (bandId: string | null, userId?: string | null) => {
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnce = useRef(false);
  const effectiveUserId = userId || user?.id;
  const cacheKey = getCacheKey(effectiveUserId, bandId, 'dashboard_data');
  const fallbackCacheKey = getCacheKey(effectiveUserId, 'global', 'dashboard_data_fallback');
  
  const [data, setData] = useState<{
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
    memberStats: {
      totalEarned: number;
      confirmedFee: number;
      pendingFee: number;
      revenueChange: number;
      confirmedCount: number;
    } | null;
    upcomingEvents: eventsService.Event[];
    recentQuotes: quotesService.Quote[];
  }>({
    eventStats: null,
    quoteStats: null,
    memberStats: null,
    upcomingEvents: [],
    recentQuotes: [],
  });

  // Seed from cache immediately on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getOfflineItem<typeof data>(cacheKey),
      getOfflineItem<typeof data>(fallbackCacheKey),
    ]).then(([cached, fallbackCached]) => {
      if (!isMounted) return;
      const source = (cached && (cached.eventStats || cached.memberStats || cached.upcomingEvents?.length))
        ? cached
        : fallbackCached;
      if (source && (source.eventStats || source.memberStats || source.upcomingEvents?.length)) {
        setData(source);
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [cacheKey, fallbackCacheKey]);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isAuthenticated || (!bandId && !userId)) { setLoading(false); return; }

    if (!getIsNetworkOnline()) {
      setLoading(false);
      return;
    }
    
    // Skip visual loading indicator if we already have cached/loaded data
    if (!isBackground && !hasLoadedOnce.current) {
      setLoading(true);
    }
    
    try {
      const promises: Promise<any>[] = [
        bandId ? eventsService.getEventStats(bandId) : Promise.resolve({ data: null, error: null, skipped: true }),
        bandId ? quotesService.getQuoteStats(bandId) : Promise.resolve({ data: null, error: null, skipped: true }),
        bandId ? eventsService.getUpcomingEvents(bandId, 5) : Promise.resolve({ data: [], error: null, skipped: true }),
        bandId ? quotesService.getQuotes(bandId, { limit: 5 }) : Promise.resolve({ data: [], error: null, skipped: true }),
      ];
      if (userId) {
        promises.push(eventsService.getMemberPersonalStats(bandId || null, userId));
      }

      const results = await Promise.all(promises);
      const [eventStatsRes, quoteStatsRes, upcomingEventsRes, recentQuotesRes] = results;
      const memberStatsRes = userId ? results[4] : null;

      const hasAnyError = Boolean(
        eventStatsRes?.error ||
        quoteStatsRes?.error ||
        upcomingEventsRes?.error ||
        recentQuotesRes?.error ||
        memberStatsRes?.error
      );

      setData(prev => {
        const nextData = {
          eventStats: (!eventStatsRes?.error && !eventStatsRes?.skipped && eventStatsRes?.data)
            ? eventStatsRes.data
            : prev.eventStats,
          quoteStats: (!quoteStatsRes?.error && !quoteStatsRes?.skipped && quoteStatsRes?.data)
            ? quoteStatsRes.data
            : prev.quoteStats,
          memberStats: (!memberStatsRes?.error && memberStatsRes?.data)
            ? memberStatsRes.data
            : prev.memberStats,
          upcomingEvents: (!upcomingEventsRes?.error && !upcomingEventsRes?.skipped && upcomingEventsRes?.data)
            ? upcomingEventsRes.data
            : prev.upcomingEvents,
          recentQuotes: (!recentQuotesRes?.error && !recentQuotesRes?.skipped && recentQuotesRes?.data)
            ? recentQuotesRes.data
            : prev.recentQuotes,
        };

        if (!hasAnyError && (nextData.eventStats || nextData.memberStats || nextData.upcomingEvents.length > 0)) {
          setOfflineItem(cacheKey, nextData).catch(() => {});
          setOfflineItem(fallbackCacheKey, nextData).catch(() => {});
        }
        return nextData;
      });

      hasLoadedOnce.current = true;
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId, userId, cacheKey, fallbackCacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for dashboard updates every 30 seconds (increased frequency for fee sync)
  useEffect(() => {
    if (!bandId) return;
    
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const hasModalOpen = document.querySelector('[data-modal-open="true"]') || 
                            document.querySelector('.fixed.inset-0.z-\\[100\\]');
        if (!hasModalOpen) {
          fetchData(true);
        }
      }
    }, 30000);
    
    return () => clearInterval(pollInterval);
  }, [bandId, fetchData]);

  // Subscribe to realtime changes on events table to refresh dashboard when event_members change
  // (event_members changes happen via persistMembers delete+reinsert triggered by event saves)
  useEffect(() => {
    if (!bandId) return;

    const uniqueChannelName = `dash-events-sync-${Math.random().toString(36).substring(2, 9)}`;

    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: Array.isArray(bandId) ? undefined : `band_id=eq.${bandId}`,
        },
        () => {
          console.log('[useDashboardData] Events changed, refreshing all counters...');
          fetchData(true).catch((err) => {
            console.error('[useDashboardData] Error refreshing:', err);
          });
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.log('[useDashboardData] Events subscription status:', status);
        } else {
          console.log('[useDashboardData] Events subscription active');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bandId, fetchData]);

  return { data, loading, error, refetch: fetchData };
};

// ============================================
// TRANSACTIONS HOOKS
// ============================================

export const useTransactions = (
  bandId: string | null,
  options?: Parameters<typeof transactionsService.getTransactions>[1]
) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<transactionsService.Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, `txs_${JSON.stringify(options || {})}`);

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<transactionsService.Transaction[]>(cacheKey).then((cached) => {
        if (isMounted && cached?.length) {
          setTransactions(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchTransactions = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    setLoading(true);
    const { data, error } = await transactionsService.getTransactions(bandId, options);
    if (data) {
      setTransactions(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, JSON.stringify(options), cacheKey]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
};

export const useFinancialStats = (bandId: string | null, year?: number, month?: number) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, `fin_stats_${year || 'curr'}_${month || 'all'}`);

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<typeof stats>(cacheKey).then((cached) => {
        if (isMounted && cached) {
          setStats(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchStats = useCallback(async () => {
    if (!bandId) { setLoading(false); return; }
    
    setLoading(true);
    const { data, error } = await transactionsService.getFinancialStats(bandId, year, month);
    if (data) {
      setStats(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [bandId, year, month, cacheKey]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
};

// ============================================
// EXPANDED CARDS DATA HOOKS
// ============================================

export const useExpandedFinanceData = (bandId: string | null) => {
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cacheKey = getCacheKey(user?.id, bandId, 'expanded_finance_data');
  
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

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<typeof data>(cacheKey).then((cached) => {
        if (isMounted && cached && (cached.financialStats || cached.recentTransactions?.length)) {
          setData(cached);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !bandId) { setLoading(false); return; }
    
    setLoading(true);
    
    try {
      const [statsRes, transactionsRes] = await Promise.all([
        transactionsService.getFinancialStats(bandId),
        transactionsService.getTransactions(bandId, { limit: 10 }),
      ]);

      if (!statsRes.error && !transactionsRes.error) {
        const fresh = {
          financialStats: statsRes.data ? {
            totalIncome: statsRes.data.totalIncome,
            totalExpenses: statsRes.data.totalExpenses,
            netProfit: statsRes.data.netProfit,
          } : null,
          recentTransactions: transactionsRes.data || [],
        };

        setData(fresh);
        setOfflineItem(cacheKey, fresh).catch(() => {});
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId, cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

export const useExpandedEventsData = (bandId: string | null, statusFilter?: string[]) => {
  const { isAuthenticated, user } = useAuth();
  const [events, setEvents] = useState<eventsService.Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedOnce = useRef(false);
  const cacheKey = getCacheKey(user?.id, bandId, `expanded_events_${JSON.stringify(statusFilter || [])}`);

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<eventsService.Event[]>(cacheKey).then((cached) => {
        if (isMounted && cached?.length) {
          setEvents(cached);
          hasLoadedOnce.current = true;
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchEvents = useCallback(async (isBackground = false) => {
    if (!isAuthenticated || !bandId) { setLoading(false); return; }
    
    // Skip visual loading indicator during background refreshes
    if (!isBackground || !hasLoadedOnce.current) {
      setLoading(true);
    }
    
    try {
      const status = statusFilter as eventsService.EventStatus[] | undefined;
      const { data, error: fetchError } = await eventsService.getEvents(bandId, { 
        status,
        limit: 20 
      });

      if (fetchError) throw fetchError;
      if (data) {
        setEvents(data);
        setOfflineItem(cacheKey, data).catch(() => {});
        hasLoadedOnce.current = true;
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId, JSON.stringify(statusFilter), cacheKey]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Subscribe to realtime events updates
  useEffect(() => {
    if (!bandId || (Array.isArray(bandId) && bandId.length === 0)) return;

    const uniqueChannelName = `events-expanded-${Math.random().toString(36).substring(2, 9)}`;

    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: Array.isArray(bandId) ? undefined : `band_id=eq.${bandId}`,
        },
        () => {
          // Refetch events on any insert/update/delete (silent background)
          fetchEvents(true);
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.log('[useExpandedEventsData] Realtime status:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bandId, fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
};

export const useExpandedQuotesData = (bandId: string | null) => {
  const { isAuthenticated, user } = useAuth();
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
  const cacheKey = getCacheKey(user?.id, bandId, 'expanded_quotes_data');

  useEffect(() => {
    let isMounted = true;
    if (bandId) {
      getOfflineItem<{ quotes: quotesService.Quote[]; stats: typeof stats }>(cacheKey).then((cached) => {
        if (isMounted && cached && (cached.quotes?.length || cached.stats)) {
          setQuotes(cached.quotes || []);
          setStats(cached.stats || null);
          setLoading(false);
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [bandId, cacheKey]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !bandId) { setLoading(false); return; }
    
    setLoading(true);
    
    try {
      const [quotesRes, statsRes] = await Promise.all([
        quotesService.getQuotes(bandId),
        quotesService.getQuoteStats(bandId),
      ]);

      if (!quotesRes.error && !statsRes.error) {
        const freshQuotes = quotesRes.data || [];
        const freshStats = statsRes.data || null;

        setQuotes(freshQuotes);
        setStats(freshStats);
        setOfflineItem(cacheKey, { quotes: freshQuotes, stats: freshStats }).catch(() => {});
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, bandId, cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { quotes, stats, loading, error, refetch: fetchData };
};

// ============================================
// CHATS HOOKS
// ============================================

export const useChats = (bandId?: string) => {
  const { isAuthenticated, user } = useAuth();
  const [chats, setChats] = useState<chatsService.ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Last list on this device (per account), shown offline and while loading.
  const cacheKey = getCacheKey(user?.id, bandId, 'chats_list');

  useEffect(() => {
    let isMounted = true;
    getOfflineItem<chatsService.ChatWithDetails[]>(cacheKey).then((cached) => {
      if (isMounted && cached?.length) {
        setChats((prev) => (prev.length ? prev : cached));
        setLoading(false);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [cacheKey]);

  const fetchChats = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    
    setLoading(true);
    const { data, error } = await chatsService.getChats(bandId);
    // A failed refetch (offline, network blip) keeps the list on screen.
    if (data) {
      setChats(data);
      setOfflineItem(cacheKey, data).catch(() => {});
    }
    setError(error);
    setLoading(false);
  }, [isAuthenticated, bandId, cacheKey]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Subscribe to new messages for real-time updates
  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }

    const unsubscribe = chatsService.subscribeToNewMessages(() => {
      // Refetch chats to update last message and unread counts
      fetchChats();
    });

    // Ticks in the list: refresh (debounced) when someone receives/reads.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribeReceipts = chatsService.subscribeToReceipts(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { fetchChats(); }, 1200);
    });

    return () => {
      unsubscribe();
      unsubscribeReceipts();
      clearTimeout(timer);
    };
  }, [isAuthenticated, fetchChats]);

  return { chats, loading, error, refetch: fetchChats };
};

export const useChat = (chatId: string | null) => {
  const { isAuthenticated } = useAuth();
  const [chat, setChat] = useState<chatsService.ChatWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChat = useCallback(async () => {
    if (!isAuthenticated || !chatId) { setLoading(false); return; }
    
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
    if (!isAuthenticated || !chatId) { setLoading(false); return; }
    
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
    if (!isAuthenticated || !chatId) { setLoading(false); return; }

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

// ============================================
// REHEARSAL POLLS HOOKS
// ============================================

export const useRehearsalPolls = (bandId: string | null, userId?: string | null) => {
  const { isAuthenticated } = useAuth();
  const [polls, setPolls] = useState<rehearsalPollsService.RehearsalPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPolls = useCallback(async () => {
    if (!isAuthenticated || !bandId) {
      setPolls([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchErr } = await rehearsalPollsService.getRehearsalPolls(bandId, userId);
    setPolls(data || []);
    setError(fetchErr);
    setLoading(false);
  }, [isAuthenticated, bandId, userId]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  // Realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !bandId) return;

    const unsubscribe = rehearsalPollsService.subscribeToRehearsalPolls(bandId, () => {
      fetchPolls();
    });

    return unsubscribe;
  }, [isAuthenticated, bandId, fetchPolls]);

  return { polls, loading, error, refetch: fetchPolls };
};