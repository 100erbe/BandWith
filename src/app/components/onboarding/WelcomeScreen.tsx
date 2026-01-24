import React from 'react';
import { motion } from 'motion/react';
import { Guitar, Ticket, ArrowRight, Music2 } from 'lucide-react';
import { OnboardingPath } from '@/lib/OnboardingContext';

interface WelcomeScreenProps {
  onSelectPath: (path: OnboardingPath) => void;
  onSignIn: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectPath,
  onSignIn,
}) => {
  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-15"
          style={{
            background:
              'radial-gradient(circle, rgba(212, 251, 70, 0.4) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, rgba(0, 71, 255, 0.5) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 relative z-10">
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="w-24 h-24 rounded-[2rem] bg-[#D4FB46] flex items-center justify-center mb-6"
            style={{
              boxShadow: '0 12px 48px rgba(212, 251, 70, 0.4)',
            }}
          >
            <Music2 className="w-12 h-12 text-black" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Band<span className="text-[#D4FB46]">With</span>
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <h2 className="text-[28px] font-bold text-white leading-tight mb-3">
            Manage your band
            <br />
            like a pro
          </h2>
          <p className="text-zinc-500 text-[15px] leading-relaxed max-w-[280px] mx-auto">
            The all-in-one app for gigs, setlists, and team coordination.
          </p>
        </motion.div>

        {/* Path Selection */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          {/* Start My Band */}
          <motion.button
            onClick={() => onSelectPath('creator')}
            className="w-full relative overflow-hidden rounded-[1.5rem] p-6 text-left group"
            style={{
              background: 'linear-gradient(135deg, #D4FB46 0%, #B8E040 100%)',
              boxShadow: '0 8px 32px rgba(212, 251, 70, 0.3)',
            }}
            whileHover={{ scale: 0.98 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-black/10 flex items-center justify-center">
                <Guitar className="w-7 h-7 text-black" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-black">Start My Band</h3>
                <p className="text-sm text-black/60">Create a new band</p>
              </div>
              <ArrowRight className="w-6 h-6 text-black/40 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>

          {/* Join a Band */}
          <motion.button
            onClick={() => onSelectPath('joiner')}
            className="w-full relative overflow-hidden rounded-[1.5rem] p-6 text-left group bg-[#1C1C1E] border border-white/5"
            whileHover={{ scale: 0.98, borderColor: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                <Ticket className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Join a Band</h3>
                <p className="text-sm text-zinc-500">I have an invite</p>
              </div>
              <ArrowRight className="w-6 h-6 text-white/30 group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="px-6 pb-10 pt-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-zinc-600 text-[15px]">
          Already have an account?{' '}
          <button
            onClick={onSignIn}
            className="text-[#D4FB46] font-semibold hover:underline"
          >
            Sign In
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default WelcomeScreen;
