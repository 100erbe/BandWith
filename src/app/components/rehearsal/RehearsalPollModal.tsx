import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
  ArrowRight,
  Check,
  Zap,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { TimePicker } from '@/app/components/ui/TimePicker';
import {
  createOrPublishAdminPoll,
  cleanNotesWithoutDays,
  type RehearsalPoll,
} from '@/lib/services/rehearsalPolls';
import { toLocalDateString } from '../../../lib/dates';

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
      setError('Select at least one day of the week to generate slots.');
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
      setError('These slots have already been added.');
      return;
    }

    setTimeSlots((prev) => [...prev, ...newSlots]);
  };

  // Add individual custom slot
  const handleAddCustomSlot = () => {
    if (!customDate || !customStartTime) {
      setError('Please select both a date and start time.');
      return;
    }

    setError(null);
    const exists = timeSlots.some(
      (s) => s.proposed_date === customDate && s.start_time === customStartTime
    );

    if (exists) {
      setError('This slot is already added.');
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
      setError('Please give your poll a title.');
      return;
    }
    if (timeSlots.length === 0) {
      setError('Add at least one candidate time slot for members to vote on.');
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
      setError(publishErr.message || 'Failed to publish poll.');
      return;
    }

    onShowToast?.('Rehearsal availability poll published to band!', 'success');
    onSuccess?.();
    onClose();
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
          className="relative w-full max-w-xl bg-background border border-foreground/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-foreground/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-rehearsal)]/15 border border-[var(--accent-rehearsal)]/30 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-[var(--accent-rehearsal)]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground uppercase tracking-tight leading-tight">
                  {initialProposal ? 'Convert Proposal to Poll' : 'Rehearsal Availability Poll'}
                </h2>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin Tool • Find the Best Day
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

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/25 text-[var(--destructive)] text-xs font-bold">
                {error}
              </div>
            )}

            {/* Converting banner */}
            {initialProposal && (
              <div className="p-3.5 rounded-2xl bg-[var(--accent-rehearsal)]/10 border border-[var(--accent-rehearsal)]/20 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-[var(--accent-rehearsal)] shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  <span className="font-bold">
                    Converting proposal from{' '}
                    {initialProposal.creator_profile?.full_name || 'Band Member'}:
                  </span>{' '}
                  <span className="text-muted-foreground">{initialProposal.title}</span>
                  {initialProposal.preferred_days && initialProposal.preferred_days.length > 0 && (
                    <div className="mt-1 font-semibold text-[11px] text-[var(--accent-rehearsal)]">
                      Preferred days: {initialProposal.preferred_days.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Title & Notes */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Poll Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Next Week Rehearsal Availability"
                  className="w-full bg-card border border-foreground/15 rounded-xl px-4 py-3 text-sm font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[var(--accent-rehearsal)] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Goal / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Focus on ending transitions and sound balance"
                  className="w-full bg-card border border-foreground/15 rounded-xl px-4 py-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[var(--accent-rehearsal)] transition-colors"
                />
              </div>
            </div>

            {/* Generator Mode Selector Tabs */}
            <div className="flex flex-col gap-3 pt-2 border-t border-foreground/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Slot Generator
                </span>
                <div className="flex rounded-lg bg-card border border-foreground/10 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setGeneratorMode('preset')}
                    className={cn(
                      'px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-all',
                      generatorMode === 'preset'
                        ? 'bg-[var(--accent-rehearsal)] text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Whole Week Preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratorMode('custom')}
                    className={cn(
                      'px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-all',
                      generatorMode === 'custom'
                        ? 'bg-[var(--accent-rehearsal)] text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Custom Date/Time
                  </button>
                </div>
              </div>

              {/* Option A: Whole Week Preset */}
              {generatorMode === 'preset' ? (
                <div className="p-4 rounded-2xl bg-card border border-foreground/10 flex flex-col gap-4">
                  {/* Target Week */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Week of:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWeekOffset(0)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase border transition-all',
                          weekOffset === 0
                            ? 'bg-foreground/10 border-foreground/25 text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                      >
                        This Week
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeekOffset(1)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-[11px] font-bold uppercase border transition-all',
                          weekOffset === 1
                            ? 'bg-foreground/10 border-foreground/25 text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Next Week
                      </button>
                    </div>
                  </div>

                  {/* Day Pills */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Include Days
                    </span>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS_META.map((d) => {
                        const isSelected = selectedPresetDays.includes(d.dayIndex);
                        return (
                          <button
                            key={d.dayIndex}
                            type="button"
                            onClick={() => {
                              setSelectedPresetDays((prev) =>
                                prev.includes(d.dayIndex)
                                  ? prev.filter((idx) => idx !== d.dayIndex)
                                  : [...prev, d.dayIndex]
                              );
                            }}
                            className={cn(
                              'py-2 rounded-lg text-xs font-bold uppercase transition-all border',
                              isSelected
                                ? 'bg-[var(--accent-rehearsal)] text-white border-[var(--accent-rehearsal)] shadow-2xs'
                                : 'bg-background text-muted-foreground border-foreground/10 hover:border-foreground/25 hover:text-foreground'
                            )}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Default Time range */}
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        Start Time
                      </span>
                      <TimePicker
                        value={presetStartTime}
                        onChange={setPresetStartTime}
                        textSize="text-sm"
                        className="w-full bg-background border-foreground/15 text-xs py-2"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        End Time
                      </span>
                      <TimePicker
                        value={presetEndTime}
                        onChange={setPresetEndTime}
                        textSize="text-sm"
                        className="w-full bg-background border-foreground/15 text-xs py-2"
                      />
                    </div>
                  </div>

                  {/* Button to batch add */}
                  <button
                    type="button"
                    onClick={handleGenerateWeekPreset}
                    className="w-full py-2.5 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Selected Days to Poll</span>
                  </button>
                </div>
              ) : (
                /* Option B: Custom Date & Time */
                <div className="p-4 rounded-2xl bg-card border border-foreground/10 flex flex-col gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Candidate Date
                    </span>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full bg-background border border-foreground/15 rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-[var(--accent-rehearsal)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        Start Time
                      </span>
                      <TimePicker
                        value={customStartTime}
                        onChange={setCustomStartTime}
                        textSize="text-sm"
                        className="w-full bg-background border-foreground/15 text-xs py-2"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        End Time
                      </span>
                      <TimePicker
                        value={customEndTime}
                        onChange={setCustomEndTime}
                        textSize="text-sm"
                        className="w-full bg-background border-foreground/15 text-xs py-2"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomSlot}
                    className="w-full py-2.5 rounded-xl bg-foreground/10 hover:bg-foreground/15 text-foreground font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slot to Candidate List</span>
                  </button>
                </div>
              )}
            </div>

            {/* Candidate Options Review List */}
            <div className="flex flex-col gap-2 pt-2 border-t border-foreground/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Poll Options ({timeSlots.length})
                </span>
                {timeSlots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTimeSlots([])}
                    className="text-[10px] font-bold uppercase text-[var(--destructive)] hover:opacity-80"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {timeSlots.length === 0 ? (
                <div className="py-8 rounded-2xl border border-dashed border-foreground/20 flex flex-col items-center justify-center text-center p-4">
                  <Clock className="w-6 h-6 text-muted-foreground/40 mb-2" />
                  <p className="text-xs font-bold text-muted-foreground uppercase">
                    No time slots added yet
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 max-w-xs mt-0.5">
                    Generate slots above to give band members dates and times to vote on.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {timeSlots.map((slot, index) => {
                    const parsedDate = new Date(slot.proposed_date + 'T12:00:00');
                    return (
                      <div
                        key={slot.id || index}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-foreground/10 hover:border-foreground/20 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--accent-rehearsal)]/15 text-[var(--accent-rehearsal)] flex items-center justify-center text-xs font-black">
                            {index + 1}
                          </div>
                          <div>
                            <span className="text-xs font-black text-foreground block">
                              {parsedDate.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {slot.start_time}
                              {slot.end_time ? ` – ${slot.end_time}` : ''}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(slot.id)}
                          className="w-7 h-7 rounded-lg text-muted-foreground hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 px-6 border-t border-foreground/10 bg-background/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-3 px-5 rounded-xl border border-foreground/15 text-foreground hover:bg-foreground/5 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={submitting || timeSlots.length === 0}
              className="flex-1 py-3.5 rounded-xl bg-[var(--accent-rehearsal)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Poll...</span>
                </>
              ) : (
                <>
                  <span>Publish Poll & Notify Band</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
