import React, { useState, useEffect } from 'react';
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

  const changes = `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="offline-banner"
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
          className={cn(
            // Figma "State / Offline + toast" → Offline banner: full-width strip under the status bar.
            'fixed inset-x-0 top-0 z-[120] flex items-center gap-3 px-4 pb-3',
            !isOnline ? 'bg-warning text-warning-foreground' : 'bg-success text-success-foreground'
          )}
          style={{ paddingTop: 'calc(var(--safe-top, 0px) + 12px)' }}
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
