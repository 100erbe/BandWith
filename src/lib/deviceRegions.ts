import { useEffect, useState } from 'react';
import {
  computePosture,
  devicePostureApi,
  readViewportSegments,
  readWebHinge,
  updatePosture,
  type HingeState,
  type PostureInput,
} from './posture';

/**
 * Display regions iOS reserves on the current device, published by the
 * native shell (ios/App/App/BandWithBridgeViewController.swift).
 *
 * On iPhone Duo the clock, battery and camera sit in a column along one edge
 * of each display (`status`, with the `edge` it hugs: the trailing edge
 * normally, the leading edge for a Split View window on the left), and the
 * open inner display has a fold (`division`, vertical in the book posture,
 * horizontal in Laptop pose). Newer shells also send the app's `window` frame
 * against the `screen` (Split View) and the `hinge` state. Elsewhere all of
 * these are null or absent.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export type Edge = 'left' | 'right' | 'top' | 'bottom';
export interface StatusRect extends Rect {
  /** Edge the column hugs. Older shells omit it: that column is on the right. */
  edge?: Edge;
}
export interface NativeHinge {
  status: 'closed' | 'partial' | 'open' | 'unknown';
  /** Opening angle in degrees, when UIKit reports one. */
  angle?: number | null;
}
export interface DeviceRegions {
  status: StatusRect | null;
  division: Rect | null;
  viewport: { w: number; h: number };
  window?: Rect | null;
  screen?: { w: number; h: number } | null;
  hinge?: NativeHinge | null;
}

declare global {
  interface Window { __bwRegions?: DeviceRegions }
}

function current(): DeviceRegions {
  if (typeof window === 'undefined') return { status: null, division: null, viewport: { w: 0, h: 0 } };
  return window.__bwRegions ?? { status: null, division: null, viewport: { w: window.innerWidth, h: window.innerHeight } };
}

export function useDeviceRegions(): DeviceRegions {
  const [regions, setRegions] = useState<DeviceRegions>(current);
  useEffect(() => {
    const onChange = () => setRegions(current());
    window.addEventListener('bwregions', onChange);
    onChange();
    return () => window.removeEventListener('bwregions', onChange);
  }, []);
  return regions;
}

/**
 * Two-pane geometry when the display has a vertical fold: the leading pane
 * ends where the fold starts and the trailing pane begins where it ends.
 */
export function useFoldPanes(): { leading: number; trailing: number; fold: number } | null {
  const { division, viewport } = useDeviceRegions();
  if (!division || division.h < division.w) return null;
  return {
    leading: division.x,
    fold: division.w,
    trailing: Math.max(0, viewport.w - division.x - division.w),
  };
}

function nativeHinge(h: NativeHinge | null | undefined): HingeState {
  switch (h?.status) {
    case 'closed': return 'closed';
    case 'partial': return 'half-open';
    case 'open': return 'open';
    default: return null;
  }
}

/** Native regions when the shell sent them, else the browser's own fold signals. */
export function postureInput(r: DeviceRegions, native: boolean, vw: number, vh: number): PostureInput {
  if (native) {
    return {
      viewport: { w: vw, h: vh },
      status: r.status,
      division: r.division,
      hinge: nativeHinge(r.hinge),
      window: r.window ?? null,
      screen: r.screen ?? null,
    };
  }
  const segments = readViewportSegments();
  return {
    viewport: { w: vw, h: vh },
    status: null,
    division: null,
    segments,
    hinge: readWebHinge(!!segments && segments.length > 1),
  };
}

/** Narrowest window that gets the tablet layout (iPad mini portrait is 744). */
export const WIDE_MIN_W = 744;

/** Shortest side a tablet window has: keeps phones in landscape (~390 tall) on the phone layout. */
export const WIDE_MIN_SHORT = 600;

/** A tablet-sized window: wide enough and tall enough (not a phone turned sideways). */
export function isTabletWindow(vw: number, vh: number): boolean {
  return vw >= WIDE_MIN_W && Math.min(vw, vh) >= WIDE_MIN_SHORT;
}

/** Width of the list column on a tablet in two-pane: 36% of the window, 320–420 px. */
export function tabletListWidth(vw: number): number {
  return Math.max(320, Math.min(420, Math.round(vw * 0.36)));
}

/**
 * Duo / foldable layout, applied to <html> whenever the regions, the viewport
 * or the device posture change.
 *
 * - `data-bw-rail` + `--bw-rail-w` (+ `data-bw-rail-edge`): the system
 *   column becomes a rail that holds the vertical nav (Figma "Duo" frames),
 *   on whichever side the column is.
 * - `data-bw-two-pane` + `--bw-pane-*`: the book layout. Lists on the leading
 *   pane, details on the trailing pane, at a vertical fold when one is
 *   reported (iOS division or browser viewport segments), otherwise evenly on
 *   a wide display (Duo open landscape, tablets, foldables in a WebView).
 * - `data-bw-posture` + `--bw-fold-*` / `--bw-display-h` / `--bw-deck-*`:
 *   see src/lib/posture.ts. Absent on ordinary phones.
 */
export function installDuoLayout(): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const update = () => {
    const native = !!window.__bwRegions;
    const r = current();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const result = computePosture(postureInput(r, native, vw, vh));
    const s = r.status;
    const railEdge = result.railEdge;
    const rail = s && railEdge === 'right'
      ? Math.max(72, Math.round(vw - s.x))
      : s && railEdge === 'left'
        ? Math.max(72, Math.round(s.x + s.w))
        : 0;
    const fold = result.fold && result.fold.orientation === 'vertical' ? result.fold : null;
    const twoPane = result.twoPane;
    // Tablet-sized window (iPad, Android tablet, desktop browser): no Duo
    // system column. Drives the floating labelled nav and centred sheets;
    // the Duo rules never see it.
    // A top/bottom occlusion (an iPad status strip) is not a Duo column.
    const sideColumn = !!s && s.edge !== 'top' && s.edge !== 'bottom';
    const wide = !sideColumn && rail === 0 && isTabletWindow(vw, vh);
    root.toggleAttribute('data-bw-wide', wide);
    root.toggleAttribute('data-bw-rail', rail > 0);
    if (rail > 0 && railEdge) root.setAttribute('data-bw-rail-edge', railEdge);
    else root.removeAttribute('data-bw-rail-edge');
    root.toggleAttribute('data-bw-two-pane', twoPane);
    root.style.setProperty('--bw-rail-w', `${rail}px`);
    // The rail lives in the system column but must stay clear of the clock /
    // camera block, wherever the device puts it: at the top (portrait, open)
    // or at the bottom (closed, turned over). DuoRail keeps its group centred
    // as in Figma and only steps it away from the block when they would meet.
    // A column that runs the full height has no block to avoid.
    if (rail > 0 && s && s.h < vh * 0.6) {
      const atBottom = s.y + s.h / 2 > vh / 2;
      root.style.setProperty('--bw-rail-clear-top', atBottom ? '0px' : `${Math.max(0, Math.round(s.y + s.h + 8 - 40))}px`);
      root.style.setProperty('--bw-rail-clear-bottom', atBottom ? `${Math.max(0, Math.round(vh - s.y + 8))}px` : '0px');
    } else {
      root.style.removeProperty('--bw-rail-clear-top');
      root.style.removeProperty('--bw-rail-clear-bottom');
    }
    if (twoPane) {
      const railLeft = railEdge === 'left' ? rail : 0;
      const railRight = railEdge === 'right' ? rail : 0;
      // Tablets (no system column, no fold): a list column of 320–420 px and
      // the rest for the detail, as in the iPad frames. The Duo keeps the
      // even split or its fold.
      const leading = fold
        ? Math.round(fold.x)
        : wide
          ? tabletListWidth(vw)
          : railLeft + Math.floor((vw - rail) / 2);
      const trailingX = fold ? Math.round(fold.x + fold.w) : leading + 1;
      root.style.setProperty('--bw-pane-leading-w', `${leading}px`);
      root.style.setProperty('--bw-pane-trailing-x', `${trailingX}px`);
      root.style.setProperty('--bw-pane-trailing-w', `${Math.max(0, vw - railRight - trailingX)}px`);
    }
    // Laptop pose: the clock is a small block in the Display's top corner,
    // not a full-height column. The Display then runs edge to edge from the
    // block's top; only its first row steps aside for the clock.
    const hfold = result.posture === 'tabletop' && result.fold?.orientation === 'horizontal' ? result.fold : null;
    const block = !!s && !!hfold && !!railEdge && s.y + s.h <= hfold.y / 2;
    root.toggleAttribute('data-bw-status-block', block);
    if (block && s) {
      root.style.setProperty('--bw-display-top', `${Math.max(8, Math.round(s.y))}px`);
      root.style.setProperty('--bw-display-head-x', `${Math.round(railEdge === 'left' ? s.x + s.w : vw - s.x)}px`);
      root.style.setProperty('--bw-status-bottom', `${Math.round(s.y + s.h)}px`);
    } else {
      root.style.removeProperty('--bw-display-top');
      root.style.removeProperty('--bw-display-head-x');
      root.style.removeProperty('--bw-status-bottom');
    }
    updatePosture(result);
    window.dispatchEvent(new CustomEvent('bwlayout'));
  };
  // Turning the phone, the native regions and the web view's new size arrive
  // in either order, so the last event can see a stale half (open landscape
  // stayed single-pane, the rail kept the old column). Settle once more after
  // the burst.
  let settle: ReturnType<typeof setTimeout> | undefined;
  let settleLate: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    update();
    clearTimeout(settle);
    clearTimeout(settleLate);
    settle = setTimeout(update, 150);
    settleLate = setTimeout(update, 600);
  };
  window.addEventListener('bwregions', schedule);
  window.addEventListener('resize', schedule);
  try {
    screen.orientation?.addEventListener('change', schedule);
  } catch {
    /* no Screen Orientation API */
  }
  try {
    devicePostureApi()?.addEventListener('change', schedule);
  } catch {
    /* no Device Posture API */
  }
  update();
}

/** Layout flags from <html>: Duo rail, two panes, tablet-sized window. */
export function useRailLayout(): { rail: boolean; twoPane: boolean; wide: boolean; railEdge: 'left' | 'right' } {
  const read = () => ({
    rail: document.documentElement.hasAttribute('data-bw-rail'),
    twoPane: document.documentElement.hasAttribute('data-bw-two-pane'),
    wide: document.documentElement.hasAttribute('data-bw-wide'),
    railEdge: (document.documentElement.getAttribute('data-bw-rail-edge') === 'left' ? 'left' : 'right') as
      | 'left'
      | 'right',
  });
  const [state, setState] = useState(read);
  useEffect(() => {
    const onChange = () =>
      setState((prev) => {
        const next = read();
        return prev.rail === next.rail &&
          prev.twoPane === next.twoPane &&
          prev.wide === next.wide &&
          prev.railEdge === next.railEdge
          ? prev
          : next;
      });
    window.addEventListener('bwlayout', onChange);
    onChange();
    return () => window.removeEventListener('bwlayout', onChange);
  }, []);
  return state;
}
