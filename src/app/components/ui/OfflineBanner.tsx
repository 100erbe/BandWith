import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi, RefreshCw } from '@/app/components/icons';

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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed top-3 inset-x-0 z-[120] flex justify-center items-center pointer-events-none px-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div
            className={`pointer-events-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md text-[12px] font-semibold tracking-wide border transition-colors ${
              !isOnline
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-200 dark:text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200 dark:text-emerald-300'
            }`}
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span>Offline • Showing cached info</span>
                {pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-200">
                    {pendingCount} pending upload{pendingCount > 1 ? 's' : ''}
                  </span>
                )}
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Back online • Synced</span>
                {pendingCount > 0 && onSyncNow && (
                  <button
                    onClick={onSyncNow}
                    className="ml-1 inline-flex items-center gap-1 text-[11px] underline opacity-90 hover:opacity-100"
                  >
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Sync now
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
