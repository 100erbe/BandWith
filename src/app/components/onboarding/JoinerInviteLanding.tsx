import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Users, Calendar, ArrowLeft, CheckCircle } from 'lucide-react';

export interface InviteData {
  id: string;
  band_id: string;
  email: string;
  role: 'admin' | 'member';
  status: string;
  created_at: string;
  expires_at: string;
  band: {
    id: string;
    name: string;
    logo_url?: string;
    description?: string;
  };
  member_count?: number;
  inviter?: {
    full_name?: string;
    email?: string;
  };
}

interface JoinerInviteLandingProps {
  inviteData: InviteData | null;
  onAccept: () => void;
  onDecline: () => void;
  onBack?: () => void;
}

export const JoinerInviteLanding: React.FC<JoinerInviteLandingProps> = ({
  inviteData,
  onAccept,
  onDecline,
  onBack,
}) => {
  const bandName = inviteData?.band?.name || 'Unknown Band';
  const bandLogo = inviteData?.band?.logo_url;
  const inviterName =
    inviteData?.inviter?.full_name ||
    inviteData?.inviter?.email?.split('@')[0] ||
    'A band admin';
  const memberRole = inviteData?.role === 'admin' ? 'Admin' : 'Member';
  const memberCount = inviteData?.member_count || 0;

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        {onBack ? (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
        ) : (
          <div className="w-10" />
        )}
        
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
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <h1 className="text-[44px] font-black text-white leading-[0.95] tracking-tight mb-4">
            You're
            <br />
            <span className="text-[#0047FF]">invited</span>
          </h1>
          <p className="text-white/40 text-[16px] font-medium leading-relaxed">
            {inviterName} invited you to join as <span className="text-[#D4FB46] font-bold">{memberRole}</span>
          </p>
        </motion.div>

        {/* Band Card - Editorial style */}
        <motion.div
          className="rounded-3xl bg-white/5 border border-white/5 p-5 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
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

            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-[20px] leading-tight truncate">
                {bandName}
              </h2>
              {inviteData?.band?.description && (
                <p className="text-white/30 text-[13px] line-clamp-1 mt-0.5">
                  {inviteData.band.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-white/40">
              <Users className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-[13px] font-medium">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
            {inviteData?.created_at && (
              <div className="flex items-center gap-2 text-white/40">
                <Calendar className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-[13px] font-medium">
                  Sent {formatDate(inviteData.created_at)}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* What you'll get */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <p className="text-white/20 text-[11px] font-bold uppercase tracking-[0.15em] mb-3">
            What you'll get
          </p>
          
          {[
            'Access to band events & calendar',
            'Shared setlists & song library',
            'Team chat & notifications',
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3 text-white/50">
              <CheckCircle className="w-4 h-4 text-[#D4FB46]" strokeWidth={1.5} />
              <span className="text-[14px] font-medium">{item}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="px-6 pb-10 pt-6 relative z-10 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        {/* Primary CTA */}
        <button
          onClick={onAccept}
          className="w-full h-14 rounded-full text-[15px] font-black uppercase tracking-[0.15em] bg-[#D4FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          Accept & Continue
          <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
        </button>

        {/* Decline */}
        <button
          onClick={onDecline}
          className="w-full text-center py-3 text-white/30 text-[14px] font-medium hover:text-white/50 transition-colors"
        >
          Decline invitation
        </button>
      </motion.div>
    </div>
  );
};

export default JoinerInviteLanding;
