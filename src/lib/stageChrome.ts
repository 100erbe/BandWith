/**
 * Stage mode full screen: the person can hide the side bar (the iPhone Duo
 * rail, and on two-pane layouts the list pane beside Stage mode) so the live
 * view gets the whole screen. The choice is per device and only applies to
 * Stage mode (src/app/components/dashboard/StageMode.tsx and its Laptop pose,
 * FloorWedgeMode).
 *
 * While Stage mode is open with the bar hidden, <html> carries
 * `data-bw-stage-full` (see src/styles/stage.css).
 */
import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react';

const KEY = 'bw-stage-bar-hidden-v1';
const CHANGED = 'bw:stage-bar';
export const STAGE_FULL_ATTR = 'data-bw-stage-full';

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** Fallback when localStorage throws (private mode). */
let memory: boolean | null = null;
const snapshot = () => memory ?? read();

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGED, cb);
    window.removeEventListener('storage', cb);
  };
};

export function setStageBarHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the choice lasts until the page reloads */
    memory = hidden;
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** The remembered choice: true = Stage mode hides the side bar. */
export function useStageBarHidden(): [boolean, (hidden: boolean) => void] {
  const hidden = useSyncExternalStore(subscribe, snapshot, () => false);
  const set = useCallback((v: boolean) => setStageBarHidden(v), []);
  return [hidden, set];
}

/**
 * Marks <html> while Stage mode is full screen. A layout effect, so Stage
 * mode can measure its new box in its own layout effects declared after it.
 */
export function useStageFullScreen(on: boolean): void {
  useLayoutEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.setAttribute(STAGE_FULL_ATTR, '');
    return () => root.removeAttribute(STAGE_FULL_ATTR);
  }, [on]);
}
