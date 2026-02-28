import { useState, useCallback, useMemo } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  pageSize?: number;
  totalItems?: number;
}

interface UsePaginationReturn<T> {
  // Current page data
  currentPage: number;
  pageSize: number;
  totalPages: number;
  
  // Navigation
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  
  // State
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
  
  // Data helpers
  paginatedData: T[];
  startIndex: number;
  endIndex: number;
  
  // For infinite scroll
  loadMore: () => void;
  isLoadingMore: boolean;
  setIsLoadingMore: (loading: boolean) => void;
}

/**
 * Hook for managing pagination state
 * 
 * Usage:
 * ```tsx
 * const { paginatedData, nextPage, hasNextPage } = usePagination({
 *   data: allItems,
 *   pageSize: 20
 * });
 * ```
 */
export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    initialPage = 1,
    pageSize = 20,
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Calculate total pages
  const totalPages = Math.ceil(data.length / pageSize);

  // Calculate current page data
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);
  
  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // Navigation functions
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const loadMore = useCallback(() => {
    if (currentPage < totalPages && !isLoadingMore) {
      setIsLoadingMore(true);
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages, isLoadingMore]);

  // Computed states
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages || totalPages === 0;

  return {
    currentPage,
    pageSize,
    totalPages,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
    isFirstPage,
    isLastPage,
    paginatedData,
    startIndex,
    endIndex,
    loadMore,
    isLoadingMore,
    setIsLoadingMore,
  };
}

/**
 * Hook for infinite scroll pagination with cursor-based loading
 */
interface UseInfiniteScrollOptions {
  pageSize?: number;
  threshold?: number; // How many pixels from bottom to trigger load
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  appendItems: (newItems: T[], hasMoreItems: boolean) => void;
}

export function useInfiniteScroll<T>(
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn<T> {
  const { pageSize = 20 } = options;
  
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setIsLoading(true);
    }
  }, [isLoading, hasMore]);

  const appendItems = useCallback((newItems: T[], hasMoreItems: boolean) => {
    setItems(prev => [...prev, ...newItems]);
    setHasMore(hasMoreItems);
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setHasMore(true);
    setIsLoading(false);
  }, []);

  return {
    items,
    isLoading,
    hasMore,
    loadMore,
    reset,
    appendItems,
  };
}

/**
 * Hook to detect when user scrolls near bottom of a container
 */
export function useScrollNearBottom(
  ref: React.RefObject<HTMLElement>,
  callback: () => void,
  threshold: number = 200
) {
  const handleScroll = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < threshold) {
      callback();
    }
  }, [ref, callback, threshold]);

  return handleScroll;
}

export default usePagination;
