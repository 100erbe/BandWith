import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  X,
  Users,
  Plus,
  Send,
  Loader2,
} from 'lucide-react';
import { useOnboarding, MemberInvite, INSTRUMENTS } from '@/lib/OnboardingContext';
import { DotRadio } from '@/app/components/ui/DotRadio';

interface InviteMembersProps {
  onBack: () => void;
  onComplete: () => void;
}

export const InviteMembers: React.FC<InviteMembersProps> = ({
  onBack,
  onComplete,
}) => {
  const { invites, addInvite, removeInvite, bandData } = useOnboarding();

  const [emailInput, setEmailInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<Partial<MemberInvite>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAddEmail = () => {
    const email = emailInput.toLowerCase().trim();
    if (!isValidEmail(email)) return;
    if (invites.some((i) => i.email === email)) return;

    setCurrentInvite({ email });
    setShowModal(true);
    setEmailInput('');
  };

  const handleConfirmInvite = () => {
    if (!currentInvite.email) return;

    addInvite({
      email: currentInvite.email,
      name: currentInvite.name,
      role: currentInvite.role,
      instruments: currentInvite.instruments,
      permission: currentInvite.permission || 'member',
    });

    setShowModal(false);
    setCurrentInvite({});
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Invites will be sent when onboarding completes
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsSubmitting(false);
    onComplete();
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
          className="absolute bottom-0 left-0 right-0 h-[50%]"
          style={{
            background: 'linear-gradient(to top, rgba(212, 251, 70, 0.03) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-14 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[15px] font-medium">Back</span>
          </button>
          <span className="text-zinc-500 text-[13px] font-medium">Step 3/4</span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#D4FB46] rounded-full"
            initial={{ width: '50%' }}
            animate={{ width: '75%' }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 py-8 relative z-10 overflow-y-auto">
        {/* Title */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-[32px] font-black text-white leading-tight mb-2">
            Invite your bandmates
          </h1>
          <p className="text-zinc-500 text-[16px]">
            They'll receive an email to join "{bandData?.name}"
          </p>
        </motion.div>

        {/* Email Input */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <label className="text-zinc-500 text-[13px] font-medium mb-3 block">
            EMAIL ADDRESS
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="member@email.com"
                className="w-full bg-[#1C1C1E] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white text-[15px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEmail();
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleAddEmail}
              disabled={!isValidEmail(emailInput)}
              className="px-4 rounded-xl bg-[#D4FB46] text-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Invited List */}
        {invites.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="text-zinc-500 text-[13px] font-medium">
                INVITED ({invites.length})
              </label>
            </div>

            <div className="space-y-2">
              {invites.map((invite, index) => (
                <motion.div
                  key={invite.email}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 bg-[#1C1C1E] rounded-xl p-3 border border-white/5"
                >
                  <div className="w-10 h-10 rounded-full bg-[#998878]/20 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-[#998878]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-[14px] truncate">
                      {invite.email}
                    </p>
                    <p className="text-zinc-500 text-[12px]">
                      {invite.role || 'Musician'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInvite(invite.email)}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Import from Contacts */}
        <motion.button
          type="button"
          className="flex items-center gap-3 text-[#D4FB46] py-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Users className="w-5 h-5" />
          <span className="text-[15px] font-medium">Import from Contacts</span>
        </motion.button>

        {/* Empty state illustration */}
        {invites.length === 0 && (
          <motion.div
            className="flex-1 flex flex-col items-center justify-center py-12 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-20 h-20 rounded-full bg-[#1C1C1E] flex items-center justify-center mb-4">
              <Send className="w-10 h-10 text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-[15px] max-w-[250px]">
              Add emails above to invite your bandmates
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-10 pt-4 relative z-10">
        <motion.button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full h-14 rounded-full text-sm font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 active:scale-[0.98] transition-all ${
            invites.length > 0
              ? 'bg-[#D4FB46] text-black hover:bg-[#c8ef3a]'
              : 'bg-transparent text-white/60 border border-white/20 hover:border-white/40 hover:text-white'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : invites.length > 0 ? (
            <>
              Send Invites
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          ) : (
            <>
              Skip for Now
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </motion.button>

        {invites.length > 0 && (
          <p className="text-center text-white/30 text-[12px] mt-3">
            You can invite more members later
          </p>
        )}
      </div>

      {/* Invite Detail Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-md bg-[#1C1C1E] rounded-t-[2rem] p-6"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 text-zinc-500"
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-white font-bold text-[20px] mb-1">
                Invite Details
              </h3>
              <p className="text-[#D4FB46] text-[15px] mb-6">
                {currentInvite.email}
              </p>

              {/* Name (optional) */}
              <div className="mb-4">
                <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                  NAME (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={currentInvite.name || ''}
                  onChange={(e) =>
                    setCurrentInvite((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="John Doe"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-[15px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50"
                />
              </div>

              {/* Role/Instrument */}
              <div className="mb-4">
                <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                  ROLE/INSTRUMENT
                </label>
                <div className="flex flex-wrap gap-2">
                  {INSTRUMENTS.slice(0, 6).map((inst) => (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() =>
                        setCurrentInvite((prev) => ({
                          ...prev,
                          role: inst.label,
                        }))
                      }
                      className={`px-3 py-2 rounded-xl text-[13px] font-medium ${
                        currentInvite.role === inst.label
                          ? 'bg-[#D4FB46] text-black'
                          : 'bg-black/30 text-white border border-white/10'
                      }`}
                    >
                      {inst.icon} {inst.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permission */}
              <div className="mb-6">
                <label className="text-zinc-500 text-[12px] font-medium mb-2 block">
                  PERMISSION
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentInvite((prev) => ({
                        ...prev,
                        permission: 'member',
                      }))
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 cursor-pointer hover:border-white/20"
                  >
                    <DotRadio
                      selected={currentInvite.permission !== 'admin'}
                      activeColor="#D4FB46"
                      inactiveColor="rgba(255,255,255,0.15)"
                    />
                    <div className="text-left">
                      <span className="text-white font-medium text-[14px]">
                        Member
                      </span>
                      <p className="text-zinc-500 text-[12px]">
                        Limited access
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentInvite((prev) => ({
                        ...prev,
                        permission: 'admin',
                      }))
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 cursor-pointer hover:border-white/20"
                  >
                    <DotRadio
                      selected={currentInvite.permission === 'admin'}
                      activeColor="#D4FB46"
                      inactiveColor="rgba(255,255,255,0.15)"
                    />
                    <div className="text-left">
                      <span className="text-white font-medium text-[14px]">
                        Admin
                      </span>
                      <p className="text-zinc-500 text-[12px]">Full access</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                onClick={handleConfirmInvite}
                className="w-full h-12 rounded-full text-sm font-black uppercase tracking-[0.1em] bg-[#D4FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all"
              >
                Add to List
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InviteMembers;
