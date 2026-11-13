import { useCallback, useRef } from 'react';

/**
 * Async results for one item (an event, a chat) must not land on whatever
 * item is open by the time they arrive.
 *
 * Pass the key of the item on screen. `isCurrent(k)` says whether `k` is
 * still that item. `markCurrent(k)` records a change right away, before
 * React re-renders, for handlers that switch item and then await.
 */
export function useCurrentKey(key: string | null) {
  const ref = useRef<string | null>(key);
  const rendered = useRef<string | null>(key);
  // A new render with a new key wins over an older mark.
  if (rendered.current !== key) {
    rendered.current = key;
    ref.current = key;
  }
  const isCurrent = useCallback((k: string | null | undefined) => k != null && ref.current === k, []);
  const markCurrent = useCallback((k: string | null) => {
    ref.current = k;
  }, []);
  return { isCurrent, markCurrent };
}
