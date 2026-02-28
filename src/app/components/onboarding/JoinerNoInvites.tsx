import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Mail, MessageCircle, RefreshCw } from 'lucide-react';

interface JoinerNoInvitesProps {
  email: string;
  onBack: () => void;
  onCreateBand: () => void;
}

export const JoinerNoInvites: React.FC<JoinerNoInvitesProps> = ({
  email,
  onBack,
  onCreateBand,
}) => {
  return (
    <div
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Subtle gradient - warm tone for "not found" */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute bottom-0 left-0 right-0 h-[60%]"
          style={{
            background: 'linear-gradient(to top, rgba(255, 149, 0, 0.03) 0%, transparent 100%)',
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
      <div className="flex-1 flex flex-col px-6 pt-16 relative z-10">
        {/* Editorial headline */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <h1 className="text-[44px] font-black text-white leading-[0.95] tracking-tight mb-4">
            No invites
            <br />
            <span className="text-white/20">found</span>
          </h1>
          <p className="text-white/40 text-[16px] font-medium leading-relaxed">
            We couldn't find pending invitations for
          </p>
          <p className="text-white font-bold text-[16px] mt-1">
            {email}
          </p>
        </motion.div>

        {/* Suggestions */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <p className="text-white/30 text-[12px] font-bold uppercase tracking-[0.15em] mb-3">
            What to do
          </p>
          
          {/* Suggestion cards */}
          <div className="space-y-3">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#D4FB46]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-[#D4FB46]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-white font-bold text-[15px] mb-0.5">Check spam folder</p>
                <p className="text-white/40 text-[13px] leading-relaxed">
                  The invite email might be in spam or promotions
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#D4FB46]/10 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-[#D4FB46]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-white font-bold text-[15px] mb-0.5">Try another email</p>
                <p className="text-white/40 text-[13px] leading-relaxed">
                  The invite might have been sent to a different address
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#D4FB46]/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-[#D4FB46]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-white font-bold text-[15px] mb-0.5">Contact your admin</p>
                <p className="text-white/40 text-[13px] leading-relaxed">
                  Ask them to resend the invitation
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="px-6 pb-10 pt-6 relative z-10 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {/* Primary CTA */}
        <button
          onClick={onBack}
          className="w-full h-14 rounded-full text-[15px] font-black uppercase tracking-[0.15em] bg-white/10 text-white hover:bg-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          Try Another Email
        </button>

        {/* Secondary action */}
        <button
          onClick={onCreateBand}
          className="w-full text-center py-3 text-white/30 text-[14px] font-medium hover:text-white/50 transition-colors"
        >
          Or <span className="text-[#D4FB46]">create your own band</span> →
        </button>
      </motion.div>
    </div>
  );
};

export default JoinerNoInvites;
