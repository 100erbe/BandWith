import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, MapPin, CurrencyIcon, Users, Check } from '@/app/components/icons';
import { HeaderAction, IconButton } from '@/app/components/bw/Screen';
import { RailCover } from '@/lib/railActions';
import { PillButton, PillField, FormError } from '@/app/components/bw/Form';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { venueFields } from '@/lib/services/location';
import { createPersonalGig, updatePersonalGig, type Event } from '@/lib/services/events';
import { enqueueMutation } from '@/lib/offline/syncQueue';
import { isOfflineError, reportNetworkStatus, getIsNetworkOnline } from '@/lib/offline/useNetworkStatus';
import { todayLocal } from '../../../lib/dates';
import { useT } from '@/lib/i18n';

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
  /** Opens band creation on top of this form (the form stays open). */
  onCreateBand?: () => void;
}

export const PersonalGigModal: React.FC<PersonalGigModalProps> = ({
  isOpen,
  onClose,
  userId,
  initialData,
  onSaved,
  onCreateBand,
}) => {
  const t = useT();
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
      const today = todayLocal();
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
      setError(t('Gig title is required.'));
      return;
    }
    if (!eventDate) {
      setError(t('Event date is required.'));
      return;
    }
    if (!startTime || !endTime) {
      setError(t('Start and end times are required.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const numericFee = fee.trim() ? parseFloat(fee.replace(/[^0-9.]/g, '')) : 0;
    const cleanFee = isNaN(numericFee) ? 0 : numericFee;

    const savePersonalGigOffline = async () => {
      reportNetworkStatus(false);
      if (isEditing && initialData?.id) {
        const updates: Partial<Event> = {
          title: title.trim(),
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          venue_name: venueName.trim() || undefined,
          fee: cleanFee,
          notes: notes.trim() || undefined,
          _isPendingSync: true,
        };
        await enqueueMutation('update_event', {
          eventId: initialData.id,
          updates,
          isPersonalGig: true,
          personalGigInput: {
            eventId: initialData.id,
            userId,
            title: title.trim(),
            eventDate,
            startTime,
            endTime,
            venueName: venueName.trim() || undefined,
            fee: cleanFee,
            notes: notes.trim() || undefined,
          },
        });
        if (onSaved) {
          onSaved({
            id: initialData.id,
            band_id: null,
            created_by: userId,
            title: title.trim(),
            event_type: 'gig',
            status: 'confirmed',
            event_date: eventDate,
            start_time: startTime,
            end_time: endTime,
            venue_name: venueName.trim() || undefined,
            fee: cleanFee,
            notes: notes.trim() || undefined,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _isPendingSync: true,
          });
        }
      } else {
        const tempId = `offline_ev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const offlineEv: Event = {
          id: tempId,
          band_id: null,
          created_by: userId,
          title: title.trim(),
          event_type: 'gig',
          status: 'confirmed',
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime,
          venue_name: venueName.trim() || undefined,
          fee: cleanFee,
          notes: notes.trim() || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _isPendingSync: true,
          _tempId: tempId,
        };
        await enqueueMutation(
          'create_event',
          {
            eventData: offlineEv,
            isPersonalGig: true,
            personalGigInput: {
              userId,
              title: title.trim(),
              eventDate,
              startTime,
              endTime,
              venueName: venueName.trim() || undefined,
              fee: cleanFee,
              notes: notes.trim() || undefined,
            },
            memberIds: [{ user_id: userId, role: 'solo', fee: cleanFee, status: 'confirmed' }],
          },
          tempId
        );
        if (onSaved) onSaved(offlineEv);
      }
      onClose();
    };

    try {
      if (!getIsNetworkOnline()) {
        await savePersonalGigOffline();
        return;
      }

      const withFastTimeout = <T,>(promise: Promise<T>, ms = 4500): Promise<T> =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('offline_timeout')), ms)
          ),
        ]);

      if (isEditing && initialData?.id) {
        const { data, error: updateErr } = await withFastTimeout(updatePersonalGig({
          eventId: initialData.id,
          userId,
          title: title.trim(),
          eventDate,
          startTime,
          endTime,
          venueName: venueName.trim() || undefined,
          fee: cleanFee,
          notes: notes.trim() || undefined,
        }));

        if (updateErr) {
          if (isOfflineError(updateErr)) {
            await savePersonalGigOffline();
            return;
          }
          throw updateErr;
        }
        if (data && onSaved) onSaved(data);
      } else {
        const { data, error: createErr } = await withFastTimeout(createPersonalGig({
          userId,
          title: title.trim(),
          eventDate,
          startTime,
          endTime,
          venueName: venueName.trim() || undefined,
          fee: cleanFee,
          notes: notes.trim() || undefined,
        }));

        if (createErr) {
          if (isOfflineError(createErr)) {
            await savePersonalGigOffline();
            return;
          }
          throw createErr;
        }
        if (data && onSaved) onSaved(data);
      }

      onClose();
    } catch (err: any) {
      if (isOfflineError(err)) {
        await savePersonalGigOffline();
        return;
      }
      console.error('Failed to save personal gig:', err);
      setError(err?.message || t('Failed to save personal gig. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canSubmit = !!title.trim() && !!eventDate && !!startTime && !!endTime;

  return (
    <AnimatePresence>
      {/* Figma: Modal / Log personal gig — full screen, pink header block */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="personal-gig-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'tween', duration: 0.25 }}
        className="bw-pane-detail fixed inset-0 z-[110] flex flex-col bg-background text-foreground"
      >
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {/* Header block */}
            <header
              className="bg-accent-personal text-accent-personal-foreground px-4 pb-6 flex flex-col gap-3"
              style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}
            >
              <div className="max-w-xl mx-auto w-full flex flex-col gap-3">
                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="bw-label-sm opacity-80">{t('Personal gig')}</p>
                    <h2 id="personal-gig-title" className="bw-display-lg [overflow-wrap:anywhere]">
                      {isEditing ? t('Edit personal gig') : t('Log personal gig')}
                    </h2>
                  </div>
                  <RailCover pane />
                  <HeaderAction pane label={t('Close')} variant="event" icon={<X />} onClick={onClose} className="self-start" />
                </div>
                <p className="bw-body-md">
                  {t('Only you can see it. It blocks the date for your bands and syncs to your earnings.')}
                </p>
              </div>
            </header>

            <div className="px-4 pt-6 pb-6 max-w-xl mx-auto w-full flex flex-col gap-5">
              {error && <FormError>{error}</FormError>}

              <PillField
                label={t('Gig title *')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('e.g. Solo acoustic set @ The Blue Room')}
                required
                autoFocus
              />

              <FieldShell label={t('Date *')} icon={<Calendar className="w-5 h-5" />}>
                <DatePicker
                  value={eventDate}
                  onChange={setEventDate}
                  accentColor="var(--accent-personal)"
                  placeholder={t('Select date…')}
                  showIcon={false}
                  className={PICKER_CLASS}
                />
              </FieldShell>

              <div className="grid grid-cols-2 gap-3">
                <FieldShell label={t('Start *')} icon={<Clock className="w-5 h-5" />}>
                  <TimePicker
                    value={startTime}
                    onChange={setStartTime}
                    accentColor="var(--accent-personal)"
                    align="start"
                    textSize="bw-body-lg"
                    showIcon={false}
                    className={PICKER_CLASS}
                  />
                </FieldShell>
                <FieldShell label={t('End *')} icon={<Clock className="w-5 h-5" />}>
                  <TimePicker
                    value={endTime}
                    onChange={setEndTime}
                    accentColor="var(--accent-personal)"
                    align="end"
                    textSize="bw-body-lg"
                    showIcon={false}
                    className={PICKER_CLASS}
                  />
                </FieldShell>
              </div>

              <FieldShell label={t('Venue / location (optional)')} icon={<MapPin className="w-5 h-5" />}>
                <VenueAutocomplete
                  value={venueName}
                  onChange={setVenueName}
                  onSelect={(place) => setVenueName(venueFields(place).location)}
                  placeholder={t('Search venue…')}
                  className="h-[50px] border-0 pb-0 bw-body-lg normal-case font-medium text-foreground placeholder:text-muted-foreground/60"
                />
              </FieldShell>

              <PillField
                label={t('My personal fee (optional)')}
                icon={<CurrencyIcon className="w-5 h-5" />}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
                hint={t('Syncs to your personal earnings tracker')}
              />

              <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-field border border-border focus-within:border-foreground transition-colors">
                <span className="bw-label-xs text-muted-foreground">{t('Personal notes (optional)')}</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('Parking, load-in gate, wardrobe, gear checklist…')}
                  rows={2}
                  className="w-full bg-transparent bw-body-lg text-foreground placeholder:text-muted-foreground/60 outline-none resize-none"
                />
              </label>

              <p className="flex items-center gap-2 bw-body-sm text-muted-foreground">
                <Users className="w-4 h-4 shrink-0 text-foreground" />
                <span>
                  {t('Want to invite bandmates?')}{' '}
                  <button type="button" onClick={() => onCreateBand?.()} className="text-foreground underline underline-offset-2">
                    {t('Create a free band')}
                  </button>
                </span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
            <div className="max-w-xl mx-auto w-full flex items-center gap-3">
              <PillButton variant="outline" className="flex-[0_0_36%]" onClick={onClose}>
                {t('Cancel')}
              </PillButton>
              <PillButton
                type="submit"
                className="flex-1"
                disabled={!canSubmit}
                loading={isSubmitting}
                icon={<Check className="w-[18px] h-[18px]" />}
              >
                {isSubmitting ? t('Saving…') : isEditing ? t('Save changes') : t('Create personal gig')}
              </PillButton>
            </div>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};

/** Picker trigger inside a FieldShell pill: drop the pickers' underline look. */
const PICKER_CLASS = 'h-[50px] border-0 pb-0 font-medium bw-body-lg text-foreground [&_span]:font-medium';

/** Figma Input chrome (label above a 52pt pill with a leading icon) for non-<input> controls. */
const FieldShell: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="flex flex-col gap-2 min-w-0">
    <span className="bw-label-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-3 h-[52px] pl-4 pr-3 rounded-full bg-field border border-border text-foreground focus-within:border-2 focus-within:border-foreground transition-[border-color]">
      <span className="shrink-0 flex">{icon}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  </div>
);
