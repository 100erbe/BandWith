import { useEffect, useRef } from 'react';

/**
 * Nested screens that handle the system Back (Android back button / gesture)
 * themselves: e.g. a Settings sub-section goes back to the section list
 * instead of closing Settings.
 *
 * The app-level back handler asks the most recently registered handler first;
 * a handler returns true when it consumed the back press.
 */
type BackHandler = () => boolean;

const stack: BackHandler[] = [];

/** Runs the topmost handler. True if a screen handled the back press. */
export const handleBackFromStack = (): boolean => {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]()) return true;
  }
  return false;
};

/**
 * Registers `onBack` while `active` is true. Return true from it when it handled
 * the press (return false to let the next screen / the app handle it).
 */
export const useSystemBack = (active: boolean, onBack: () => boolean | void) => {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const handler: BackHandler = () => ref.current() !== false;
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
};
