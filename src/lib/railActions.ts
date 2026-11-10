import { createContext, createElement, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { useIsPresent } from 'motion/react';
import type React from 'react';
import { useRailLayout } from './deviceRegions';

/**
 * iPhone Duo: Back and Search live in the side rail (Figma "Duo/Side Actions"),
 * not in each screen. Screens register what Back and Search should do; the
 * rail shows the most recently opened layer's entry.
 *
 * Registration only takes effect while the rail is on screen (a host is
 * mounted and the device reports the system column), so the same screens
 * keep their own buttons everywhere else.
 */

export interface RailBack {
  id: number;
  label: string;
  run: () => void;
  /** Belongs to the trailing pane (a detail or sheet) on the open display. */
  pane?: boolean;
  /**
   * A sheet's close: it takes over an existing Back (so Back closes the sheet
   * first) but never adds one where the screen beneath has none.
   */
  inherit?: boolean;
}

export interface RailSearch {
  id: number;
  label: string;
  value: string;
  placeholder?: string;
  /** True while results are loading. */
  busy?: boolean;
  /** Open the field as soon as this entry becomes the active one. */
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** When set, the Search button runs this instead of opening the field. */
  onActivate?: () => void;
  /**
   * Belongs to a tab's main screen (Calendar, Chats): any layer above it
   * hides it, whichever registered first (a tab can mount after the layer
   * that a deep link opened on top of it).
   */
  base?: boolean;
}

/**
 * A screen's header action (a wizard's close, Event detail's Stage mode, the
 * Chat "New chat"): on the Duo it joins the rail's Side Actions, under Back
 * and above Search (Figma "Duo/Side Actions"), instead of the screen's own
 * top bar. Apple's Duo rail orders a toolbar the same way: Back or Close
 * first, then the screen's actions.
 */
export interface RailAction {
  id: number;
  label: string;
  icon: React.ReactNode;
  run: () => void;
  pane?: boolean;
  /** Belongs to a tab's main header: any layer above it hides it. */
  base?: boolean;
  /** The screen's primary action (Figma Filled icon button): a filled disc. */
  prominent?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  badgeCount?: number;
}

interface Snapshot {
  /** The visible header actions, oldest first. */
  actions: RailAction[];
  back: RailBack | null;
  search: RailSearch | null;
  hosted: boolean;
  /** A full-screen layer is open: the rail hides the tab bar (Figma "Duo"). */
  fullScreen: boolean;
  /** A dark full-screen layer (Stage mode) asks for the dark glass rail. */
  tone: 'dark' | null;
}

let seq = 0;
let backs: RailBack[] = [];
let searches: RailSearch[] = [];
let actions: RailAction[] = [];
let covers: { id: number; pane: boolean; hideTabs: boolean }[] = [];
let tones: { id: number; tone: 'dark' }[] = [];
let hosts = 0;
let snapshot: Snapshot = { tone: null, actions: [], back: null, search: null, hosted: false, fullScreen: false };
const listeners = new Set<() => void>();

function emit() {
  // Entries registered before the newest cover or Back belong to a screen now
  // under another layer (e.g. Chats under Settings or the profile), so they
  // leave the rail. On the open display a detail or sheet on the trailing
  // pane leaves the leading list's Search in place (Figma "Open · Chat / Inbox
  // | Chat / Event thread").
  const twoPane = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-bw-two-pane');
  // A later layer hides an entry, except that on the open display a layer
  // on the trailing pane leaves the leading pane's entries alone (Figma
  // "Open · Setlists / Songs library | Event / Stage mode").
  const covered = (x: { id: number; pane?: boolean }, by: { id: number; pane?: boolean }) =>
    by.id > x.id && !(twoPane && by.pane && !x.pane);
  const visibleBacks = backs.filter((b) => !covers.some((c) => covered(b, c)));
  let back: RailBack | null = null;
  for (let i = visibleBacks.length - 1; i >= 0; i--) {
    const b = visibleBacks[i];
    if (!b.inherit) { back = visibleBacks[visibleBacks.length - 1]; break; }
  }
  const layers = [...covers, ...backs].filter((l) => !(twoPane && l.pane));
  const visibleSearches = searches.filter((s) => !layers.some((l) => s.base || l.id > s.id));
  const search = visibleSearches.length ? visibleSearches[visibleSearches.length - 1] : null;
  const onFullPane = (pane?: boolean) => !(twoPane && pane);
  // Sheets (inherit) leave the header action of the screen beneath in place
  // (Figma "Closed · Picker / Date").
  const hides = (a: RailAction, by: { id: number; pane?: boolean }) =>
    a.base ? !(twoPane && by.pane && !a.pane) : covered(a, by);
  const visibleActions = actions.filter(
    (a) => !covers.some((c) => hides(a, c)) && !backs.some((b) => !b.inherit && hides(a, b)),
  );
  snapshot = {
    actions: visibleActions,
    tone: tones.length ? tones[tones.length - 1].tone : null,
    back,
    search,
    fullScreen: backs.some((b) => !b.inherit && onFullPane(b.pane)) || covers.some((c) => c.hideTabs && onFullPane(c.pane)),
    hosted: hosts > 0,
  };
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') window.addEventListener('bwlayout', () => emit());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRailSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Mounted by the rail itself: screens hand their Back/Search over only while it exists. */
export function useRailHost(): void {
  useEffect(() => {
    hosts += 1;
    // Lets CSS keep full-screen layers and sheets clear of the rail.
    document.documentElement.setAttribute('data-bw-rail-host', '');
    emit();
    return () => {
      hosts -= 1;
      if (hosts === 0) document.documentElement.removeAttribute('data-bw-rail-host');
      emit();
    };
  }, []);
}

/** True when the Duo rail is on screen and owns Back, Search and the profile. */
export function useRailOwnsChrome(): boolean {
  const { rail } = useRailLayout();
  const { hosted } = useRailSnapshot();
  return rail && hosted;
}

/**
 * Hand a Back action to the rail. Returns true when the rail took it, in
 * which case the caller must not render its own back button.
 */
export function useRailBack(
  run: (() => void) | undefined,
  label = 'Back',
  enabled = true,
  pane = false,
  inherit = false,
): boolean {
  const owns = useRailOwnsChrome();
  // A layer playing its exit animation has already been closed.
  const present = useIsPresent();
  const runRef = useRef(run);
  const labelRef = useRef(label);
  runRef.current = run;
  labelRef.current = label;
  const active = owns && enabled && !!run && present;
  useEffect(() => {
    if (!active) return;
    const entry: RailBack = { id: ++seq, label: labelRef.current, run: () => runRef.current?.(), pane, inherit };
    backs = [...backs, entry];
    emit();
    return () => {
      backs = backs.filter((b) => b.id !== entry.id);
      emit();
    };
  }, [active]);
  return owns && enabled;
}

/**
 * A full-screen layer with no Back of its own (the profile): while active it
 * hides the Back and Search of the screens beneath it.
 */
export function useRailCover(active: boolean, pane = false, hideTabs = true): void {
  const owns = useRailOwnsChrome();
  const present = useIsPresent();
  const on = owns && active && present;
  useEffect(() => {
    if (!on) return;
    const id = ++seq;
    covers = [...covers, { id, pane, hideTabs }];
    emit();
    return () => {
      covers = covers.filter((c) => c.id !== id);
      emit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
}

/**
 * Render inside a bottom sheet that keeps its own close (X): the rail stays as
 * the screen beneath had it, except an existing Back now closes the sheet.
 */
export function RailSheet({ onClose, label = 'Close' }: { onClose: () => void; label?: string }): null {
  useRailBack(onClose, label, true, true, true);
  return null;
}

/** Render inside a layer that keeps its own close (X) to cover the rail entries beneath it. */
export function RailCover({ pane = false, sheet = false }: { pane?: boolean; sheet?: boolean }): null {
  // Sheets leave the tab bar on screen (Figma "Home / Switch band").
  useRailCover(true, pane || sheet, !sheet);
  return null;
}

export interface RailActionOptions {
  label: string;
  icon: React.ReactNode;
  pane?: boolean;
  base?: boolean;
  prominent?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  badgeCount?: number;
}

/**
 * Hand a header action to the rail. Returns true when the rail took it, in
 * which case the caller must not render its own button.
 */
export function useRailAction(run: (() => void) | undefined, opts: RailActionOptions): boolean {
  const owns = useRailOwnsChrome();
  const present = useIsPresent();
  const runRef = useRef(run);
  const optsRef = useRef(opts);
  runRef.current = run;
  optsRef.current = opts;
  const idRef = useRef<number | null>(null);
  const active = owns && !!run && present;
  useEffect(() => {
    if (!active) return;
    // Register after every effect of this commit: the screen's own Back
    // (registered by a parent, whose effects run after its children's) must
    // not count as a layer above its actions.
    let entry: RailAction | null = null;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const o = optsRef.current;
      entry = {
        id: ++seq,
        label: o.label,
        icon: o.icon,
        pane: o.pane,
        base: o.base,
        prominent: o.prominent,
        destructive: o.destructive,
        disabled: o.disabled,
        badgeCount: o.badgeCount,
        run: () => runRef.current?.(),
      };
      idRef.current = entry.id;
      actions = [...actions, entry];
      emit();
    });
    return () => {
      cancelled = true;
      if (!entry) return;
      const id = entry.id;
      actions = actions.filter((a) => a.id !== id);
      idRef.current = null;
      emit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const { label, prominent, destructive, disabled, badgeCount } = opts;
  useEffect(() => {
    const id = idRef.current;
    if (id == null) return;
    actions = actions.map((a) =>
      a.id === id ? { ...a, label, icon: optsRef.current.icon, prominent, destructive, disabled, badgeCount } : a,
    );
    emit();
  }, [label, prominent, destructive, disabled, badgeCount]);
  return owns && !!run;
}

/**
 * A dark full-screen layer (Stage mode): while mounted the rail switches to
 * the dark glass and light icons so it reads on the black canvas.
 */
export function useRailTone(tone: 'dark' | null): void {
  useEffect(() => {
    if (!tone) return;
    const id = ++seq;
    tones = [...tones, { id, tone }];
    emit();
    return () => {
      tones = tones.filter((t) => t.id !== id);
      emit();
    };
  }, [tone]);
}

/**
 * Marks a header's trailing controls: on the Duo every IconButton inside
 * moves into the rail (see IconButton) instead of the screen's top bar.
 */
export const RailHeaderActionsContext = createContext<{ pane?: boolean; base?: boolean } | null>(null);

export function RailHeaderActions({
  pane,
  base,
  children,
}: {
  pane?: boolean;
  base?: boolean;
  children?: React.ReactNode;
}): React.ReactElement {
  return createElement(RailHeaderActionsContext.Provider, { value: { pane, base } }, children);
}

export function useRailHeaderSlot() {
  return useContext(RailHeaderActionsContext);
}

export type RailSearchConfig = Omit<RailSearch, 'id'>;

/**
 * Hand a screen's search to the rail. Returns true when the rail took it, in
 * which case the caller must not render its own search field or button.
 */
export function useRailSearch(config: RailSearchConfig | null): boolean {
  const owns = useRailOwnsChrome();
  const present = useIsPresent();
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const idRef = useRef<number | null>(null);
  const active = owns && !!config && present;

  useEffect(() => {
    if (!active || !cfgRef.current) return;
    const c = cfgRef.current;
    const entry: RailSearch = {
      id: ++seq,
      label: c.label,
      value: c.value,
      placeholder: c.placeholder,
      busy: c.busy,
      autoFocus: c.autoFocus,
      onChange: (v) => cfgRef.current?.onChange(v),
      onKeyDown: (e) => cfgRef.current?.onKeyDown?.(e),
      onActivate: c.onActivate ? () => cfgRef.current?.onActivate?.() : undefined,
      base: c.base,
    };
    idRef.current = entry.id;
    searches = [...searches, entry];
    emit();
    return () => {
      searches = searches.filter((s) => s.id !== entry.id);
      idRef.current = null;
      emit();
    };
  }, [active]);

  const value = config?.value ?? '';
  const placeholder = config?.placeholder;
  const busy = config?.busy;
  const label = config?.label ?? '';
  useEffect(() => {
    const id = idRef.current;
    if (id == null) return;
    const cur = searches.find((s) => s.id === id);
    if (!cur || (cur.value === value && cur.placeholder === placeholder && cur.busy === busy && cur.label === label)) return;
    searches = searches.map((s) => (s.id === id ? { ...s, value, placeholder, busy, label } : s));
    emit();
  }, [value, placeholder, busy, label, active]);

  return owns;
}
