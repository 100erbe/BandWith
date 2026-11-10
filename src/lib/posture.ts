import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Edge, Rect } from './deviceRegions';

/**
 * Device posture for foldables (iPhone Duo, Android foldables) and wide
 * tablets, from the Figma "Duo · 11 Laptop pose" + "§ Postures" pages.
 *
 * - closed     one display (Duo outer display, or open with nothing reported)
 * - open-flat  open, one tall pane (open portrait, or a horizontal fold laid flat)
 * - book       two panes side by side: a vertical fold (flat or half folded),
 *              or a display wide enough for the even book split
 * - tabletop   half folded with a horizontal fold ("Laptop pose"): the upright
 *              top half is the Display, the flat bottom half is the Deck
 * - split      the app runs in a window narrower than the screen (Split View)
 *
 * The pure computation (`computePosture`) is unit tested. The DOM side
 * (attributes, CSS vars, settle debounce) is driven by `installDuoLayout`
 * in deviceRegions.ts, which only runs in the native shells.
 */

export type Posture = 'closed' | 'open-flat' | 'book' | 'tabletop' | 'split';
/** Hinge state from UIHingeInteraction (iOS) or navigator.devicePosture (web). */
export type HingeState = 'closed' | 'half-open' | 'open' | null;

export interface Fold {
  orientation: 'vertical' | 'horizontal';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PostureInput {
  viewport: { w: number; h: number };
  status?: (Rect & { edge?: Edge }) | null;
  division?: Rect | null;
  /** Viewport segments (web), in CSS px. Two or more means the window spans a fold. */
  segments?: Rect[] | null;
  hinge?: HingeState;
  /** The app's window frame in screen coordinates (native). */
  window?: Rect | null;
  /** The screen's bounds (native). */
  screen?: { w: number; h: number } | null;
}

export interface PostureResult {
  posture: Posture;
  /** False when nothing posture-related is known (ordinary phones): stay inert. */
  detected: boolean;
  fold: Fold | null;
  /** Lists on the leading pane, details on the trailing pane. */
  twoPane: boolean;
  /** Edge the Duo rail sits on, or null when there is no side status column. */
  railEdge: 'left' | 'right' | null;
}

/** The empty band kept at the fold in Laptop pose (pt). */
export const FOLD_BAND = 44;
/** The phone has to stay in a posture this long before Laptop pose starts. */
export const SETTLE_MS = 600;
/** Duo (status column reported): the open display splits from this width in landscape. */
export const DUO_BOOK_MIN_W = 860;
/** Anything else (tablets, foldables in a WebView): wide and tall enough for two panes. */
export const BOOK_MIN_W = 900;
export const BOOK_MIN_H = 600;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validRect = (r: Rect | null | undefined): r is Rect =>
  !!r && finite(r.x) && finite(r.y) && finite(r.w) && finite(r.h) && r.w >= 0 && r.h >= 0;

/** A fold reported as a division region: taller than wide is vertical. */
export function foldFromDivision(d: Rect | null | undefined): Fold | null {
  if (!validRect(d) || (d.w === 0 && d.h === 0)) return null;
  return { orientation: d.h >= d.w ? 'vertical' : 'horizontal', x: d.x, y: d.y, w: d.w, h: d.h };
}

/** The gap between the first two viewport segments (side by side or stacked). */
export function foldFromSegments(
  segments: Rect[] | null | undefined,
  viewport: { w: number; h: number },
): Fold | null {
  if (!segments || segments.length < 2) return null;
  const segs = segments.filter(validRect).slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (segs.length < 2) return null;
  const [a, b] = segs;
  if (b.x >= a.x + a.w - 1 && b.x > a.x) {
    const x = a.x + a.w;
    return { orientation: 'vertical', x, y: 0, w: Math.max(0, b.x - x), h: viewport.h };
  }
  if (b.y >= a.y + a.h - 1 && b.y > a.y) {
    const y = a.y + a.h;
    return { orientation: 'horizontal', x: 0, y, w: viewport.w, h: Math.max(0, b.y - y) };
  }
  return null;
}

export function computePosture(input: PostureInput): PostureResult {
  const vw = input.viewport.w;
  const vh = input.viewport.h;
  const status = validRect(input.status ?? null) ? input.status! : null;
  const hinge = input.hinge ?? null;
  const fold = foldFromDivision(input.division) ?? foldFromSegments(input.segments, input.viewport);

  // An older native shell sends no edge: its column is always the trailing one.
  const railEdge: PostureResult['railEdge'] = !status
    ? null
    : status.edge === 'left'
      ? 'left'
      : status.edge === undefined || status.edge === 'right'
        ? 'right'
        : null;

  const landscape = vw > vh;
  const wideDuo = !!status && landscape && vw >= DUO_BOOK_MIN_W;
  const wideOther = !status && landscape && vw >= BOOK_MIN_W && vh >= BOOK_MIN_H;
  const win = input.window;
  const scr = input.screen;
  const isSplit =
    validRect(win ?? null) && !!scr && finite(scr.w) && finite(scr.h) && scr.w > 0 && scr.h > 0 &&
    (win!.w < scr.w - 1 || win!.h < scr.h - 1);

  let posture: Posture;
  if (isSplit) posture = 'split';
  else if (fold?.orientation === 'horizontal') {
    // Laid flat, a horizontal fold is just a tall display; otherwise the
    // phone stands half folded (Laptop pose). Without a hinge reading, a
    // reported horizontal fold counts as half folded.
    posture = hinge === 'open' ? 'open-flat' : hinge === 'closed' ? 'closed' : 'tabletop';
  } else if (fold?.orientation === 'vertical') posture = 'book';
  else if (wideDuo || wideOther) posture = 'book';
  else if (hinge === 'open' || hinge === 'half-open') posture = 'open-flat';
  else posture = 'closed';

  const detected = isSplit || !!fold || !!status || hinge !== null || wideOther;
  const twoPane = posture === 'book' || (posture === 'split' && (wideDuo || wideOther));

  return { posture, detected, fold, twoPane, railEdge };
}

/** Laptop pose switched off in Settings: the half-folded phone keeps the normal layout. */
export function effectivePosture(posture: Posture, laptopPoseEnabled: boolean): Posture {
  return posture === 'tabletop' && !laptopPoseEnabled ? 'open-flat' : posture;
}

export interface FoldBands {
  /** Height of the Display (top half), from the top of the viewport. */
  displayH: number;
  /** Top of the Deck (bottom half). */
  deckTop: number;
  /** Height of the Deck. */
  deckH: number;
}

/** The Display and Deck around a horizontal fold, keeping at least FOLD_BAND empty. */
export function foldBands(fold: Fold, viewportH: number): FoldBands {
  const centre = fold.y + fold.h / 2;
  const half = Math.max(FOLD_BAND, fold.h) / 2;
  const displayH = Math.max(0, Math.round(centre - half));
  const deckTop = Math.min(viewportH, Math.max(displayH, Math.round(centre + half)));
  return { displayH, deckTop, deckH: Math.max(0, viewportH - deckTop) };
}

/**
 * Debounces entering Laptop pose until the phone settles; every other change
 * (opening flat, closing) applies at once, so the book layout comes straight back.
 */
export function createPostureSettler(apply: (p: Posture) => void, delay = SETTLE_MS) {
  let current: Posture | null = null;
  let pending: Posture | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return {
    push(next: Posture) {
      if (next === current) {
        cancel();
        return;
      }
      if (current === null) {
        current = next;
        apply(next);
        return;
      }
      if (next === 'tabletop') {
        if (pending === next) return;
        cancel();
        pending = next;
        timer = setTimeout(() => {
          timer = null;
          pending = null;
          current = next;
          apply(next);
        }, delay);
        return;
      }
      cancel();
      current = next;
      apply(next);
    },
    cancel,
    get current() {
      return current;
    },
  };
}

// ── Web signals (Android foldables and tablets in a WebView) ─────────────

type MaybeSegments = { segments?: ArrayLike<DOMRectReadOnly> | null } | undefined;

const toRect = (r: DOMRectReadOnly | { x: number; y: number; width: number; height: number }): Rect => ({
  x: r.x,
  y: r.y,
  w: r.width,
  h: r.height,
});

let probe: HTMLDivElement | null = null;
function envSegment(col: number, row: number): Rect | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;z-index:-1;';
    document.body.appendChild(probe);
  }
  probe.style.left = `env(viewport-segment-left ${col} ${row}, 0px)`;
  probe.style.top = `env(viewport-segment-top ${col} ${row}, 0px)`;
  probe.style.width = `env(viewport-segment-width ${col} ${row}, 0px)`;
  probe.style.height = `env(viewport-segment-height ${col} ${row}, 0px)`;
  const cs = getComputedStyle(probe);
  const w = parseFloat(cs.width) || 0;
  const h = parseFloat(cs.height) || 0;
  if (w <= 0 || h <= 0) return null;
  return { x: parseFloat(cs.left) || 0, y: parseFloat(cs.top) || 0, w, h };
}

/** Viewport segments from the JS API, else from the CSS env() variables. */
export function readViewportSegments(): Rect[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const w = window as unknown as { viewport?: MaybeSegments; visualViewport?: MaybeSegments };
    const list = w.viewport?.segments ?? w.visualViewport?.segments;
    if (list && list.length > 0) return Array.from(list, toRect);
    const a = envSegment(0, 0);
    if (!a) return null;
    const b = envSegment(1, 0) ?? envSegment(0, 1);
    return b ? [a, b] : null;
  } catch {
    return null;
  }
}

interface DevicePostureLike extends EventTarget {
  type?: 'continuous' | 'folded' | string;
}
export function devicePostureApi(): DevicePostureLike | null {
  if (typeof navigator === 'undefined') return null;
  const p = (navigator as unknown as { devicePosture?: DevicePostureLike }).devicePosture;
  return p && typeof p.addEventListener === 'function' ? p : null;
}

/**
 * Hinge from navigator.devicePosture. "continuous" only says something on a
 * device that spans a fold (segments present); elsewhere it is every phone.
 */
export function readWebHinge(hasSegments: boolean): HingeState {
  try {
    const type = devicePostureApi()?.type;
    if (type === 'folded') return 'half-open';
    if (type === 'continuous' && hasSegments) return 'open';
  } catch {
    /* not supported */
  }
  return null;
}

// ── Laptop pose preference (Settings › iPhone Duo) ───────────────────────

export const LAPTOP_POSE_PREF = 'bw-duo-laptop-pose';
const PREF_EVENT = 'bwposturepref';

export function getLaptopPoseEnabled(): boolean {
  try {
    return localStorage.getItem(LAPTOP_POSE_PREF) !== '0';
  } catch {
    return true;
  }
}

let sessionPref: boolean | null = null;

export function setLaptopPoseEnabled(on: boolean): void {
  try {
    localStorage.setItem(LAPTOP_POSE_PREF, on ? '1' : '0');
    sessionPref = null;
  } catch {
    /* storage unavailable: the change lasts for this session only */
    sessionPref = on;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PREF_EVENT));
}
const readPref = () => sessionPref ?? getLaptopPoseEnabled();

export function useLaptopPoseEnabled(): boolean {
  const [on, setOn] = useState(readPref);
  useEffect(() => {
    const sync = () => setOn(readPref());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAPTOP_POSE_PREF) sync();
    };
    window.addEventListener(PREF_EVENT, sync);
    window.addEventListener('storage', onStorage);
    sync();
    return () => {
      window.removeEventListener(PREF_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return on;
}

// ── Posture store + DOM ──────────────────────────────────────────────────

export interface PostureState {
  /** Settled posture, with the Laptop pose preference applied. */
  posture: Posture;
  /** Latest computed posture, before settling and preferences. */
  rawPosture: Posture;
  detected: boolean;
  fold: Fold | null;
  bands: FoldBands | null;
  twoPane: boolean;
  railEdge: 'left' | 'right' | null;
}

const INITIAL: PostureState = {
  posture: 'closed',
  rawPosture: 'closed',
  detected: false,
  fold: null,
  bands: null,
  twoPane: false,
  railEdge: null,
};

let state: PostureState = INITIAL;
let settled: Posture = 'closed';
let latest: PostureResult | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bwposture', { detail: state }));
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getPosture(): PostureState {
  return state;
}

/** The current posture; ordinary phones always get `{ posture: 'closed', detected: false }`. */
export function usePosture(): PostureState {
  return useSyncExternalStore(subscribe, getPosture, getPosture);
}

const FOLD_VARS = [
  '--bw-fold-top',
  '--bw-fold-height',
  '--bw-fold-left',
  '--bw-fold-width',
  '--bw-display-h',
  '--bw-deck-top',
  '--bw-deck-h',
  '--bw-display-bottom-inset',
];

function writeDom() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (state.detected) root.setAttribute('data-bw-posture', state.posture);
  else root.removeAttribute('data-bw-posture');
  const fold = state.fold;
  if (!fold) {
    FOLD_VARS.forEach((v) => root.style.removeProperty(v));
    return;
  }
  if (fold.orientation === 'horizontal') {
    root.style.setProperty('--bw-fold-top', `${Math.round(fold.y)}px`);
    root.style.setProperty('--bw-fold-height', `${Math.round(fold.h)}px`);
    root.style.removeProperty('--bw-fold-left');
    root.style.removeProperty('--bw-fold-width');
  } else {
    root.style.setProperty('--bw-fold-left', `${Math.round(fold.x)}px`);
    root.style.setProperty('--bw-fold-width', `${Math.round(fold.w)}px`);
    root.style.removeProperty('--bw-fold-top');
    root.style.removeProperty('--bw-fold-height');
  }
  const b = state.bands;
  if (b) {
    const vh = b.deckTop + b.deckH;
    root.style.setProperty('--bw-display-h', `${b.displayH}px`);
    root.style.setProperty('--bw-deck-top', `${b.deckTop}px`);
    root.style.setProperty('--bw-deck-h', `${b.deckH}px`);
    root.style.setProperty('--bw-display-bottom-inset', `${Math.max(0, vh - b.displayH)}px`);
  } else {
    ['--bw-display-h', '--bw-deck-top', '--bw-deck-h', '--bw-display-bottom-inset'].forEach((v) =>
      root.style.removeProperty(v),
    );
  }
}

function rebuild() {
  if (!latest) return;
  const posture = effectivePosture(settled, readPref());
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const fold = latest.fold;
  state = {
    posture,
    rawPosture: latest.posture,
    detected: latest.detected,
    fold,
    bands: fold && fold.orientation === 'horizontal' ? foldBands(fold, vh) : null,
    twoPane: latest.twoPane,
    railEdge: latest.railEdge,
  };
  writeDom();
  emit();
}

const settler = createPostureSettler((p) => {
  settled = p;
  rebuild();
});

let prefListening = false;

/** Called by installDuoLayout on every regions/resize change. */
export function updatePosture(result: PostureResult): void {
  latest = result;
  if (!prefListening && typeof window !== 'undefined') {
    prefListening = true;
    window.addEventListener(PREF_EVENT, rebuild);
    window.addEventListener('storage', (e) => {
      if (e.key === LAPTOP_POSE_PREF) rebuild();
    });
  }
  const before = settler.current;
  settler.push(result.posture);
  // Geometry (fold, panes) follows at once even while the posture settles.
  if (settler.current === before) rebuild();
}

// ── Keep awake (Stage / Floor wedge) ─────────────────────────────────────

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
let wakeLock: WakeLockSentinelLike | null = null;
let wantAwake = false;
let visibilityHooked = false;

function nativeKeepAwake(): { postMessage: (v: unknown) => void } | null {
  if (typeof window === 'undefined') return null;
  const handler = (window as unknown as {
    webkit?: { messageHandlers?: { bwKeepAwake?: { postMessage: (v: unknown) => void } } };
  }).webkit?.messageHandlers?.bwKeepAwake;
  return handler ?? null;
}

async function requestWebWakeLock() {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } })
      .wakeLock;
    if (!wl || wakeLock || document.visibilityState !== 'visible') return;
    wakeLock = await wl.request('screen');
    if (!wantAwake) {
      void wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

/**
 * Keeps the screen on (or lets it sleep again). Native iOS: the shell's
 * `bwKeepAwake` handler toggles the idle timer. Elsewhere: the Screen Wake
 * Lock API when the WebView has it. Prefer `useKeepAwake`, which counts users.
 */
export function setKeepAwake(on: boolean): void {
  if (typeof document === 'undefined') return;
  wantAwake = on;
  const root = document.documentElement;
  if (on) root.dataset.bwKeepAwake = '1';
  else delete root.dataset.bwKeepAwake;

  const native = nativeKeepAwake();
  if (native) {
    try {
      native.postMessage(on);
    } catch {
      /* shell without the handler */
    }
    return;
  }
  if (on) {
    void requestWebWakeLock();
    if (!visibilityHooked) {
      visibilityHooked = true;
      // The browser drops the lock when the page is hidden; take it back.
      document.addEventListener('visibilitychange', () => {
        if (wantAwake && document.visibilityState === 'visible') {
          wakeLock = null;
          void requestWebWakeLock();
        }
      });
    }
  } else if (wakeLock) {
    const lock = wakeLock;
    wakeLock = null;
    void lock.release().catch(() => {});
  }
}

let keepAwakeUsers = 0;

/** Keeps the screen on while `active` and the component is mounted. */
export function useKeepAwake(active = true): void {
  useEffect(() => {
    if (!active) return;
    keepAwakeUsers += 1;
    if (keepAwakeUsers === 1) setKeepAwake(true);
    return () => {
      keepAwakeUsers = Math.max(0, keepAwakeUsers - 1);
      if (keepAwakeUsers === 0) setKeepAwake(false);
    };
  }, [active]);
}
