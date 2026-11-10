import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Crown, User, X } from '@/app/components/icons';
import { useOnboarding, INSTRUMENTS } from '@/lib/OnboardingContext';
import { useAuth } from '@/lib/AuthContext';
import { AuthScreen, Kicker, PillButton, PillField } from '@/app/components/bw/Form';
import { ChoicePill, WizardTop, wizardStep } from './OnboardingChrome';

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

  const { step, total } = wizardStep(path, 'profile');

  return (
    <AuthScreen
      top={<WizardTop onBack={onBack} step={step} total={total} />}
      bodyClassName="pt-2 gap-5"
      footer={
        <PillButton
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          loading={isSubmitting}
          trailingIcon={<ArrowUpRight className="w-5 h-5" />}
        >
          Continue
        </PillButton>
      }
    >
      <Kicker overline="Your profile" title="Tell us about you" />

      {/* Name Input */}
      <PillField
        label="Your name *"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Your name"
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="done"
        icon={<User className="w-5 h-5" strokeWidth={1.75} />}
      />

      {/* Instruments */}
      <div className="flex flex-col gap-3">
        <p id="instrument-label" className="bw-label-sm text-muted-foreground">
          Your role / instrument *
        </p>

        <div role="group" aria-labelledby="instrument-label" className="flex flex-wrap gap-2">
          {INSTRUMENTS.map((instrument) => (
            <ChoicePill
              key={instrument.id}
              selected={selectedInstruments.includes(instrument.id)}
              onClick={() => toggleInstrument(instrument.id)}
            >
              {instrument.id === 'other' ? 'Other…' : instrument.label}
            </ChoicePill>
          ))}

          {/* Custom instruments added */}
          {selectedInstruments
            .filter((i) => !INSTRUMENTS.find((inst) => inst.id === i))
            .map((custom) => (
              <ChoicePill
                key={custom}
                selected
                aria-label={`Remove ${custom}`}
                onClick={() => setSelectedInstruments((prev) => prev.filter((i) => i !== custom))}
              >
                {custom}
                <X className="w-3 h-3" strokeWidth={2} />
              </ChoicePill>
            ))}
        </div>

        {/* Custom instrument input */}
        {showCustomInput && (
          <motion.div
            className="flex items-end gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <PillField
              label="Other instrument"
              hideLabel
              type="text"
              value={customInstrument}
              onChange={(e) => setCustomInstrument(e.target.value)}
              placeholder="Enter instrument…"
              className="flex-1 min-w-0"
              autoFocus
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomInstrument();
                }
              }}
            />
            <PillButton
              variant="dark"
              size="md"
              fullWidth={false}
              className="h-[52px]"
              onClick={addCustomInstrument}
              disabled={!customInstrument.trim()}
            >
              Add
            </PillButton>
            <PillButton
              variant="ghost"
              size="md"
              fullWidth={false}
              className="h-[52px] px-3 text-muted-foreground"
              onClick={() => setShowCustomInput(false)}
            >
              Cancel
            </PillButton>
          </motion.div>
        )}
      </div>

      {/* Role Badge (Creator only) */}
      {isCreator && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-card rounded-[24px] p-4 flex items-center gap-4"
        >
          <div className="w-11 h-11 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
            <Crown className="w-[22px] h-[22px]" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="bw-label-md text-foreground">Your role: band admin</p>
            <p className="bw-body-sm text-muted-foreground">Full control over settings, events and members.</p>
          </div>
        </motion.div>
      )}

      {/* Band info for joiner */}
      {!isCreator && bandData && (
        <motion.div
          className="bg-card rounded-[24px] p-4 flex flex-col gap-1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <p className="bw-label-sm text-muted-foreground">Joining</p>
          <h3 className="bw-h3 text-foreground truncate">{bandData.name}</h3>
        </motion.div>
      )}
    </AuthScreen>
  );
};

export default ProfileSetup;
