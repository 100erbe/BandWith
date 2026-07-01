import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onInviteCodeSubmit: (code: string) => void;
  inviteCodeLoading: boolean;
  inviteCodeError: string | null;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onSignIn,
  onInviteCodeSubmit,
  inviteCodeLoading,
  inviteCodeError,
}) => {
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleInviteSubmit = () => {
    if (inviteCode.trim().length < 2) return;
    setSubmitted(true);
    onInviteCodeSubmit(inviteCode.trim());
  };

  if (submitted && inviteCodeLoading) {
    return (
      <div
        className="min-h-screen bg-background flex flex-col items-center justify-center px-5"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
        <p className="text-muted-foreground text-[15px] font-medium">
          Checking invite code…
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Subtle brand gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(213, 251, 70, 0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-12 pb-6 relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src="/brand/Logo - full text White.png"
            alt="BANDWITH"
            className="h-6"
          />
        </motion.div>

        {/* Main value prop area */}
        <div className="flex-1 flex flex-col justify-center -mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h1 className="text-[40px] font-black text-foreground leading-[1.05] tracking-tight mb-4">
              Your music,
              <br />
              your schedule,
              <br />
              <span className="text-accent">your way.</span>
            </h1>
            <p className="text-muted-foreground text-[15px] font-medium leading-relaxed max-w-[280px]">
              Manage gigs, rehearsals, and sync your band — or just keep your own calendar in tune.
            </p>
        </motion.div>

          {/* Feature pips */}
          <motion.div
            className="flex flex-wrap gap-x-5 gap-y-2.5 mt-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            {[
              'Shared calendars',
              'Automated quotes',
              'Rehearsal costs',
              'Setlist builder',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                <span className="text-[13px] text-muted-foreground/70 font-medium">
                  {feature}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* CTA Section */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {/* Primary CTA */}
          <button
            onClick={onGetStarted}
            className="w-full h-14 rounded-full text-[13px] font-black uppercase tracking-[0.15em] bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            Get Started
            <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
          </button>

          {/* Invite code section */}
          {showInviteInput ? (
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value);
                    setSubmitted(false);
                  }}
                  placeholder="Enter invite code"
                  className="flex-1 h-12 rounded-xl bg-card border border-border px-4 text-foreground text-[15px] font-medium placeholder:text-muted-foreground/40 outline-none focus:border-accent transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInviteSubmit();
                  }}
                />
                <button
                  onClick={handleInviteSubmit}
                  disabled={inviteCode.trim().length < 2}
                  className="h-12 px-5 rounded-xl bg-accent text-accent-foreground text-[13px] font-black uppercase tracking-wider disabled:opacity-40 transition-opacity"
                >
                  Join
                </button>
              </div>
              {inviteCodeError && (
                <p className="text-red-400 text-[13px] font-medium px-1">
                  {inviteCodeError}
                </p>
              )}
              <button
                onClick={() => {
                  setShowInviteInput(false);
                  setInviteCode('');
                  setSubmitted(false);
                }}
                className="text-muted-foreground/40 text-[12px] font-semibold hover:text-muted-foreground/70 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          ) : (
            <button
              onClick={() => setShowInviteInput(true)}
              className="w-full h-14 rounded-full text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55 hover:text-muted-foreground/90 hover:bg-card active:scale-[0.98] transition-all flex items-center justify-center border border-border"
            >
              I have an invite code
            </button>
          )}

          {/* Sign in link */}
          <div className="text-center pt-3">
            <button
              onClick={onSignIn}
              className="text-muted-foreground/40 text-[13px] font-semibold hover:text-muted-foreground/80 transition-colors"
            >
              Already have an account?{' '}
              <span className="text-muted-foreground/60 underline underline-offset-4 decoration-border">
                Sign In
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default WelcomeScreen;