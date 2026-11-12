import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, Sparkles, Send } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { HeaderAction, IconButton, PillButton, PillField, Selector, Card, FormError } from '@/app/components/bw';
import { RailCover } from '@/lib/railActions';
import { TimePicker } from '@/app/components/ui/TimePicker';
import {
  createOrPublishAdminPoll,
  cleanNotesWithoutDays,
  type RehearsalPoll,
} from '@/lib/services/rehearsalPolls';
import { toLocalDateString } from '../../../lib/dates';
import { personName } from '@/lib/personName';
import { useT } from '@/lib/i18n';

interface TimeSlotDraft {
  id: string;
  proposed_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
}

interface RehearsalPollModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  adminId: string;
  initialProposal?: RehearsalPoll | null;
  onSuccess?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const DAYS_META = [
  { dayIndex: 1, label: 'Mon' },
  { dayIndex: 2, label: 'Tue' },
  { dayIndex: 3, label: 'Wed' },
  { dayIndex: 4, label: 'Thu' },
  { dayIndex: 5, label: 'Fri' },
  { dayIndex: 6, label: 'Sat' },
  { dayIndex: 0, label: 'Sun' },
];

export const RehearsalPollModal: React.FC<RehearsalPollModalProps> = ({
  isOpen,
  onClose,
  bandId,
  adminId,
  initialProposal,
  onSuccess,
  onShowToast,
}) => {
  const t = useT();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [generatorMode, setGeneratorMode] = useState<'preset' | 'custom'>('preset');

  // Generator preset state
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = this week/next week, 1 = week after
  const [presetStartTime, setPresetStartTime] = useState('20:00');
  const [presetEndTime, setPresetEndTime] = useState('22:00');
  const [selectedPresetDays, setSelectedPresetDays] = useState<number[]>([1, 2, 3, 4]); // Mon-Thu default

  // Custom single slot inputs
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return toLocalDateString(d);
  });
  const [customStartTime, setCustomStartTime] = useState('20:00');
  const [customEndTime, setCustomEndTime] = useState('22:00');

  // Candidate slots list
  const [timeSlots, setTimeSlots] = useState<TimeSlotDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate Monday of the target week
  const targetMonday = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    // difference to nearest or upcoming Monday
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
    const monday = new Date(now.setDate(diff));
    return monday;
  }, [weekOffset]);

  // Pre-fill if opening from a member proposal
  useEffect(() => {
    if (!isOpen) return;

    if (initialProposal) {
      setTitle(initialProposal.title || 'Rehearsal Availability Poll');
      setNotes(cleanNotesWithoutDays(initialProposal.notes));

      // If proposal had preferred days, select them in preset generator
      if (initialProposal.preferred_days && initialProposal.preferred_days.length > 0) {
        const dayIndices: number[] = [];
        initialProposal.preferred_days.forEach((dayStr) => {
          const lower = dayStr.toLowerCase();
          if (lower.startsWith('mon')) dayIndices.push(1);
          else if (lower.startsWith('tue')) dayIndices.push(2);
          else if (lower.startsWith('wed')) dayIndices.push(3);
          else if (lower.startsWith('thu')) dayIndices.push(4);
          else if (lower.startsWith('fri')) dayIndices.push(5);
          else if (lower.startsWith('sat')) dayIndices.push(6);
          else if (lower.startsWith('sun')) dayIndices.push(0);
        });
        if (dayIndices.length > 0) {
          setSelectedPresetDays(dayIndices);
        }
      }

      // If proposal already had options (e.g. re-editing)
      if (initialProposal.options && initialProposal.options.length > 0) {
        setTimeSlots(
          initialProposal.options.map((o) => ({
            id: o.id || `slot-${Math.random()}`,
            proposed_date: o.proposed_date,
            start_time: o.start_time,
            end_time: o.end_time || '',
          }))
        );
      } else {
        // Start empty or populate with preset
        setTimeSlots([]);
      }
    } else {
      setTitle('Upcoming Rehearsal Availability');
      setNotes('');
      setTimeSlots([]);
    }
  }, [isOpen, initialProposal]);

  // Fast Week Preset Generation
  const handleGenerateWeekPreset = () => {
    if (selectedPresetDays.length === 0) {
      setError(t('Select at least one day of the week to generate slots.'));
      return;
    }

    setError(null);
    const newSlots: TimeSlotDraft[] = [];

    selectedPresetDays.forEach((targetDay) => {
      // Find date corresponding to this day in target week
      const dateObj = new Date(targetMonday);
      const dayOffset = targetDay === 0 ? 6 : targetDay - 1; // 0=Sunday (day 6 from Monday)
      dateObj.setDate(targetMonday.getDate() + dayOffset);
      const isoDate = toLocalDateString(dateObj);

      // Avoid duplicates
      const exists = timeSlots.some(
        (s) => s.proposed_date === isoDate && s.start_time === presetStartTime
      );

      if (!exists) {
        newSlots.push({
          id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          proposed_date: isoDate,
          start_time: presetStartTime,
          end_time: presetEndTime,
        });
      }
    });

    if (newSlots.length === 0) {
      setError(t('These slots have already been added.'));
      return;
    }

    setTimeSlots((prev) => [...prev, ...newSlots]);
  };

  // Add individual custom slot
  const handleAddCustomSlot = () => {
    if (!customDate || !customStartTime) {
      setError(t('Please select both a date and start time.'));
      return;
    }

    setError(null);
    const exists = timeSlots.some(
      (s) => s.proposed_date === customDate && s.start_time === customStartTime
    );

    if (exists) {
      setError(t('This slot is already added.'));
      return;
    }

    const newSlot: TimeSlotDraft = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      proposed_date: customDate,
      start_time: customStartTime,
      end_time: customEndTime || '',
    };

    setTimeSlots((prev) => [...prev, newSlot]);
  };

  const handleRemoveSlot = (id: string) => {
    setTimeSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      setError(t('Please give your poll a title.'));
      return;
    }
    if (timeSlots.length === 0) {
      setError(t('Add at least one candidate time slot for members to vote on.'));
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: publishErr } = await createOrPublishAdminPoll({
      pollId: initialProposal?.id,
      bandId,
      adminId,
      title: title.trim(),
      notes: notes.trim(),
      timeSlots: timeSlots.map((s) => ({
        proposed_date: s.proposed_date,
        start_time: s.start_time,
        end_time: s.end_time || null,
      })),
    });

    setSubmitting(false);

    if (publishErr) {
      setError(publishErr.message || t('Failed to publish poll.'));
      return;
    }

    onShowToast?.(t('Rehearsal availability poll published to band!'), 'success');
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  const slotLabel = (slot: TimeSlotDraft) => {
    const parsedDate = new Date(slot.proposed_date + 'T12:00:00');
    const day = parsedDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return `${day} · ${slot.start_time}${slot.end_time ? ` – ${slot.end_time}` : ''}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        key="rehearsal-poll-builder"
        role="dialog"
        aria-modal="true"
        aria-labelledby="poll-builder-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="bw-pane-detail fixed inset-0 z-[120] bg-background text-foreground flex flex-col"
      >
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Figma "Rehearsal / Poll builder": rehearsal-blue header */}
          <header
            className="bg-accent-rehearsal text-accent-rehearsal-foreground px-4 pb-5 flex flex-col gap-2"
            style={{ paddingTop: 'calc(var(--safe-top) + 16px)' }}
          >
            <div className="flex items-center gap-3 min-h-11">
              <p className="flex-1 min-w-0 bw-label-sm truncate">{t('Admin tool · Find the best day')}</p>
              <RailCover pane />
              <HeaderAction pane label={t('Close')} icon={<X />} variant="sheet" onClick={onClose} />
            </div>
            <h1 id="poll-builder-title" className="bw-display-lg [overflow-wrap:anywhere]">
              {initialProposal ? t('Proposal to poll') : t('Availability poll')}
            </h1>
          </header>

          <div className="w-full max-w-xl mx-auto px-4 pt-5 pb-6 flex flex-col gap-4">
            {error && <FormError>{error}</FormError>}

            {/* Converting banner */}
            {initialProposal && (
              <div className="flex items-start gap-3 p-4 rounded-[16px] bg-card">
                <Sparkles className="w-5 h-5 shrink-0" />
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="bw-body-sm">
                    <span className="font-semibold">
                      {t('From {name}:', { name: personName(initialProposal.creator_profile, t('Band member')) })}
                    </span>{' '}
                    <span className="text-muted-foreground">{initialProposal.title}</span>
                  </p>
                  {initialProposal.preferred_days && initialProposal.preferred_days.length > 0 && (
                    <p className="bw-label-sm text-muted-foreground">
                      {t('Preferred days')} · {initialProposal.preferred_days.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Title & Notes */}
            <PillField
              label={t('Poll title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('e.g. Extra rehearsal before the wedding')}
            />
            <PillField
              label={t('Goal / notes (optional)')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('e.g. Focus on ending transitions')}
            />

            {/* Generator mode (Figma Segmented) */}
            <div role="tablist" aria-label={t('Slot generator')} className="flex p-1 gap-1 rounded-full bg-card">
              {([
                ['preset', t('Whole week preset')],
                ['custom', t('Custom date / time')],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={generatorMode === mode}
                  onClick={() => setGeneratorMode(mode)}
                  className={cn(
                    'flex-1 h-9 px-2 rounded-full bw-button-sm transition-colors',
                    generatorMode === mode
                      ? 'bg-accent-rehearsal text-accent-rehearsal-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {generatorMode === 'preset' ? (
              <>
                {/* Target Week */}
                <fieldset className="flex flex-col gap-2">
                  <legend className="bw-label-sm text-muted-foreground mb-2">{t('Week of')}</legend>
                  <div className="flex gap-2">
                    <Selector selected={weekOffset === 0} onClick={() => setWeekOffset(0)}>
                      {t('This week')}
                    </Selector>
                    <Selector selected={weekOffset === 1} onClick={() => setWeekOffset(1)}>
                      {t('Next week')}
                    </Selector>
                  </div>
                </fieldset>

                {/* Day Pills */}
                <fieldset className="flex flex-col gap-2">
                  <legend className="bw-label-sm text-muted-foreground mb-2">{t('Include days')}</legend>
                  <div className="flex gap-1.5">
                    {DAYS_META.map((d) => (
                      <Selector
                        key={d.dayIndex}
                        selected={selectedPresetDays.includes(d.dayIndex)}
                        onClick={() => {
                          setSelectedPresetDays((prev) =>
                            prev.includes(d.dayIndex)
                              ? prev.filter((idx) => idx !== d.dayIndex)
                              : [...prev, d.dayIndex]
                          );
                        }}
                        className="flex-1 min-w-0 justify-center px-0"
                      >
                        {d.label}
                      </Selector>
                    ))}
                  </div>
                </fieldset>

                {/* Default Time range */}
                <div className="grid grid-cols-2 gap-3">
                  <TimeField label={t('Start')} value={presetStartTime} onChange={setPresetStartTime} />
                  <TimeField label={t('End')} value={presetEndTime} onChange={setPresetEndTime} align="end" />
                </div>

                <PillButton variant="dark" size="md" onClick={handleGenerateWeekPreset}>
                  {t('Add selected days to poll')}
                </PillButton>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="poll-custom-date" className="bw-label-sm text-muted-foreground">
                    {t('Candidate date')}
                  </label>
                  <div className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border focus-within:border-2 focus-within:border-foreground">
                    <Calendar className="w-5 h-5 shrink-0" />
                    <input
                      id="poll-custom-date"
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TimeField label={t('Start')} value={customStartTime} onChange={setCustomStartTime} />
                  <TimeField label={t('End')} value={customEndTime} onChange={setCustomEndTime} align="end" />
                </div>

                <PillButton variant="dark" size="md" onClick={handleAddCustomSlot}>
                  {t('Add slot to poll')}
                </PillButton>
              </>
            )}

            {/* Candidate slots */}
            <div className="flex items-center justify-between gap-3 min-h-9 pt-2">
              <h2 className="bw-label-md text-foreground">{t('Candidate slots')} · {timeSlots.length}</h2>
              {timeSlots.length > 0 && (
                <PillButton variant="danger" size="sm" fullWidth={false} onClick={() => setTimeSlots([])}>
                  {t('Clear all')}
                </PillButton>
              )}
            </div>

            {timeSlots.length === 0 ? (
              <Card className="items-center text-center py-8">
                <Clock className="w-6 h-6 text-muted-foreground" />
                <p className="bw-body-sm text-muted-foreground max-w-xs">
                  {t('No slots yet. Add days above to give the band dates to vote on.')}
                </p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-4">
                {timeSlots.map((slot, index) => (
                  <li
                    key={slot.id || index}
                    className="flex items-center gap-3 min-h-[47px] pl-4 pr-1 rounded-full bg-card"
                  >
                    <Calendar className="w-[18px] h-[18px] shrink-0" />
                    <span className="flex-1 min-w-0 bw-body-md truncate">{slotLabel(slot)}</span>
                    <IconButton
                      label={t('Remove slot')}
                      icon={<X />}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSlot(slot.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* CTA bar */}
        <div
          className="shrink-0 px-4 pt-3 bg-background"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
        >
          <div className="max-w-xl mx-auto grid grid-cols-[2fr_3fr] gap-3">
            <PillButton variant="outline" onClick={onClose} disabled={submitting}>
              {t('Cancel')}
            </PillButton>
            <PillButton
              onClick={handlePublish}
              loading={submitting}
              disabled={timeSlots.length === 0}
              icon={<Send className="w-[18px] h-[18px]" />}
            >
              {submitting ? t('Publishing…') : t('Publish poll')}
            </PillButton>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/** Figma "Input" with a clock glyph, hosting the shared TimePicker. */
const TimeField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  align?: 'start' | 'end';
}> = ({ label, value, onChange, align }) => {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={id} className="bw-label-sm text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border text-foreground focus-within:border-2 focus-within:border-foreground">
        <Clock className="w-5 h-5 shrink-0" />
        <TimePicker
          id={id}
          value={value}
          onChange={onChange}
          align={align}
          showIcon={false}
          textSize="bw-body-lg"
          className="h-full border-0 pb-0 [&_span]:font-medium hover:border-0"
        />
      </div>
    </div>
  );
};
