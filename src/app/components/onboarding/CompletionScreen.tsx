import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Check } from '@/app/components/icons';
import { useOnboarding } from '@/lib/OnboardingContext';
import { useAuth } from '@/lib/AuthContext';
import { AuthScreen, Kicker, PillButton } from '@/app/components/bw/Form';
import { Metric } from '@/app/components/bw/Metric';
import { setStatusBarTone } from '@/lib/systemBars';

interface CompletionScreenProps {
  onComplete: () => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  onComplete,
}) => {
  const { bandData, invites, songs, profileData } = useOnboarding();
  const { user } = useAuth();
  const [showContent, setShowContent] = useState(false);

  // Full-bleed dark surface → light status-bar icons in both themes.
  useEffect(() => setStatusBarTone('dark'), []);

  useEffect(() => {
    // Delay content reveal for dramatic effect
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // You plus everyone invited.
  const memberCount = invites.length + 1;
  const songCount = songs.length;
  // Meter = 4×12 dots; one dot per member / song.
  const METER_DOTS = 48;
  const signedInAs = user?.email || profileData?.fullName;

  return (
    // Full-bleed dark screen (Figma "Ready to rock"): scope the dark theme so
    // fg / dot / muted tokens resolve to their on-dark values.
    <AuthScreen
      className="dark bg-sheet text-foreground relative overflow-hidden"
      bodyClassName="pt-16 pb-8 gap-6"
      footer={
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <PillButton onClick={onComplete} trailingIcon={<ArrowUpRight className="w-5 h-5" />}>
            Go to dashboard
          </PillButton>
        </motion.div>
      }
    >
      {/* Lime progress pills: every step done */}
      <motion.div
        className="flex items-center gap-1"
        aria-hidden="true"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.span
            key={i}
            className="h-2.5 w-6 rounded-full bg-accent"
            variants={{ hidden: { opacity: 0, scaleX: 0 }, show: { opacity: 1, scaleX: 1 } }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          />
        ))}
      </motion.div>

      {/* Main Title */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 30 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Kicker title="Ready to rock." size="xl" />
      </motion.div>

      {/* Band Name */}
      <motion.p
        className="text-[18px] font-medium leading-[1.35] tracking-[-0.005em] text-muted-foreground"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        {bandData?.name ? `${bandData.name} is all set up.` : 'You’re all set up.'}
      </motion.p>

      {/* Stats */}
      <motion.div
        className="flex gap-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: showContent ? 1 : 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Metric
          className="flex-1"
          label={memberCount === 1 ? 'Member' : 'Members'}
          value={memberCount}
          fill={memberCount / METER_DOTS}
        />
        <Metric
          className="flex-1"
          label={songCount === 1 ? 'Song in repertoire' : 'Songs in repertoire'}
          value={songCount}
          fill={songCount / METER_DOTS}
        />
      </motion.div>

      {/* Signed-in chip */}
      {signedInAs && (
        <motion.div
          className="self-start max-w-full flex items-center gap-2 px-3 py-2 rounded-full bg-muted"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : -20 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Check className="w-3.5 h-3.5 shrink-0 text-accent" strokeWidth={2.5} />
          <p className="bw-label-sm text-foreground truncate">Signed in as {signedInAs}</p>
        </motion.div>
      )}
    </AuthScreen>
  );
};

export default CompletionScreen;
