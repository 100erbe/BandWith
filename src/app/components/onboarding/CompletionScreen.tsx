import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { useOnboarding } from '@/lib/OnboardingContext';

interface CompletionScreenProps {
  onComplete: () => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  onComplete,
}) => {
  const { bandData, invites, songs, profileData } = useOnboarding();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Delay content reveal for dramatic effect
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className="min-h-screen bg-background flex flex-col relative overflow-hidden"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 30%, rgba(212, 251, 70, 0.15) 0%, transparent 50%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 relative z-10">
        {/* Success Check */}
        <motion.div
          className="mb-8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        >
          <div className="w-16 h-16 rounded-full border-2 border-accent flex items-center justify-center">
            <Check className="w-8 h-8 text-accent" strokeWidth={3} />
          </div>
        </motion.div>

        {/* Main Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1 className="text-[48px] font-black text-foreground leading-[1.05] tracking-tight mb-4">
            Ready<br />
            <span className="text-accent">to rock.</span>
          </h1>
        </motion.div>

        {/* Band Name */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <p className="text-muted-foreground/60 text-lg">
            {bandData?.name} is all set up.
          </p>
        </motion.div>

        {/* Stats - Editorial Style */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: showContent ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {/* Members */}
          <div className="flex items-baseline gap-4">
            <span className="text-[56px] font-black text-foreground leading-none">
              {invites.length || 1}
            </span>
            <span className="text-muted-foreground/60 text-lg">
              {(invites.length || 1) === 1 ? 'member' : 'members'}
            </span>
          </div>

          {/* Songs */}
          <div className="flex items-baseline gap-4">
            <span className="text-[56px] font-black text-foreground leading-none">
              {songs.length || '—'}
            </span>
            <span className="text-muted-foreground/60 text-lg">
              {songs.length === 1 ? 'song' : 'songs'} in repertoire
            </span>
          </div>
        </motion.div>

        {/* Profile Badge */}
        {profileData && (
          <motion.div
            className="mt-12 border-l-2 border-accent pl-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : -20 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
              Signed in as
            </span>
            <p className="text-foreground font-bold text-lg mt-1">
              {profileData.fullName}
            </p>
            <p className="text-muted-foreground/60 text-sm">
              {profileData.instruments?.join(' · ')}
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <motion.div
        className="px-6 pb-10 pt-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <motion.button
          onClick={onComplete}
          className="w-full h-14 rounded-full text-sm font-black uppercase tracking-[0.15em] bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          whileTap={{ scale: 0.98 }}
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
        </motion.button>
      </motion.div>
    </div>
  );
};

export default CompletionScreen;
