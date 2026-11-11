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
    root.toggleAttribute('data-bw-rail', rail > 0);
    if (rail > 0 && railEdge) root.setAttribute('data-bw-rail-edge', railEdge);
    else root.removeAttribute('data-bw-rail-edge');
    root.toggleAttribute('data-bw-two-pane', twoPane);
    root.style.setProperty('--bw-rail-w', `${rail}px`);
    if (twoPane) {
      const railLeft = railEdge === 'left' ? rail : 0;
      const railRight = railEdge === 'right' ? rail : 0;
      const leading = fold ? Math.round(fold.x) : railLeft + Math.floor((vw - rail) / 2);
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
  window.addEventListener('bwregions', update);
  window.addEventListener('resize', update);
  try {
    devicePostureApi()?.addEventListener('change', update);
  } catch {
    /* no Device Posture API */
  }
  update();
}

/** True while the vertical rail nav is active (Duo, either posture). */
export function useRailLayout(): { rail: boolean; twoPane: boolean; railEdge: 'left' | 'right' } {
  const read = () => ({
    rail: document.documentElement.hasAttribute('data-bw-rail'),
    twoPane: document.documentElement.hasAttribute('data-bw-two-pane'),
    railEdge: (document.documentElement.getAttribute('data-bw-rail-edge') === 'left' ? 'left' : 'right') as
      | 'left'
      | 'right',
  });
  const [state, setState] = useState(read);
  useEffect(() => {
    const onChange = () =>
      setState((prev) => {
        const next = read();
        return prev.rail === next.rail && prev.twoPane === next.twoPane && prev.railEdge === next.railEdge
          ? prev
          : next;
      });
    window.addEventListener('bwlayout', onChange);
    onChange();
    return () => window.removeEventListener('bwlayout', onChange);
  }, []);
  return state;
}
