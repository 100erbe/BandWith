import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from '@/app/components/ui/BrandLogo';

interface AnimatedSplashProps {
  onComplete: () => void;
  duration?: number;
}

export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({
  onComplete,
  duration = 1800,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <BrandLogo variant="waveform" lockup="icon-only" className="w-20 h-20" />
          </motion.div>

          <motion.div
            className="mt-8 flex items-baseline"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <BrandLogo variant="waveform" lockup="wordmark-only" textClassName="text-[34px] font-black" />
          </motion.div>

          <motion.p
            className="mt-3 text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            Band management, simplified
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedSplash;
