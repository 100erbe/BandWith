import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { OnboardingPath } from '@/lib/OnboardingContext';

interface WelcomeScreenProps {
  onSelectPath: (path: OnboardingPath) => void;
  onSignIn: () => void;
}

const STATEMENTS = [
  { word: 'Gigs', suffix: 'tracked' },
  { word: 'Quotes', suffix: 'automated' },
  { word: 'Setlists', suffix: 'organized' },
  { word: 'Team', suffix: 'synced' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectPath,
  onSignIn,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STATEMENTS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-10 pb-6 relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src="/brand/Logo - full text White.png"
            alt="BANDWITH"
            className="h-6"
          />
        </motion.div>

        {/* Main editorial area */}
        <div className="flex-1 flex flex-col justify-center -mt-10">
          {/* Animated words */}
          <motion.div
            className="mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="overflow-hidden h-[64px] mb-1">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeIndex}
                  className="block text-[56px] font-black text-[#D5FB46] leading-none tracking-tight uppercase"
                  initial={{ y: 64, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -64, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                >
                  {STATEMENTS[activeIndex].word}
                </motion.span>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              <motion.span
                key={activeIndex}
                className="text-[56px] font-black text-white/15 leading-none tracking-tight uppercase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {STATEMENTS[activeIndex].suffix}
              </motion.span>
            </AnimatePresence>
          </motion.div>

          {/* Progress dots */}
          <motion.div
            className="flex gap-1.5 mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {STATEMENTS.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className="group"
              >
                <div
                  className={`h-[3px] rounded-full transition-all duration-500 ${
                    index === activeIndex
                      ? 'w-7 bg-[#D5FB46]'
                      : 'w-[6px] bg-white/15 group-hover:bg-white/30'
                  }`}
                />
              </button>
            ))}
          </motion.div>

          {/* Tagline */}
          <motion.p
            className="text-white/35 text-[15px] font-semibold leading-relaxed max-w-[260px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Everything your band needs.
            <br />
            Nothing it doesn't.
          </motion.p>
        </div>

        {/* CTA Section */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          {/* Primary CTA */}
          <button
            onClick={() => onSelectPath('creator')}
            className="w-full h-14 rounded-full text-[13px] font-black uppercase tracking-[0.15em] bg-[#D5FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            Get Started
            <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
          </button>

          {/* Secondary CTA */}
          <button
            onClick={() => onSelectPath('joiner')}
            className="w-full h-14 rounded-full text-[13px] font-bold uppercase tracking-[0.1em] text-white/35 hover:text-white/60 hover:bg-white/5 active:scale-[0.98] transition-all flex items-center justify-center border border-white/10"
          >
            I have an invite code
          </button>

          {/* Sign in link */}
          <div className="text-center pt-3">
            <button
              onClick={onSignIn}
              className="text-white/25 text-[13px] font-semibold hover:text-white/50 transition-colors"
            >
              Already a member?{' '}
              <span className="text-white/40 underline underline-offset-4 decoration-white/20">
                Sign in
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
