import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getBands, getBand, BandWithMembers } from './services/bands';

interface BandContextType {
  bands: BandWithMembers[];
  selectedBand: BandWithMembers | null;
  loading: boolean;
  error: Error | null;
  selectBand: (bandId: string) => void;
  refreshBands: () => Promise<void>;
  isAdmin: boolean;
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

  // Fetch bands when authenticated with retry
  const fetchBands = useCallback(async (retryCount = 0) => {
    if (!isAuthenticated) {
      setBands([]);
      setSelectedBand(null);
      setLoading(false);
      return;
    }

    // Only set loading true on first attempt
    if (retryCount === 0) {
      setLoading(true);
    }
    
    try {
      const { data, error: fetchError } = await getBands();
      
      if (fetchError) {
        // Log detailed error info
        const errorMsg = fetchError?.message || 'Unknown error';
        const errorCode = (fetchError as any)?.code || 'N/A';
        console.error('Bands fetch error:', { message: errorMsg, code: errorCode, details: fetchError });
        
        // Retry on network/abort errors
        if (retryCount < 3 && (
          errorMsg.includes('aborted') || 
          errorMsg.includes('fetch') ||
          errorMsg.includes('network') ||
          errorCode === 'PGRST301' // JWT expired
        )) {
          setTimeout(() => fetchBands(retryCount + 1), 500 * (retryCount + 1));
          return;
        }
        
        // For other errors, set empty bands and continue (don't block app)
        setBands([]);
        setError(fetchError);
        setLoading(false);
        return;
      }

      setBands(data || []);

      // Auto-select first band if none selected
      if (data && data.length > 0 && !selectedBand) {
        setSelectedBand(data[0]);
      }

      setError(null);
      setLoading(false);
    } catch (err: any) {
      // Retry on AbortError (up to 3 times)
      const isAbortError = err?.name === 'AbortError' || err?.message?.includes('aborted');
      if (isAbortError && retryCount < 3) {
        setTimeout(() => fetchBands(retryCount + 1), 500 * (retryCount + 1));
        return;
      }
      
      // Log and continue with empty bands (don't block app)
      if (!isAbortError) {
        console.error('Error fetching bands:', err?.message || err);
      }
      setBands([]);
      setError(err);
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  // Select a specific band
  const selectBand = useCallback(async (bandId: string) => {
    // First check if we have it in the list
    const existingBand = bands.find(b => b.id === bandId);
    if (existingBand) {
      setSelectedBand(existingBand);
      return;
    }

    // Otherwise fetch it
    try {
      const { data, error: fetchError } = await getBand(bandId);
      if (fetchError) throw fetchError;
      if (data) {
        setSelectedBand(data);
        // Also add to bands list if not there
        if (!bands.find(b => b.id === bandId)) {
          setBands(prev => [...prev, data]);
        }
      }
    } catch (err: any) {
      console.error('Error selecting band:', err);
    }
  }, [bands]);

  // Check if current user is admin of selected band
  const isAdmin = selectedBand?.user_role === 'admin';

  const value: BandContextType = {
    bands,
    selectedBand,
    loading,
    error,
    selectBand,
    refreshBands: fetchBands,
    isAdmin,
  };

  return <BandContext.Provider value={value}>{children}</BandContext.Provider>;
};

export default BandContext;
