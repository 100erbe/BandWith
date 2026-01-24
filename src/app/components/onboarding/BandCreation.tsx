import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Camera, Sparkles, Loader2 } from 'lucide-react';
import { useOnboarding } from '@/lib/OnboardingContext';

interface BandCreationProps {
  onBack: () => void;
  onComplete: () => void;
}

export const BandCreation: React.FC<BandCreationProps> = ({
  onBack,
  onComplete,
}) => {
  const { setBandData, bandData } = useOnboarding();
  const [bandName, setBandName] = useState(bandData?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(bandData?.avatarUrl || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValid = bandName.trim().length >= 2;

  // Generate initials for avatar placeholder
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setAvatarUrl(reader.result as string); // In production, upload to storage
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    
    // Save band data
    setBandData({
      name: bandName.trim(),
      avatarUrl: avatarUrl || undefined,
    });

    // Show celebration
    setShowCelebration(true);
    
    // Wait for celebration animation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setShowCelebration(false);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background:
              'radial-gradient(circle, rgba(212, 251, 70, 0.3) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="mb-8"
            >
              <div className="w-24 h-24 rounded-[2rem] bg-[#D4FB46] flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-black" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center"
            >
              <h2 className="text-3xl font-black text-white mb-2">
                🎉 "{bandName}"
              </h2>
              <p className="text-[#D4FB46] text-xl font-bold">is born!</p>
            </motion.div>

            {/* Confetti particles */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  background: ['#D4FB46', '#0047FF', '#FF4F28', '#998878'][i % 4],
                  left: `${Math.random() * 100}%`,
                  top: '50%',
                }}
                initial={{ y: 0, opacity: 1, scale: 1 }}
                animate={{
                  y: [0, -200 - Math.random() * 200],
                  x: [(Math.random() - 0.5) * 100],
                  opacity: [1, 0],
                  scale: [1, 0],
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.05,
                  ease: 'easeOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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
            <span className="text-zinc-500 text-[13px] font-medium">Step 1/4</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#D4FB46] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: '25%' }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 py-8 relative z-10">
        {/* Title */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-[32px] font-black text-white leading-tight mb-2">
            Name your band
          </h1>
          <p className="text-zinc-500 text-[16px]">
            This is how your band will appear to members and clients.
          </p>
        </motion.div>

        {/* Band Name Input */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <label className="text-zinc-500 text-[13px] font-medium mb-2 block">
            BAND NAME *
          </label>
          <input
            type="text"
            value={bandName}
            onChange={(e) => setBandName(e.target.value)}
            placeholder="The Groovemasters"
            className="w-full bg-transparent border-b-2 border-white/20 pb-3 text-white text-[28px] font-bold placeholder:text-zinc-700 outline-none focus:border-[#D4FB46] transition-colors"
            maxLength={50}
            autoFocus
          />
          <div className="flex justify-between mt-2">
            <p className="text-zinc-600 text-[12px]">
              {bandName.length < 2 ? 'At least 2 characters' : ''}
            </p>
            <p className="text-zinc-600 text-[12px]">{bandName.length}/50</p>
          </div>
        </motion.div>

        {/* Avatar Upload */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <label className="text-zinc-500 text-[13px] font-medium mb-4 block">
            BAND AVATAR
          </label>
          
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-28 h-28 rounded-[1.5rem] bg-[#1C1C1E] border-2 border-dashed border-white/20 flex flex-col items-center justify-center hover:border-[#D4FB46]/50 transition-colors overflow-hidden group"
            >
              {avatarPreview || avatarUrl ? (
                <img
                  src={avatarPreview || avatarUrl}
                  alt="Band avatar"
                  className="w-full h-full object-cover"
                />
              ) : bandName.length >= 2 ? (
                <div className="w-full h-full bg-gradient-to-br from-[#D4FB46] to-[#98BC21] flex items-center justify-center">
                  <span className="text-3xl font-black text-black">
                    {getInitials(bandName)}
                  </span>
                </div>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-zinc-600 mb-2 group-hover:text-[#D4FB46] transition-colors" />
                  <span className="text-zinc-600 text-[11px] font-medium group-hover:text-[#D4FB46]">
                    Add photo
                  </span>
                </>
              )}
            </button>
            
            <div className="flex-1">
              <p className="text-zinc-400 text-[14px] mb-1">
                {avatarPreview ? 'Looking good! 🎸' : 'Tap to add a photo'}
              </p>
              <p className="text-zinc-600 text-[12px]">
                Skip for now, add later
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </motion.div>

        {/* Preview Card */}
        {bandName.length >= 2 && (
          <motion.div
            className="mt-auto mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-zinc-600 text-[11px] font-medium mb-3 uppercase tracking-wider">
              Preview
            </p>
            <div className="bg-[#1C1C1E] rounded-[1.5rem] p-4 flex items-center gap-4 border border-white/5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4FB46] to-[#98BC21] flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatarPreview || avatarUrl ? (
                  <img
                    src={avatarPreview || avatarUrl}
                    alt="Band avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-black text-black">
                    {getInitials(bandName)}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-white font-bold text-[18px]">{bandName}</h3>
                <p className="text-zinc-500 text-[13px]">1 member • New band</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-10 pt-4 relative z-10">
        <motion.button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#D4FB46] text-black font-bold text-[16px] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            boxShadow: isValid ? '0 4px 20px rgba(212, 251, 70, 0.3)' : 'none',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {isSubmitting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5" strokeWidth={2} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default BandCreation;
