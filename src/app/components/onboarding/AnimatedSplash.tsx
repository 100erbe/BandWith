import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
          className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          <motion.img
            src="/brand/app-icon.png"
            alt=""
            className="w-20 h-20 rounded-[1.25rem]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />

          <motion.div
            className="mt-8 flex items-baseline"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              className="text-[32px] font-black tracking-[-0.02em] leading-none text-white"
              style={{ fontFamily: 'var(--font-display), sans-serif' }}
            >
              BAND
            </span>
            <span
              className="text-[32px] font-black tracking-[-0.02em] leading-none text-[#D5FB46]"
              style={{ fontFamily: 'var(--font-display), sans-serif' }}
            >
              WITH
            </span>
          </motion.div>

          <motion.p
            className="mt-3 text-[11px] font-medium tracking-[0.2em] uppercase text-white/25"
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
