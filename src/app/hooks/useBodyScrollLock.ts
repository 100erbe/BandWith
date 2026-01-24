import { useEffect } from 'react';

/**
 * Hook to lock body scroll when any of the conditions are true
 * @param conditions - Array of boolean conditions that trigger scroll lock
 */
export function useBodyScrollLock(conditions: boolean[]) {
  useEffect(() => {
    const shouldLock = conditions.some(Boolean);
    
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [conditions]);
}

/**
 * Simple hook to lock body scroll based on a single condition
 * @param isLocked - Whether to lock the scroll
 */
export function useScrollLock(isLocked: boolean) {
  useBodyScrollLock([isLocked]);
}
