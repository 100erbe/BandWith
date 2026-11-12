import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Mail, Send, Loader2 } from '@/app/components/icons';
import { HeaderAction, IconButton, PillButton, PillField, Selector, Tag, Card, FormError } from '@/app/components/bw';
import { RailCover } from '@/lib/railActions';
import {
  checkMemberProposalEligibility,
  createMemberRehearsalProposal,
  type ProposalEligibility,
} from '@/lib/services/rehearsalPolls';
import { useT } from '@/lib/i18n';

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
  const t = useT();
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
      setError(t('Please provide a short reason or topic for the rehearsal.'));
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
        setError(submitErr.message || t('Failed to submit proposal. Please try again.'));
        return;
      }

      onShowToast?.(t('Proposal sent to band admin.'), 'success');
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
      <motion.div
        key="propose-rehearsal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="propose-rehearsal-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="bw-pane-detail fixed inset-0 z-[120] bg-background text-foreground flex flex-col overflow-y-auto"
      >
        {/* Figma "Rehearsal / Propose – member": rehearsal-blue header */}
        <header
          className="shrink-0 bg-accent-rehearsal text-accent-rehearsal-foreground px-4 pb-5 flex flex-col gap-2"
          style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}
        >
          <div className="flex items-center gap-3 min-h-11">
            <p className="flex-1 min-w-0 bw-label-sm truncate">{bandName ? t('For {band}', { band: bandName }) : t('Member request')}</p>
            <RailCover pane />
            <HeaderAction pane label={t('Close')} icon={<X />} variant="sheet" onClick={onClose} />
          </div>
          <h1 id="propose-rehearsal-title" className="bw-display-lg [overflow-wrap:anywhere]">
            {t('Propose rehearsal')}
          </h1>
        </header>

        <div
          className="flex-1 w-full max-w-xl mx-auto px-4 pt-5 flex flex-col gap-4"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
        >
          {loadingEligibility ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="bw-label-sm text-muted-foreground">{t('Checking weekly proposal quota…')}</p>
            </div>
          ) : !eligibility.canPropose ? (
            // LOCKED STATE: 1 per 7 days reached
            <div className="flex flex-col gap-4">
              <Card className="items-start gap-4">
                <span className="w-14 h-14 rounded-full bg-accent-rehearsal text-accent-rehearsal-foreground flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="bw-h1">{t('Weekly limit reached')}</h2>
                  <p className="bw-body-md text-muted-foreground">
                    {t('Band members can send one rehearsal proposal every 7 days, to keep band scheduling focused.')}
                  </p>
                </div>
              </Card>

              {eligibility.nextAvailableDate && (
                <Card>
                  <p className="bw-label-sm text-muted-foreground">{t('Next available proposal')}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="bw-h3">
                      {eligibility.nextAvailableDate.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {eligibility.daysRemaining != null && (
                      <Tag variant="rehearsal">
                        {eligibility.daysRemaining === 1 ? t('In {count} day', { count: eligibility.daysRemaining }) : t('In {count} days', { count: eligibility.daysRemaining })}
                      </Tag>
                    )}
                  </div>
                </Card>
              )}

              <PillButton variant="outline" onClick={onClose} className="mt-2">
                {t('Close')}
              </PillButton>
            </div>
          ) : (
            // PROPOSAL FORM
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <FormError>{error}</FormError>}

              {/* Topic / Purpose */}
              <PillField
                label={t('Topic')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('e.g. Practice new setlist transitions')}
                maxLength={100}
                autoFocus
              />

              {/* Preferred Days of the Week */}
              <fieldset className="flex flex-col gap-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">{t('Preferred days (optional)')}</legend>
                <div className="flex gap-1.5">
                  {DAYS_OF_WEEK.map((d) => (
                    <Selector
                      key={d.key}
                      selected={selectedDays.includes(d.key)}
                      onClick={() => toggleDay(d.key)}
                      className="flex-1 min-w-0 justify-center px-0"
                    >
                      {d.label}
                    </Selector>
                  ))}
                </div>
              </fieldset>

              {/* Optional Notes */}
              <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-field border border-border focus-within:border-2 focus-within:border-foreground transition-[border-color]">
                <span className="bw-label-sm text-muted-foreground">{t('Notes or songs (optional)')}</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('e.g. Volare → September segue, and the new medley ending.')}
                  className="w-full bg-transparent outline-none bw-body-lg text-foreground placeholder:text-muted-foreground/60 min-h-[72px] resize-none"
                  maxLength={400}
                />
              </label>

              {/* Notice */}
              <div className="flex items-start gap-3 p-4 rounded-[16px] bg-card">
                <Mail className="w-5 h-5 shrink-0" />
                <p className="bw-body-sm">
                  {t('Your proposal goes straight to the band admin. 1 proposal per week.')}
                </p>
              </div>

              {/* Submit */}
              <PillButton
                type="submit"
                loading={submitting}
                icon={<Send className="w-[18px] h-[18px]" />}
                className="mt-5"
              >
                {submitting ? t('Submitting…') : t('Submit to admin')}
              </PillButton>
            </form>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
