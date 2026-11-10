import { useEffect, useState } from 'react';

/**
 * Display regions iOS reserves on the current device, published by the
 * native shell (ios/App/App/BandWithBridgeViewController.swift).
 *
 * On iPhone Duo the clock, battery and camera sit in a column at the top
 * right of each display (`status`), and the open inner display has a fold
 * (`division`). Elsewhere both are null.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export interface DeviceRegions {
  status: Rect | null;
  division: Rect | null;
  viewport: { w: number; h: number };
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

/**
 * Duo layout, applied to <html> whenever the regions or the viewport change.
 *
 * - `data-bw-rail` + `--bw-rail-w`: the system column becomes a rail that
 *   holds the vertical nav (Figma "Duo" frames, both postures).
 * - `data-bw-two-pane` + `--bw-pane-*`: on the open display the app splits
 *   into a leading pane (lists) and a trailing pane (details), at the fold
 *   when iOS reports one, otherwise evenly.
 */
export function installDuoLayout(): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const update = () => {
    const r = current();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rail = r.status ? Math.max(72, Math.round(vw - r.status.x)) : 0;
    const fold = r.division && r.division.h >= r.division.w ? r.division : null;
    const twoPane = !!r.status && (!!fold || (vw >= 860 && vw > vh));
    root.toggleAttribute('data-bw-rail', rail > 0);
    root.toggleAttribute('data-bw-two-pane', twoPane);
    root.style.setProperty('--bw-rail-w', `${rail}px`);
    if (twoPane) {
      const leading = fold ? Math.round(fold.x) : Math.floor((vw - rail) / 2);
      const trailingX = fold ? Math.round(fold.x + fold.w) : leading + 1;
      root.style.setProperty('--bw-pane-leading-w', `${leading}px`);
      root.style.setProperty('--bw-pane-trailing-x', `${trailingX}px`);
      root.style.setProperty('--bw-pane-trailing-w', `${Math.max(0, vw - rail - trailingX)}px`);
    }
    window.dispatchEvent(new CustomEvent('bwlayout'));
  };
  window.addEventListener('bwregions', update);
  window.addEventListener('resize', update);
  update();
}

/** True while the vertical rail nav is active (Duo, either posture). */
export function useRailLayout(): { rail: boolean; twoPane: boolean } {
  const read = () => ({
    rail: document.documentElement.hasAttribute('data-bw-rail'),
    twoPane: document.documentElement.hasAttribute('data-bw-two-pane'),
  });
  const [state, setState] = useState(read);
  useEffect(() => {
    const onChange = () => setState(read());
    window.addEventListener('bwlayout', onChange);
    onChange();
    return () => window.removeEventListener('bwlayout', onChange);
  }, []);
  return state;
}
