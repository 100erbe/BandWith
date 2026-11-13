import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, Sparkles, Send, ChevronLeft, ChevronRight, MapPin, Plus, Check } from '@/app/components/icons';
import { useBand } from '@/lib/BandContext';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { getActiveSymbol as sym } from '@/lib/currency';
import { pollShareLabel } from './PollDetails';
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
import { personName, personInitials } from '@/lib/personName';
import { useT, intlLocale } from '@/lib/i18n';
import { useBandFreeDays, useCandidateFreeCounts, slotKey } from '@/lib/bandAvailability';
import { FreeDots, FreeHeatLegend, FreeLabel, freeTone, heatStyle } from '@/app/components/ui/FreeHeat';
import { ComposerCard, ComposerPreview, ComposerShell, Segmented, useComposerLayout } from '@/app/components/composer/Composer';

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
  /** iPad composer: "Schedule directly" goes back to the rehearsal composer. */
  onScheduleDirectly?: () => void;
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
  onScheduleDirectly,
}) => {
  const t = useT();
  // iPad (data-bw-wide, no Duo rail): the poll opens as a one-screen composer
  // (Figma iPad · 05 "Rehearsal / New · Poll availability").
  const { composer: composerOn, landscape } = useComposerLayout();
  const [voteBy, setVoteBy] = useState('');
  // Place, cost & songs (097), composer only.
  const [location, setLocation] = useState('');
  const [roomCost, setRoomCost] = useState('');
  const [focusSongs, setFocusSongs] = useState<{ id: string; title: string }[]>([]);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  // Who votes and the vote-by time (098). Nobody left out = every member.
  const [excluded, setExcluded] = useState<string[]>([]);
  const [voteByTime, setVoteByTime] = useState('18:00');
  const { selectedBand } = useBand();
  const roster = useMemo(
    () =>
      selectedBand?.id === bandId
        ? (selectedBand.members || [])
            .filter((m) => !!m.user_id)
            .map((m) => ({
              id: m.user_id as string,
              name: personName(m.profile, t('Band member')),
              initials: personInitials(m.profile, '?'),
            }))
            .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i)
        : [],
    [selectedBand, bandId]
  );
  const invitedIds = excluded.length === 0 ? [] : roster.filter((m) => !excluded.includes(m.id)).map((m) => m.id);
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

  // Free-slot heatmap (095): free members per day of the target week, for
  // the preset window, and per candidate slot.
  const weekDates = useMemo(
    () =>
      DAYS_META.map((d) => {
        const x = new Date(targetMonday);
        x.setDate(targetMonday.getDate() + (d.dayIndex === 0 ? 6 : d.dayIndex - 1));
        return toLocalDateString(x);
      }),
    [targetMonday]
  );
  const weekFree = useBandFreeDays({
    bandId,
    from: weekDates[0],
    to: weekDates[6],
    start: presetStartTime,
    end: presetEndTime,
    enabled: isOpen && generatorMode === 'preset',
  });
  const slotFree = useCandidateFreeCounts(
    bandId,
    timeSlots.map((s) => ({ date: s.proposed_date, start: s.start_time, end: s.end_time })),
    isOpen
  );

  // Pre-fill if opening from a member proposal
  useEffect(() => {
    if (!isOpen) return;

    setLocation(initialProposal?.location || '');
    setRoomCost(initialProposal?.room_cost != null ? String(initialProposal.room_cost) : '');
    // Member proposals carry no songs; the builder never reopens a published poll.
    setFocusSongs([]);
    setExcluded([]);
    setVoteByTime('18:00');
    if (initialProposal) {
      setTitle(initialProposal.title || t('Rehearsal Availability Poll'));
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
      setTitle(t('Upcoming Rehearsal Availability'));
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
    if (voteBy && !voteByCheck().ok) {
      setError(t('Pick a day before the first slot'));
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
      // Vote by (058) and place, cost & songs (097): set in the composer and the builder.
      voteBy: voteBy || null,
      location: location.trim() || null,
      roomCost: parseFloat(roomCost) > 0 ? parseFloat(roomCost) : null,
      focusSongIds: focusSongs.map(s => s.id),
      invitedUserIds: invitedIds,
      voteByTime: voteBy ? voteByTime || null : null,
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

  // Place, cost & songs (097): the same fields in the iPad composer card and
  // in the phone / Duo builder. Members get only their share of the room.
  const memberTotalOf = (): number | undefined =>
    excluded.length > 0
      ? invitedIds.length
      : weekFree?.values().next().value?.total ?? slotFree.values().next().value?.total ?? (roster.length || undefined);

  /** Who votes: tap a member to leave them out (you always vote). */
  function renderRoster(chipBg: string) {
    if (roster.length === 0) return null;
    const count = roster.length - excluded.length;
    return (
      <div className="flex flex-col gap-2" role="group" aria-label={t('Who votes')}>
        <div className="flex items-center justify-between gap-3">
          <span className="bw-label-sm text-muted-foreground">{t('Who votes')}</span>
          <span className="bw-label-xs text-muted-foreground">{t('{count} of {total}', { count, total: roster.length })}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {roster.map((m) => {
            const on = !excluded.includes(m.id);
            const self = m.id === adminId;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                aria-label={self ? t('You') : m.name}
                title={m.name}
                disabled={self}
                onClick={() => setExcluded((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                className={cn(
                  'relative w-12 h-12 rounded-full flex items-center justify-center bw-label-md shrink-0 transition-opacity',
                  chipBg,
                  on ? 'text-foreground' : 'text-muted-foreground opacity-50',
                  self ? 'cursor-default' : 'cursor-pointer'
                )}
              >
                {m.initials}
                {on && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-surface-inverse text-surface-inverse-foreground flex items-center justify-center"
                  >
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPlaceFields(idp: string, members: number | undefined, chipBg: string) {
    return (
      <>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idp}-poll-place`} className="bw-label-sm text-muted-foreground">
            {t('Location / studio')}
          </label>
          <div className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border focus-within:border-2 focus-within:border-foreground">
            <MapPin className="w-5 h-5 shrink-0" />
            <input
              id={`${idp}-poll-place`}
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={t('e.g. Blackbox Studios · room 2')}
              className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2 min-w-0">
            <label htmlFor={`${idp}-poll-cost`} className="bw-label-sm text-muted-foreground">
              {t('Room cost')}
            </label>
            <div className="flex items-center gap-2 h-[52px] px-4 rounded-full bg-field border border-border focus-within:border-2 focus-within:border-foreground">
              <span className="bw-body-lg shrink-0">{sym().trim()}</span>
              <input
                id={`${idp}-poll-cost`}
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                value={roomCost}
                onChange={e => setRoomCost(e.target.value)}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg text-foreground tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <span className="bw-label-sm text-muted-foreground">{t('Split')}</span>
            <div className={cn('h-[52px] px-4 rounded-full flex items-center bw-body-lg truncate', chipBg)}>
              {(() => { const share = pollShareLabel(parseFloat(roomCost) || 0, members); return share ? t('{amount} each', { amount: share }) : t('Free'); })()}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="bw-label-sm text-muted-foreground">{t('Focus songs')}</span>
          <div className="flex flex-wrap gap-2">
            {focusSongs.map(song => (
              <span
                key={song.id}
                className={cn('inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bw-label-sm max-w-full', chipBg)}
              >
                <span className="truncate">{song.title}</span>
                <IconButton
                  label={t('Remove {title}', { title: song.title })}
                  icon={<X />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setFocusSongs(prev => prev.filter(s => s.id !== song.id))}
                />
              </span>
            ))}
            <button
              type="button"
              onClick={() => setSongPickerOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-foreground/30 bw-label-sm cursor-pointer hover:bg-foreground/[0.06]"
            >
              <Plus aria-hidden className="w-4 h-4" />
              {t('Add')}
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderSongPicker(zIndex?: number) {
    return (
      <AnimatePresence>
        {songPickerOpen && (
          <SongPicker
            isOpen={songPickerOpen}
            onClose={() => setSongPickerOpen(false)}
            onSelect={(song: PickedSong) => {
              setFocusSongs(prev => (prev.some(s => s.id === song.id) ? prev : [...prev, { id: song.id, title: song.title }]));
            }}
            selectedIds={focusSongs.map(s => s.id)}
            theme="blue"
            zIndex={zIndex}
          />
        )}
      </AnimatePresence>
    );
  }

  /** "Vote by" must fall between today and the first candidate slot. */
  const voteByCheck = () => {
    const today = toLocalDateString(new Date());
    const first = [...timeSlots].map(s => s.proposed_date).sort()[0];
    return { today, first, ok: !!voteBy && voteBy >= today && (!first || voteBy <= first) };
  };

  function renderVoteByField(idp: string) {
    const { today, first, ok } = voteByCheck();
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idp}-poll-vote-by`} className="bw-label-sm text-muted-foreground">
          {t('Vote by')}
        </label>
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
          <div className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border focus-within:border-2 focus-within:border-foreground min-w-0">
            <Calendar className="w-5 h-5 shrink-0" />
            <input
              id={`${idp}-poll-vote-by`}
              type="date"
              value={voteBy}
              min={today}
              max={first}
              onChange={e => setVoteBy(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg text-foreground"
            />
          </div>
          <div
            className={cn(
              'flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border text-foreground focus-within:border-2 focus-within:border-foreground min-w-0',
              !voteBy && 'opacity-50 pointer-events-none'
            )}
            aria-disabled={!voteBy}
          >
            <Clock className="w-5 h-5 shrink-0" />
            <TimePicker
              id={`${idp}-poll-vote-by-time`}
              value={voteByTime}
              onChange={setVoteByTime}
              align="end"
              showIcon={false}
              textSize="bw-body-lg"
              className="h-full border-0 pb-0 [&_span]:font-medium hover:border-0"
            />
          </div>
        </div>
        {voteBy && !ok && <p className="bw-label-xs text-destructive">{t('Pick a day before the first slot')}</p>}
      </div>
    );
  }

  // ── TABLET COMPOSER ───────────────────────────────────────
  // Same state and publish as the builder below; days are picked on a week
  // strip coloured by how many members are free (095), and the preview shows
  // the slots as members will vote on them.
  function renderComposer() {
    const todayStr = toLocalDateString(new Date());
    const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) =>
      new Date(d + 'T12:00:00').toLocaleDateString(intlLocale(), opts);
    const sorted = [...timeSlots].sort((a, b) =>
      (a.proposed_date + a.start_time).localeCompare(b.proposed_date + b.start_time)
    );
    const freeOf = (s: TimeSlotDraft) =>
      slotFree.get(slotKey({ date: s.proposed_date, start: s.start_time, end: s.end_time })) ?? null;
    const memberTotal = memberTotalOf();
    const best = sorted.reduce<TimeSlotDraft | null>((acc, s) => {
      const f = freeOf(s)?.free ?? -1;
      return f > (acc ? freeOf(acc)?.free ?? -1 : -1) ? s : acc;
    }, null);
    const voteByOk = voteByCheck().ok;

    const toggleDay = (date: string) => {
      setError(null);
      const has = timeSlots.some(s => s.proposed_date === date);
      if (has) {
        setTimeSlots(prev => prev.filter(s => s.proposed_date !== date));
        return;
      }
      setTimeSlots(prev => [
        ...prev,
        {
          id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          proposed_date: date,
          start_time: presetStartTime,
          end_time: presetEndTime,
        },
      ]);
    };

    const ready = [title.trim().length > 0, timeSlots.length > 0, location.trim().length > 0, voteByOk].filter(Boolean).length;
    const costNumber = parseFloat(roomCost) || 0;
    const share = pollShareLabel(costNumber, memberTotal);

    const placeCard = (
      <ComposerCard n={3} title={t('Place, cost & songs')} done={location.trim().length > 0}>
        {renderPlaceFields('cmp', memberTotal, 'bg-background')}
      </ComposerCard>
    );

    const pollCard = (
      <ComposerCard n={1} title={t('Session & roster')} done={title.trim().length > 0}>
        {initialProposal && (
          <div className="flex items-start gap-3 p-4 rounded-[20px] bg-background">
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
        <PillField
          label={t('Poll title')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('e.g. Extra rehearsal before the wedding')}
        />
        {renderRoster('bg-background') ?? (
          <p className="bw-label-xs text-muted-foreground">
            {memberTotal
              ? t('Sent to every active member · {n}', { n: memberTotal })
              : t('Sent to every active member')}
          </p>
        )}
      </ComposerCard>
    );

    const slotsCard = (
      <ComposerCard n={2} title={t('Candidate slots')} done={timeSlots.length > 0}>
        <div className="flex items-center gap-1 min-w-0">
          <span className="bw-body-lg font-semibold shrink-0 mr-1">
            {weekOffset === 0
              ? t('This week')
              : weekOffset === 1
                ? t('Next week')
                : `${dayLabel(weekDates[0], { day: 'numeric', month: 'short' })} – ${dayLabel(weekDates[6], { day: 'numeric', month: 'short' })}`}
          </span>
          <span className="bw-label-xs text-muted-foreground flex-1 min-w-0 truncate text-right">
            {t('From band calendars')}
          </span>
          <IconButton
            label={t('Previous week')}
            icon={<ChevronLeft />}
            variant="ghost"
            size="sm"
            onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
          />
          <IconButton
            label={t('Next week')}
            icon={<ChevronRight />}
            variant="ghost"
            size="sm"
            onClick={() => setWeekOffset(w => Math.min(8, w + 1))}
          />
        </div>
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={t('Candidate days')}>
          {weekDates.map(d => {
            const past = d < todayStr;
            const c = !past ? weekFree?.get(d) ?? null : null;
            const on = timeSlots.some(s => s.proposed_date === d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                disabled={past}
                aria-label={`${dayLabel(d, { weekday: 'long', day: 'numeric', month: 'long' })}${c ? `, ${t('{free} of {total} free', { free: c.free, total: c.total })}` : ''}`}
                onClick={() => toggleDay(d)}
                className={cn(
                  'min-w-0 rounded-[20px] py-2.5 flex flex-col items-center gap-1 transition-colors',
                  past
                    ? 'bg-background text-muted-foreground opacity-50 cursor-not-allowed'
                    : on
                      ? 'bg-surface-inverse text-surface-inverse-foreground cursor-pointer'
                      : 'bg-background text-foreground hover:bg-foreground/[0.06] cursor-pointer'
                )}
              >
                <span className="bw-label-xs opacity-70">{dayLabel(d, { weekday: 'short' })}</span>
                <span className="bw-h2 tabular-nums leading-none">{new Date(d + 'T12:00:00').getDate()}</span>
                {c ? (
                  <>
                    <FreeDots count={c} size={5} onColor={on ? 'var(--accent-gig)' : 'var(--success)'} />
                    <span className="bw-label-xs text-[9px] leading-tight text-center opacity-80">
                      {c.free}/{c.total}
                      <br />
                      {t('free')}
                    </span>
                  </>
                ) : (
                  <span className="bw-label-xs text-[9px] opacity-60 h-[26px] flex items-center">—</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TimeField label={t('Start')} value={presetStartTime} onChange={setPresetStartTime} />
          <TimeField label={t('End')} value={presetEndTime} onChange={setPresetEndTime} align="end" />
        </div>
        <p className="bw-label-xs text-muted-foreground">{t('Tap a day to add it with these times')}</p>
        {initialProposal?.preferred_days && initialProposal.preferred_days.length > 0 && (
          <PillButton variant="outline" size="sm" fullWidth={false} onClick={handleGenerateWeekPreset}>
            {t('Add preferred days')}
          </PillButton>
        )}
        {sorted.length > 0 && (
          <ul className="flex flex-col">
            {sorted.map(slot => {
              const f = freeOf(slot);
              return (
                <li key={slot.id} className="flex items-center gap-3 min-h-11 border-t border-foreground/10">
                  <span className="bw-body-md font-semibold w-24 shrink-0 truncate">
                    {dayLabel(slot.proposed_date, { weekday: 'short', day: 'numeric' })}
                  </span>
                  <span className="bw-label-sm tabular-nums flex-1 min-w-0 truncate">
                    {slot.start_time}
                    {slot.end_time ? `–${slot.end_time}` : ''}
                  </span>
                  {f && <FreeLabel count={f} className={freeTone(f)} />}
                  <IconButton
                    label={t('Remove slot')}
                    icon={<X />}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSlot(slot.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </ComposerCard>
    );

    const deadlineCard = (
      <ComposerCard n={4} title={t('Vote deadline & note')} done={voteByOk}>
        {renderVoteByField('cmp')}
        <div className="flex flex-col gap-2">
          <label htmlFor="cmp-poll-note" className="bw-label-sm text-muted-foreground">
            {t('Goal / notes (optional)')}
          </label>
          <textarea
            id="cmp-poll-note"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder={t('e.g. Focus on ending transitions')}
            className="w-full rounded-[24px] bg-field border border-border px-4 py-3 bw-body-md text-foreground outline-none resize-none focus:border-2 focus:border-foreground"
          />
        </div>
      </ComposerCard>
    );

    const publishButton = (
      <PillButton
        size="lg"
        onClick={handlePublish}
        loading={submitting}
        disabled={timeSlots.length === 0 || !title.trim() || (!!voteBy && !voteByOk)}
        icon={<Send className="w-5 h-5" />}
        style={{ backgroundColor: 'var(--accent-gig)', color: 'var(--accent-gig-fg)' }}
      >
        {submitting ? t('Publishing…') : t('Publish poll')}
      </PillButton>
    );

    const voteLine = [
      voteByOk
        ? t('Vote by {date}', {
            date: `${dayLabel(voteBy, { weekday: 'short', day: 'numeric', month: 'short' })}${voteByTime ? `, ${voteByTime}` : ''}`,
          })
        : null,
      memberTotal ? t('{voted} of {total} voted', { voted: 0, total: memberTotal }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const preview = (
      <ComposerPreview
        label={t('Live preview')}
        caption={t('As members vote')}
        className={landscape ? 'sticky top-0 min-h-[min(720px,calc(100dvh-140px))]' : undefined}
        footer={
          <>
            {error && <FormError>{error}</FormError>}
            {publishButton}
          </>
        }
      >
        <div className="rounded-[28px] p-5 flex flex-col gap-2 min-w-0 bg-accent-rehearsal text-accent-rehearsal-foreground">
          <span className="bw-label-xs">{t('Rehearsal poll · active')}</span>
          <h3 className="bw-display-lg [overflow-wrap:anywhere]">{title.trim() || t('Rehearsal poll')}</h3>
          {voteLine && <span className="bw-label-xs opacity-90">{voteLine}</span>}
          {(location.trim() || share || focusSongs.length > 0) && (
            <div className="flex flex-col gap-1 pt-1">
              {(location.trim() || share) && (
                <span className="bw-body-sm flex items-center gap-2 min-w-0">
                  {location.trim() && <MapPin aria-hidden className="w-4 h-4 shrink-0" />}
                  <span className="truncate">
                    {[location.trim(), share ? t('{amount} each', { amount: share }) : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
              )}
              {focusSongs.length > 0 && (
                <span className="bw-body-sm [overflow-wrap:anywhere]">{focusSongs.map(s => s.title).join(' · ')}</span>
              )}
            </div>
          )}
        </div>
        {sorted.length === 0 ? (
          <p className="bw-body-sm text-muted-foreground text-center py-6">
            {t('No slots yet. Add days above to give the band dates to vote on.')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sorted.map(slot => {
              const f = freeOf(slot);
              return (
                <li key={slot.id} className="rounded-[20px] bg-background px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="bw-body-lg font-semibold flex-1 min-w-0 truncate">
                      {dayLabel(slot.proposed_date, { weekday: 'short', day: 'numeric' })} · {slot.start_time}
                    </span>
                    {best?.id === slot.id && f && f.free > 0 ? (
                      <span className="bw-label-xs rounded-full px-2.5 py-1 bg-accent-gig text-accent-gig-foreground shrink-0">
                        {t('Top pick')}
                      </span>
                    ) : (
                      f && <span className="bw-label-xs text-muted-foreground shrink-0">{f.free}/{f.total}</span>
                    )}
                  </div>
                  {f && <FreeDots count={f} size={10} onColor="currentColor" className="text-foreground" />}
                </li>
              );
            })}
          </ul>
        )}
      </ComposerPreview>
    );

    const modeSwitch = onScheduleDirectly && !initialProposal ? (
      <div className={cn(landscape ? 'w-[340px]' : 'w-full order-last basis-full')}>
        <Segmented
          label={t('Scheduling mode')}
          value="poll"
          options={[
            { value: 'direct', label: t('Schedule directly') },
            { value: 'poll', label: t('Poll availability') },
          ]}
          onChange={v => {
            if (v === 'direct') onScheduleDirectly();
          }}
        />
      </div>
    ) : undefined;

    return (
      <ComposerShell
        kind="rehearsal-poll"
        zClassName="z-[105]"
        title={initialProposal ? t('Proposal to poll') : t('New rehearsal')}
        subline={t('Poll · members vote on dates')}
        closeLabel={t('Close')}
        onClose={onClose}
        ready={{ done: ready, total: 4 }}
        headerCenter={modeSwitch}
        accent="var(--accent-gig)"
        accentFg="var(--accent-gig-fg)"
      >
        {landscape ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-4 items-start">
            <div className="flex flex-col gap-4 min-w-0">
              {pollCard}
              {placeCard}
            </div>
            <div className="flex flex-col gap-4 min-w-0">
              {slotsCard}
              {deadlineCard}
            </div>
            {preview}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-4 min-w-0">
              {pollCard}
              {slotsCard}
              {placeCard}
            </div>
            <div className="flex flex-col gap-4 min-w-0">
              {deadlineCard}
              {preview}
            </div>
          </div>
        )}
        {renderSongPicker()}
      </ComposerShell>
    );
  }

  if (!isOpen) return null;

  const slotLabel = (slot: TimeSlotDraft) => {
    const parsedDate = new Date(slot.proposed_date + 'T12:00:00');
    const day = parsedDate.toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
    return `${day} · ${slot.start_time}${slot.end_time ? ` – ${slot.end_time}` : ''}`;
  };

  if (composerOn) return renderComposer();

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

            {/* Who votes (098), as in the iPad composer */}
            {renderRoster('bg-card')}

            {/* Place, cost & songs (097), as in the iPad composer */}
            <section className="flex flex-col gap-4 pt-2" aria-labelledby="poll-builder-place">
              <h2 id="poll-builder-place" className="bw-label-md text-foreground">
                {t('Place, cost & songs')}
              </h2>
              {renderPlaceFields('bld', memberTotalOf(), 'bg-card')}
            </section>

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
                  {weekFree && (
                    <>
                      <div className="flex gap-1.5" data-bw-heatmap="">
                        {DAYS_META.map((d, i) => {
                          const c = weekDates[i] >= toLocalDateString(new Date()) ? weekFree.get(weekDates[i]) : undefined;
                          return (
                            <span
                              key={d.dayIndex}
                              className={cn('flex-1 min-w-0 h-7 rounded-full flex items-center justify-center bw-label-xs text-foreground', (!c || c.free === 0) && 'bg-foreground/[0.08] text-muted-foreground')}
                              style={heatStyle(c)}
                              aria-label={c ? t('{day}: {free} of {total} free', { day: d.label, free: c.free, total: c.total }) : undefined}
                            >
                              {c ? `${c.free}/${c.total}` : '–'}
                            </span>
                          );
                        })}
                      </div>
                      <FreeHeatLegend
                        className="pt-1"
                        total={weekFree.values().next().value?.total}
                      />
                    </>
                  )}
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
                {timeSlots.map((slot, index) => {
                  const free = slotFree.get(slotKey({ date: slot.proposed_date, start: slot.start_time, end: slot.end_time }));
                  return (
                  <li
                    key={slot.id || index}
                    className={cn(
                      'flex items-center gap-3 min-h-[47px] pl-4 pr-1 bg-card',
                      free ? 'rounded-3xl py-2' : 'rounded-full'
                    )}
                  >
                    <Calendar className="w-[18px] h-[18px] shrink-0" />
                    <span className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="bw-body-md truncate">{slotLabel(slot)}</span>
                      {free && (
                        <span className={cn('flex items-center gap-2', freeTone(free))}>
                          <FreeDots count={free} onColor="currentColor" />
                          <FreeLabel count={free} />
                        </span>
                      )}
                    </span>
                    <IconButton
                      label={t('Remove slot')}
                      icon={<X />}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSlot(slot.id)}
                    />
                  </li>
                  );
                })}
              </ul>
            )}

            {/* Vote by (058) */}
            <div className="pt-2">{renderVoteByField('bld')}</div>
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
        {renderSongPicker(130)}
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
