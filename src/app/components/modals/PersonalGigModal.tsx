import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic2, Calendar, Clock, MapPin, DollarSign, FileText, Sparkles, Loader2, Lock } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { createPersonalGig, updatePersonalGig, type Event } from '@/lib/services/events';

interface PersonalGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialData?: {
    id: string;
    title: string;
    eventDate: string;
    startTime?: string;
    endTime?: string;
    venueName?: string;
    fee?: number;
    notes?: string;
  } | null;
  onSaved?: (event: Event) => void;
  onOpenUpgradeSheet?: () => void;
}

export const PersonalGigModal: React.FC<PersonalGigModalProps> = ({
  isOpen,
  onClose,
  userId,
  initialData,
  onSaved,
  onOpenUpgradeSheet,
}) => {
  const isEditing = Boolean(initialData?.id);

  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('23:00');
  const [venueName, setVenueName] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialData when modal opens or initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setEventDate(initialData.eventDate || '');
      setStartTime(initialData.startTime || '20:00');
      setEndTime(initialData.endTime || '23:00');
      setVenueName(initialData.venueName || '');
      setFee(initialData.fee != null ? String(initialData.fee) : '');
      setNotes(initialData.notes || '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      setTitle('');
      setEventDate(today);
      setStartTime('20:00');
      setEndTime('23:00');
      setVenueName('');
      setFee('');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Gig title is required.');
      return;
    }
    if (!eventDate) {
      setError('Event date is required.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Start and end times are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const numericFee = fee.trim() ? parseFloat(fee.replace(/[^0-9.]/g, '')) : 0;

    try {
      if (isEditing && initialData?.id) {
        const { data, error: updateErr } = await updatePersonalGig({
          eventId: initialData.id,
          userId,
          title: title.trim(),
          eventDate,
          startTime,
          endTime,
          venueName: venueName.trim() || undefined,
          fee: isNaN(numericFee) ? 0 : numericFee,
          notes: notes.trim() || undefined,
        });

        if (updateErr) throw updateErr;
        if (data && onSaved) onSaved(data);
      } else {
        const { data, error: createErr } = await createPersonalGig({
          userId,
          title: title.trim(),
          eventDate,
          startTime,
          endTime,
          venueName: venueName.trim() || undefined,
          fee: isNaN(numericFee) ? 0 : numericFee,
          notes: notes.trim() || undefined,
        });

        if (createErr) throw createErr;
        if (data && onSaved) onSaved(data);
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to save personal gig:', err);
      setError(err?.message || 'Failed to save personal gig. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
          className="relative w-full max-w-lg bg-background border border-foreground/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-foreground/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-gig/15 border border-accent-gig/30 flex items-center justify-center shrink-0">
                <Mic2 className="w-5 h-5 text-accent-gig" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-accent-gig leading-tight">
                  PERSONAL GIG • FREEMIUM
                </div>
                <h2 className="text-lg font-black text-foreground uppercase tracking-tight leading-tight mt-0.5">
                  {isEditing ? 'EDIT PERSONAL GIG' : 'LOG PERSONAL GIG'}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-foreground/15 flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive">
                {error}
              </div>
            )}

            {/* Gig Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                <Mic2 className="w-3.5 h-3.5 text-accent-gig" />
                Gig Title <span className="text-accent-gig">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Solo Acoustic Set @ The Blue Room"
                className="w-full bg-card border border-foreground/15 rounded-xl px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent-gig transition-colors"
                required
                autoFocus
              />
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Event Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-accent-gig" />
                  Date <span className="text-accent-gig">*</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-card border border-foreground/15 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-accent-gig transition-colors"
                  required
                />
              </div>

              {/* Start Time */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent-gig" />
                  Start <span className="text-accent-gig">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-card border border-foreground/15 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-accent-gig transition-colors"
                  required
                />
              </div>

              {/* End Time */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent-gig" />
                  End <span className="text-accent-gig">*</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-card border border-foreground/15 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-accent-gig transition-colors"
                  required
                />
              </div>
            </div>

            {/* Venue / Location Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-foreground/50" />
                Venue / Location Name (Optional)
              </label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Dublin Castle, St. Stephen's Green"
                className="w-full bg-card border border-foreground/15 rounded-xl px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent-gig transition-colors"
              />
            </div>

            {/* My Personal Fee */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-accent-gig" />
                  My Personal Fee (Optional)
                </label>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  Syncs to personal earnings tracker
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground font-bold text-sm">
                  €
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-card border border-foreground/15 rounded-xl pl-8 pr-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent-gig transition-colors"
                />
              </div>
            </div>

            {/* Personal Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-foreground/50" />
                Personal Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Parking instructions, load-in gate, wardrobe, gear checklist..."
                rows={3}
                className="w-full bg-card border border-foreground/15 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent-gig transition-colors resize-none"
              />
            </div>

            {/* Subtle Freemium Upsell Banner */}
            <div className="mt-1 p-3.5 rounded-2xl bg-card border border-foreground/10 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-foreground/60" />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <p className="text-[11px] font-medium text-foreground/75 leading-relaxed">
                  Want to invite bandmates, split fees, attach setlists, or send client quotes?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUpgradeSheet?.();
                    }}
                    className="font-bold text-accent-gig hover:underline inline-flex items-center gap-1"
                  >
                    Upgrade to Band Admin
                    <Sparkles className="w-3 h-3 text-accent-gig inline" />
                  </button>
                </p>
              </div>
            </div>

            {/* Submit & Cancel Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-foreground/15 text-xs font-bold uppercase tracking-wider text-foreground/70 hover:bg-foreground/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !eventDate || !startTime || !endTime}
                style={{ backgroundColor: 'var(--accent-gig)', color: 'var(--accent-gig-fg)' }}
                className="flex-2 py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-black/10 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEditing ? 'Save Changes' : 'Create Personal Gig'}</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
