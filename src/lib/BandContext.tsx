import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getBands, getBand, BandWithMembers } from './services/bands';
import { getOfflineItem, setOfflineItem, getCacheKey } from './offline/storage';
import { getBandPricing } from './services/pricing';
import { setActiveCurrency } from './currency';

export type MemberRole = 'admin' | 'member';

/**
 * Last band the user had open, per account. Kept outside the `bw:` offline
 * cache (wiped on sign-out) so signing out and back in reopens the same band
 * instead of whichever band the server lists first.
 */
const lastBandKey = (userId: string) => `bw-last-band:${userId}`;
const readLastBand = (userId: string | undefined): string | null => {
  if (!userId) return null;
  try {
    return localStorage.getItem(lastBandKey(userId));
  } catch {
    return null;
  }
};
export const rememberLastBand = (userId: string | undefined, bandId: string | null | undefined) => {
  if (!userId || !bandId) return;
  try {
    localStorage.setItem(lastBandKey(userId), bandId);
  } catch {
    /* storage blocked */
  }
};

interface BandContextType {
  bands: BandWithMembers[];
  selectedBand: BandWithMembers | null;
  loading: boolean;
  error: Error | null;
  selectBand: (bandId: string) => void;
  refreshBands: () => Promise<void>;
  isAdmin: boolean;
  currentMemberRole: MemberRole | null;
}

const BandContext = createContext<BandContextType | undefined>(undefined);

export const useBand = () => {
  const context = useContext(BandContext);
  if (context === undefined) {
    throw new Error('useBand must be used within a BandProvider');
  }
  return context;
};

interface BandProviderProps {
  children: ReactNode;
}

export const BandProvider: React.FC<BandProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [bands, setBands] = useState<BandWithMembers[]>([]);
  const [selectedBand, setSelectedBand] = useState<BandWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedCacheRef = useRef(false);
  /**
   * Account whose band list is known (fetched, or read from its cache, or the
   * fetch failed for good). Until it matches the signed-in user, `loading`
   * stays true: right after a sign-in the app must not take "no bands yet"
   * for "no bands" and send the user through onboarding again.
   */
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);

  const bandsCacheKey = getCacheKey(user?.id, 'global', 'bands_context');
  const selectedBandCacheKey = getCacheKey(user?.id, 'global', 'selected_band_id');

  // Seed bands and selectedBand from offline cache immediately
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let isMounted = true;
    Promise.all([
      getOfflineItem<BandWithMembers[]>(bandsCacheKey),
      getOfflineItem<string>(selectedBandCacheKey),
    ]).then(([cachedBands, cachedSelectedId]) => {
      if (!isMounted || !cachedBands?.length) return;
      hasLoadedCacheRef.current = true;
      setBands(prev => (prev.length > 0 ? prev : cachedBands));
      setSelectedBand(prev => {
        if (prev) return prev;
        if (cachedSelectedId) {
          const match = cachedBands.find(b => b.id === cachedSelectedId);
          if (match) return match;
        }
        return cachedBands[0];
      });
      setResolvedFor(user.id);
      setLoading(false);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [isAuthenticated, user?.id, bandsCacheKey, selectedBandCacheKey]);

  // Robust RBAC calculation
  const currentMemberRole = useMemo(() => {
    if (!selectedBand) return null;
    return (selectedBand.user_role as MemberRole) || null;
  }, [selectedBand]);

  const isAdmin = useMemo(() => currentMemberRole === 'admin', [currentMemberRole]);

  // Fetch bands when authenticated with retry
  const fetchBands = useCallback(async (retryCount = 0) => {
    if (!isAuthenticated || !user) {
      setBands([]);
      setSelectedBand(null);
      setLoading(false);
      return;
    }

    // Only set loading true on first attempt if we have no data in state or cache
    if (retryCount === 0 && bands.length === 0 && !hasLoadedCacheRef.current) {
      setLoading(true);
    }
    
    try {
      const { data, error: fetchError } = await getBands();
      
      if (fetchError) {
        const errorMsg = fetchError?.message || 'Unknown error';
        const errorCode = (fetchError as any)?.code || 'N/A';
        console.error('Bands fetch error:', { message: errorMsg, code: errorCode });
        
        // Retry on network errors when online
        if (retryCount < 2 && (typeof navigator === 'undefined' || navigator.onLine) && (
          errorMsg.includes('aborted') || 
          errorMsg.includes('fetch') ||
          errorCode === 'PGRST301'
        )) {
          setTimeout(() => fetchBands(retryCount + 1), 500 * (retryCount + 1));
          return;
        }
        
        // Offline / network fallback: preserve cached or current bands instead of wiping to []
        const cachedBands = await getOfflineItem<BandWithMembers[]>(bandsCacheKey);
        const cachedSelectedId = (await getOfflineItem<string>(selectedBandCacheKey)) || readLastBand(user.id);
        if (cachedBands && cachedBands.length > 0) {
          setBands(prev => (prev.length > 0 ? prev : cachedBands));
          setSelectedBand(prev => {
            if (prev) return prev;
            if (cachedSelectedId) {
              const found = cachedBands.find(b => b.id === cachedSelectedId);
              if (found) return found;
            }
            return cachedBands[0];
          });
        }
        setError(fetchError);
        setResolvedFor(user.id);
        setLoading(false);
        return;
      }

      const fetchedBands = data || [];
      setBands(fetchedBands);
      setOfflineItem(bandsCacheKey, fetchedBands).catch(() => {});
      hasLoadedCacheRef.current = true;

      // Robust auto-selection logic
      if (fetchedBands.length > 0) {
        const cachedSelectedId = await getOfflineItem<string>(selectedBandCacheKey);
        // After a sign-out the cache is gone: fall back to the band last open on this device.
        const candidates = [selectedBand?.id, cachedSelectedId, readLastBand(user.id)];
        const updatedSelected = candidates
          .map((id) => (id ? fetchedBands.find(b => b.id === id) : undefined))
          .find(Boolean);
        const nextBand = updatedSelected || fetchedBands[0];
        setSelectedBand(nextBand);
        setOfflineItem(selectedBandCacheKey, nextBand.id).catch(() => {});
        rememberLastBand(user.id, nextBand.id);
      } else {
        setSelectedBand(null);
      }

      setError(null);
      setResolvedFor(user.id);
      setLoading(false);
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !err?.message?.includes('aborted')) {
        console.error('Error fetching bands:', err);
        setError(err);
      }
      setResolvedFor(user.id);
      setLoading(false);
    }
  }, [isAuthenticated, user, selectedBand, bands.length, bandsCacheKey, selectedBandCacheKey]);

  useEffect(() => {
    // A new account (or the same one after signing out and in): start clean
    // so nothing from the previous session decides what it sees.
    hasLoadedCacheRef.current = false;
    setError(null);
    if (isAuthenticated) {
      fetchBands();
    } else {
      setBands([]);
      setSelectedBand(null);
      setResolvedFor(null);
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  // Keep the app-wide money labels in the selected band's currency.
  const selectedBandId = selectedBand?.id ?? null;
  useEffect(() => {
    setActiveCurrency((selectedBand as { pricing_currency?: string } | null)?.pricing_currency, selectedBandId, true);
    if (!selectedBandId) return;
    getBandPricing(selectedBandId).catch(() => {});
  }, [selectedBandId]);

  // Select a specific band
  const selectBand = useCallback(async (bandId: string) => {
    const existingBand = bands.find(b => b.id === bandId);
    if (existingBand) {
      setSelectedBand(existingBand);
      setOfflineItem(selectedBandCacheKey, existingBand.id).catch(() => {});
      rememberLastBand(user?.id, existingBand.id);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await getBand(bandId);
      if (fetchError) throw fetchError;
      if (data) {
        setSelectedBand(data);
        setOfflineItem(selectedBandCacheKey, data.id).catch(() => {});
        rememberLastBand(user?.id, data.id);
        setBands(prev => {
          if (prev.find(b => b.id === bandId)) return prev;
          return [...prev, data];
        });
      }
    } catch (err: any) {
      console.error('Error selecting band:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [bands, selectedBandCacheKey, user?.id]);

  const bandsKnown = !isAuthenticated || !user?.id || resolvedFor === user.id;

  const value: BandContextType = {
    bands,
    selectedBand,
    loading: loading || !bandsKnown,
    error,
    selectBand,
    refreshBands: fetchBands,
    isAdmin,
    currentMemberRole,
  };

  return <BandContext.Provider value={value}>{children}</BandContext.Provider>;
};

export default BandContext;
