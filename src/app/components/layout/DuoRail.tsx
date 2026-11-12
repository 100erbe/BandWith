import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Search,
  X,
  Loader2,
  IconPlus,
  type IconProps,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';
import { useAuth } from '@/lib/AuthContext';
import { useRailHost, useRailSnapshot } from '@/lib/railActions';
import { useRailLayout } from '@/lib/deviceRegions';
import { usePosture } from '@/lib/posture';
import { KEYBOARD_EVENT, isKeyboardOpen } from '@/lib/keyboardInsets';
import { useT } from '@/lib/i18n';

/* ─────────────────────────────────────────────────────────────────────────
 * iPhone Duo side rail, 1:1 with Figma "11 · Foldables":
 *   Duo/Side Tab Bar   – glass, 48 wide (Apple's Duo bar width), r24,
 *                        padding 12, gap 14: Home · Calendar · Create (40) · Chat
 *   Duo/Side Actions   – glass, 8pt below: Back · the screen's actions
 *                        (close, new, stage…) · Search · profile (40)
 *   Duo/Rail Search Field – glass 52pt pill, 8pt left of the rail,
 *                        centred on the Search button.
 * Both containers sit in the system column under the clock and battery and
 * are centred together in the space left below it. Nothing of the app's
 * chrome stays in the screen's top bar.
 *
 * The rail follows the column: on the right normally, on the left when the
 * column is on the leading edge (Split View, left window). In Laptop pose it
 * moves down onto the Deck (the flat bottom half), below the fold.
 * ───────────────────────────────────────────────────────────────────────── */

export interface RailTab {
  key: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  isActive: boolean;
  onClick: () => void;
  badgeCount?: number;
}

interface DuoRailProps {
  tabs: RailTab[];
  isPlusMenuOpen: boolean;
  onPlus: () => void;
  isProfileOpen: boolean;
  onProfile: () => void;
  /** A create/edit flow is open: the profile stays visible but inactive. */
  profileLocked?: boolean;
  /** Tab bar visibility (hidden while a full-screen layer is open). */
  showTabs: boolean;
}

/** 24pt icon over a 4pt dot, 32pt tall (Figma tab cell). */
const Cell: React.FC<{
  label: string;
  onClick: () => void;
  dot?: boolean;
  active?: boolean;
  badgeCount?: number;
  buttonRef?: React.Ref<HTMLButtonElement>;
  expanded?: boolean;
  /** Keep focus where it is (the Search button must not blur its own field). */
  keepFocus?: boolean;
  tone?: 'destructive';
  children: React.ReactNode;
}> = ({ label, onClick, dot = false, active = true, badgeCount, buttonRef, expanded, keepFocus, tone, children }) => (
  <button
    ref={buttonRef}
    type="button"
    onClick={onClick}
    onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
    aria-label={label}
    title={label}
    aria-current={dot && active ? 'page' : undefined}
    aria-expanded={expanded}
    className={cn(
      'relative w-11 h-8 shrink-0 flex flex-col items-center gap-1 outline-none cursor-pointer',
      "after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']",
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground rounded-[12px]',
      tone === 'destructive' ? 'text-destructive' : active ? 'text-foreground' : 'text-foreground/55',
    )}
  >
    <span className="relative w-6 h-6 flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6">
      {children}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive-solid text-white text-[9px] font-bold flex items-center justify-center leading-none pointer-events-none">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </span>
    <span aria-hidden="true" className="w-1 h-1 rounded-full bg-accent transition-opacity duration-150" style={{ opacity: dot ? 1 : 0 }} />
  </button>
);

const motionFrom = (edge: 'left' | 'right') => {
  const off = edge === 'left' ? -96 : 96;
  return {
    initial: { x: off, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: off, opacity: 0 },
    transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] as const },
  };
};

/** Laptop pose: the bar groups rise from the Deck's bottom edge. */
const deckMotion = {
  initial: { y: 24, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 24, opacity: 0 },
  transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] as const },
};

export const DuoRail: React.FC<DuoRailProps> = ({ tabs, isPlusMenuOpen, onPlus, isProfileOpen, onProfile, profileLocked = false, showTabs }) => {
  useRailHost();
  const t = useT();
  const { actions, back, search, fullScreen, tone } = useRailSnapshot();
  const { railEdge } = useRailLayout();
  const onLeft = railEdge === 'left';
  // Laptop pose: navigation lives on the Deck, never across the fold.
  const onDeck = usePosture().posture === 'tabletop';
  const containerMotion = onDeck ? deckMotion : motionFrom(railEdge);
  // Tabs show on the main screens, sheets and the profile, not over full-screen layers.
  const tabsVisible = showTabs && !fullScreen;
  const { profile } = useAuth();
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldTop, setFieldTop] = useState(0);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = (() => {
    const name = profile?.full_name?.trim();
    if (name) {
      const parts = name.split(/\s+/);
      return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
    }
    return (profile?.email?.slice(0, 2) || 'ME').toUpperCase();
  })();

  // A newly active search opens its field when it asks to (e.g. "Search events");
  // otherwise a change of screen closes it.
  const searchId = search?.id ?? null;
  useEffect(() => {
    setFieldOpen(!!search?.autoFocus && !search?.onActivate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId]);
  // A new layer on top (Back changes) also closes the field.
  const backId = back?.id ?? null;
  useEffect(() => {
    setFieldOpen((open) => (open && search?.autoFocus ? open : false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backId]);

  // Centre the field on the Search button. While the keyboard is up the web
  // view ends at the keyboard and the rail group may scroll the button out of
  // view, so the field sits just above the keyboard instead, where the person
  // is typing.
  useLayoutEffect(() => {
    if (!fieldOpen) return;
    const place = () => {
      const bottom = window.innerHeight - 52 - 12;
      if (isKeyboardOpen()) {
        setFieldTop(Math.max(12, bottom));
        return;
      }
      const r = searchBtnRef.current?.getBoundingClientRect();
      if (r) setFieldTop(Math.max(12, Math.min(bottom, Math.round(r.top + 12 - 26))));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('bwlayout', place);
    window.addEventListener(KEYBOARD_EVENT, place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('bwlayout', place);
      window.removeEventListener(KEYBOARD_EVENT, place);
    };
  }, [fieldOpen, tabsVisible, !!back, onDeck, railEdge]);

  // The keyboard going away (tap outside, swipe, Android Back) ends the search
  // entry: iOS keeps the input focused after Keyboard.hide(), so without this
  // the field stayed floating over the content. The query stays applied and
  // the Search button keeps its dot; a tap reopens the field.
  useEffect(() => {
    if (!fieldOpen) return;
    const onKeyboard = (e: Event) => {
      if ((e as CustomEvent<{ open: boolean }>).detail?.open) return;
      setFieldOpen(false);
      inputRef.current?.blur();
    };
    window.addEventListener(KEYBOARD_EVENT, onKeyboard);
    return () => window.removeEventListener(KEYBOARD_EVENT, onKeyboard);
  }, [fieldOpen]);

  useEffect(() => {
    if (fieldOpen) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [fieldOpen]);

  const fieldVisible = fieldOpen && !!search && !search.onActivate;

  const onSearchTap = () => {
    if (!search) return;
    haptic.tap();
    if (fieldVisible) {
      setFieldOpen(false);
      inputRef.current?.blur();
      return;
    }
    // Focus now, inside the tap, so iOS shows the keyboard. "Search events"
    // swaps in its field entry on the next render and keeps this focus.
    inputRef.current?.focus({ preventScroll: true });
    if (search.onActivate) search.onActivate();
    else setFieldOpen(true);
  };

  return (
    <>
      <div
        // Dark layers (Stage mode) get the dark-theme tokens: dark glass, light icons.
        // Scrolls (scrollbar hidden) when the keyboard shrinks the viewport
        // below the rail group, so the bottom actions stay reachable; safe
        // centring keeps the top reachable too once it overflows.
        className={cn(
          'fixed z-[190] flex items-center gap-2 pointer-events-none',
          onDeck
            ? 'flex-row justify-center-safe overflow-x-auto overflow-y-hidden'
            : 'flex-col justify-center-safe overflow-y-auto overflow-x-hidden',
          'overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          tone === 'dark' && 'dark',
        )}
        // Figma "Duo" frames centre the rail group 20pt below the display's
        // middle (y 359 of 678 closed, 355 of 669 open), clear of the clock.
        // On the Deck the group centres in the bottom half instead.
        // Laptop pose (Figma "Duo · 11 Laptop pose"): the bar lies along the
        // Deck's bottom edge, closest to the hands, never across the fold.
        style={
          onDeck
            ? {
                left: 0,
                right: 0,
                bottom: 0,
                paddingInline: 12,
                paddingBottom: 'max(12px, calc(var(--safe-bottom, 0px) - 4px))',
              }
            : {
                top: 0,
                bottom: 0,
                paddingTop: 40,
                width: 'var(--bw-rail-w)',
                ...(onLeft ? { left: 0 } : { right: 0 }),
              }
        }
        // Any other rail button closes the search field.
        onPointerDownCapture={(e) => {
          if (fieldOpen && !searchBtnRef.current?.contains(e.target as Node)) setFieldOpen(false);
        }}
      >
        {/* Equal spacers keep the group centred as in Figma; their minimum heights
            (deviceRegions) step it away from the clock / camera block, top or
            bottom, only when the two would meet. */}
        {!onDeck && <span aria-hidden style={{ flex: '1 1 0', minHeight: 'var(--bw-rail-clear-top, 0px)' }} />}
        <AnimatePresence initial={false}>
          {tabsVisible && (
            <motion.nav
              key="tabs"
              aria-label={t('Main')}
              {...containerMotion}
              className={cn('bw-glass pointer-events-auto shrink-0 rounded-[24px] flex items-center gap-[14px]', onDeck ? 'h-12 px-3 flex-row' : 'w-12 py-3 flex-col')}
            >
              {tabs.slice(0, 2).map((tab) => (
                <Cell key={tab.key} label={tab.label} onClick={tab.onClick} dot={tab.isActive} active={tab.isActive} badgeCount={tab.badgeCount}>
                  <tab.icon color="currentColor" size={24} strokeWidth={tab.isActive ? 2.2 : 2} />
                </Cell>
              ))}
              <motion.button
                type="button"
                aria-label={isPlusMenuOpen ? t('Close create menu') : t('Create')}
                aria-expanded={isPlusMenuOpen}
                onClick={onPlus}
                whileTap={{ scale: 0.94 }}
                // Figma "Home / Create menu": the button stays lime with + while
                // the sheet (which has its own close) is open.
                className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center cursor-pointer bg-accent text-accent-foreground"
              >
                <IconPlus size={24} color="currentColor" strokeWidth={2.4} />
              </motion.button>
              {tabs.slice(2).map((tab) => (
                <Cell key={tab.key} label={tab.label} onClick={tab.onClick} dot={tab.isActive} active={tab.isActive} badgeCount={tab.badgeCount}>
                  <tab.icon color="currentColor" size={24} strokeWidth={tab.isActive ? 2.2 : 2} />
                </Cell>
              ))}
            </motion.nav>
          )}
          {/* Duo/Side Actions is always on screen: the profile stays reachable. */}
          <motion.div
            key="actions"
            role="toolbar"
            aria-label={t('Screen actions, search and profile')}
            {...containerMotion}
            className={cn('bw-glass pointer-events-auto shrink-0 rounded-[24px] flex items-center gap-[14px]', onDeck ? 'h-12 px-3 flex-row' : 'w-12 py-3 flex-col')}
          >
            {back && (
              <Cell label={back.label} onClick={() => { haptic.tap(); back.run(); }}>
                <ArrowLeft />
              </Cell>
            )}
            {/* Closes and the like first, the screen's primary action last
                (Apple's Duo toolbar order; Figma "Duo/Side Actions" slots). */}
            {[...actions.filter((x) => !x.prominent), ...actions.filter((x) => x.prominent)].map((a) =>
              a.prominent ? (
                <motion.button
                  key={a.id}
                  type="button"
                  aria-label={a.label}
                  title={a.label}
                  disabled={a.disabled}
                  onClick={() => { haptic.tap(); a.run(); }}
                  whileTap={{ scale: 0.94 }}
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center cursor-pointer bg-surface-inverse text-surface-inverse-foreground disabled:opacity-40 [&_svg]:w-5 [&_svg]:h-5"
                >
                  {a.icon}
                </motion.button>
              ) : (
                <Cell
                  key={a.id}
                  label={a.label}
                  onClick={() => { if (a.disabled) return; haptic.tap(); a.run(); }}
                  badgeCount={a.badgeCount}
                  active={!a.disabled}
                  tone={a.destructive ? 'destructive' : undefined}
                >
                  {a.icon}
                </Cell>
              ),
            )}
            {search && (
              <Cell
                label={search.label}
                onClick={onSearchTap}
                dot={!!search.value}
                buttonRef={searchBtnRef}
                keepFocus={fieldOpen}
                expanded={search.onActivate ? undefined : fieldOpen}
              >
                <Search />
              </Cell>
            )}
            <button
              type="button"
              onClick={() => { haptic.tap(); onProfile(); }}
              disabled={profileLocked}
              aria-label={isProfileOpen ? t('Close profile') : t('Open profile')}
              aria-expanded={isProfileOpen}
              className={cn(
                'w-10 h-10 shrink-0 rounded-full overflow-hidden bg-white border-[1.5px] border-border text-black bw-h3 flex items-center justify-center cursor-pointer',
                'disabled:opacity-40 disabled:cursor-default transition-opacity',
                'outline-2 outline-offset-0 transition-[outline-color]',
                isProfileOpen ? 'outline outline-accent' : 'outline-none',
              )}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover pointer-events-none select-none" />
              ) : (
                initials
              )}
            </button>
          </motion.div>
        </AnimatePresence>
        {!onDeck && <span aria-hidden style={{ flex: '1 1 0', minHeight: 'var(--bw-rail-clear-bottom, 0px)' }} />}
      </div>

      {/* Duo/Rail Search Field. Always mounted so the Search tap can focus it
          inside the same gesture (iOS only opens the keyboard that way). */}
      <motion.label
        aria-hidden={!fieldVisible}
        initial={false}
        animate={fieldVisible ? { opacity: 1, x: 0, y: 0, scaleX: 1 } : onDeck ? { opacity: 0, x: 0, y: 16, scaleX: 1 } : { opacity: 0, x: onLeft ? -24 : 24, y: 0, scaleX: 0.92 }}
        transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          tone === 'dark' && 'dark',
          'bw-glass fixed z-[191] h-[52px] rounded-full px-4 flex items-center gap-3 text-foreground',
          onLeft ? 'origin-left' : 'origin-right',
          !fieldVisible && 'pointer-events-none',
        )}
        style={onDeck ? {
          // Above the Deck's bottom bar, across the Deck.
          bottom: 'calc(max(12px, calc(var(--safe-bottom, 0px) - 4px)) + 56px)',
          left: 12,
          right: 12,
        } : {
          top: fieldTop,
          ...(onLeft
            ? { left: 'calc(var(--bw-rail-w) / 2 + 24px + 8px)' }
            : { right: 'calc(var(--bw-rail-w) / 2 + 24px + 8px)' }),
          width: 'min(399px, calc(100vw - var(--bw-rail-w) - 36px))',
        }}
      >
        <span className="sr-only">{search?.label}</span>
        {search?.busy ? (
          <Loader2 className="w-5 h-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="w-5 h-5 shrink-0" aria-hidden />
        )}
        <input
          ref={inputRef}
          type="search"
          tabIndex={fieldVisible ? 0 : -1}
          value={search?.value ?? ''}
          placeholder={search?.placeholder}
          onChange={(e) => search?.onChange(e.target.value)}
          onKeyDown={(e) => {
            search?.onKeyDown?.(e);
            if (e.key === 'Escape' || e.key === 'Enter') {
              setFieldOpen(false);
              inputRef.current?.blur();
            }
          }}
          onBlur={() => setFieldOpen(false)}
          enterKeyHint="search"
          className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg placeholder:text-muted-foreground/60 [&::-webkit-search-cancel-button]:hidden"
        />
        {fieldVisible && search?.value && (
          <button
            type="button"
            // Keep focus in the field so clearing doesn't close it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              search.onChange('');
              inputRef.current?.focus({ preventScroll: true });
            }}
            aria-label={t('Clear search')}
            className="-m-2 p-2 shrink-0 text-muted-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.label>
    </>
  );
};

export default DuoRail;
