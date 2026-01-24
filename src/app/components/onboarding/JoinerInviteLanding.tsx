import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Users, Music, Ticket, X } from 'lucide-react';

interface JoinerInviteLandingProps {
  inviteData: any;
  onAccept: () => void;
  onDecline: () => void;
}

export const JoinerInviteLanding: React.FC<JoinerInviteLandingProps> = ({
  inviteData,
  onAccept,
  onDecline,
}) => {
  const bandName = inviteData?.band?.name || 'Unknown Band';
  const bandLogo = inviteData?.band?.logo_url;
  const inviterName =
    inviteData?.inviter?.full_name ||
    inviteData?.inviter?.email?.split('@')[0] ||
    'Someone';
  const memberRole = inviteData?.role || 'Musician';

  // Get initials for avatar placeholder
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle, rgba(0, 71, 255, 0.4) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        {/* Ticket Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 0.1 }}
          className="mb-8"
        >
          <div
            className="w-24 h-24 rounded-[2rem] bg-[#0047FF] flex items-center justify-center"
            style={{
              boxShadow: '0 12px 48px rgba(0, 71, 255, 0.4)',
            }}
          >
            <Ticket className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-[32px] font-black text-white leading-tight mb-2">
            You're invited!
          </h1>
          <p className="text-zinc-400 text-[16px]">
            {inviterName} invited you as <span className="text-[#D4FB46]">{memberRole}</span>
          </p>
        </motion.div>

        {/* Band Card */}
        <motion.div
          className="w-full max-w-sm bg-[#1C1C1E] rounded-[2rem] p-6 border border-white/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-6">
            {/* Band Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0047FF] to-[#0033CC] flex items-center justify-center overflow-hidden flex-shrink-0">
              {bandLogo ? (
                <img
                  src={bandLogo}
                  alt={bandName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black text-white">
                  {getInitials(bandName)}
                </span>
              )}
            </div>

            <div>
              <h2 className="text-white font-bold text-[22px] leading-tight">
                {bandName}
              </h2>
              {inviteData?.band?.description && (
                <p className="text-zinc-500 text-[13px] line-clamp-1">
                  {inviteData.band.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-zinc-400">
              <Users className="w-4 h-4" />
              <span className="text-[13px]">3 members</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Music className="w-4 h-4" />
              <span className="text-[13px]">12 songs</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="px-6 pb-10 pt-4 relative z-10 space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <motion.button
          onClick={onAccept}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#D4FB46] text-black font-bold text-[16px]"
          style={{
            boxShadow: '0 4px 20px rgba(212, 251, 70, 0.3)',
          }}
          whileHover={{ scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
        >
          Accept & Continue
          <ArrowRight className="w-5 h-5" strokeWidth={2} />
        </motion.button>

        <button
          onClick={onDecline}
          className="w-full text-center text-zinc-500 text-[15px] py-2 hover:text-zinc-400 transition-colors"
        >
          Decline invitation
        </button>
      </motion.div>
    </div>
  );
};

export default JoinerInviteLanding;
