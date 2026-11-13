import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { currencySymbol as symbolFor } from '@/lib/currency';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Minus,
  ChevronDown,
  ArrowLeft,
  AlertCircle,
  Music,
  Folder,
  Check,
  Sparkles,
  Briefcase,
  Users,
  Mic2,
  Sliders,
  MapPin,
  Calendar,
  Edit3,
  Layers,
  User,
  ArrowUpRight,
  LayoutTemplate,
  ListChecks,
  ListMusic,
  ScrollText,
  Truck,
} from '@/app/components/icons';
import { useDraftStage } from '@/app/components/event/rider/useEventStage';
import { RiderStageContent } from '@/app/components/event/rider/RiderStage';
import { HeaderAction, IconButton, NavBackButton, Tag } from '@/app/components/bw/Screen';
import { RailCover, useRailAction } from '@/lib/railActions';
import { PillButton, PillField, Selector } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { DotCheckbox } from '@/app/components/ui/DotCheckbox';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { getEventAccentColor } from '@/app/components/ui/WizardAccentRail';
import { PeekingScrollContainer } from '@/app/components/ui/PeekingScrollContainer';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { venueFields } from '@/lib/services/location';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { DatePicker, toDatePickerEvents } from '@/app/components/ui/DatePicker';
import type { EventData } from '@/app/components/dashboard/EventCard';
import { RehearsalCreationWizard } from '@/app/components/rehearsal/RehearsalCreationWizard';
import { useBand } from '@/lib/BandContext';
import { getSongs, getSetlists, getSetlist, type Song, type Setlist } from '@/lib/services/songs';
import { removeSongsFromSets, setsFromSetlistSongs, setSongCount } from '@/lib/setlistSets';
import { setStartNumbers, withSetSongs } from '@/lib/setlistOrder';
import { SortableSongList } from '@/app/components/ui/SortableSongList';
import { supabase } from '@/lib/supabase';
import { listEventTasks } from '@/lib/services/eventTasks';
import { getBandPricing, DEFAULT_BAND_PRICING, type BandPricingSettings } from '@/lib/services/pricing';
import { todayLocal } from '../../../lib/dates';
import { deleteEventDraft, newDraftId, saveEventDraft, type EventDraft } from '@/lib/wizardDrafts';
import { addressWithoutCity } from '@/lib/eventAddress';
import { useSystemBack } from '@/lib/backStack';
import { haptic } from '@/lib/haptics';
import { LeaveWizardSheet } from '@/app/components/bw/LeaveWizardSheet';
import { useLeadingCompanion } from '@/app/components/duo';
import { LiveGigPreview } from '@/app/components/duo/previews/LiveGigPreview';
import { useT, intlLocale, getLocale } from '@/lib/i18n';
import { ComposerCard, ComposerCheck, ComposerPreview, ComposerShell, Segmented, useComposerLayout } from '@/app/components/composer/Composer';
import { InlineMonthCalendar } from '@/app/components/ui/DatePicker';
import { useBandFreeDays } from '@/lib/bandAvailability';
import { heatLevel } from '@/lib/freeSlots';
import { freeTone } from '@/app/components/ui/FreeHeat';
import { BwSheet, DotText } from '@/app/components/bw';
import { builtinText } from '@/lib/i18n/builtins';

export interface BandMember {
  id: string;
  user_id: string;
  name: string;
  role: string;
  fee: string;
  initials: string;
  /** "Guitar / Backing vocals" (band_members.instrument), for the stage plot. */
  instrument?: string | null;
}

interface TaskTemplate {
  id: string;
  name: string;
  category: string;
  tasks: { id: string; title: string; dueOffset: number; required: boolean }[];
}

// 'pub' splits the legacy "Club / pub" chip (Figma). events.event_type is a
// VARCHAR (see supabase/FIX_add_missing_event_columns.sql), so both values
// persist as-is and existing 'club' events keep selecting the "Club" chip.
type EventType = 'gig' | 'wedding' | 'corporate' | 'private' | 'festival' | 'club' | 'pub' | 'other' | 'rehearsal';
type PerformanceType = 'full_band' | 'duo' | 'trio' | 'solo' | 'dj_set' | 'acoustic' | 'karaoke';
type SettingType = 'indoor' | 'outdoor';

const EVENT_TYPE_OPTIONS: {
  value: EventType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'wedding', label: 'Wedding', subtitle: 'Ceremony & reception', icon: Sparkles },
  { value: 'corporate', label: 'Corporate', subtitle: 'Company events', icon: Briefcase },
  { value: 'private', label: 'Private party', subtitle: 'Birthdays, anniversaries', icon: Users },
  { value: 'festival', label: 'Festival', subtitle: 'Outdoor stages', icon: Music },
  { value: 'club', label: 'Club', subtitle: 'Night sets', icon: Mic2 },
  { value: 'pub', label: 'Pub', subtitle: 'Small venues', icon: Mic2 },
  { value: 'other', label: 'Other', subtitle: 'Custom lineup', icon: Sliders },
];

const STEPS = [
  { id: 'basics', title: 'Event & lineup' },
  { id: 'datetime', title: 'Date & venue' },
  { id: 'review', title: 'Review & confirm' },
];

export const DURATION_15M_OPTIONS = [
  15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 270, 300, 360,
];

export const formatDurationOption = (m: number): string => {
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

interface CreateEventModalProps {
  onClose: () => void;
  /**
   * Saves the gig. Resolves false when nothing was saved (the form stays open
   * with what the user typed); anything else means saved or queued offline.
   */
  onCreate: (eventData: any) => Promise<boolean | void> | boolean | void;
  initialType?: EventType | null;
  initialDate?: string;
  layoutId?: string;
  bandMembers?: BandMember[];
  currentUserId?: string;
  onOpenPollBuilder?: () => void;
  onOpenProposeRehearsal?: () => void;
  /** Band calendar, so the date picker can mark busy days and suggest a free one. */
  existingEvents?: EventData[];
  /** Tasks preloaded from a task template ("Use this template"). */
  initialTasks?: { title: string; templateId?: string; dueOffset?: number }[];
  editingEvent?: {
    id: number;
    eventId?: string;
    setlistId?: string;
    title: string;
    status: string;
    date: string;
    time: string;
    location: string;
    price: string;
    clientName?: string;
    venueAddress?: string;
    venueCity?: string;
    /** events.indoor_outdoor: also "hybrid" (from quotes). */
    indoorOutdoor?: string;
    guests?: number;
    notes?: string;
    endTime?: string;
    loadInTime?: string;
    soundcheckTime?: string;
    eventType?: string;
    paymentStatus?: string;
    members?: string[];
    memberUserIds?: string[];
    memberFeeMap?: Record<string, string>;
  } | null;
  /** Reopen an unfinished "New gig" saved as a draft (lib/wizardDrafts). */
  draft?: EventDraft | null;
}

// --- Wizard steps (Figma "Wizard steps": 6pt segments + "Step N of 3 · title") ---
const InteractiveStepIndicator: React.FC<{
  current: number;
  total: number;
  steps: { id: string; title: string }[];
  maxAccessibleStep: number;
  onSelectStep: (step: number) => void;
  activeColor?: string;
  inactiveColor?: string;
}> = ({ current, total, steps, maxAccessibleStep, onSelectStep, activeColor, inactiveColor }) => {
  const t = useT();
  return (
  <div className="flex flex-col gap-2 w-full">
    <div className="flex items-center gap-2 w-full">
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i === current;
        const isAccessible = i <= maxAccessibleStep;
        const isReached = i <= current;
        return (
          <button
            key={i}
            type="button"
            onClick={() => isAccessible && onSelectStep(i)}
            disabled={!isAccessible}
            aria-label={t('Step {number}: {title}', { number: i + 1, title: steps[i]?.title || '' })}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn('flex-1 py-2 -my-2', isAccessible ? 'cursor-pointer' : 'cursor-not-allowed')}
          >
            <span
              className={cn('block h-1.5 w-full rounded-full transition-colors', isCurrent && 'ring-1 ring-foreground')}
              style={{
                backgroundColor: isReached
                  ? activeColor || 'var(--wizard-accent)'
                  : inactiveColor || 'var(--dot-off)',
              }}
            />
          </button>
        );
      })}
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className="bw-label-sm text-muted-foreground shrink-0">
        {t('Step {current} of {total}', { current: current + 1, total })}
      </span>
      <span className="bw-label-sm text-foreground truncate">{steps[current]?.title}</span>
    </div>
  </div>
  );
};

// --- Collapsible card (Figma "Accordion": card r24 p16, Label/MD title + Body/SM summary) ---
const EditAccordionCard: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  stepNumber?: string;
  title: string;
  summary: string;
  hasWarning?: boolean;
  warningLabel?: string;
  children: React.ReactNode;
}> = ({ isOpen, onToggle, stepNumber, title, summary, hasWarning, warningLabel, children }) => {
  const t = useT();
  return (
    <div
      className={cn(
        'rounded-[24px] bg-card text-card-foreground p-4 flex flex-col',
        hasWarning && 'ring-[1.5px] ring-inset ring-warning'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {stepNumber && <span className="bw-label-sm text-muted-foreground">{stepNumber}</span>}
            <span className="bw-label-md text-foreground">{title}</span>
            {hasWarning && (
              <Tag variant="outline" icon={<AlertCircle />} className="border-warning text-warning">
                {warningLabel ?? t('Needs attention')}
              </Tag>
            )}
          </div>
          <span className="bw-body-sm text-muted-foreground truncate">{summary}</span>
        </div>
        <ChevronDown
          className={cn('w-[18px] h-[18px] shrink-0 text-foreground transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-4 flex flex-col gap-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Label/SM field caption used above every input in the wizard. */
const FieldLabel: React.FC<{ children: React.ReactNode; htmlFor?: string; trailing?: React.ReactNode }> = ({
  children,
  htmlFor,
  trailing,
}) => (
  <div className="flex items-center justify-between gap-2">
    <label htmlFor={htmlFor} className="bw-label-sm text-muted-foreground">
      {children}
    </label>
    {trailing}
  </div>
);

/** 28pt light avatar (Figma "Avatar" Style=Light, Size=S). */
const MemberAvatar: React.FC<{ initials: string; title?: string; className?: string }> = ({ initials, title, className }) => (
  <span
    title={title}
    className={cn(
      'w-7 h-7 rounded-full bg-white text-black border-[1.5px] border-border flex items-center justify-center bw-label-sm shrink-0',
      className
    )}
  >
    {initials}
  </span>
);

/** Pill styling for the date/time/venue pickers so they read as Figma "Input" fields. */
const PICKER_FIELD =
  'h-[52px] px-4 pb-0 gap-3 rounded-full bg-field border border-border text-foreground text-lg font-medium hover:border-foreground focus:border-2 focus:border-foreground';

const capitalize = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

/* ── Forecast row (step 2) ───────────────────────────────────────────────
 * Same Open-Meteo source and 7-day window as WeatherWidget (whose fetchers
 * are module-private), plus sunset. Returns null outside the window or on
 * any failure, so the row is simply omitted.
 * ─────────────────────────────────────────────────────────────────────── */
const FORECAST_WINDOW_DAYS = 7;
type GigForecast = { temp: number; sky: string; sunset: string | null };
const forecastCache = new Map<string, GigForecast | null>();

const skyFromWmo = (code: number): string => {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storms';
  return 'cloudy';
};

function useGigForecast(date?: string, city?: string): GigForecast | null {
  const [forecast, setForecast] = useState<GigForecast | null>(null);
  useEffect(() => {
    setForecast(null);
    const place = (city || '').trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !place) return;
    const target = new Date(date + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (isNaN(diffDays) || diffDays < 0 || diffDays > FORECAST_WINDOW_DAYS) return;

    const key = `${place.toLowerCase()}_${date}`;
    if (forecastCache.has(key)) {
      setForecast(forecastCache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const geo = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`
        ).then(r => (r.ok ? r.json() : null));
        const hit = geo?.results?.[0];
        if (!hit || typeof hit.latitude !== 'number' || typeof hit.longitude !== 'number') {
          forecastCache.set(key, null);
          return;
        }
        const wx = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&daily=weather_code,temperature_2m_max,sunset&timezone=auto&start_date=${date}&end_date=${date}`
        ).then(r => (r.ok ? r.json() : null));
        const temp = wx?.daily?.temperature_2m_max?.[0];
        const code = wx?.daily?.weather_code?.[0];
        if (typeof temp !== 'number' || typeof code !== 'number') {
          forecastCache.set(key, null);
          return;
        }
        const sunsetRaw: unknown = wx?.daily?.sunset?.[0];
        const sunset = typeof sunsetRaw === 'string' && sunsetRaw.includes('T') ? sunsetRaw.split('T')[1].slice(0, 5) : null;
        const result = { temp: Math.round(temp), sky: skyFromWmo(code), sunset };
        forecastCache.set(key, result);
        if (!cancelled) setForecast(result);
      } catch {
        // Offline or blocked: no forecast row.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, city]);
  return forecast;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  onClose,
  onCreate,
  initialType,
  initialDate,
  bandMembers = [],
  currentUserId,
  editingEvent,
  onOpenPollBuilder,
  onOpenProposeRehearsal,
  existingEvents,
  initialTasks,
  draft,
}) => {
  const t = useT();
  const isEditing = !!editingEvent;
  // A draft restores the wizard where it was left (creation only).
  const ds = (!editingEvent && draft?.state ? draft.state : null) as Record<string, any> | null;
  const { selectedBand, isAdmin } = useBand();

  const editingWarnings = useMemo(() => {
    if (!editingEvent) return [];
    const w: string[] = [];
    if (!editingEvent.location || editingEvent.location === 'TBD') w.push('venue');
    if (!editingEvent.date) w.push('date');
    const type = editingEvent.eventType?.toLowerCase();
    if (type !== 'rehearsal' && (!editingEvent.price || editingEvent.price === '0')) w.push('fee');
    const hasMembers =
      (editingEvent.memberUserIds?.length ?? 0) > 0 || (editingEvent.members?.length ?? 0) > 0;
    if (!hasMembers) w.push('members');
    return w;
  }, [editingEvent]);

  const [step, setStep] = useState<number>(() => (typeof ds?.step === 'number' ? ds.step : 0));
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songPickerTargetSet, setSongPickerTargetSet] = useState<string | null>(null);

  // Review step collapsibles (closed by default)
  const [isReviewSetlistExpanded, setIsReviewSetlistExpanded] = useState(false);
  const [isReviewLogisticsExpanded, setIsReviewLogisticsExpanded] = useState(false);
  const [isReviewTasksExpanded, setIsReviewTasksExpanded] = useState(false);

  // Lineup bar expansion in Step 1 (Figma: open by default)
  const [isRosterExpanded, setIsRosterExpanded] = useState(true);
  // Setlist accordion: show the saved-setlist chips even when sets exist
  const [showSetlistTemplates, setShowSetlistTemplates] = useState(false);

  // Accordion state for Edit mode
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      basics: false,
      date_venue: false,
      team_pay: false,
      setlist_tasks: false,
    };
    if (editingWarnings.some(w => ['fee', 'members'].includes(w))) {
      initial.team_pay = true;
    } else if (editingWarnings.some(w => ['venue', 'date', 'time'].includes(w))) {
      initial.date_venue = true;
    } else {
      initial.date_venue = true;
    }
    return initial;
  });

  const toggleEditSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [savedSetlists, setSavedSetlists] = useState<Setlist[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBand?.id) return;
    const fetchLibrary = async () => {
      const [setlistsRes, taskTplRes] = await Promise.all([
        getSetlists(selectedBand.id),
        supabase
          .from('task_templates')
          .select('*')
          .eq('band_id', selectedBand.id)
          .order('created_at', { ascending: false }),
      ]);
      if (setlistsRes.data) setSavedSetlists(setlistsRes.data);
      if (taskTplRes.data) setTaskTemplates(taskTplRes.data);
      const err = setlistsRes.error || taskTplRes.error;
      setLibraryError(err ? t("Couldn't load saved templates: {error}", { error: err.message }) : null);
    };
    fetchLibrary();
  }, [selectedBand?.id]);

  const MEMBERS = useMemo(() => bandMembers || [], [bandMembers]);
  const currentUserMember = useMemo(
    () => MEMBERS.find(m => m.user_id === currentUserId),
    [MEMBERS, currentUserId]
  );
  const currentUserMemberId = currentUserMember?.id || currentUserId || '';

  // --- Derive category ---
  const modalCategory: 'gig' | 'quote' | 'rehearsal' =
    initialType === 'rehearsal' ||
    editingEvent?.eventType?.toLowerCase() === 'rehearsal' ||
    editingEvent?.status?.toUpperCase() === 'REHEARSAL'
      ? 'rehearsal'
      : initialType === ('quote' as any) ||
          editingEvent?.status?.toUpperCase() === 'QUOTE' ||
          editingEvent?.status?.toUpperCase() === 'QUOTED'
        ? 'quote'
        : 'gig';

  useEffect(() => {
    if (!isAdmin && modalCategory === 'quote') {
      onClose();
    }
  }, [isAdmin, modalCategory, onClose]);

  // Members never schedule rehearsals here: AuthenticatedApp routes them to
  // ProposeRehearsalModal. Defensive redirect in case one gets through.
  useEffect(() => {
    if (!isAdmin && modalCategory === 'rehearsal') {
      onClose();
      onOpenProposeRehearsal?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, modalCategory]);

  // --- Pricing Settings ---
  const [pricingSettings, setPricingSettings] = useState<BandPricingSettings>(DEFAULT_BAND_PRICING);

  const currencySymbol = symbolFor(pricingSettings.currency);

  const getAutoFeeForMember = useCallback(
    (
      memberId: string,
      currentSelected: string[],
      settings: BandPricingSettings = pricingSettings,
      memberObj?: BandMember
    ): string => {
      const member = memberObj || MEMBERS.find(m => m.id === memberId || m.user_id === memberId);
      if (member?.fee && parseFloat(member.fee) > 0) {
        return member.fee;
      }
      const idx = currentSelected.includes(memberId)
        ? currentSelected.indexOf(memberId)
        : currentSelected.length;
      const isCore = idx < (settings.core_members_count ?? 1);
      const rate = isCore ? settings.core_member_rate : settings.session_musician_rate;
      return String(rate || (isCore ? 300 : 250));
    },
    [MEMBERS, pricingSettings]
  );

  // --- Form State ---
  const editingType = useMemo<EventType | null>(() => {
    if (!editingEvent) return null;
    if (editingEvent.eventType) return editingEvent.eventType as EventType;
    const s = editingEvent.status?.toUpperCase();
    if (s === 'REHEARSAL') return 'rehearsal';
    if (s === 'QUOTED' || s === 'QUOTE') return 'wedding';
    return 'club';
  }, [editingEvent]);

  // Default eventType is null for quotes unless editing or explicitly passed
  const defaultEventType: EventType | null =
    initialType && initialType !== ('quote' as any)
      ? initialType
      : editingType || (modalCategory === 'quote' ? null : 'club');

  const [eventType, setEventType] = useState<EventType | null>(() => (ds?.eventType as EventType | null | undefined) ?? defaultEventType);
  // iPhone Duo: the wizard's close sits in the system column under the clock
  // (Figma "Closed · New gig / 1 Event & lineup").
  // Closing "New gig" with something typed in asks to keep it as a draft.
  const requestCloseRef = useRef<() => void>(onClose);
  const requestClose = useCallback(() => requestCloseRef.current(), []);
  const closeInRail = useRailAction(!isEditing && eventType !== 'rehearsal' ? requestClose : undefined, {
    label: modalCategory === 'quote' ? t('Close quote wizard') : t('Close gig wizard'),
    icon: <X />,
    pane: true,
  });
  // Display-only labels; the ids (event_type, setting) stay English.
  const eventTypeLabels: Record<string, { label: string; subtitle: string }> = {
    wedding: { label: t('Wedding'), subtitle: t('Ceremony & reception') },
    corporate: { label: t('Corporate'), subtitle: t('Company events') },
    private: { label: t('Private party'), subtitle: t('Birthdays, anniversaries') },
    festival: { label: t('Festival'), subtitle: t('Outdoor stages') },
    club: { label: t('Club'), subtitle: t('Night sets') },
    pub: { label: t('Pub'), subtitle: t('Small venues') },
    other: { label: t('Other'), subtitle: t('Custom lineup') },
  };
  // capitalize(eventType) / raw eventType as shown before.
  const typeCapLabels: Record<string, string> = {
    wedding: t('Wedding'),
    corporate: t('Corporate'),
    private: t('Private'),
    festival: t('Festival'),
    club: t('Club'),
    pub: t('Pub'),
    other: t('Other'),
    gig: t('Gig'),
  };
  const typeCap = (v?: string | null) => (v && typeCapLabels[v]) || capitalize(v);
  const rawWordLabels: Record<string, string> = {
    wedding: t('wedding'),
    corporate: t('corporate'),
    private: t('private'),
    festival: t('festival'),
    club: t('club'),
    pub: t('pub'),
    other: t('other'),
    gig: t('gig'),
    quote: t('quote'),
    rehearsal: t('rehearsal'),
    indoor: t('indoor'),
    outdoor: t('outdoor'),
  };
  const rawWord = (v: string) => rawWordLabels[v] ?? v;
  const settingCap = (v: string) => (v === 'indoor' ? t('Indoor') : v === 'outdoor' ? t('Outdoor') : capitalize(v));
  const musiciansText = (n: number) =>
    n === 1 ? t('{count} musician', { count: n }) : t('{count} musicians', { count: n });
  const setsText = (n: number) => (n === 1 ? t('{count} set', { count: n }) : t('{count} sets', { count: n }));
  const songsText = (n: number) => (n === 1 ? t('{count} song', { count: n }) : t('{count} songs', { count: n }));
  const tasksText = (n: number) => (n === 1 ? t('{count} task', { count: n }) : t('{count} tasks', { count: n }));
  const guestsText = (n: number) => (n === 1 ? t('{count} guest', { count: n }) : t('{count} guests', { count: n }));
  const stepsShown = STEPS.map((st, i) => ({
    ...st,
    title: [t('Event & lineup'), t('Date & venue'), t('Review & confirm')][i] ?? st.title,
  }));
  const skyLabel = (sky: string) =>
    (({
      clear: t('clear'),
      'partly cloudy': t('partly cloudy'),
      overcast: t('overcast'),
      fog: t('fog'),
      drizzle: t('drizzle'),
      rain: t('rain'),
      snow: t('snow'),
      storms: t('storms'),
      cloudy: t('cloudy'),
    }) as Record<string, string>)[sky] ?? sky;
  const [performanceType, setPerformanceType] = useState<PerformanceType>(() => ds?.performanceType ?? 'full_band');
  const [setting, setSettingState] = useState<SettingType>(
    () => ds?.setting ?? (editingEvent?.indoorOutdoor === 'outdoor' ? 'outdoor' : 'indoor')
  );
  // Editing: an untouched choice keeps the saved value (also "hybrid" or none,
  // which this form cannot show) instead of resetting it to indoor.
  const settingTouchedRef = useRef(false);
  const setSetting = (value: SettingType) => {
    settingTouchedRef.current = true;
    setSettingState(value);
  };

  const [details, setDetails] = useState(() => {
    const base = {
    title: editingEvent?.title || '',
    clientName: editingEvent?.clientName || '',
    venue: editingEvent?.location || '',
    address: addressWithoutCity(editingEvent?.venueAddress, editingEvent?.venueCity),
    city: editingEvent?.venueCity || '',
    province: '',
    zip: '',
    country: '',
    date: editingEvent?.date || initialDate || todayLocal(),
    // Saved times come back as 20:00:00; the wizard works in HH:MM.
    startTime: editingEvent?.time?.slice(0, 5) || '20:00',
    endTime: editingEvent?.endTime?.slice(0, 5) || '23:30',
    // Optional call times for gigs (events.load_in_time / soundcheck_time).
    loadInTime: editingEvent?.loadInTime?.slice(0, 5) || '',
    soundcheckTime: editingEvent?.soundcheckTime?.slice(0, 5) || '',
    guests: editingEvent?.guests || 0,
    duration: 120,
    pay: editingEvent?.price || '',
    };
    return { ...base, ...(ds?.details || {}) } as typeof base;
  });
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(() => !!editingEvent || !!ds?.titleManuallyEdited);
  const forecast = useGigForecast(details.date, details.city);
  const pickerEvents = useMemo(
    () => toDatePickerEvents(existingEvents, editingEvent?.eventId),
    [existingEvents, editingEvent?.eventId]
  );

  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => {
    if (Array.isArray(ds?.selectedMembers)) return ds!.selectedMembers;
    if (editingEvent?.memberUserIds?.length) {
      return editingEvent.memberUserIds
        .map(uid => {
          const member = MEMBERS.find(m => m.user_id === uid);
          return member?.id || uid;
        })
        .filter(Boolean);
    }
    if (isEditing) return [];
    return currentUserMemberId ? [currentUserMemberId] : [];
  });

  const [memberFees, setMemberFees] = useState<Record<string, string>>(() => {
    if (ds?.memberFees && typeof ds.memberFees === 'object') return ds.memberFees;
    if (editingEvent?.memberUserIds?.length && editingEvent.memberFeeMap) {
      const fees: Record<string, string> = {};
      editingEvent.memberUserIds.forEach(uid => {
        const member = MEMBERS.find(m => m.user_id === uid);
        const id = member?.id || uid;
        fees[id] = editingEvent.memberFeeMap?.[uid] || '0';
      });
      return fees;
    }
    if (isEditing) return {};
    if (currentUserMemberId) {
      const m = MEMBERS.find(mem => mem.id === currentUserMemberId || mem.user_id === currentUserMemberId);
      const defaultRate =
        m?.fee && parseFloat(m.fee) > 0 ? m.fee : String(DEFAULT_BAND_PRICING.core_member_rate);
      return { [currentUserMemberId]: defaultRate };
    }
    return {};
  });

  // Load Band Pricing Settings and auto-populate fees if not editing
  useEffect(() => {
    if (!selectedBand?.id) return;
    let isCancelled = false;
    getBandPricing(selectedBand.id).then(settings => {
      if (isCancelled) return;
      setPricingSettings(settings);
      if (!isEditing) {
        if (selectedMembers.length === 0 && currentUserMemberId) {
          setSelectedMembers([currentUserMemberId]);
          const m = MEMBERS.find(mem => mem.id === currentUserMemberId || mem.user_id === currentUserMemberId);
          const autoFee =
            m?.fee && parseFloat(m.fee) > 0 ? m.fee : String(settings.core_member_rate);
          setMemberFees({ [currentUserMemberId]: autoFee });
        } else {
          setMemberFees(prev => {
            let changed = false;
            const updated = { ...prev };
            selectedMembers.forEach((id, index) => {
              if (!updated[id] || updated[id] === '0') {
                const m = MEMBERS.find(mem => mem.id === id || mem.user_id === id);
                const isCore = index < (settings.core_members_count ?? 1);
                const rate =
                  m?.fee && parseFloat(m.fee) > 0
                    ? m.fee
                    : String(isCore ? settings.core_member_rate : settings.session_musician_rate);
                updated[id] = rate;
                changed = true;
              }
            });
            return changed ? updated : prev;
          });
        }
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [selectedBand?.id, isEditing, currentUserMemberId, MEMBERS, selectedMembers]);

  const [setlist, setSetlist] = useState<any[]>(() => (Array.isArray(ds?.setlist) ? ds!.setlist : []));
  // Editing: start from the songs already on the gig (the screen showed them,
  // the form used to open with 0). Songs the user picked meanwhile win.
  const editingSetlistId: string | undefined = isEditing ? editingEvent?.setlistId : undefined;
  const savedSongCountRef = useRef(0);
  useEffect(() => {
    if (!editingSetlistId || Array.isArray(ds?.setlist)) return;
    let cancelled = false;
    getSetlist(editingSetlistId).then(({ data, error }) => {
      if (cancelled || error || !data?.songs?.length) return;
      const sets = setsFromSetlistSongs(data.songs, (n) => t('Set {n}', { n }));
      savedSongCountRef.current = setSongCount(sets);
      setSetlist((prev) => (setSongCount(prev) > 0 ? prev : sets));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSetlistId]);
  const [tasks, setTasks] = useState<any[]>(() =>
    Array.isArray(ds?.tasks) ? ds!.tasks : (initialTasks || []).map((t, i) => ({
      uid: `t-init-${i}-${Math.random().toString(36).slice(2)}`,
      title: t.title,
      completed: false,
      templateId: t.templateId,
      dueOffset: t.dueOffset,
    })),
  );
  const [newTaskText, setNewTaskText] = useState<string>(() => ds?.newTaskText ?? '');
  // Editing: show the tasks already saved on the event, so they can be
  // renamed or removed (ids kept to sync on save).
  const [originalTaskIds, setOriginalTaskIds] = useState<string[]>([]);
  const editingEventId: string | undefined = editingEvent?.eventId;
  useEffect(() => {
    if (!isEditing || !editingEventId) return;
    let cancelled = false;
    listEventTasks(editingEventId).then(({ data }) => {
      if (cancelled || data.length === 0) return;
      setOriginalTaskIds(data.map(t => t.id));
      setTasks(prev => [
        ...data.map(t => ({ uid: `t-saved-${t.id}`, id: t.id, title: t.title, completed: t.is_completed })),
        ...prev.filter(t => !t.id),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [isEditing, editingEventId]);
  const [notes, setNotes] = useState<string>(() => editingEvent?.notes || ds?.notes || '');
  // The extra band fee isn't stored on its own: the event fee is members +
  // extra, so when editing it is what the saved fee has beyond the members.
  // "Fee TBD": confirm the date before the money is agreed (events.payment_status = 'tbd').
  const wasFeeTbd = editingEvent?.paymentStatus === 'tbd';
  const [feeTbd, setFeeTbd] = useState<boolean>(() => wasFeeTbd || !!ds?.feeTbd);
  const [extraBandFee, setExtraBandFee] = useState<string>(() => {
    if (!editingEvent) return ds?.extraBandFee ?? '';
    const total = parseFloat(String(editingEvent.price || '').replace(/[^0-9.]/g, '')) || 0;
    const members = Object.values(editingEvent.memberFeeMap || {}).reduce((acc, f) => acc + (parseFloat(f) || 0), 0);
    const extra = Math.round((total - members) * 100) / 100;
    return extra > 0 ? String(extra) : '';
  });

  const activeAccentColor = useMemo(
    () => getEventAccentColor(eventType, modalCategory),
    [eventType, modalCategory]
  );

  const activeAccentFg = useMemo(() => {
    if (modalCategory === 'rehearsal') return 'var(--accent-rehearsal-fg)';
    if (modalCategory === 'quote') return 'var(--accent-quote-fg)';
    return 'var(--accent-gig-fg)';
  }, [modalCategory]);

  const totalPayout = useMemo(
    () => Object.values(memberFees).reduce((acc, fee) => acc + (parseFloat(fee) || 0), 0),
    [memberFees]
  );

  const grandTotalFee = useMemo(
    () => totalPayout + (parseFloat(extraBandFee) || 0),
    [totalPayout, extraBandFee]
  );

  const calculatedDurationBadge = useMemo(() => {
    if (!details.startTime || !details.endTime) return formatDurationOption(details.duration);
    const [sh, sm] = details.startTime.split(':').map(Number);
    const [eh, em] = details.endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return formatDurationOption(details.duration);
    let totalMinutes = eh * 60 + em - (sh * 60 + sm);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    if (totalMinutes === 0) return formatDurationOption(details.duration);
    return formatDurationOption(totalMinutes);
  }, [details.startTime, details.endTime, details.duration]);

  const formattedDateStr = useMemo(() => {
    if (!details.date) return t('DATE TBD');
    const d = new Date(details.date + 'T00:00:00');
    if (isNaN(d.getTime())) return details.date;
    return d.toLocaleDateString(intlLocale('en-US'), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [details.date, t]);

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return STEPS.length - 1;
    if (!eventType) return 0;
    if (!details.date) return 1;
    return STEPS.length - 1;
  }, [isEditing, eventType, details.date]);

  const getEffectiveTitle = useCallback(() => {
    if (details.title.trim()) return details.title.trim();
    const rawLabel = eventType ? eventType.charAt(0).toUpperCase() + eventType.slice(1) : 'Event';
    // Saved as the title: English as before, otherwise in the app language.
    const typeLabel =
      getLocale() === 'en'
        ? rawLabel
        : eventType
          ? t(EVENT_TYPE_OPTIONS.find(o => o.value === eventType)?.label ?? rawLabel)
          : t('Event');
    if (details.clientName.trim()) {
      return `${typeLabel} - ${details.clientName.trim()}`;
    }
    const suffix = modalCategory === 'quote' ? 'Quote' : 'Gig';
    // Avoid "Gig Gig" when the default event type is already "gig".
    if (rawLabel === suffix) return modalCategory === 'quote' ? t('New quote') : t('New gig');
    return modalCategory === 'quote' ? t('{type} Quote', { type: typeLabel }) : t('{type} Gig', { type: typeLabel });
  }, [details.title, details.clientName, eventType, modalCategory, t]);

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleCreate();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      if (memberId === currentUserMemberId) return;
      setSelectedMembers(prev => prev.filter(id => id !== memberId));
      const newFees = { ...memberFees };
      delete newFees[memberId];
      setMemberFees(newFees);
    } else {
      const nextSelected = [...selectedMembers, memberId];
      setSelectedMembers(nextSelected);
      const autoFee = getAutoFeeForMember(memberId, selectedMembers, pricingSettings);
      setMemberFees(prev => ({ ...prev, [memberId]: autoFee }));
    }
  };

  const updateFee = useCallback((memberId: string, amount: string) => {
    setMemberFees(prev => ({ ...prev, [memberId]: amount }));
  }, []);

  const applyPerformancePreset = (preset: { label: string; count: number; type: PerformanceType }) => {
    setPerformanceType(preset.type);
    let newSelected: string[] = [];
    if (MEMBERS.length > 0) {
      newSelected = MEMBERS.slice(0, preset.count).map(m => m.id);
      if (currentUserMemberId && !newSelected.includes(currentUserMemberId)) {
        newSelected[0] = currentUserMemberId;
      }
    } else if (currentUserMemberId) {
      newSelected = [currentUserMemberId];
    }
    setSelectedMembers(newSelected);
    const newFees: Record<string, string> = {};
    newSelected.forEach((id, idx) => {
      if (memberFees[id] && memberFees[id] !== '0') {
        newFees[id] = memberFees[id];
      } else {
        newFees[id] = getAutoFeeForMember(id, newSelected.slice(0, idx), pricingSettings);
      }
    });
    setMemberFees(newFees);
  };

  const [isSaving, setIsSaving] = useState(false);

  // Rider & stage in the iPad composer (Figma iPad · 04 "New gig"): admins of
  // a band gig. Saved with the gig (AuthenticatedApp → persistComposerStage).
  const riderLineup = useMemo(
    () =>
      selectedMembers
        .map(id => MEMBERS.find(m => m.id === id || m.user_id === id))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map(m => ({ name: m.name, instrument: m.instrument || null })),
    [selectedMembers, MEMBERS],
  );
  const riderAllowed = isAdmin && !!selectedBand?.id && !isEditing && modalCategory === 'gig';
  const draftStage = useDraftStage({ lineup: riderLineup, isAdmin: riderAllowed });

  const handleCreate = async () => {
    if (isSaving) return;
    const fallbackTitle = getEffectiveTitle();

    const membersWithUserIds = selectedMembers.map(id => {
      const member = MEMBERS.find(m => m.id === id || m.user_id === id);
      return {
        id: member?.user_id || id,
        memberId: id,
        fee: feeTbd ? '0' : memberFees[id] || '0',
        name: member?.name || 'Unknown',
        role: member?.role || 'Member',
      };
    });

    const eventData = {
      details: {
        ...details,
        title: fallbackTitle,
        time: details.startTime,
        pay: feeTbd ? '0' : String(grandTotalFee || details.pay || '0'),
      },
      eventType: (eventType || (modalCategory === 'quote' ? 'wedding' : 'club')) as EventType,
      _originalEventType: editingEvent?.eventType || eventType || 'club',
      performanceType,
      setting: isEditing && !settingTouchedRef.current ? (editingEvent?.indoorOutdoor ?? null) : setting,
      members: membersWithUserIds,
      audienceIds: membersWithUserIds.map(m => m.id),
      setlist,
      // Every song removed from a saved setlist: empty it (no songs alone means "unchanged").
      _setlistCleared: isEditing && savedSongCountRef.current > 0 && setSongCount(setlist) === 0,
      // A task typed but not yet added with the button still counts.
      tasks: newTaskText.trim()
        ? [...tasks, { uid: `t-${Date.now()}`, title: newTaskText.trim(), completed: false }]
        : tasks,
      _originalTaskIds: originalTaskIds,
      notes,
      feeTbd: modalCategory === 'gig' ? feeTbd : false,
      _wasFeeTbd: wasFeeTbd,
      status: modalCategory === 'quote' ? 'tentative' : 'confirmed',
      ...(riderAllowed && composerLayout.composer && (draftStage.pending || draftStage.riderWanted)
        ? { _stage: draftStage.pending, _createRider: draftStage.riderWanted }
        : {}),
      ...(isEditing && editingEvent
        ? { _editing: true, _editingEventId: editingEvent.eventId, _editingLocalId: editingEvent.id }
        : {}),
    };
    setIsSaving(true);
    let saved: boolean | void;
    try {
      saved = await onCreate(eventData);
    } catch (err) {
      console.error('[gig] save failed:', err);
      saved = false;
    }
    setIsSaving(false);
    if (saved === false) {
      // Not saved: the form stays open, and a new gig is also kept in Drafts.
      if (draftsEnabled) persistDraft();
      return;
    }
    deleteEventDraft(draftIdRef.current);
  };

  // ── Drafts ──────────────────────────────────────────────────
  // What the user typed (fees filled in automatically don't count).
  const draftState = {
    step,
    eventType,
    performanceType,
    setting,
    details,
    titleManuallyEdited,
    selectedMembers,
    memberFees,
    setlist,
    tasks,
    newTaskText,
    notes,
    extraBandFee,
    feeTbd,
  };
  const typedSnapshot = JSON.stringify({
    eventType,
    performanceType,
    setting,
    details: { ...details, duration: undefined },
    members: [...selectedMembers].sort(),
    setlist: setlist.map((s: any) => [s.title, (s.songs || []).map((sg: any) => sg.songId || sg.title)]),
    tasks: tasks.map((t: any) => t.title),
    newTaskText: newTaskText.trim(),
    notes: notes.trim(),
    extraBandFee,
    feeTbd,
  });
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = typedSnapshot;
  const isDirty = typedSnapshot !== baselineRef.current;
  const draftsEnabled = !isEditing && modalCategory === 'gig' && !!currentUserId;
  const [leaveOpen, setLeaveOpen] = useState(false);

  requestCloseRef.current = () => {
    if (draftsEnabled && isDirty) setLeaveOpen(true);
    else onClose();
  };

  // One id for this form: a draft kept after a failed save is replaced, not
  // duplicated, and removed once the gig is saved.
  const draftIdRef = useRef<string | null>(draft?.id ?? null);

  const persistDraft = () => {
    if (!currentUserId) return;
    if (!draftIdRef.current) draftIdRef.current = newDraftId();
    saveEventDraft({
      id: draftIdRef.current,
      userId: currentUserId,
      bandId: selectedBand?.id ?? null,
      title: getEffectiveTitle(),
      date: details.date || undefined,
      venue: details.venue || undefined,
      eventType,
      state: draftState,
    });
  };

  const handleSaveDraft = () => {
    if (!currentUserId) return;
    persistDraft();
    haptic.confirm();
    setLeaveOpen(false);
    onClose();
  };

  const handleDiscardDraft = () => {
    // Reopened from a draft: throwing it away removes it from Drafts too.
    deleteEventDraft(draftIdRef.current);
    setLeaveOpen(false);
    onClose();
  };

  // Android Back: the leave sheet first, then the song picker, then close.
  // Tablet composer: the sheet open over it (setlist, tasks, logistics).
  const [composerSheet, setComposerSheet] = useState<null | 'setlist' | 'rider' | 'tasks' | 'logistics'>(null);
  useSystemBack(!isEditing && eventType !== 'rehearsal', () => {
    if (leaveOpen) setLeaveOpen(false);
    else if (songPickerOpen) {
      setSongPickerOpen(false);
      setSongPickerTargetSet(null);
    } else if (composerSheet) setComposerSheet(null);
    else requestClose();
    return true;
  });

  // iPad (Figma iPad · 04 "New gig"): every step on one screen, with a live
  // preview. Only a new gig on a tablet-sized window; phones and the iPhone
  // Duo keep the step wizard. Same state and save as the steps.
  const composerLayout = useComposerLayout();
  const composerOn = composerLayout.composer && !isEditing && modalCategory === 'gig' && eventType !== 'rehearsal';
  const composerFree = useBandFreeDays({
    bandId: selectedBand?.id,
    from: details.date,
    to: details.date,
    start: details.startTime,
    end: details.endTime,
    enabled: composerOn && !!details.date,
  });

  // iPhone Duo book layout (Figma "Duo · 04"): on step 1 the leading page
  // shows the gig as it will be saved, filling in as the user types. Steps
  // 2–3 leave the leading page alone (the calendar shows underneath).
  // Called before the rehearsal passthrough so the hook order never changes.
  useLeadingCompanion(
    <LiveGigPreview
      kindLabel={modalCategory === 'quote' ? t('Quote') : t('Gig')}
      typeLabel={eventType ? eventTypeLabels[eventType]?.label ?? eventType : null}
      settingLabel={setting}
      title={getEffectiveTitle()}
      dateLabel={details.date ? formattedDateStr : null}
      timeLabel={details.startTime ? `${details.startTime}${details.endTime ? ` – ${details.endTime}` : ''}` : null}
      venue={details.venue}
      city={details.city}
      lineupCount={selectedMembers.length}
      lineupNames={selectedMembers
        .map(id => MEMBERS.find(m => m.id === id || m.user_id === id)?.name)
        .filter((n): n is string => !!n)}
      fee={isAdmin && grandTotalFee > 0 ? `${currencySymbol}${grandTotalFee.toLocaleString(intlLocale('en-US'))}` : null}
      accent={activeAccentColor}
      accentFg={activeAccentFg}
    />,
    !isEditing && step === 0 && eventType !== 'rehearsal' && !composerOn
  );

  // Members never see quotes (the effect above closes the wizard). This sits
  // after every hook above so the hook order never changes with the role.
  if (!isAdmin && modalCategory === 'quote') {
    return null;
  }

  // --- Rehearsal passthrough ---
  if (eventType === 'rehearsal') {
    if (!isAdmin) return null; // redirected to ProposeRehearsalModal (effect above)
    return (
      <RehearsalCreationWizard
        onClose={onClose}
        onCreate={onCreate}
        editingEvent={editingEvent}
        onOpenPollBuilder={onOpenPollBuilder}
        existingEvents={existingEvents}
        draft={draft}
        initialTasks={initialTasks}
      />
    );
  }

  // --- Inline Song & Setlist Handlers for Review Step ---
  const handlePickedSong = (picked: PickedSong) => {
    setSetlist(prev => {
      if (prev.length === 0) {
        return [
          {
            uid: `set-${Date.now()}`,
            title: t('Set {n}', { n: 1 }),
            songs: [
              {
                uid: `song-${Date.now()}`,
                title: picked.title,
                artist: picked.artist,
                songId: picked.id,
              },
            ],
          },
        ];
      }
      const targetUid = songPickerTargetSet || prev[0].uid;
      return prev.map(s => {
        if (s.uid === targetUid) {
          const existingIds = new Set(
            (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
          );
          if (existingIds.has(picked.id)) return s;
          return {
            ...s,
            songs: [
              ...(s.songs || []),
              {
                uid: `song-${Date.now()}`,
                title: picked.title,
                artist: picked.artist,
                songId: picked.id,
              },
            ],
          };
        }
        return s;
      });
    });
  };

  const handleRemovedSongs = (songIds: string[]) => {
    setSetlist(prev => removeSongsFromSets(prev, songIds));
  };

  const handlePickedMultipleSongs = (picked: PickedSong[]) => {
    setSetlist(prev => {
      if (prev.length === 0) {
        return [
          {
            uid: `set-${Date.now()}`,
            title: t('Set {n}', { n: 1 }),
            songs: picked.map(p => ({
              uid: `song-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              title: p.title,
              artist: p.artist,
              songId: p.id,
            })),
          },
        ];
      }
      const targetUid = songPickerTargetSet || prev[0].uid;
      return prev.map(s => {
        if (s.uid === targetUid) {
          const existingIds = new Set(
            (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
          );
          const newSongs = picked.filter(p => !existingIds.has(p.id));
          return {
            ...s,
            songs: [
              ...(s.songs || []),
              ...newSongs.map(p => ({
                uid: `song-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                title: p.title,
                artist: p.artist,
                songId: p.id,
              })),
            ],
          };
        }
        return s;
      });
    });
    setSongPickerOpen(false);
    setSongPickerTargetSet(null);
  };

  const loadSavedSetlist = async (sl: Setlist) => {
    const { data, error } = await getSetlist(sl.id);
    if (error) {
      setLibraryError(t('Couldn\'t load "{name}": {error}', { name: sl.name, error: error.message }));
      return;
    }
    setLibraryError(null);
    if (!data?.songs?.length) return;

    setSetlist(setsFromSetlistSongs(data.songs, (n) => t('Set {n}', { n })));
  };

  const addSet = () => {
    setSetlist(prev => [
      ...prev,
      { uid: `set-${Date.now()}`, title: t('Set {n}', { n: prev.length + 1 }), songs: [] },
    ]);
  };

  const removeSet = (setUid: string) => {
    setSetlist(prev => prev.filter(s => s.uid !== setUid));
  };

  const addSongToSet = (setUid: string) => {
    setSetlist(prev =>
      prev.map(s =>
        s.uid === setUid
          ? {
              ...s,
              songs: [...(s.songs || []), { uid: `song-${Date.now()}`, title: '', artist: '' }],
            }
          : s
      )
    );
  };

  const updateSongInSet = (setUid: string, songUid: string, field: string, value: string) => {
    setSetlist(prev =>
      prev.map(s =>
        s.uid === setUid
          ? {
              ...s,
              songs: (s.songs || []).map((song: any) =>
                song.uid === songUid ? { ...song, [field]: value } : song
              ),
            }
          : s
      )
    );
  };

  const removeSongFromSet = (setUid: string, songUid: string) => {
    setSetlist(prev =>
      prev.map(s =>
        s.uid === setUid
          ? { ...s, songs: (s.songs || []).filter((song: any) => song.uid !== songUid) }
          : s
      )
    );
  };

  // Plain values, not hooks: this code runs after the rehearsal passthrough.
  const totalSongCount = setlist.reduce((acc: number, s: any) => acc + (s.songs || []).length, 0);
  // Play numbers (01, 02, …) run across sets, as on the gig detail and in Stage mode.
  const setStarts = setStartNumbers(setlist);
  const reorderHint =
    isAdmin && totalSongCount > 1 ? (
      <p className="bw-label-xs text-muted-foreground">{t('Long-press a song and drag to reorder')}</p>
    ) : null;

  const handleAddNewTask = () => {
    if (!newTaskText.trim()) return;
    setTasks(prev => [
      ...prev,
      {
        uid: `t-${Date.now()}`,
        title: newTaskText.trim(),
        completed: false,
      },
    ]);
    setNewTaskText('');
  };

  const warnField = (field: string) => {
    if (!isEditing) return false;
    if (!editingWarnings.includes(field)) return false;
    if (field === 'members' && selectedMembers.length > 0) return false;
    if (field === 'venue' && details.venue && details.venue !== 'TBD') return false;
    if (field === 'date' && details.date) return false;
    if (field === 'fee' && details.pay && details.pay !== '0') return false;
    return true;
  };

  // ── Shared field blocks (wizard steps and edit view) ─────────
  const selectEventType = (value: EventType) => {
    setEventType(value);
    if (!titleManuallyEdited) {
      const typeLabel = value.charAt(0).toUpperCase() + value.slice(1);
      const title = details.clientName ? `${typeLabel} - ${details.clientName}` : '';
      setDetails(prev => ({ ...prev, title }));
    }
  };

  const handleClientChange = (val: string) => {
    setDetails(prev => ({ ...prev, clientName: val }));
    if (!titleManuallyEdited) {
      const typeLabel = eventType ? eventType.charAt(0).toUpperCase() + eventType.slice(1) : 'Event';
      const title = val ? `${typeLabel} - ${val}` : '';
      setDetails(prev => ({ ...prev, title }));
    }
  };

  const handleTitleChange = (val: string) => {
    setDetails(prev => ({ ...prev, title: val }));
    setTitleManuallyEdited(true);
  };

  const lineupPresets = [
    { label: t('Solo'), count: 1, type: 'solo' as PerformanceType },
    { label: t('Duo'), count: 2, type: 'duo' as PerformanceType },
    { label: t('Trio'), count: 3, type: 'trio' as PerformanceType },
    { label: t('Full band'), count: MEMBERS.length || 1, type: 'full_band' as PerformanceType },
  ];

  const activeServices = (pricingSettings.custom_services || []).filter(s => s.is_active);

  const renderEventTypeGrid = () => (
    <div className="flex flex-col gap-2">
      <FieldLabel>{t('Event type')}</FieldLabel>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('Event type')}>
        {EVENT_TYPE_OPTIONS.map(opt => {
          const isSelected = eventType === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => selectEventType(opt.value)}
              className={cn(
                'rounded-[24px] p-4 flex flex-col gap-1 text-left border cursor-pointer transition-colors active:scale-[0.98]',
                isSelected ? 'border-transparent' : 'bg-card border-border text-foreground'
              )}
              style={isSelected ? { backgroundColor: activeAccentColor, color: activeAccentFg } : undefined}
            >
              <span className="bw-label-md">{eventTypeLabels[opt.value]?.label ?? opt.label}</span>
              <span className={cn('bw-body-sm', isSelected ? 'opacity-70' : 'text-muted-foreground')}>
                {eventTypeLabels[opt.value]?.subtitle ?? opt.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderTitleField = () => (
    <PillField
      label={t('Event title')}
      value={details.title}
      onChange={e => handleTitleChange(e.target.value)}
      placeholder={getEffectiveTitle()}
    />
  );

  const renderClientField = () => (
    <PillField
      label={t('Client / promoter')}
      icon={<User className="w-5 h-5" />}
      value={details.clientName}
      onChange={e => handleClientChange(e.target.value)}
      placeholder={t('e.g. Rossi / Red Bull')}
    />
  );

  const renderPresets = () => (
    <div className="flex flex-col gap-2">
      <FieldLabel>{t('Lineup preset')}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {lineupPresets.map(preset => (
          <Selector
            key={preset.label}
            size="md"
            selected={selectedMembers.length === preset.count}
            onClick={() => applyPerformancePreset(preset)}
          >
            {preset.label}
          </Selector>
        ))}
      </div>
    </div>
  );

  const renderRosterRows = () => (
    <div className="flex flex-col">
      {MEMBERS.map(member => {
        const isSelected = selectedMembers.includes(member.id);
        const isCurrentUser = member.id === currentUserMemberId;
        const isLocked = isSelected && isCurrentUser;
        const showFee = isSelected && isAdmin && !feeTbd;

        return (
          <div key={member.id} className="flex items-center gap-3 py-2 min-h-[57px]">
            <div
              onClick={() => !isLocked && toggleMember(member.id)}
              className={cn('flex items-center gap-3 min-w-0 flex-1', !isLocked && 'cursor-pointer')}
            >
              <DotCheckbox
                checked={isSelected}
                disabled={isLocked}
                activeColor="var(--wizard-accent)"
                inactiveColor="var(--dot-mid)"
              />
              <MemberAvatar initials={member.initials} />
              <div className="min-w-0 flex flex-col">
                <span className={cn('bw-label-md truncate', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                  {member.name}
                </span>
                <span className="bw-body-sm text-muted-foreground truncate">
                  {isCurrentUser ? t('You · {role}', { role: member.role }) : member.role}
                </span>
              </div>
            </div>

            {showFee && (
              <label className="flex items-center gap-1 h-10 px-3 rounded-full bg-field border border-border focus-within:border-foreground shrink-0 cursor-text">
                <span className="bw-body-md text-muted-foreground">{currencySymbol}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label={t('Fee for {name}', { name: member.name })}
                  value={memberFees[member.id] || ''}
                  onChange={e => updateFee(member.id, e.target.value)}
                  placeholder={getAutoFeeForMember(member.id, selectedMembers, pricingSettings)}
                  className="w-14 bg-transparent text-right bw-label-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderExtraFee = (withTbd = true) =>
    isAdmin && (
      <div className="flex flex-col gap-3">
        {modalCategory === 'gig' && withTbd && (
          <Selector
            selected={feeTbd}
            onClick={() => setFeeTbd(v => !v)}
            aria-pressed={feeTbd}
          >
            {t('Fee to be discussed (TBD)')}
          </Selector>
        )}
        {feeTbd && (
          <span className="bw-body-sm text-muted-foreground">
            {t('The gig is confirmed on the calendar; set the fees once the deal is closed.')}
          </span>
        )}
        {!feeTbd && <>
        <PillField
          label={t('Extra band fee / services')}
          type="number"
          inputMode="decimal"
          icon={<span className="bw-body-lg text-muted-foreground w-5 text-center">{currencySymbol}</span>}
          value={extraBandFee}
          onChange={e => setExtraBandFee(e.target.value)}
          placeholder="0"
        />
        {activeServices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeServices.map(service => (
              <Selector
                key={service.id}
                size="sm"
                selected={false}
                onClick={() => {
                  const current = parseFloat(extraBandFee) || 0;
                  setExtraBandFee(String(current + service.price));
                }}
              >
                + {service.name} ({currencySymbol}
                {service.price})
              </Selector>
            ))}
          </div>
        )}
        </>}
      </div>
    );

  const renderVenueField = (placeholder: string) => (
    <div className="flex flex-col gap-2">
      <FieldLabel>{t('Venue / location')}</FieldLabel>
      <div className="relative">
        <MapPin className="w-5 h-5 absolute left-4 top-4 z-[1] pointer-events-none text-foreground" />
        <VenueAutocomplete
          value={details.venue}
          onChange={val => setDetails(prev => ({ ...prev, venue: val }))}
          onSelect={place => {
            const { location, isNamedPlace } = venueFields(place);
            setDetails(prev => ({
              ...prev,
              venue: location,
              // The street is the venue itself when the pick is just an address.
              address: isNamedPlace ? place.address || '' : '',
              ...(place.city ? { city: place.city } : {}),
              ...(place.state ? { province: place.state } : {}),
              ...(place.postcode ? { zip: place.postcode } : {}),
              ...(place.country ? { country: place.country } : {}),
            }));
          }}
          placeholder={placeholder}
          className="h-[52px] pl-12 pr-10 pb-0 rounded-full bg-field border border-border text-foreground text-lg font-medium normal-case placeholder:text-muted-foreground/60 focus:border-2 focus:border-foreground"
        />
      </div>
    </div>
  );

  const renderDateField = () => (
    <div className="flex flex-col gap-2">
      <FieldLabel>{t('Event date')}</FieldLabel>
      <DatePicker
        value={details.date}
        onChange={d => setDetails(prev => ({ ...prev, date: d }))}
        accentColor={activeAccentColor}
        placeholder={t('Select event date')}
        className={PICKER_FIELD}
        events={pickerEvents}
        availability={{ bandId: selectedBand?.id, start: details.startTime, end: details.endTime, excludeEventId: editingEvent?.eventId }}
      />
    </div>
  );

  // Figma "Picker / Time" overline: "Gig · Sat 12 Dec".
  const timeOverline = (() => {
    const kindLabel = modalCategory === 'quote' ? t('Quote') : t('Gig');
    const d = details.date ? new Date(details.date + 'T00:00:00') : null;
    if (!d || isNaN(d.getTime())) return kindLabel;
    return `${kindLabel} · ${d.toLocaleDateString(intlLocale('en-GB'), { weekday: 'short', day: 'numeric', month: 'short' })}`;
  })();

  const renderTimeFields = () => (
    <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2 min-w-0">
        <FieldLabel htmlFor="cem-start-time">{t('Start time')}</FieldLabel>
        <TimePicker
          id="cem-start-time"
          value={details.startTime}
          onChange={val => setDetails(prev => ({ ...prev, startTime: val }))}
          accentColor={activeAccentColor}
          textSize="text-lg"
          showIcon
          className={PICKER_FIELD}
          overline={timeOverline}
        />
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <FieldLabel htmlFor="cem-end-time" trailing={<span className="bw-label-sm text-foreground">{calculatedDurationBadge}</span>}>
          {t('End time')}
        </FieldLabel>
        <TimePicker
          id="cem-end-time"
          value={details.endTime}
          onChange={val => setDetails(prev => ({ ...prev, endTime: val }))}
          accentColor={activeAccentColor}
          align="end"
          textSize="text-lg"
          showIcon
          className={PICKER_FIELD}
          overline={timeOverline}
        />
      </div>
    </div>
    {renderCallTimes()}
    </div>
  );

  // Call times: shown on the event and the member's Home card.
  const renderCallTimes = () => (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2 min-w-0">
        <FieldLabel htmlFor="cem-loadin-time">{t('Load-in (optional)')}</FieldLabel>
        <TimePicker
          id="cem-loadin-time"
          value={details.loadInTime}
          onChange={val => setDetails(prev => ({ ...prev, loadInTime: val }))}
          accentColor={activeAccentColor}
          textSize="text-lg"
          showIcon
          allowEmpty
          emptyLabel={t('Add')}
          className={PICKER_FIELD}
          overline={timeOverline}
        />
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <FieldLabel htmlFor="cem-soundcheck-time">{t('Soundcheck (optional)')}</FieldLabel>
        <TimePicker
          id="cem-soundcheck-time"
          value={details.soundcheckTime}
          onChange={val => setDetails(prev => ({ ...prev, soundcheckTime: val }))}
          accentColor={activeAccentColor}
          align="end"
          textSize="text-lg"
          showIcon
          allowEmpty
          emptyLabel={t('Add')}
          className={PICKER_FIELD}
          overline={timeOverline}
        />
      </div>
    </div>
  );

  const renderSettingField = () => (
    <div className="flex flex-col gap-2">
      <FieldLabel>{t('Setting')}</FieldLabel>
      <div className="flex gap-2">
        <Selector size="md" selected={setting === 'indoor'} onClick={() => setSetting('indoor')}>
          {t('Indoor')}
        </Selector>
        <Selector size="md" selected={setting === 'outdoor'} onClick={() => setSetting('outdoor')}>
          {t('Outdoor')}
        </Selector>
      </div>
    </div>
  );

  const renderGuestsField = (label: string) => (
    <div className="flex flex-col gap-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <IconButton
          label={t('Fewer guests')}
          size="sm"
          icon={<Minus />}
          onClick={() => setDetails(prev => ({ ...prev, guests: Math.max(0, prev.guests - 10) }))}
        />
        <span className="bw-h1 flex-1 text-center tabular-nums">{details.guests}</span>
        <IconButton
          label={t('More guests')}
          size="sm"
          icon={<Plus />}
          onClick={() => setDetails(prev => ({ ...prev, guests: prev.guests + 10 }))}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {[50, 100, 150, 200, 300].map(n => (
          <Selector
            key={n}
            size="sm"
            selected={details.guests === n}
            onClick={() => setDetails(prev => ({ ...prev, guests: n }))}
          >
            {n === 300 ? '300+' : n}
          </Selector>
        ))}
      </div>
    </div>
  );

  const renderDurationField = (label: string, withMinutes: boolean) => (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor="event-duration">{label}</FieldLabel>
      <div className="relative">
        <select
          id="event-duration"
          value={details.duration}
          onChange={e => setDetails(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
          className="w-full h-[52px] appearance-none rounded-full bg-field border border-border pl-4 pr-12 bw-body-lg text-foreground focus:outline-none focus:border-2 focus:border-foreground cursor-pointer"
        >
          {DURATION_15M_OPTIONS.map(m => (
            <option key={m} value={m} className="bg-card text-foreground">
              {withMinutes ? `${formatDurationOption(m)} (${m} min)` : formatDurationOption(m)}
            </option>
          ))}
        </select>
        <ChevronDown className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground" />
      </div>
    </div>
  );

  const renderTaskInput = () => (
    <div className="flex items-center gap-2">
      <PillField
        label={t('New task')}
        hideLabel
        className="flex-1"
        value={newTaskText}
        onChange={e => setNewTaskText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddNewTask();
          }
        }}
        placeholder={t('Add a preparation task...')}
      />
      <PillButton variant="primary" size="md" fullWidth={false} onClick={handleAddNewTask} disabled={!newTaskText.trim()}>
        {t('Add')}
      </PillButton>
    </div>
  );

  const renderNotesField = (label: string, placeholder: string) => (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor="event-band-notes">{label}</FieldLabel>
      <textarea
        id="event-band-notes"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-[24px] bg-field border border-border p-4 bw-body-md text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-2 focus:border-foreground"
      />
    </div>
  );

  const openSongPicker = (setUid: string | null) => {
    setSongPickerTargetSet(setUid);
    setSongPickerOpen(true);
  };

  // ── STEP 01: EVENT & LINEUP ─────────────────────────────────
  const renderStep1 = () => (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {renderTitleField()}
      {renderClientField()}
      {renderEventTypeGrid()}
      {renderPresets()}

      {/* Roster card */}
      <div className="bg-card text-card-foreground rounded-[24px] p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3 min-h-9">
          <span className="bw-label-md">
            {t('Roster · {count} of {total}', { count: selectedMembers.length, total: MEMBERS.length })}
          </span>
          <PillButton
            variant="ghost"
            size="sm"
            fullWidth={false}
            className="px-0"
            icon={<Edit3 className="w-3.5 h-3.5" />}
            aria-expanded={isRosterExpanded}
            onClick={() => setIsRosterExpanded(!isRosterExpanded)}
          >
            {isRosterExpanded ? t('Done') : t('Customize')}
          </PillButton>
        </div>

        {!isRosterExpanded && (
          <div className="flex items-center gap-3 pt-2 min-w-0">
            <div className="flex -space-x-1.5 shrink-0">
              {MEMBERS.filter(m => selectedMembers.includes(m.id))
                .slice(0, 5)
                .map(m => (
                  <MemberAvatar key={m.id} initials={m.initials} title={m.name} />
                ))}
              {selectedMembers.length > 5 && (
                <MemberAvatar initials={`+${selectedMembers.length - 5}`} className="bg-foreground/[0.08] text-foreground" />
              )}
            </div>
            <span className="bw-body-sm text-muted-foreground truncate">
              {musiciansText(selectedMembers.length)}
              {isAdmin && grandTotalFee > 0 ? ` · ${t('{amount} est. total', { amount: `${currencySymbol}${grandTotalFee}` })}` : ''}
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {isRosterExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {renderRosterRows()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {renderExtraFee()}
    </div>
  );

  // ── STEP 02: DATE & VENUE ───────────────────────────────────
  const renderStep2 = () => (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {renderVenueField(t('Search venue or location...'))}

      {/* Quick-select chips */}
      <div className="flex flex-wrap gap-2 -mt-1">
        {['TBD', 'Main Stage', 'Private Venue'].map(loc => (
          <Selector
            key={loc}
            size="sm"
            selected={details.venue === builtinText(loc)}
            onClick={() => setDetails(prev => ({ ...prev, venue: builtinText(loc) }))}
          >
            {builtinText(loc)}
          </Selector>
        ))}
      </div>

      {renderDateField()}
      {renderTimeFields()}
      {forecast && (
        <p className="bw-body-sm text-muted-foreground -mt-1" aria-live="polite">
          {t('Forecast: {temp}° {sky}', { temp: forecast.temp, sky: skyLabel(forecast.sky) })}
          {forecast.sunset ? ` · ${t('sunset {time}', { time: forecast.sunset })}` : ''}
        </p>
      )}
    </div>
  );

  // Setlist and tasks editors: the review step and the tablet composer's sheets.
  const renderSetlistEditor = () => (
    <>
      {libraryError && (
        <p role="alert" className="bw-body-sm text-destructive [overflow-wrap:anywhere]">
          {libraryError}
        </p>
      )}
      {savedSetlists.length > 0 && (setlist.length === 0 || showSetlistTemplates) && (
        <div className="flex flex-col gap-2">
          <FieldLabel>{setlist.length > 0 ? t('Replace with a template') : t('Load from templates')}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {savedSetlists.map(sl => (
              <Selector
                key={sl.id}
                size="sm"
                selected={false}
                onClick={() => {
                  loadSavedSetlist(sl);
                  setShowSetlistTemplates(false);
                }}
              >
                <Folder className="w-3.5 h-3.5" />
                {sl.name}
                {sl.song_count != null && <span className="opacity-60">({sl.song_count})</span>}
              </Selector>
            ))}
          </div>
        </div>
      )}

      {setlist.length > 0 && reorderHint}
      {setlist.length > 0 ? (
        setlist.map((item, i) => (
          <div key={item.uid || i} className="rounded-[16px] bg-foreground/[0.08] p-3 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <input
                type="text"
                aria-label={t('Set name')}
                value={item.title}
                onChange={e =>
                  setSetlist(prev => prev.map(s => (s.uid === item.uid ? { ...s, title: e.target.value } : s)))
                }
                className="flex-1 min-w-0 bg-transparent bw-label-md text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder={t('Set name...')}
              />
              <PillButton variant="danger" size="sm" fullWidth={false} className="px-0" onClick={() => removeSet(item.uid)}>
                {t('Remove set')}
              </PillButton>
            </div>

            {(item.songs || []).length > 0 && (
              <SortableSongList
                songs={item.songs}
                startNumber={setStarts[i]}
                canReorder={isAdmin}
                label={item.title || t('Set {n}', { n: i + 1 })}
                onReorder={songs => setSetlist(prev => withSetSongs(prev, item.uid, songs))}
                onRemove={songUid => removeSongFromSet(item.uid, songUid)}
              />
            )}
            {(item.songs || []).length === 0 && (
              <p className="bw-body-sm text-muted-foreground">{t('No songs in this set.')}</p>
            )}

            <div className="flex items-center gap-4">
              <PillButton
                variant="ghost"
                size="sm"
                fullWidth={false}
                className="px-0"
                icon={<Music className="w-3.5 h-3.5" />}
                onClick={() => openSongPicker(item.uid)}
              >
                {t('From library')}
              </PillButton>
              <PillButton
                variant="ghost"
                size="sm"
                fullWidth={false}
                className="px-0 text-muted-foreground"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => addSongToSet(item.uid)}
              >
                {t('Manual')}
              </PillButton>
            </div>
          </div>
        ))
      ) : (
        <p className="bw-body-sm text-muted-foreground">
          {t('No sets added yet. Load a saved template or add songs from your catalog.')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <PillButton
          variant="outline"
          size="sm"
          fullWidth={false}
          icon={<Plus className="w-4 h-4" />}
          onClick={() => openSongPicker(setlist[0]?.uid || null)}
        >
          {t('Add songs')}
        </PillButton>
        <PillButton variant="outline" size="sm" fullWidth={false} icon={<Layers className="w-4 h-4" />} onClick={addSet}>
          {t('Add set')}
        </PillButton>
        {savedSetlists.length > 0 && setlist.length > 0 && (
          <PillButton
            variant={showSetlistTemplates ? 'dark' : 'outline'}
            size="sm"
            fullWidth={false}
            icon={<LayoutTemplate className="w-4 h-4" />}
            aria-expanded={showSetlistTemplates}
            onClick={() => setShowSetlistTemplates(v => !v)}
          >
            {t('Templates')}
          </PillButton>
        )}
      </div>
    </>
  );

  const renderTasksEditor = () => (
    <>
      {taskTemplates.length > 0 && tasks.length === 0 && (
        <div className="flex flex-col gap-2">
          <FieldLabel>{t('Load a to-do list')}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {taskTemplates.map(tpl => (
              <Selector
                key={tpl.id}
                size="sm"
                selected={false}
                onClick={() => {
                  const loaded = tpl.tasks.map((tk: any) => ({
                    uid: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    title: tk.title,
                    completed: false,
                    templateId: tpl.id,
                    dueOffset: tk.dueOffset ?? tk.due_offset,
                  }));
                  setTasks(loaded);
                }}
              >
                <Folder className="w-3.5 h-3.5" />
                {tpl.name}
                <span className="opacity-60">({tpl.tasks.length})</span>
              </Selector>
            ))}
          </div>
        </div>
      )}

      {renderTaskInput()}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-2">
          {tasks.map((task, idx) => (
            <div
              key={task.uid || idx}
              className="flex items-center gap-3 rounded-[16px] bg-foreground/[0.08] pl-4 pr-1 py-1 min-h-11"
            >
              <span className="bw-body-md text-foreground truncate flex-1 min-w-0">{task.title}</span>
              <IconButton
                label={t('Delete task')}
                variant="ghost"
                size="sm"
                icon={<X />}
                onClick={() => setTasks(tasks.filter((_, i) => i !== idx))}
              />
            </div>
          ))}
        </div>
      )}

      {renderNotesField(t('Band notes'), t('Any details, directions, or notes for the band...'))}
    </>
  );

  // ── STEP 03: REVIEW & OPTIONAL EXTRAS ───────────────────────
  const setlistSummary =
    totalSongCount === 0 && setlist.length === 0
      ? t('Optional · No setlist')
      : t('Optional · {sets}, {songs}', { sets: setsText(setlist.length), songs: songsText(totalSongCount) });
  const logisticsSummary = [t('Optional'), settingCap(setting), details.guests > 0 ? t('~{count} guests', { count: details.guests }) : null]
    .filter(Boolean)
    .join(' · ');
  const tasksSummary = t('Optional · {tasks}', { tasks: tasksText(tasks.length) });
  const lineupLabel = (() => {
    const n = selectedMembers.length;
    if (n > 1 && n === MEMBERS.length) return t('Full band');
    if (n === 1) return t('Solo');
    if (n === 2) return t('Duo');
    if (n === 3) return t('Trio');
    return t('Custom lineup');
  })();
  const lineupSummary = [
    lineupLabel,
    musiciansText(selectedMembers.length),
    isAdmin && grandTotalFee > 0 ? `${currencySymbol}${grandTotalFee.toLocaleString(intlLocale('en-US'))}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const renderStep3 = () => (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Summary card (event colour) */}
      <div
        className="rounded-[24px] p-5 flex flex-col gap-3"
        style={{ backgroundColor: activeAccentColor, color: activeAccentFg }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Tag variant="solid">{modalCategory === 'quote' ? t('Quote') : t('Gig')}</Tag>
          <span className="bw-label-xs">{eventType ? rawWord(eventType) : t('Event')}</span>
          <span className="bw-label-xs opacity-70">{rawWord(setting)}</span>
        </div>
        <h3 className="bw-display-lg [overflow-wrap:anywhere]">{getEffectiveTitle()}</h3>

        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 shrink-0 mt-[3px]" />
          <span className="bw-body-md">
            {details.date ? formattedDateStr : t('Date TBD')} · {details.startTime || '20:00'} – {details.endTime || '23:30'}
          </span>
        </div>
        <div className="flex items-start gap-2 min-w-0">
          <MapPin className="w-4 h-4 shrink-0 mt-[3px]" />
          <span className="bw-body-md truncate">
            {details.venue || t('Venue TBD')}
            {details.city ? `, ${details.city}` : ''}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 shrink-0 mt-[3px]" />
          <span className="bw-body-md">{lineupSummary}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <PillButton variant="dark" size="sm" icon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => setStep(0)}>
            {t('Edit lineup')}
          </PillButton>
          <PillButton variant="dark" size="sm" icon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => setStep(1)}>
            {t('Edit date & venue')}
          </PillButton>
        </div>
      </div>

      {/* Accordion 1: Setlist & songs */}
      <EditAccordionCard
        isOpen={isReviewSetlistExpanded}
        onToggle={() => setIsReviewSetlistExpanded(!isReviewSetlistExpanded)}
        title={t('Setlist & songs')}
        summary={setlistSummary}
      >
        {renderSetlistEditor()}
      </EditAccordionCard>

      {/* Accordion 2: Logistics, guests & setting */}
      <EditAccordionCard
        isOpen={isReviewLogisticsExpanded}
        onToggle={() => setIsReviewLogisticsExpanded(!isReviewLogisticsExpanded)}
        title={t('Logistics, guests & setting')}
        summary={logisticsSummary}
      >
        {renderSettingField()}
        {renderGuestsField(t('Estimated guests'))}
        {renderDurationField(t('Performance duration'), true)}
      </EditAccordionCard>

      {/* Accordion 3: Tasks & band notes */}
      <EditAccordionCard
        isOpen={isReviewTasksExpanded}
        onToggle={() => setIsReviewTasksExpanded(!isReviewTasksExpanded)}
        title={t('Tasks & band notes')}
        summary={tasksSummary}
      >
        {renderTasksEditor()}
      </EditAccordionCard>
    </div>
  );

  // ── ACCORDION EDIT VIEW (FOR isEditing === true) ─────────────
  const renderEditAccordionView = () => (
    <div className="flex flex-col gap-4">
      {/* Section 1: Event basics & client */}
      <EditAccordionCard
        isOpen={!!expandedSections.basics}
        onToggle={() => toggleEditSection('basics')}
        stepNumber="01"
        title={t('Event basics & client')}
        summary={`${typeCap(eventType) || t('Event')} · ${details.clientName ? t('Client: {name}', { name: details.clientName }) : t('No client')} · ${guestsText(details.guests || 0)} · ${settingCap(setting)}`}
      >
        {renderEventTypeGrid()}
        {renderClientField()}
        {renderTitleField()}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderGuestsField(t('Guests'))}
          {renderSettingField()}
        </div>
      </EditAccordionCard>

      {/* Section 2: Date, time & venue */}
      <EditAccordionCard
        isOpen={!!expandedSections.date_venue}
        onToggle={() => toggleEditSection('date_venue')}
        stepNumber="02"
        title={t('Date, time & venue')}
        summary={`${formattedDateStr} · ${details.startTime} – ${details.endTime} · ${details.venue || t('Venue TBD')}`}
        hasWarning={warnField('date') || warnField('venue') || warnField('time')}
      >
        {renderVenueField(t('Venue name'))}
        {renderDateField()}
        {renderTimeFields()}
      </EditAccordionCard>

      {/* Section 3: Band roster & compensation */}
      <EditAccordionCard
        isOpen={!!expandedSections.team_pay}
        onToggle={() => toggleEditSection('team_pay')}
        stepNumber="03"
        title={t('Band & compensation')}
        summary={t('{count} of {musicians} · Total {amount}', {
          count: selectedMembers.length,
          musicians: musiciansText(MEMBERS.length),
          amount: `${currencySymbol}${grandTotalFee}`,
        })}
        hasWarning={warnField('members') || warnField('fee')}
      >
        {renderPresets()}
        {renderRosterRows()}
        {renderExtraFee()}
        {renderDurationField(t('Duration'), false)}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <span className="bw-label-sm text-muted-foreground">{t('Total estimate')}</span>
          <span className="bw-h2 tabular-nums">
            {currencySymbol}
            {grandTotalFee}
          </span>
        </div>
      </EditAccordionCard>

      {/* Section 4: Setlist, tasks & notes */}
      <EditAccordionCard
        isOpen={!!expandedSections.setlist_tasks}
        onToggle={() => toggleEditSection('setlist_tasks')}
        stepNumber="04"
        title={t('Setlist, tasks & notes')}
        summary={`${songsText(totalSongCount)} · ${tasksText(tasks.length)} · ${notes ? t('Notes attached') : t('No notes')}`}
      >
        <div className="rounded-[16px] bg-foreground/[0.08] p-4 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="bw-label-sm text-muted-foreground">{t('Setlist')}</span>
            <span className="bw-body-lg text-foreground">
              {setsText(setlist.length)} · {songsText(totalSongCount)}
            </span>
          </div>
          <PillButton
            variant="primary"
            size="sm"
            fullWidth={false}
            icon={<Music className="w-4 h-4" />}
            onClick={() => openSongPicker(setlist[0]?.uid || null)}
          >
            {t('Pick songs')}
          </PillButton>
        </div>

        {/* Songs in play order; the admin reorders them (saved with the gig). */}
        {isAdmin && totalSongCount > 0 && (
          <div className="flex flex-col gap-2">
            {reorderHint}
            {setlist.map((item, i) =>
              (item.songs || []).length > 0 ? (
                <div key={item.uid || i} className="rounded-[16px] bg-foreground/[0.08] p-3 flex flex-col gap-1">
                  {setlist.length > 1 && (
                    <span className="bw-label-sm text-muted-foreground px-1">{item.title || t('Set {n}', { n: i + 1 })}</span>
                  )}
                  <SortableSongList
                    songs={item.songs}
                    startNumber={setStarts[i]}
                    canReorder
                    label={item.title || t('Set {n}', { n: i + 1 })}
                    onReorder={songs => setSetlist(prev => withSetSongs(prev, item.uid, songs))}
                  />
                </div>
              ) : null
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <FieldLabel>{t('Tasks')}</FieldLabel>
          {renderTaskInput()}
          {tasks.map((task, i) => (
            <div key={task.uid || i} className="flex items-center gap-2">
              <input
                type="text"
                aria-label={t('Task {number}', { number: i + 1 })}
                value={task.title}
                onChange={e => {
                  const newTasks = [...tasks];
                  newTasks[i] = { ...newTasks[i], title: e.target.value };
                  setTasks(newTasks);
                }}
                placeholder={t('Task description...')}
                className="flex-1 min-w-0 h-11 px-4 rounded-full bg-field border border-border bw-body-md text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground"
              />
              <IconButton
                label={t('Delete task')}
                variant="ghost"
                size="sm"
                icon={<X />}
                onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
              />
            </div>
          ))}
        </div>

        {renderNotesField(t('Notes for the band'), t('Any details or notes for the band...'))}
      </EditAccordionCard>
    </div>
  );

  // SongPicker overline: the set the songs land in (e.g. "Set 1 · Dinner").
  const songPickerOverline = (() => {
    const target = setlist.find((s: any) => s.uid === songPickerTargetSet) || setlist[0];
    return (target?.title || '').trim() || t('Set 1');
  })();

  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;

  const canProceed = (() => {
    switch (step) {
      case 0:
        return eventType !== null;
      case 1:
        return !!details.date;
      case 2:
        return true;
      default:
        return true;
    }
  })();

  const rightButtonLabel = isLastStep
    ? modalCategory === 'quote'
      ? t('Create quote')
      : t('Create gig')
    : t('Next');

  const rightButtonAction = isLastStep ? handleCreate : handleNext;

  const headerPadTop = { paddingTop: 'var(--wizard-header-pt, calc(var(--safe-top) + 8px))' };
  const ctaPadBottom = { paddingBottom: 'calc(var(--safe-bottom) + 16px)' };

  // ── EDIT MODE RENDER ────────────────────────────────────────
  if (isEditing) {
    return (
      <>
        <motion.div
          data-modal-open="true"
          data-wizard-type={modalCategory}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
          className="bw-pane-detail fixed inset-0 z-[100] bg-background text-foreground flex flex-col h-full overflow-hidden"
        >
          {/* Header */}
          <div className="shrink-0 px-4 pb-3 flex flex-col gap-2" style={headerPadTop}>
            <div className="h-11 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Tag variant="solid">{t('Editing')}</Tag>
                <Tag variant="subtle">{rawWord(modalCategory)}</Tag>
                {eventType && <Tag variant="subtle">{rawWord(eventType)}</Tag>}
              </div>
              <RailCover pane />
              <HeaderAction
                pane
                label={t('Close edit {kind} modal', { kind: rawWord(modalCategory) })}
                variant="outline"
                size="sm"
                icon={<X />}
                onClick={onClose}
              />
            </div>
            <h1 className="bw-h1 truncate">{getEffectiveTitle()}</h1>
            <span className="bw-body-sm text-muted-foreground truncate">
              {formattedDateStr} · {details.startTime} – {details.endTime} · {details.venue || t('Venue TBD')}
            </span>
          </div>

          {/* Scrollable body */}
          <PeekingScrollContainer className="flex-1 px-4 pt-2 pb-6 min-h-0">
            {renderEditAccordionView()}
          </PeekingScrollContainer>

          {/* CTA bar */}
          <div className="shrink-0 px-4 pt-3 bg-background" style={ctaPadBottom}>
            <div className="grid grid-cols-[2fr_3fr] gap-3">
              <PillButton variant="outline" size="lg" onClick={onClose}>
                {t('Cancel')}
              </PillButton>
              <PillButton
                variant="primary"
                size="lg"
                icon={<Check className="w-5 h-5" />}
                onClick={handleCreate}
                disabled={!details.date}
                loading={isSaving}
              >
                {t('Save changes')}
              </PillButton>
            </div>
          </div>
        </motion.div>

        {/* SongPicker overlay */}
        <AnimatePresence>
          {songPickerOpen && (
            <SongPicker
              isOpen={songPickerOpen}
              onClose={() => {
                setSongPickerOpen(false);
                setSongPickerTargetSet(null);
              }}
              onSelect={handlePickedSong}
              onSelectMultiple={handlePickedMultipleSongs}
              onRemoveSelected={handleRemovedSongs}
              multiSelect={true}
              selectedIds={setlist.flatMap((s: any) =>
                (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
              )}
              theme="lime"
              overline={songPickerOverline}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── TABLET COMPOSER (Figma iPad · 04 "New gig") ─────────────
  // Every step on one screen in numbered cards, and the gig as the band will
  // see it beside them. Fields, drafts and save are the wizard's own.
  const renderComposer = () => {
    const landscape = composerLayout.landscape;
    const money = (n: number) => `${currencySymbol}${n.toLocaleString(intlLocale('en-US'))}`;
    const compactMoney = (n: number) =>
      n >= 1000 ? `${currencySymbol}${(Math.round(n / 100) / 10).toString()}K` : `${currencySymbol}${Math.round(n)}`;
    const venueSet = !!details.venue.trim() && details.venue !== 'TBD';
    const feeSet = feeTbd || grandTotalFee > 0;
    const doneEvent = !!eventType;
    const doneDate = !!details.date;
    const doneLineup = selectedMembers.length > 0;
    const ready = [doneEvent, doneDate, venueSet, doneLineup, feeSet].filter(Boolean).length;
    const canCreate = !!eventType && !!details.date;
    const dateShort = details.date
      ? new Date(details.date + 'T00:00:00').toLocaleDateString(intlLocale('en-GB'), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : null;
    const whenLine = [dateShort, details.startTime].filter(Boolean).join(', ');
    const addressLine = [addressWithoutCity(details.address, details.city), details.city].filter(Boolean).join(', ');
    const dayFree = details.date ? composerFree?.get(details.date) ?? null : null;
    const feeLabel = feeTbd ? t('TBD') : grandTotalFee > 0 ? money(grandTotalFee) : null;

    const typeChips = (
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('Event type')}>
        {EVENT_TYPE_OPTIONS.map(opt => (
          <Selector
            key={opt.value}
            size="md"
            selected={eventType === opt.value}
            onClick={() => selectEventType(opt.value)}
          >
            {eventTypeLabels[opt.value]?.label ?? opt.label}
          </Selector>
        ))}
      </div>
    );

    const eventCard = (
      <ComposerCard n={1} title={t('Event')} done={doneEvent}>
        {typeChips}
        {renderTitleField()}
        {renderClientField()}
      </ComposerCard>
    );

    const dateCard = (
      <ComposerCard n={2} title={t('Date & time')} done={doneDate}>
        <InlineMonthCalendar
          value={details.date}
          onChange={d => setDetails(prev => ({ ...prev, date: d }))}
          events={pickerEvents}
          accent={activeAccentColor}
          accentFg={activeAccentFg}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2 min-w-0">
            <FieldLabel htmlFor="cmp-start-time">{t('Start time')}</FieldLabel>
            <TimePicker
              id="cmp-start-time"
              value={details.startTime}
              onChange={val => setDetails(prev => ({ ...prev, startTime: val }))}
              accentColor={activeAccentColor}
              textSize="text-lg"
              className={PICKER_FIELD}
              overline={timeOverline}
            />
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <FieldLabel
              htmlFor="cmp-end-time"
              trailing={<span className="bw-label-sm text-foreground">{calculatedDurationBadge}</span>}
            >
              {t('End time')}
            </FieldLabel>
            <TimePicker
              id="cmp-end-time"
              value={details.endTime}
              onChange={val => setDetails(prev => ({ ...prev, endTime: val }))}
              accentColor={activeAccentColor}
              align="end"
              textSize="text-lg"
              className={PICKER_FIELD}
              overline={timeOverline}
            />
          </div>
        </div>
        {dayFree && (
          <p className={cn('bw-label-xs flex items-center gap-2', freeTone(dayFree))} aria-live="polite">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
            {heatLevel(dayFree) === 4
              ? t('{free} of {total} free · no conflicts', { free: dayFree.free, total: dayFree.total })
              : t('{free} of {total} free', { free: dayFree.free, total: dayFree.total })}
          </p>
        )}
        {forecast && (
          <p className="bw-label-xs text-muted-foreground" aria-live="polite">
            {t('Forecast: {temp}° {sky}', { temp: forecast.temp, sky: skyLabel(forecast.sky) })}
            {forecast.sunset ? ` · ${t('sunset {time}', { time: forecast.sunset })}` : ''}
          </p>
        )}
      </ComposerCard>
    );

    const venueCard = (
      <ComposerCard n={3} title={t('Venue')} done={venueSet}>
        {renderVenueField(t('Search venue or location...'))}
        {addressLine && <p className="bw-label-xs text-muted-foreground px-1 [overflow-wrap:anywhere]">{addressLine}</p>}
      </ComposerCard>
    );

    const lineupCard = (
      <ComposerCard n={4} title={t('Lineup')} done={doneLineup}>
        <div className="flex flex-wrap gap-2">
          {lineupPresets.map(preset => (
            <Selector
              key={preset.label}
              size="md"
              selected={selectedMembers.length === preset.count}
              onClick={() => applyPerformancePreset(preset)}
            >
              {preset.label}
            </Selector>
          ))}
        </div>
        {renderRosterRows()}
      </ComposerCard>
    );

    const feeCard = isAdmin ? (
      <ComposerCard n={5} title={t('Fee')} done={feeSet}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0 h-[52px] rounded-full bg-field border border-border px-5 flex items-center">
            <span className="bw-h2 tabular-nums truncate" aria-live="polite">
              {feeTbd ? t('TBD') : money(grandTotalFee)}
            </span>
          </div>
          <Segmented
            label={t('Fee')}
            value={feeTbd ? 'tbd' : 'fixed'}
            onChange={v => setFeeTbd(v === 'tbd')}
            options={[
              { value: 'fixed', label: t('Fixed') },
              { value: 'tbd', label: t('TBD') },
            ]}
            className="shrink-0 w-[150px]"
          />
        </div>
        {feeTbd ? (
          <p className="bw-body-sm text-muted-foreground">
            {t('The gig is confirmed on the calendar; set the fees once the deal is closed.')}
          </p>
        ) : (
          <>
            <p className="bw-label-xs text-muted-foreground px-1">
              {t('Musicians {amount}', { amount: money(totalPayout) })}
              {parseFloat(extraBandFee) > 0 ? ` · ${t('Band {amount}', { amount: money(parseFloat(extraBandFee)) })}` : ''}
            </p>
            {renderExtraFee(false)}
          </>
        )}
      </ComposerCard>
    ) : null;

    const riderSet = draftStage.edited || draftStage.riderWanted;
    const extras: { key: 'setlist' | 'rider' | 'tasks' | 'logistics'; label: string; icon: React.ReactNode; count?: number }[] = [
      { key: 'setlist', label: t('Setlist'), icon: <ListMusic className="w-4 h-4" />, count: totalSongCount },
      ...(riderAllowed
        ? [{
            key: 'rider' as const,
            label: t('Rider & stage'),
            icon: riderSet ? <Check className="w-4 h-4" /> : <ScrollText className="w-4 h-4" />,
          }]
        : []),
      { key: 'logistics', label: t('Logistics'), icon: <Truck className="w-4 h-4" /> },
      { key: 'tasks', label: t('Tasks'), icon: <ListChecks className="w-4 h-4" />, count: tasks.length },
    ];
    const extraButtons = (
      <div className={cn('gap-3', landscape ? 'flex flex-wrap' : extras.length > 3 ? 'grid grid-cols-4' : 'grid grid-cols-3')}>
        {extras.map(x => (
          <PillButton
            key={x.key}
            variant="outline"
            size="md"
            fullWidth={!landscape}
            icon={x.icon}
            onClick={() => setComposerSheet(x.key)}
          >
            {x.label}
            {x.count ? ` · ${x.count}` : ''}
          </PillButton>
        ))}
      </div>
    );

    const createButton = (
      <PillButton
        variant="primary"
        size="lg"
        icon={<Check className="w-5 h-5" />}
        onClick={handleCreate}
        disabled={!canCreate}
        loading={isSaving}
        style={{ backgroundColor: activeAccentColor, color: activeAccentFg }}
      >
        {t('Create gig')}
      </PillButton>
    );

    const lineupDots = (
      <span aria-hidden className="flex flex-wrap gap-[5px] max-w-[96px]">
        {MEMBERS.slice(0, 10).map((m, i) => (
          <span
            key={m.id}
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: i < selectedMembers.length ? 'currentColor' : 'color-mix(in srgb, currentColor 25%, transparent)' }}
          />
        ))}
      </span>
    );

    const previewMetrics = (size: number) => (
      <div className="flex items-end gap-6 flex-wrap">
        <div className="flex flex-col gap-1.5">
          {landscape && lineupDots}
          <span className="bw-label-xs">{t('Lineup')}</span>
          <DotText
            text={`${selectedMembers.length}/${MEMBERS.length || selectedMembers.length}`}
            size={size}
            label={t('{count} of {total}', { count: selectedMembers.length, total: MEMBERS.length })}
          />
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-1.5">
            <span className="bw-label-xs">{t('Fee')}</span>
            {feeTbd ? (
              <DotText text="TBD" size={size} label={t('TBD')} />
            ) : (
              <DotText text={compactMoney(grandTotalFee)} size={size} label={money(grandTotalFee)} />
            )}
          </div>
        )}
      </div>
    );

    const checklist = (
      <ul className="flex flex-col gap-2">
        <ComposerCheck done={doneEvent}>
          {t('Event & client')}
          {details.clientName.trim() ? ` · ${details.clientName.trim()}` : ''}
        </ComposerCheck>
        <ComposerCheck done={doneDate}>
          {doneDate ? `${t('Date')} · ${whenLine}` : t('Date TBD')}
        </ComposerCheck>
        <ComposerCheck done={venueSet}>{venueSet ? `${t('Venue')} · ${details.venue}` : t('Venue TBD')}</ComposerCheck>
        <ComposerCheck done={doneLineup}>
          {t('Lineup')} · {musiciansText(selectedMembers.length)}
        </ComposerCheck>
        {isAdmin && <ComposerCheck done={feeSet}>{`${t('Fee')} · ${feeLabel ?? '—'}`}</ComposerCheck>}
      </ul>
    );

    const previewCard = (
      <div
        className="rounded-[28px] p-5 flex flex-col gap-4 min-w-0"
        style={{ backgroundColor: activeAccentColor, color: activeAccentFg }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar aria-hidden className="w-4 h-4 shrink-0" />
          <span className="bw-label-xs">{t('Gig')}</span>
          <span className="bw-label-xs rounded-full px-2 py-0.5 bg-black/10">{feeTbd ? t('TBD') : t('Confirmed')}</span>
        </div>
        <h3 className="bw-display-lg [overflow-wrap:anywhere]">{getEffectiveTitle()}</h3>
        <p className="bw-label-xs [overflow-wrap:anywhere]">
          {venueSet ? details.venue : t('Venue TBD')}
          {addressLine ? <><br />{addressLine}</> : null}
        </p>
        {previewMetrics(30)}
      </div>
    );

    const sheetTitle =
      composerSheet === 'setlist'
        ? t('Setlist & songs')
        : composerSheet === 'rider'
          ? t('Rider & stage')
          : composerSheet === 'tasks'
            ? t('Tasks & band notes')
            : t('Logistics, guests & setting');

    return (
      <>
        <ComposerShell
          kind={modalCategory}
          title={t('New gig')}
          subline={[draft ? t('Draft') : null, selectedBand?.name].filter(Boolean).join(' · ')}
          closeLabel={t('Close gig wizard')}
          onClose={requestClose}
          ready={{ done: ready, total: 5 }}
          onSaveDraft={landscape && draftsEnabled ? handleSaveDraft : undefined}
          accent={activeAccentColor}
          accentFg={activeAccentFg}
        >
          {landscape ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)] gap-4 items-start">
              <div className="flex flex-col gap-4 min-w-0">
                {eventCard}
                {venueCard}
                {feeCard}
              </div>
              <div className="flex flex-col gap-4 min-w-0">
                {dateCard}
                {lineupCard}
              </div>
              <ComposerPreview
                label={t('Live preview')}
                caption={t('As the band sees it')}
                className="sticky top-0 min-h-[min(720px,calc(100dvh-140px))]"
                footer={createButton}
              >
                {previewCard}
                {checklist}
                <div className="flex flex-col gap-3">
                  <span className="bw-label-xs text-muted-foreground">{t('Add now or later')}</span>
                  {extraButtons}
                </div>
              </ComposerPreview>
            </div>
          ) : (
            <>
              <div
                className="rounded-[28px] p-6 flex items-end gap-6 min-w-0"
                style={{ backgroundColor: activeAccentColor, color: activeAccentFg }}
                aria-live="polite"
              >
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <span className="bw-label-xs flex items-center gap-2">
                    <Calendar aria-hidden className="w-4 h-4" />
                    {t('Live preview')} · {t('Gig')}
                  </span>
                  <h3 className="bw-display-lg [overflow-wrap:anywhere]">{getEffectiveTitle()}</h3>
                  <span className="bw-label-xs [overflow-wrap:anywhere]">
                    {[whenLine || t('Date TBD'), venueSet ? details.venue : t('Venue TBD')].join(' · ')}
                  </span>
                </div>
                <div className="shrink-0">{previewMetrics(26)}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="flex flex-col gap-4 min-w-0">
                  {eventCard}
                  {venueCard}
                  {feeCard}
                </div>
                <div className="flex flex-col gap-4 min-w-0">
                  {dateCard}
                  {lineupCard}
                </div>
              </div>
              {extraButtons}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3 pt-4">
                <PillButton variant="outline" size="lg" onClick={draftsEnabled ? handleSaveDraft : requestClose}>
                  {draftsEnabled ? t('Save draft') : t('Cancel')}
                </PillButton>
                {createButton}
              </div>
            </>
          )}
        </ComposerShell>

        <BwSheet
          open={composerSheet !== null}
          onClose={() => setComposerSheet(null)}
          title={sheetTitle}
          overline={getEffectiveTitle()}
          tone="light"
          zIndex={106}
          footer={
            <PillButton variant="primary" size="lg" onClick={() => setComposerSheet(null)}>
              {t('Done')}
            </PillButton>
          }
        >
          <div className="flex flex-col gap-4">
            {composerSheet === 'setlist' && renderSetlistEditor()}
            {composerSheet === 'rider' && (
              <RiderStageContent
                state={draftStage.state}
                isAdmin={riderAllowed}
                eventTitle={getEffectiveTitle()}
                people={riderLineup.map(p => p.name.trim().split(/\s+/)[0] || p.name)}
                canEditPlot
                layout="board"
                draft={{ riderWanted: draftStage.riderWanted }}
              />
            )}
            {composerSheet === 'tasks' && renderTasksEditor()}
            {composerSheet === 'logistics' && (
              <>
                {renderCallTimes()}
                {renderSettingField()}
                {renderGuestsField(t('Estimated guests'))}
                {renderDurationField(t('Performance duration'), true)}
              </>
            )}
          </div>
        </BwSheet>
      </>
    );
  };

  // ── CREATION MODE RENDER (3-ZONE SHELL) ─────────────────────
  return (
    <>
      {composerOn && renderComposer()}
      {!composerOn && (
      <motion.div
        data-modal-open="true"
        data-wizard-type={modalCategory}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
        className="bw-pane-detail fixed inset-0 z-[100] bg-background text-foreground flex flex-col h-full overflow-hidden"
      >
        {/* Top bar (Figma Top Bar Style=Canvas) + wizard steps */}
        <div className="shrink-0 bg-background" style={headerPadTop}>
          <div className="h-14 px-4 flex items-center gap-3 bw-status-clear">
            <NavBackButton
              pane
              label={isFirstStep ? (modalCategory === 'quote' ? t('Cancel new quote') : t('Cancel new gig')) : t('Back')}
              size="sm"
              onClick={isFirstStep ? requestClose : handleBack}
            />
            <h2 className="bw-h2 flex-1 min-w-0 truncate">{modalCategory === 'quote' ? t('New quote') : t('New gig')}</h2>
            {!closeInRail && (
              <IconButton
                label={modalCategory === 'quote' ? t('Close quote wizard') : t('Close gig wizard')}
                variant="ghost"
                size="sm"
                icon={<X />}
                onClick={requestClose}
                className="-mr-1.5"
              />
            )}
          </div>
          <div className="px-4 pb-3">
            <InteractiveStepIndicator
              current={step}
              total={STEPS.length}
              steps={stepsShown}
              maxAccessibleStep={maxAccessibleStep}
              onSelectStep={s => setStep(s)}
              activeColor="var(--wizard-accent)"
            />
          </div>
        </div>

        {/* Scrollable body */}
        <PeekingScrollContainer className="flex-1 px-4 pt-2 pb-6 min-h-0">
          {step === 0 && renderStep1()}
          {step === 1 && renderStep2()}
          {step === 2 && renderStep3()}
        </PeekingScrollContainer>

        {/* CTA bar */}
        <div className="shrink-0 px-4 pt-3 bg-background" style={ctaPadBottom}>
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <PillButton variant="outline" size="lg" onClick={isFirstStep ? requestClose : handleBack}>
              {isFirstStep ? t('Cancel') : t('Back')}
            </PillButton>
            <PillButton
              variant="primary"
              size="lg"
              onClick={rightButtonAction}
              disabled={!canProceed}
              loading={isLastStep && isSaving}
              icon={isLastStep ? <Check className="w-5 h-5" /> : undefined}
              trailingIcon={isLastStep ? undefined : <ArrowUpRight className="w-5 h-5" />}
              className={isLastStep ? undefined : 'justify-center gap-2'}
            >
              {rightButtonLabel}
            </PillButton>
          </div>
        </div>
      </motion.div>
      )}

      {/* SongPicker overlay */}
      <AnimatePresence>
        {songPickerOpen && (
          <SongPicker
            isOpen={songPickerOpen}
            onClose={() => {
              setSongPickerOpen(false);
              setSongPickerTargetSet(null);
            }}
            onSelect={handlePickedSong}
            onSelectMultiple={handlePickedMultipleSongs}
            onRemoveSelected={handleRemovedSongs}
            multiSelect={true}
            selectedIds={setlist.flatMap((s: any) =>
              (s.songs || []).filter((sg: any) => sg.songId).map((sg: any) => sg.songId)
            )}
            theme="lime"
            overline={songPickerOverline}
          />
        )}
      </AnimatePresence>

      {draftsEnabled && (
        <LeaveWizardSheet
          open={leaveOpen}
          what="gig"
          onSaveDraft={handleSaveDraft}
          onDiscard={handleDiscardDraft}
          onKeepEditing={() => setLeaveOpen(false)}
          discardLabel={draft ? t('Delete draft') : undefined}
        />
      )}
    </>
  );
};
