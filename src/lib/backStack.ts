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

/**
 * Where a back request comes from:
 * - `native`: Android Back (may switch tab and, on Home, exit the app);
 * - `web`: the browser's Back in the web build (may switch tab, never exits);
 * - `key`: the Escape key (only closes layers).
 */
export type BackMode = 'native' | 'web' | 'key';

type AppBack = (mode: BackMode) => boolean;
let appBack: AppBack | null = null;

/**
 * The signed-in app's own back chain (its screens and overlays), asked
 * instead of the bare stack while it is mounted (it asks the stack first).
 * Returns the unregister function.
 */
export const setAppBack = (fn: AppBack) => {
  appBack = fn;
  return () => {
    if (appBack === fn) appBack = null;
  };
};

/** One back request: the app chain when the app is mounted, else the stack. */
export const runBack = (mode: BackMode): boolean => (appBack ? appBack(mode) : handleBackFromStack());

/** Escape typed in a field belongs to the field (clearing it, closing a picker). */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
}

/**
 * Escape closes the top layer, like Android Back, through the same chain
 * (iPad with a hardware keyboard, desktop web). Fields and menus that use
 * Escape themselves call preventDefault and are left alone. One listener for
 * the whole app, so two stacked sheets never both close on one press.
 */
export const onEscapeKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
  // Escape typed in a field is the field's (a draft is never closed by it).
  if (isEditableTarget(e.target)) return;
  if (runBack('key')) e.preventDefault();
};

// Registered once, before any screen's own listeners; it calls the latest
// module's handler (dev hot reload replaces it).
type EscapeHost = Window & { __bwEscapeBack?: (e: KeyboardEvent) => void };
if (typeof window !== 'undefined') {
  const w = window as EscapeHost;
  if (!w.__bwEscapeBack) window.addEventListener('keydown', (e) => w.__bwEscapeBack?.(e));
  w.__bwEscapeBack = onEscapeKey;
}
