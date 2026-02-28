import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Calendar, Sparkles, Star } from 'lucide-react';
import { useOnboarding } from '@/lib/OnboardingContext';

interface JoinerWelcomeBandProps {
  inviteData: any;
  onComplete: () => void;
}

export const JoinerWelcomeBand: React.FC<JoinerWelcomeBandProps> = ({
  inviteData,
  onComplete,
}) => {
  const { profileData } = useOnboarding();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const bandName = inviteData?.band?.name || 'Your Band';
  const bandLogo = inviteData?.band?.logo_url;

  // Mock bandmates (would come from API)
  const bandmates = [
    {
      id: 1,
      name:
        inviteData?.inviter?.full_name ||
        inviteData?.inviter?.email?.split('@')[0] ||
        'Admin',
      role: 'Admin, Guitar',
      isAdmin: true,
    },
    { id: 2, name: 'Andrea', role: 'Drums', isAdmin: false },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div 
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle, rgba(0, 71, 255, 0.4) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(40)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                background: ['#D4FB46', '#0047FF', '#FF4F28', '#998878'][i % 4],
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
            className="w-28 h-28 rounded-[2.5rem] bg-[#0047FF] flex items-center justify-center"
            style={{
              boxShadow: '0 16px 64px rgba(0, 71, 255, 0.5)',
            }}
          >
            <Sparkles className="w-14 h-14 text-white" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-[32px] font-black text-white leading-tight mb-2">
            Welcome to
          </h1>
          <p className="text-[#D4FB46] text-[28px] font-black">"{bandName}"!</p>
        </motion.div>

        {/* Bandmates Card */}
        <motion.div
          className="w-full max-w-sm bg-[#1C1C1E] rounded-[2rem] p-6 border border-white/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-zinc-500 text-[12px] font-medium mb-4 uppercase">
            Your Bandmates
          </p>

          <div className="space-y-3">
            {bandmates.map((member, index) => (
              <motion.div
                key={member.id}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <div className="w-11 h-11 rounded-full bg-[#0047FF]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#0047FF] font-bold text-[14px]">
                    {getInitials(member.name)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-[14px] flex items-center gap-2">
                    {member.name}
                    {member.isAdmin && (
                      <span className="px-2 py-0.5 rounded-full bg-[#D4FB46]/20 text-[#D4FB46] text-[10px] font-bold">
                        Admin
                      </span>
                    )}
                  </p>
                  <p className="text-zinc-500 text-[12px]">{member.role}</p>
                </div>
              </motion.div>
            ))}

            {/* You (new member) */}
            <motion.div
              className="flex items-center gap-3 bg-[#D4FB46]/10 rounded-xl p-2 -mx-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
            >
              <div className="w-11 h-11 rounded-full bg-[#D4FB46] flex items-center justify-center flex-shrink-0">
                <span className="text-black font-bold text-[14px]">
                  {getInitials(profileData?.fullName || 'You')}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-[14px] flex items-center gap-2">
                  {profileData?.fullName || 'You'}
                  <span className="px-2 py-0.5 rounded-full bg-[#D4FB46] text-black text-[10px] font-bold flex items-center gap-1">
                    <Star className="w-3 h-3" /> NEW
                  </span>
                </p>
                <p className="text-zinc-500 text-[12px]">
                  {profileData?.instruments?.join(', ') || 'Musician'}
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Upcoming Events Card */}
        <motion.div
          className="w-full max-w-sm mt-4 bg-[#1C1C1E] rounded-2xl p-5 border border-white/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <p className="text-zinc-500 text-[12px] font-medium mb-3 uppercase">
            Upcoming
          </p>
          <div className="flex items-center gap-3 text-zinc-400">
            <Calendar className="w-5 h-5" />
            <p className="text-[14px]">No gigs scheduled yet</p>
          </div>
        </motion.div>
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
          Explore Dashboard
          <ArrowRight className="w-5 h-5" strokeWidth={2} />
        </motion.button>
      </motion.div>
    </div>
  );
};

export default JoinerWelcomeBand;
