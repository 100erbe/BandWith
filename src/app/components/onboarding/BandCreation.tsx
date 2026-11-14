import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Camera, Sparkles } from '@/app/components/icons';
import { useOnboarding } from '@/lib/OnboardingContext';
import { AuthScreen, Kicker, PillButton, PillField } from '@/app/components/bw/Form';
import { WizardTop, wizardStep } from './OnboardingChrome';
import { useT } from '@/lib/i18n';
import { resizeImageToDataUrl } from '@/lib/imageResize';

interface BandCreationProps {
  onBack: () => void;
  onComplete: () => void;
}

export const BandCreation: React.FC<BandCreationProps> = ({
  onBack,
  onComplete,
}) => {
  const t = useT();
  const { setBandData, bandData, path } = useOnboarding();
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

  // A 256 px thumbnail, not the full photo: it is uploaded to Storage once
  // the band exists (completeOnboarding), and stays this small if it can't be.
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const thumb = await resizeImageToDataUrl(file, 256);
      setAvatarPreview(thumb);
      setAvatarUrl(thumb);
    } catch {
      // Not an image the browser can read: keep the initials.
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

  const { step, total } = wizardStep(path, 'band');
  const avatarSrc = avatarPreview || avatarUrl;

  return (
    <AuthScreen
      className="relative overflow-hidden"
      top={<WizardTop onBack={onBack} step={step} total={total} />}
      bodyClassName="pt-2 gap-5"
      footer={
        <PillButton
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          loading={isSubmitting}
          trailingIcon={<ArrowUpRight className="w-5 h-5" />}
        >
          {t('Continue')}
        </PillButton>
      }
    >
      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-start justify-center px-4 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-live="polite"
          >
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="mb-6"
            >
              <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center">
                <Sparkles className="w-11 h-11 text-accent-foreground" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full"
            >
              <h2 className="font-[family-name:var(--font-display)] font-bold uppercase text-foreground text-[44px] leading-[0.9] tracking-[-0.03em] break-words">
                {bandName}
              </h2>
              <p className="bw-h2 text-accent-ink mt-3">{t('is born!')}</p>
            </motion.div>

            {/* Confetti particles */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2.5 h-2.5 rounded-full"
                style={{
                  background: ['var(--accent)', 'var(--dot-on)', 'var(--accent-ink)', 'var(--dot-mid)'][i % 4],
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

      <Kicker overline={t('Your band')} title={t('Name your band')} />
      <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground max-w-[340px] -mt-1">
        {t('This is how your band appears to members and clients.')}
      </p>

      {/* Band Name Input */}
      <PillField
        label={t('Band name *')}
        type="text"
        value={bandName}
        onChange={(e) => setBandName(e.target.value)}
        placeholder="The Groovemasters"
        maxLength={50}
        autoFocus
        autoCapitalize="words"
        enterKeyHint="done"
        hint={
          <span className="flex justify-between gap-3">
            <span>{bandName.length < 2 ? t('At least 2 characters') : ''}</span>
            <span className="tabular-nums">{bandName.length}/50</span>
          </span>
        }
      />

      {/* Avatar Upload */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={avatarSrc ? t('Change band avatar') : t('Add band avatar photo')}
          className="w-24 h-24 shrink-0 rounded-[24px] border-[1.5px] border-dashed border-foreground text-foreground flex flex-col items-center justify-center gap-2 overflow-hidden active:scale-[var(--press-scale,0.97)] transition-transform"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt={t('Band avatar')} className="w-full h-full object-cover" />
          ) : (
            <>
              <Camera className="w-6 h-6" />
              <span className="bw-label-sm">{t('Add photo')}</span>
            </>
          )}
        </button>

        <div className="flex flex-col gap-1 min-w-0">
          <p className="bw-label-md text-foreground">{t('Band avatar')}</p>
          <p className="bw-body-sm text-muted-foreground max-w-[200px]">
            {avatarPreview ? t('Looking good! Tap to change it.') : t('Tap to add a photo or skip for now.')}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
      </div>

      {/* Preview Card */}
      {bandName.length >= 2 && (
        <motion.div
          className="flex flex-col gap-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="bw-label-sm text-muted-foreground">{t('Preview')}</p>
          <div className="dark bg-sheet text-foreground rounded-[24px] p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center overflow-hidden shrink-0">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="bw-h2">{getInitials(bandName)}</span>
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <h3 className="bw-h2 truncate">{bandName}</h3>
              <p className="bw-label-sm">{t('1 member · New band')}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AuthScreen>
  );
};

export default BandCreation;
