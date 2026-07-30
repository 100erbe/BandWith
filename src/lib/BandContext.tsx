import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getBands, getBand, BandWithMembers } from './services/bands';

export type MemberRole = 'admin' | 'member';

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

    // Only set loading true on first attempt or if we have no data
    if (retryCount === 0 && bands.length === 0) {
      setLoading(true);
    }
    
    try {
      const { data, error: fetchError } = await getBands();
      
      if (fetchError) {
        const errorMsg = fetchError?.message || 'Unknown error';
        const errorCode = (fetchError as any)?.code || 'N/A';
        console.error('Bands fetch error:', { message: errorMsg, code: errorCode });
        
        // Retry on network errors
        if (retryCount < 3 && (
          errorMsg.includes('aborted') || 
          errorMsg.includes('fetch') ||
          errorCode === 'PGRST301'
        )) {
          setTimeout(() => fetchBands(retryCount + 1), 500 * (retryCount + 1));
          return;
        }
        
        setBands([]);
        setError(fetchError);
        setLoading(false);
        return;
      }

      const fetchedBands = data || [];
      setBands(fetchedBands);

      // Robust auto-selection logic
      if (fetchedBands.length > 0) {
        if (!selectedBand) {
          setSelectedBand(fetchedBands[0]);
        } else {
          // Refresh the currently selected band data if it still exists in the new list
          const updatedSelected = fetchedBands.find(b => b.id === selectedBand.id);
          if (updatedSelected) {
            setSelectedBand(updatedSelected);
          } else {
            // If currently selected band is no longer in the list (e.g. removed), select the first one
            setSelectedBand(fetchedBands[0]);
          }
        }
      } else {
        setSelectedBand(null);
      }

      setError(null);
      setLoading(false);
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !err?.message?.includes('aborted')) {
        console.error('Error fetching bands:', err);
        setBands([]);
        setError(err);
      }
      setLoading(false);
    }
  }, [isAuthenticated, user, selectedBand, bands.length]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBands();
    } else {
      setBands([]);
      setSelectedBand(null);
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  // Select a specific band
  const selectBand = useCallback(async (bandId: string) => {
    const existingBand = bands.find(b => b.id === bandId);
    if (existingBand) {
      setSelectedBand(existingBand);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await getBand(bandId);
      if (fetchError) throw fetchError;
      if (data) {
        setSelectedBand(data);
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
  }, [bands]);

  const value: BandContextType = {
    bands,
    selectedBand,
    loading,
    error,
    selectBand,
    refreshBands: fetchBands,
    isAdmin,
    currentMemberRole,
  };

  return <BandContext.Provider value={value}>{children}</BandContext.Provider>;
};

export default BandContext;
