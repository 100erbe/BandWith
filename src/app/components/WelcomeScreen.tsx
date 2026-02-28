import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface WelcomeScreenProps {
  onComplete: () => void;
  minDisplayTime?: number;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  onComplete, 
  minDisplayTime = 2000 
}) => {
  const [phase, setPhase] = useState<'logo' | 'text' | 'exit'>('logo');
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Phase 1: Logo appears (already visible)
    const textTimer = setTimeout(() => {
      setPhase('text');
    }, 600);

    // Phase 2: Start exit after min display time
    const exitTimer = setTimeout(() => {
      setPhase('exit');
      setIsExiting(true);
    }, minDisplayTime);

    // Phase 3: Complete after exit animation
    const completeTimer = setTimeout(() => {
      onComplete();
    }, minDisplayTime + 800);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, minDisplayTime]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-[#0A0A0A] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Background gradient effects */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
          >
            {/* Subtle gradient orbs */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#D4FB46] rounded-full blur-[120px] opacity-10" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#0047FF] rounded-full blur-[150px] opacity-15" />
          </motion.div>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo Mark - Animated */}
            <motion.div
              className="relative mb-10"
              initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                duration: 0.9, 
                ease: [0.2, 0.8, 0.2, 1],
                delay: 0.1
              }}
            >
              {/* Glow ring */}
              <motion.div
                className="absolute -inset-6 rounded-3xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{
                  background: 'radial-gradient(circle, rgba(212,251,70,0.3) 0%, transparent 70%)'
                }}
              />
              
              {/* Logo container with premium styling */}
              <div 
                className="relative w-20 h-20 rounded-[1.5rem] flex items-center justify-center overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #D4FB46 0%, #A8D435 100%)',
                  boxShadow: '0 25px 50px -12px rgba(212, 251, 70, 0.35), 0 10px 25px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
                }}
              >
                {/* Inner subtle border */}
                <div 
                  className="absolute inset-[2px] rounded-[1.35rem] opacity-30"
                  style={{
                    background: 'linear-gradient(145deg, transparent 0%, rgba(255,255,255,0.4) 100%)'
                  }}
                />
                
                {/* BW Monogram with typography treatment */}
                <span 
                  className="relative text-[1.75rem] font-black text-[#0A0A0A] tracking-[-0.05em]"
                  style={{ 
                    fontFamily: 'Inter, SF Pro Display, -apple-system, system-ui, sans-serif',
                    letterSpacing: '-0.02em'
                  }}
                >
                  BW
                </span>
              </div>
            </motion.div>

            {/* Brand Name - Staggered reveal */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase !== 'logo' ? 1 : 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Main title with letter stagger */}
              <div className="overflow-hidden">
                <motion.h1
                  className="text-4xl font-black text-white tracking-tight"
                  initial={{ y: 40 }}
                  animate={{ y: phase !== 'logo' ? 0 : 40 }}
                  transition={{ 
                    duration: 0.6, 
                    ease: [0.4, 0, 0.2, 1] 
                  }}
                >
                  BANDWITH
                </motion.h1>
              </div>

              {/* Tagline */}
              <div className="overflow-hidden mt-2">
                <motion.p
                  className="text-xs font-bold tracking-[0.3em] text-white/40 uppercase"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ 
                    y: phase !== 'logo' ? 0 : 20,
                    opacity: phase !== 'logo' ? 1 : 0
                  }}
                  transition={{ 
                    duration: 0.5, 
                    delay: 0.2,
                    ease: [0.4, 0, 0.2, 1] 
                  }}
                >
                  Band Management
                </motion.p>
              </div>
            </motion.div>

          </div>

          {/* Minimal loading dots - bottom center */}
          <motion.div
            className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1 h-1 rounded-full bg-white/20"
                animate={{
                  backgroundColor: ['rgba(255,255,255,0.2)', 'rgba(212,251,70,0.8)', 'rgba(255,255,255,0.2)'],
                  scale: [1, 1.3, 1]
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeScreen;
