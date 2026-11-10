import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/app/components/ui/utils';
import { ArrowUpRight, Copy, MapPin, Navigation } from '@/app/components/icons';
import { RailCover } from '@/lib/railActions';
import { haptic } from '@/lib/haptics';

/**
 * Tappable addresses → "Open in Maps" chooser (Apple Maps / Google Maps / Waze / Copy).
 *
 * The links are universal links, so on iOS/Android they open the installed app
 * (Capacitor hands external window.open URLs to the OS); otherwise the website.
 */

// ── Chooser store ───────────────────────────────────────────────

let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Open the maps chooser for an address / venue query. No-op for empty queries. */
export const openMaps = (query: string | null | undefined) => {
  const q = (query || '').trim();
  if (!q) return;
  current = q;
  emit();
};
const closeMaps = () => {
  current = null;
  emit();
};

export const mapsUrls = (query: string) => {
  const q = encodeURIComponent(query);
  return {
    apple: `https://maps.apple.com/?q=${q}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  };
};

const isAppleDevice = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

// ── Host (mount once near the app root) ─────────────────────────

const ChooserSheet: React.FC<{ query: string }> = ({ query }) => {
  const [copied, setCopied] = useState(false);
  const urls = mapsUrls(query);
  const go = (url: string) => {
    haptic.tap();
    window.open(url, '_blank', 'noopener,noreferrer');
    closeMaps();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(closeMaps, 700);
    } catch {
      closeMaps();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMaps();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options = [
    ...(isAppleDevice() ? [{ id: 'apple', label: 'Apple Maps', url: urls.apple }] : []),
    { id: 'google', label: 'Google Maps', url: urls.google },
    { id: 'waze', label: 'Waze', url: urls.waze },
    ...(!isAppleDevice() ? [{ id: 'apple', label: 'Apple Maps', url: urls.apple }] : []),
  ];

  return (
    <>
      <RailCover sheet />
      <motion.div
        key="maps-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeMaps}
        className="bw-rail-sheet fixed inset-0 z-[200] bg-black/60"
      />
      <motion.div
        key="maps-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Open in Maps"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 360 }}
        className="bw-rail-sheet fixed bottom-0 left-0 right-0 z-[201] bg-sheet text-sheet-foreground rounded-t-[32px] sm:rounded-[32px] px-5 pt-3 sm:max-w-lg sm:mx-auto sm:bottom-6 flex flex-col gap-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
      >
        <span className="mx-auto w-10 h-[5px] rounded-full bg-sheet-foreground/85" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="bw-label-sm text-sheet-foreground/70">Open in Maps</span>
          <span className="flex items-start gap-2 bw-label-md [overflow-wrap:anywhere]">
            <MapPin className="w-4 h-4 mt-[2px] shrink-0" aria-hidden />
            {query}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => go(o.url)}
              className="flex items-center justify-between gap-3 min-h-12 px-4 rounded-[16px] bg-sheet-foreground/[0.08] bw-label-md active:scale-[0.98] transition-transform"
            >
              <span className="flex items-center gap-2">
                <Navigation className="w-4 h-4" aria-hidden />
                {o.label}
              </span>
              <ArrowUpRight className="w-4 h-4" aria-hidden />
            </button>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={copy}
              className="flex items-center justify-center gap-2 min-h-12 rounded-full border border-sheet-foreground/25 bw-button-sm"
            >
              <Copy className="w-4 h-4" aria-hidden />
              {copied ? 'Copied' : 'Copy address'}
            </button>
            <button
              type="button"
              onClick={closeMaps}
              className="min-h-12 rounded-full bg-sheet-foreground text-sheet bw-button-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export const MapsChooserHost: React.FC = () => {
  const query = useSyncExternalStore(subscribe, () => current, () => null);
  if (typeof document === 'undefined') return null;
  return createPortal(<AnimatePresence>{query && <ChooserSheet key="maps" query={query} />}</AnimatePresence>, document.body);
};

// ── Inline link ─────────────────────────────────────────────────

interface MapsLinkProps {
  /** What to search in the maps app (venue + address). */
  query: string | null | undefined;
  children: React.ReactNode;
  className?: string;
  /** Show the small "MAP ↗" cue (default true). */
  cue?: boolean;
  /** Render the leading pin icon. */
  pin?: boolean;
}

/**
 * An address the user can tap to open Maps. Shows a pin + a small "MAP ↗" cue so
 * it reads as tappable; falls back to plain text when there's nothing to search.
 */
export const MapsLink: React.FC<MapsLinkProps> = ({ query, children, className, cue = true, pin = false }) => {
  const q = (query || '').trim();
  if (!q) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
        {pin && <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{children}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openMaps(q);
      }}
      aria-label={`Open ${q} in Maps`}
      title={`Open ${q} in Maps`}
      className={cn(
        'group inline-flex items-center gap-1.5 min-w-0 max-w-full text-left active:opacity-70',
        className,
      )}
    >
      {pin && <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />}
      <span className="truncate underline decoration-dotted decoration-1 underline-offset-[3px]">{children}</span>
      {cue && (
        <span className="inline-flex items-center gap-0.5 shrink-0 px-1.5 h-[18px] rounded-full border border-current/40 bw-label-xs opacity-80">
          MAP
          <ArrowUpRight className="w-2.5 h-2.5" aria-hidden />
        </span>
      )}
    </button>
  );
};
