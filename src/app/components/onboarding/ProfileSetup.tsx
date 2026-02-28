import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useOnboarding, INSTRUMENTS } from '@/lib/OnboardingContext';
import { useAuth } from '@/lib/AuthContext';

interface ProfileSetupProps {
  onBack: () => void;
  onComplete: () => void;
}

export const ProfileSetup: React.FC<ProfileSetupProps> = ({
  onBack,
  onComplete,
}) => {
  const { setProfileData, profileData, path, bandData } = useOnboarding();
  const { user, profile } = useAuth();

  // Pre-fill from OAuth if available
  const [fullName, setFullName] = useState(
    profileData?.fullName ||
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      ''
  );
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>(
    profileData?.instruments || []
  );
  const [customInstrument, setCustomInstrument] = useState(
    profileData?.customInstrument || ''
  );
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCreator = path === 'creator';
  const isValid = fullName.trim().length >= 2 && selectedInstruments.length > 0;

  const toggleInstrument = (id: string) => {
    if (id === 'other') {
      setShowCustomInput(true);
      return;
    }

    setSelectedInstruments((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const addCustomInstrument = () => {
    if (customInstrument.trim()) {
      setSelectedInstruments((prev) => [...prev, customInstrument.trim()]);
      setCustomInstrument('');
      setShowCustomInput(false);
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);

    setProfileData({
      fullName: fullName.trim(),
      instruments: selectedInstruments,
      customInstrument: customInstrument || undefined,
    });

    // Small delay for animation
    await new Promise((resolve) => setTimeout(resolve, 300));

    setIsSubmitting(false);
    onComplete();
  };

  const stepNumber = isCreator ? '2' : '2';
  const totalSteps = isCreator ? '4' : '3';
  const progressPercent = isCreator ? 50 : 66;

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
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[13px] font-medium">
              Step {stepNumber}/{totalSteps}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#D4FB46] rounded-full"
            initial={{ width: isCreator ? '25%' : '33%' }}
            animate={{ width: `${progressPercent}%` }}
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
            Tell us about you
          </h1>
          <p className="text-zinc-500 text-[16px]">
            How should your bandmates know you?
          </p>
        </motion.div>

        {/* Name Input */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <label className="text-zinc-500 text-[13px] font-medium mb-2 block">
            YOUR NAME *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            className="w-full bg-transparent border-b-2 border-white/20 pb-3 text-white text-[24px] font-bold placeholder:text-zinc-700 outline-none focus:border-[#D4FB46] transition-colors"
          />
        </motion.div>

        {/* Instruments */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <label className="text-zinc-500 text-[13px] font-medium mb-4 block">
            YOUR ROLE/INSTRUMENT *
          </label>

          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((instrument) => {
              const isSelected = selectedInstruments.includes(instrument.id);
              return (
                <motion.button
                  key={instrument.id}
                  type="button"
                  onClick={() => toggleInstrument(instrument.id)}
                  className={`px-4 py-3 rounded-2xl font-medium text-[14px] flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-[#D4FB46] text-black'
                      : 'bg-[#1C1C1E] text-white border border-white/10 hover:border-white/20'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-lg">{instrument.icon}</span>
                  {instrument.label}
                </motion.button>
              );
            })}

            {/* Custom instruments added */}
            {selectedInstruments
              .filter(
                (i) => !INSTRUMENTS.find((inst) => inst.id === i)
              )
              .map((custom) => (
                <motion.button
                  key={custom}
                  type="button"
                  onClick={() =>
                    setSelectedInstruments((prev) =>
                      prev.filter((i) => i !== custom)
                    )
                  }
                  className="px-4 py-3 rounded-2xl font-medium text-[14px] flex items-center gap-2 bg-[#D4FB46] text-black"
                  whileTap={{ scale: 0.95 }}
                >
                  ✓ {custom}
                </motion.button>
              ))}
          </div>

          {/* Custom instrument input */}
          {showCustomInput && (
            <motion.div
              className="mt-4 flex gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <input
                type="text"
                value={customInstrument}
                onChange={(e) => setCustomInstrument(e.target.value)}
                placeholder="Enter instrument..."
                className="flex-1 bg-[#1C1C1E] border border-white/10 rounded-xl px-4 py-3 text-white text-[14px] placeholder:text-zinc-600 outline-none focus:border-[#D4FB46]/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomInstrument();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomInstrument}
                className="px-4 py-3 rounded-xl bg-[#D4FB46] text-black font-bold text-[14px]"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowCustomInput(false)}
                className="px-4 py-3 rounded-xl bg-[#1C1C1E] text-zinc-400 font-medium text-[14px] border border-white/10"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Role Badge (Creator only) */}
        {isCreator && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-4"
          >
            <div className="border-l-2 border-[#D4FB46] pl-4 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4FB46]">
                Your Role
              </span>
              <h3 className="text-white font-bold text-lg mt-1">
                Band Admin
              </h3>
              <p className="text-white/40 text-[13px] mt-0.5">
                Full control over settings, events, and members.
              </p>
            </div>
          </motion.div>
        )}

        {/* Band info for joiner */}
        {!isCreator && bandData && (
          <motion.div
            className="mt-auto bg-[#1C1C1E] rounded-2xl p-4 border border-white/5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <p className="text-zinc-500 text-[11px] font-medium mb-2 uppercase">
              Joining
            </p>
            <h3 className="text-white font-bold text-[18px]">{bandData.name}</h3>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-10 pt-4 relative z-10">
        <motion.button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="w-full h-14 rounded-full text-sm font-black uppercase tracking-[0.15em] bg-[#D4FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default ProfileSetup;
