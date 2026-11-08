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
          className="fixed inset-x-0 z-[120] flex justify-center items-center pointer-events-none px-4"
          style={{ top: 'calc(var(--safe-top, 12px) + 8px)' }}
        >
          <div
            className={`pointer-events-auto inline-flex items-center gap-2.5 px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.45)] text-[12px] font-bold tracking-wide border-2 transition-colors ${
              !isOnline
                ? 'bg-zinc-950 text-white border-amber-400'
                : 'bg-zinc-950 text-white border-emerald-400'
            }`}
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span className="text-white">Offline • Showing cached info</span>
                {pendingCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-zinc-950">
                    {pendingCount} pending
                  </span>
                )}
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-white">Back online • Synced</span>
                {pendingCount > 0 && onSyncNow && (
                  <button
                    onClick={onSyncNow}
                    className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
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
