import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Calendar, Music, Sparkles, Loader2, ArrowRight } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import {
  checkMemberProposalEligibility,
  createMemberRehearsalProposal,
  type ProposalEligibility,
} from '@/lib/services/rehearsalPolls';

const DAYS_OF_WEEK = [
  { key: 'Mon', label: 'Mon' },
  { key: 'Tue', label: 'Tue' },
  { key: 'Wed', label: 'Wed' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Fri', label: 'Fri' },
  { key: 'Sat', label: 'Sat' },
  { key: 'Sun', label: 'Sun' },
];

interface ProposeRehearsalModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  bandName?: string;
  userId: string;
  onSuccess?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ProposeRehearsalModal: React.FC<ProposeRehearsalModalProps> = ({
  isOpen,
  onClose,
  bandId,
  bandName,
  userId,
  onSuccess,
  onShowToast,
}) => {
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [eligibility, setEligibility] = useState<ProposalEligibility>({
    canPropose: true,
    nextAvailableDate: null,
  });

  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Check eligibility on open
  useEffect(() => {
    if (!isOpen || !bandId || !userId) return;

    let mounted = true;
    setLoadingEligibility(true);
    setError(null);

    checkMemberProposalEligibility(bandId, userId)
      .then((res) => {
        if (mounted) {
          setEligibility(res);
          setLoadingEligibility(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error(err);
          setLoadingEligibility(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, bandId, userId]);

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || submitting) return;
    if (!title.trim()) {
      setError('Please provide a short reason or topic for the rehearsal.');
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const { error: submitErr } = await createMemberRehearsalProposal({
        bandId,
        userId,
        title: title.trim(),
        notes: notes.trim(),
        preferredDays: selectedDays,
      });

      if (submitErr) {
        setError(submitErr.message || 'Failed to submit proposal. Please try again.');
        return;
      }

      onShowToast?.('Proposal sent to band admin.', 'success');
      setTitle('');
      setSelectedDays([]);
      setNotes('');
      onSuccess?.();
      onClose();
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-background border border-foreground/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-foreground/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/30 flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-[var(--accent-rehearsal)]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground uppercase tracking-tight leading-tight">
                  Propose Rehearsal
                </h2>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {bandName ? `FOR ${bandName}` : 'Member Request'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-foreground/10 hover:bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {loadingEligibility ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-rehearsal)]" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Checking weekly proposal quota...
                </p>
              </div>
            ) : !eligibility.canPropose ? (
              // LOCKED STATE: 1 per 7 days reached
              <div className="py-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/25 flex items-center justify-center mb-4 text-[var(--accent-rehearsal)]">
                  <Clock className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-black text-foreground uppercase tracking-tight mb-2">
                  Weekly Proposal Limit Reached
                </h3>

                <p className="text-sm font-medium text-muted-foreground max-w-sm mb-6 leading-relaxed">
                  Band members can submit at most 1 rehearsal proposal every 7 days to keep band scheduling focused and orderly.
                </p>

                {eligibility.nextAvailableDate && (
                  <div className="w-full bg-card border border-foreground/10 rounded-2xl p-4 mb-6 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                      Next available proposal
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-foreground">
                        {eligibility.nextAvailableDate.toLocaleDateString(undefined, {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--accent-rehearsal)]/15 text-[var(--accent-rehearsal)] border border-[var(--accent-rehearsal)]/30">
                        In {eligibility.daysRemaining} {eligibility.daysRemaining === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              // PROPOSAL FORM
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {error && (
                  <div className="p-3.5 rounded-xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/25 text-[var(--destructive)] text-xs font-bold">
                    {error}
                  </div>
                )}

                {/* Topic / Purpose */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Rehearsal Focus / Goal <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Practice new setlist transitions & vocal harmonies"
                    className="w-full bg-card border border-foreground/15 rounded-xl px-4 py-3 text-sm font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[var(--accent-rehearsal)] transition-colors"
                    maxLength={100}
                    autoFocus
                  />
                </div>

                {/* Preferred Days of the Week */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Preferred Days of the Week
                    </label>
                    <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase">
                      Optional
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = selectedDays.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => toggleDay(d.key)}
                          className={cn(
                            'py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center border',
                            isSelected
                              ? 'bg-[var(--accent-rehearsal)] text-white border-[var(--accent-rehearsal)] shadow-xs'
                              : 'bg-card text-foreground/70 border-foreground/10 hover:border-foreground/25 hover:bg-foreground/5'
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Notes */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Additional Notes or Songs
                    </label>
                    <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase">
                      Optional
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Can we run through the bridge on song 3? I have availability after 19:30."
                    className="w-full bg-card border border-foreground/15 rounded-xl p-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[var(--accent-rehearsal)] transition-colors min-h-[90px] resize-none"
                    maxLength={400}
                  />
                </div>

                {/* Notice Box */}
                <div className="p-3.5 rounded-xl bg-card border border-foreground/10 flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
                  <Sparkles className="w-4 h-4 text-[var(--accent-rehearsal)] shrink-0 mt-0.5" />
                  <span>
                    Your proposal will be sent directly to the band admin. They can review it and launch an availability poll for the whole band.
                  </span>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 rounded-xl bg-[var(--accent-rehearsal)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting Proposal...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Proposal to Admin</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
