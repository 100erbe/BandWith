import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandMark, BrandWordmark } from '@/app/components/bw/BrandMark';

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
          <BrandMark size={88} animated title="" className="text-foreground" />

          <motion.div
            role="img"
            aria-label="BandWith"
            className="mt-8 flex text-foreground"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <BrandWordmark height={26} accent="var(--accent-ink)" />
          </motion.div>

          <motion.p
            className="mt-3 bw-label-sm text-muted-foreground"
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
