import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Users, Music, MapPin, Sparkles, Check } from 'lucide-react';
import { useOnboarding } from '@/lib/OnboardingContext';

interface CompletionScreenProps {
  onComplete: () => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  onComplete,
}) => {
  const { bandData, invites, songs, profileData } = useOnboarding();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Hide confetti after animation
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const stats = [
    {
      icon: Users,
      value: invites.length,
      label: invites.length === 1 ? 'member invited' : 'members invited',
      color: '#0047FF',
    },
    {
      icon: Music,
      value: songs.length,
      label: songs.length === 1 ? 'song in repertoire' : 'songs in repertoire',
      color: '#D4FB46',
    },
    {
      icon: MapPin,
      value: '—',
      label: 'Location',
      color: '#998878',
    },
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle, rgba(212, 251, 70, 0.4) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                background: ['#D4FB46', '#0047FF', '#FF4F28', '#998878', '#FFFFFF'][
                  i % 5
                ],
                left: `${Math.random() * 100}%`,
                top: '-20px',
              }}
              initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
              animate={{
                y: window.innerHeight + 100,
                x: (Math.random() - 0.5) * 200,
                rotate: Math.random() * 720,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        {/* Celebration Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            damping: 12,
            stiffness: 200,
            delay: 0.2,
          }}
          className="mb-8"
        >
          <div
            className="w-28 h-28 rounded-[2.5rem] bg-[#D4FB46] flex items-center justify-center"
            style={{
              boxShadow: '0 16px 64px rgba(212, 251, 70, 0.5)',
            }}
          >
            <Sparkles className="w-14 h-14 text-black" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-[36px] font-black text-white leading-tight mb-2">
            You're all set!
          </h1>
          <p className="text-zinc-400 text-[18px]">
            "{bandData?.name}" is ready to rock.
          </p>
        </motion.div>

        {/* Stats Card */}
        <motion.div
          className="w-full max-w-sm bg-[#1C1C1E] rounded-[2rem] p-6 border border-white/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="space-y-4">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}20` }}
                >
                  <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-white font-bold text-[20px]">
                    {stat.value}
                  </p>
                  <p className="text-zinc-500 text-[13px]">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Member Preview */}
        {profileData && (
          <motion.div
            className="mt-6 flex items-center gap-3 bg-[#D4FB46]/10 border border-[#D4FB46]/20 rounded-2xl px-4 py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <div className="w-10 h-10 rounded-full bg-[#D4FB46] flex items-center justify-center">
              <Check className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-white font-medium text-[14px]">
                {profileData.fullName}
              </p>
              <p className="text-[#D4FB46] text-[12px]">
                Band Admin • {profileData.instruments?.join(', ')}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <motion.div
        className="px-6 pb-10 pt-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <motion.button
          onClick={onComplete}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#D4FB46] text-black font-bold text-[16px]"
          style={{
            boxShadow: '0 4px 20px rgba(212, 251, 70, 0.3)',
          }}
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
        >
          Go to Dashboard
          <ArrowRight className="w-5 h-5" strokeWidth={2} />
        </motion.button>
      </motion.div>
    </div>
  );
};

export default CompletionScreen;
