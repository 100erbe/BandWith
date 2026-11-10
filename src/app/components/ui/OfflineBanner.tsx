import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, RefreshCw } from '@/app/components/icons';
import { cn } from './utils';

interface OfflineBannerProps {
  isOnline: boolean;
  wasOffline: boolean;
  pendingCount?: number;
  onSyncNow?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  wasOffline,
  pendingCount = 0,
  onSyncNow,
}) => {
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  const visible = !isOnline || showReconnected;
  const bannerRef = useRef<HTMLDivElement>(null);

  // While the banner shows, publish the height of its strip below the status
  // bar as --offline-h. theme.css adds it to --safe-top, so top bars and back
  // buttons step below the banner instead of sitting under it. The banner
  // itself pads by --safe-top-inset (the real status-bar inset), so it never
  // reacts to its own value.
  useEffect(() => {
    const root = document.documentElement;
    const el = bannerRef.current;
    if (!visible || !el) {
      root.style.removeProperty('--offline-h');
      return;
    }
    const measure = () => {
      const pt = parseFloat(getComputedStyle(el).paddingTop) || 0;
      // paddingTop = inset + 12px; keep the 12px and everything below it.
      const strip = Math.max(0, Math.round(el.offsetHeight - (pt - 12)));
      root.style.setProperty('--offline-h', `${strip}px`);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--offline-h');
    };
  }, [visible]);

  const changes = `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="offline-banner"
          ref={bannerRef}
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
          className={cn(
            // Figma "State / Offline + toast" → Offline banner: full-width strip under the status bar.
            // iPhone Duo open: only on the trailing page (bw-pane-trailing-bar).
            'bw-rail-clear bw-pane-trailing-bar fixed inset-x-0 top-0 z-[120] flex items-center gap-3 px-4 pb-3 bw-status-clear',
            !isOnline ? 'bg-warning text-warning-foreground' : 'bg-success text-success-foreground'
          )}
          style={{ paddingTop: 'calc(var(--safe-top-inset, 0px) + 12px)' }}
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-[18px] h-[18px] shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 truncate bw-label-sm">
                {pendingCount > 0 ? `You’re offline · ${changes} will sync` : 'You’re offline · showing cached info'}
              </span>
              <RefreshCw className="w-4 h-4 shrink-0" aria-hidden />
            </>
          ) : (
            <>
              <Wifi className="w-[18px] h-[18px] shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 truncate bw-label-sm">
                {pendingCount > 0 ? `Back online · ${changes} to sync` : 'Back online · synced'}
              </span>
              {pendingCount > 0 && onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  aria-label="Sync now"
                  className="relative -m-2 p-2 shrink-0 rounded-full active:scale-[var(--press-scale,0.97)] transition-transform"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden />
                </button>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
