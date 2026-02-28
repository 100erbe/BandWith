import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { InviteData } from './JoinerInviteLanding';

interface JoinerInviteSelectProps {
  invites: InviteData[];
  onBack: () => void;
  onSelect: (invite: InviteData) => void;
}

export const JoinerInviteSelect: React.FC<JoinerInviteSelectProps> = ({
  invites,
  onBack,
  onSelect,
}) => {
  // Get initials for avatar
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
      {/* Subtle gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute bottom-0 left-0 right-0 h-[60%]"
          style={{
            background: 'linear-gradient(to top, rgba(0, 71, 255, 0.03) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-6 relative z-10 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        
        <motion.img
          src="/brand/Logo - full text White.png"
          alt="BANDWITH"
          className="h-5 opacity-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
        />
        
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-12 relative z-10">
        {/* Editorial headline */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <h1 className="text-[44px] font-black text-white leading-[0.95] tracking-tight mb-4">
            Choose
            <br />
            <span className="text-[#0047FF]">your band</span>
          </h1>
          <p className="text-white/40 text-[16px] font-medium leading-relaxed">
            You have {invites.length} pending invitations
          </p>
        </motion.div>

        {/* Band list */}
        <motion.div
          className="space-y-3 flex-1 overflow-y-auto pb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          {invites.map((invite, index) => (
            <motion.button
              key={invite.id}
              onClick={() => onSelect(invite)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
            >
              {/* Band avatar */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0047FF] to-[#0033CC] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {invite.band?.logo_url ? (
                  <img
                    src={invite.band.logo_url}
                    alt={invite.band.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-black text-white">
                    {getInitials(invite.band?.name || 'B')}
                  </span>
                )}
              </div>

              {/* Band info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-[17px] truncate">
                  {invite.band?.name || 'Unknown Band'}
                </h3>
                <div className="flex items-center gap-3 text-white/40 text-[13px] mt-0.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {invite.member_count || 0} members
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="capitalize">{invite.role}</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="w-10 h-10 rounded-full bg-[#D4FB46]/0 group-hover:bg-[#D4FB46]/10 flex items-center justify-center transition-all">
                <ArrowRight className="w-5 h-5 text-[#D4FB46] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Footer hint */}
      <motion.div
        className="px-6 pb-10 pt-4 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <p className="text-center text-white/20 text-[13px] font-medium">
          Tap a band to view invitation details
        </p>
      </motion.div>
    </div>
  );
};

export default JoinerInviteSelect;
