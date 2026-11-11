import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Clock, MapPin, ArrowLeft, ArrowUpRight, Plus, AlertCircle,
  ChevronDown, X, Layers, CurrencyIcon, Guitar, Check,
  Drum, Sliders, Mic, Edit3, Music2, CheckSquare, Sparkles, Users
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { SongPicker, type PickedSong } from '@/app/components/ui/SongPicker';
import { getRehearsalAccentColor } from '@/app/components/ui/WizardAccentRail';
import { Card, IconButton, NavBackButton, PillButton, PillField, Selector, Tag } from '@/app/components/bw';
import { useRailAction } from '@/lib/railActions';
import { PeekingScrollContainer } from '@/app/components/ui/PeekingScrollContainer';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { venueFields } from '@/lib/services/location';
import { TimePicker } from '@/app/components/ui/TimePicker';
import { DatePicker, toDatePickerEvents } from '@/app/components/ui/DatePicker';
import {
  RehearsalState,
  RehearsalType,
  RehearsalSong,
  SongProposal,
  RehearsalTask,
  RehearsalMember,
  SetlistTemplate,
  RehearsalSetlistSnapshotFinal,
  ProposalAttachment,
  RecurrenceType,
} from './types';
import { useBand } from '@/lib/BandContext';
import { getSongs, getSetlists, getSetlist, type Song, type Setlist } from '@/lib/services/songs';
import { supabase } from '@/lib/supabase';
import { LeaveWizardSheet } from '@/app/components/bw/LeaveWizardSheet';
import { saveEventDraft, deleteEventDraft, newDraftId, type EventDraft } from '@/lib/wizardDrafts';
import { useSystemBack } from '@/lib/backStack';

import { RehearsalProposeSongModal } from './RehearsalProposeSongModal';
import { RehearsalAddTaskModal } from './RehearsalAddTaskModal';
import { RehearsalSetlistEditorModal } from './RehearsalSetlistEditorModal';
import { RehearsalEditProposalModal } from './RehearsalEditProposalModal';
import { RehearsalTaskDetailModal } from './RehearsalTaskDetailModal';
import { RehearsalReviewSetlistModal } from './RehearsalReviewSetlistModal';
import { toLocalDateString } from '../../../lib/dates';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';
import { personName, personInitials } from '@/lib/personName';
import { parseGenres } from '@/lib/songGenres';

interface TaskTemplateDB {
  id: string;
  name: string;
  category: string;
  tasks: { id: string; title: string; dueOffset: number; required: boolean }[];
}

function dbSongToRehearsalSong(song: Song): RehearsalSong {
  const secs = song.duration_seconds || 0;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return {
    id: song.id,
    title: song.title,
    artist: song.artist || 'Unknown',
    duration: secs > 0 ? `${m}:${String(s).padStart(2, '0')}` : '0:00',
    priority: song.priority || 'medium',
    type: 'song',
    // Library groups and filters by genre (first tag), then the old folder.
    category: parseGenres(song.genre)[0] || song.category,
  };
}

function dbSetlistToTemplate(setlist: Setlist, songIds: string[]): SetlistTemplate {
  return {
    id: setlist.id,
    name: setlist.name,
    songIds,
    version: 1,
    updatedAt: setlist.updated_at || setlist.created_at,
    updatedBy: setlist.created_by || '',
  };
}

const DEFAULT_CHECKLIST = ['Instrument', 'Cables', 'Tuner', 'Power Supply', 'Spare Strings/Sticks', 'Earplugs'];

const STEPS = [
  { id: 'session', title: 'SESSION & ROSTER' },
  { id: 'datetime', title: 'DATE & LOCATION' },
  { id: 'review', title: 'REVIEW & CONFIRM' },
];

const TYPE_OPTIONS: {
  value: RehearsalType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'full_band', label: 'Full Band', subtitle: 'Everyone, full set', icon: Users },
  { value: 'vocals', label: 'Vocals', subtitle: 'Harmonies & leads', icon: Mic },
  { value: 'rhythm', label: 'Rhythm', subtitle: 'Drums, bass, keys', icon: Drum },
  { value: 'acoustic', label: 'Acoustic', subtitle: 'Unplugged set', icon: Guitar },
  { value: 'custom', label: 'Other', subtitle: 'Custom lineup', icon: Sliders },
];

interface EditingEvent {
  id: number;
  eventId?: string;
  title: string;
  status: string;
  date: string;
  time: string;
  location: string;
  price: string;
  endTime?: string;
  notes?: string;
  venueAddress?: string;
  venueCity?: string;
  eventType?: string;
  memberUserIds?: string[];
  memberFeeMap?: Record<string, string>;
}

interface Props {
  onClose: () => void;
  onCreate: (data: any) => void;
  editingEvent?: EditingEvent | null;
  onOpenPollBuilder?: () => void;
  /** Band calendar, so the date picker can mark busy days and suggest a free one. */
  existingEvents?: PickerSourceEvents;
  /** Reopen an unfinished "New rehearsal" saved as a draft (lib/wizardDrafts). */
  draft?: EventDraft | null;
  /** To-dos to start with (a to-do list template). */
  initialTasks?: { title: string; templateId?: string; dueOffset?: number }[];
}

type PickerSourceEvents = Parameters<typeof toDatePickerEvents>[0];

// ── Local building blocks (Figma "Rehearsal / New" frames) ──────────────

/** Wizard steps: three 6pt segments + "Step n of 3" / step name (Label/SM). */
const WizardSteps: React.FC<{
  current: number;
  steps: { title: string }[];
  maxAccessibleStep: number;
  onSelectStep: (step: number) => void;
}> = ({ current, steps, maxAccessibleStep, onSelectStep }) => (
  <div className="flex flex-col gap-2">
    <div className="flex gap-2">
      {steps.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => i <= maxAccessibleStep && onSelectStep(i)}
          disabled={i > maxAccessibleStep}
          aria-label={`Step ${i + 1}: ${s.title}`}
          aria-current={i === current ? 'step' : undefined}
          className="flex-1 py-1 -my-1 cursor-pointer disabled:cursor-not-allowed"
        >
          <span
            className={cn(
              'block h-1.5 rounded-full transition-colors duration-300',
              i <= current ? 'bg-accent-rehearsal' : 'bg-foreground/15'
            )}
          />
        </button>
      ))}
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className="bw-label-sm text-muted-foreground">
        Step {current + 1} of {steps.length}
      </span>
      <span className="bw-label-sm text-foreground">{steps[current]?.title}</span>
    </div>
  </div>
);

/** Figma "Segmented": card pill track, rehearsal-blue selected segment. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex p-1 gap-1 rounded-full bg-card">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 min-w-0 h-9 px-2 rounded-full bw-button-sm whitespace-nowrap transition-colors cursor-pointer',
              selected
                ? 'bg-accent-rehearsal text-accent-rehearsal-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Figma "Input" shell hosting a picker (date, time, venue search). */
const PillShell: React.FC<{
  label: string;
  htmlFor?: string;
  icon: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ label, htmlFor, icon, aside, children, className }) => (
  <div className={cn('flex flex-col gap-2 min-w-0', className)}>
    <div className="flex items-center justify-between gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="bw-label-sm text-muted-foreground">
          {label}
        </label>
      ) : (
        <span className="bw-label-sm text-muted-foreground">{label}</span>
      )}
      {aside}
    </div>
    <div className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-field border border-border text-foreground focus-within:border-2 focus-within:border-foreground transition-[border-color]">
      <span className="shrink-0 flex [&_svg]:w-5 [&_svg]:h-5">{icon}</span>
      <div className="flex-1 min-w-0 h-full flex items-center">{children}</div>
    </div>
  </div>
);

/** Figma "Control": 24pt dot-grid check — solid dots on, a dotted outline off. */
const DotCheck: React.FC<{ checked: boolean; className?: string }> = ({ checked, className }) => (
  <span aria-hidden className={cn('grid grid-cols-4 gap-[2.67px] w-6 h-6 shrink-0', className)}>
    {Array.from({ length: 16 }).map((_, i) => {
      const r = Math.floor(i / 4);
      const c = i % 4;
      const edge = r === 0 || r === 3 || c === 0 || c === 3;
      return (
        <span
          key={i}
          className={cn('w-1 h-1 rounded-full bg-current transition-opacity', !checked && (edge ? 'opacity-35' : 'opacity-0'))}
        />
      );
    })}
  </span>
);

/** Figma "Avatar" (28pt, initials). */
const Initials: React.FC<{ initials: string; title?: string; className?: string }> = ({ initials, title, className }) => (
  <span
    title={title}
    className={cn(
      'w-7 h-7 rounded-full bg-field border border-foreground/20 text-foreground bw-label-xs flex items-center justify-center shrink-0',
      className
    )}
  >
    {initials}
  </span>
);

/** Collapsible card used for the optional review sections and the edit accordion. */
const RehearsalAccordionCard: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  stepNumber?: string;
  icon?: React.ReactNode;
  title: string;
  summary: string;
  optional?: boolean;
  hasWarning?: boolean;
  warningLabel?: string;
  children: React.ReactNode;
}> = ({ isOpen, onToggle, stepNumber, icon, title, summary, optional, hasWarning, warningLabel = 'Needs attention', children }) => (
  <div className="rounded-[24px] bg-card text-card-foreground overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="w-full p-4 flex items-center gap-3 text-left cursor-pointer"
    >
      {icon && (
        <span className="w-10 h-10 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0 [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="flex items-center gap-2 flex-wrap">
          {stepNumber && <span className="bw-label-sm text-muted-foreground">{stepNumber}</span>}
          <span className="bw-h3">{title}</span>
          {optional && <Tag variant="outline">Optional</Tag>}
          {hasWarning && (
            <Tag className="bg-warning text-warning-foreground" icon={<AlertCircle />}>
              {warningLabel}
            </Tag>
          )}
        </span>
        <span className="bw-body-sm text-muted-foreground truncate">{summary}</span>
      </span>
      <motion.span
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        className="w-9 h-9 rounded-full border-[1.5px] border-foreground flex items-center justify-center shrink-0"
      >
        <ChevronDown className="w-4 h-4" />
      </motion.span>
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
          <div className="px-4 pb-4 flex flex-col gap-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export const RehearsalCreationWizard: React.FC<Props> = ({ onClose, onCreate, editingEvent, onOpenPollBuilder, existingEvents, draft, initialTasks }) => {
  const pickerEvents = useMemo(
    () => toDatePickerEvents(existingEvents, editingEvent?.eventId),
    [existingEvents, editingEvent?.eventId]
  );
  useCurrency(); // re-render money labels when the band currency changes
  const { selectedBand, isAdmin } = useBand();
  const isEditing = !!editingEvent;
  // A draft restores the wizard where it was left (creation only).
  const ds = (!editingEvent && draft?.state ? draft.state : null) as Record<string, any> | null;
  const [step, setStep] = useState<number>(() => (typeof ds?.step === 'number' ? Math.min(Math.max(ds.step, 0), 2) : 0));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (authData?.user?.id) {
        setCurrentUserId(authData.user.id);
      }
    });
  }, []);

  const realMembers: RehearsalMember[] = useMemo(() => {
    if (!selectedBand?.members) return [];
    return selectedBand.members.map(m => ({
      id: m.user_id,
      name: personName(m.profile, 'Unknown'),
      role: m.instrument || m.role || 'Member',
      initials: personInitials(m.profile, 'U'),
      fee: m.default_fee?.toString() || '0',
      status: 'confirmed' as const,
    }));
  }, [selectedBand?.members]);

  const currentUserInitials = useMemo(() => {
    if (currentUserId) {
      const found = realMembers.find(m => m.id === currentUserId);
      if (found?.initials) return found.initials;
    }
    return realMembers[0]?.initials || 'ME';
  }, [currentUserId, realMembers]);

  // Modal state
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isSetlistEditorOpen, setIsSetlistEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SetlistTemplate | null>(null);
  const [isEditProposalOpen, setIsEditProposalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<SongProposal | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RehearsalTask | null>(null);
  const [isReviewSetlistOpen, setIsReviewSetlistOpen] = useState(false);
  const [isSetlistConfirmed, setIsSetlistConfirmed] = useState(false);

  const [templates, setTemplates] = useState<SetlistTemplate[]>([]);
  const [library, setLibrary] = useState<RehearsalSong[]>([]);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [taskTemplatesDB, setTaskTemplatesDB] = useState<TaskTemplateDB[]>([]);

  useEffect(() => {
    if (!selectedBand?.id) return;
    const fetchSongData = async () => {
      const [songsRes, setlistsRes, taskTplRes] = await Promise.all([
        getSongs(selectedBand.id),
        getSetlists(selectedBand.id),
        supabase.from('task_templates').select('*').eq('band_id', selectedBand.id).order('created_at', { ascending: false }),
      ]);
      if (songsRes.data) {
        setLibrary(songsRes.data.map(dbSongToRehearsalSong));
      }
      if (setlistsRes.data) {
        const templatePromises = setlistsRes.data.map(async (sl) => {
          const { data: full } = await getSetlist(sl.id);
          const songIds = full?.songs?.map(ss => ss.song_id) || [];
          return dbSetlistToTemplate(sl, songIds);
        });
        const loaded = await Promise.all(templatePromises);
        setTemplates(loaded);
      }
      if (taskTplRes.data) {
        setTaskTemplatesDB(taskTplRes.data);
      }
    };
    fetchSongData();
  }, [selectedBand?.id]);

  const [endTime, setEndTime] = useState<string>((typeof ds?.endTime === 'string' && ds.endTime) || editingEvent?.endTime || '22:00');
  const [checklistChecked, setChecklistChecked] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [isSetlistExpanded, setIsSetlistExpanded] = useState(false);
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const initialRecurrence: RecurrenceType = (
    (editingEvent as any)?.recurrence_rule?.freq ||
    (editingEvent as any)?.recurrence_rule?.frequency ||
    (editingEvent as any)?.recurrence ||
    ((editingEvent as any)?.is_recurring ? 'weekly' : 'once')
  ) as RecurrenceType;

  // Restored draft, or the to-dos of a template ("Use this list").
  const withDraft = (base: RehearsalState): RehearsalState => {
    if (ds?.data && typeof ds.data === 'object') return { ...base, ...(ds.data as Partial<RehearsalState>) };
    if (!editingEvent && initialTasks?.length) {
      const stamp = Date.now().toString(36);
      return {
        ...base,
        tasks: initialTasks
          .filter((t) => t.title?.trim())
          .map((t, i) => ({
            id: `task-tpl-${stamp}-${i}`,
            text: t.title.trim(),
            completed: false,
            assignedTo: ['all'],
            type: 'prepare' as const,
            dueOffset: t.dueOffset,
          })),
      };
    }
    return base;
  };

  const [data, setData] = useState<RehearsalState>(() => withDraft({
    type: 'full_band',
    title: editingEvent?.title || '',
    location: editingEvent?.location || '',
    address: editingEvent?.venueAddress || '',
    date: editingEvent?.date || toLocalDateString(new Date(Date.now() + 86400000)),
    time: editingEvent?.time || '20:00',
    duration: '2h',
    recurrence: initialRecurrence,
    venueType: editingEvent?.price && parseFloat(editingEvent.price) > 0 ? 'paid' : 'free',
    showCost: false,
    totalCost: editingEvent?.price || '0',
    splitMethod: 'equal',
    audienceIds: editingEvent?.memberUserIds || [],
    members: [],
    setlist: [],
    setlistSnapshotFinal: undefined,
    selectedTemplateIdsInOrder: [],
    proposals: [],
    tasks: [],
    defaultChecklist: DEFAULT_CHECKLIST,
    personalChecklist: [],
    bandChecklist: ['PA System Check', 'Extension Cords', 'Backup Cables', 'First Aid Kit'],
    reminderTime: '1_day',
    status: 'scheduled',
  }));

  const activeAccentColor = useMemo(() => getRehearsalAccentColor(data.type), [data.type]);

  useEffect(() => {
    if (realMembers.length > 0) {
      let members = realMembers;
      if (isEditing && editingEvent?.memberFeeMap) {
        members = realMembers.map(m => ({
          ...m,
          fee: editingEvent.memberFeeMap?.[m.id] || m.fee,
        }));
      }
      setData(prev => ({ ...prev, members }));
    }
  }, [realMembers, isEditing, editingEvent]);

  useEffect(() => {
    if (data.time && endTime) {
      const [sh, sm] = data.time.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      const diff = endMins >= startMins ? endMins - startMins : (24 * 60 - startMins) + endMins;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      const duration = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      setData(prev => ({ ...prev, duration }));
    }
  }, [data.time, endTime]);

  // Smart default title helper
  const getEffectiveTitle = useCallback(() => {
    if (data.title && data.title.trim()) return data.title.trim();
    const opt = TYPE_OPTIONS.find(o => o.value === data.type);
    return opt ? `${opt.label} Rehearsal` : 'Rehearsal';
  }, [data.title, data.type]);

  // Navigation
  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const finalTitle = getEffectiveTitle();
    const submitData = {
      ...data,
      title: finalTitle,
      endTime,
      ...(isEditing && editingEvent ? {
        _editing: true,
        _editingEventId: editingEvent.eventId,
        _editingLocalId: editingEvent.id,
        _originalEventType: editingEvent.eventType || 'rehearsal',
      } : {}),
    };
    onCreate(submitData);
    deleteEventDraft(draft?.id);
  };

  // ── Drafts ──────────────────────────────────────────────────
  // What the user typed (the roster and the duration fill in by themselves).
  const typedSnapshot = JSON.stringify({ ...data, members: undefined, duration: undefined, endTime });
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = typedSnapshot;
  const initialDateRef = useRef(data.date);
  const isDirty = typedSnapshot !== baselineRef.current;
  const draftsEnabled = !isEditing && !!currentUserId;
  const [leaveOpen, setLeaveOpen] = useState(false);

  const requestCloseRef = useRef<() => void>(onClose);
  requestCloseRef.current = () => {
    if (draftsEnabled && isDirty) setLeaveOpen(true);
    else onClose();
  };
  const requestClose = useCallback(() => requestCloseRef.current(), []);

  const handleSaveDraft = () => {
    if (!currentUserId) return;
    // The date counts once the user picked it (or saw it on step 2):
    // otherwise it is only tomorrow's default and the draft stays undated.
    const dated = !!data.date && (data.date !== initialDateRef.current || step >= 1 || !!ds?.dated);
    saveEventDraft({
      id: draft?.id || newDraftId(),
      userId: currentUserId,
      bandId: selectedBand?.id ?? null,
      title: getEffectiveTitle(),
      date: dated ? data.date : undefined,
      venue: data.location || undefined,
      eventType: 'rehearsal',
      state: { step, data, endTime, dated },
    });
    setLeaveOpen(false);
    onClose();
  };

  const handleDiscardDraft = () => {
    // Reopened from a draft: throwing it away removes it from Drafts too.
    deleteEventDraft(draft?.id);
    setLeaveOpen(false);
    onClose();
  };

  // Android Back: the leave sheet first, then the step before, then close.
  useSystemBack(!isEditing, () => {
    if (leaveOpen) setLeaveOpen(false);
    else if (step > 0) setStep(step - 1);
    else requestClose();
    return true;
  });

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleSubmit();
  };
  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else requestClose();
  };

  const editingWarnings = useMemo(() => {
    if (!editingEvent) return [];
    const w: string[] = [];
    if (!data.location || data.location === 'TBD') w.push('location');
    if (!data.date) w.push('date');
    if (!data.title && !getEffectiveTitle()) w.push('title');
    return w;
  }, [editingEvent, data.location, data.date, data.title, getEffectiveTitle]);

  const maxAccessibleStep = useMemo(() => {
    if (isEditing) return 2;
    if (!data.location.trim() || !data.date) return 1;
    return 2;
  }, [isEditing, data.location, data.date]);

  const [expandedEditSections, setExpandedEditSections] = useState<Record<string, boolean>>(() => {
    return {
      basics: false,
      when_where: true,
      roster: false,
      setlist_proposals: false,
      prep_tasks: false,
    };
  });

  const toggleEditSection = (key: string) => {
    setExpandedEditSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const canProceed = (() => {
    switch (step) {
      case 0: return true;
      case 1: return data.location.trim() !== '' && !!data.date;
      case 2: return true;
      default: return true;
    }
  })();

  const totalDuration = useMemo(() => {
    const durations = data.setlistSnapshotFinal
      ? data.setlistSnapshotFinal.songs.map(s => s.durationAtSnapshot)
      : data.setlist.map(s => s.duration);

    let totalSecs = 0;
    durations.forEach(d => {
      if (!d) return;
      const parts = d.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        totalSecs += parts[0] * 60 + parts[1];
      }
    });

    if (totalSecs === 0) return '0m';
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.round((totalSecs % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }, [data.setlist, data.setlistSnapshotFinal]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleTypeChange = (newType: RehearsalType) => {
    setData(prev => {
      let newAudienceIds: string[] = [];
      if (newType === 'full_band') {
        newAudienceIds = [];
      } else {
        const roleFilters: Record<string, string[]> = {
          'vocals': ['vocals', 'singer', 'voice', 'lead vocals', 'backing vocals', 'coro'],
          'rhythm': ['drums', 'bass', 'percussion', 'drummer', 'bassist', 'batteria', 'basso'],
          'acoustic': ['guitar', 'acoustic', 'piano', 'keyboard', 'keys', 'chitarra', 'tastiere']
        };
        const filters = roleFilters[newType] || [];
        newAudienceIds = prev.members
          .filter(m => filters.some(f => (m.role || '').toLowerCase().includes(f)))
          .map(m => m.id);
        if (newAudienceIds.length === 0) newAudienceIds = prev.members.map(m => m.id);
      }
      return { ...prev, type: newType, audienceIds: newAudienceIds };
    });
  };

  const toggleAudienceMember = (memberId: string) => {
    setData(prev => {
      const currentIds = prev.audienceIds.length === 0 ? prev.members.map(m => m.id) : prev.audienceIds;
      const newIds = currentIds.includes(memberId)
        ? currentIds.filter(id => id !== memberId)
        : [...currentIds, memberId];
      return { ...prev, audienceIds: newIds };
    });
  };

  // Setlist logic
  const openSetlistEditor = (template: SetlistTemplate | null) => {
    setEditingTemplate(template);
    setIsSetlistEditorOpen(true);
  };

  const handleSaveTemplate = (updatedTemplate: SetlistTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  };

  const handleCreateTemplate = (newTemplate: SetlistTemplate) => {
    setTemplates(prev => [newTemplate, ...prev]);
  };

  const handleSongPicked = async (picked: PickedSong) => {
    const rehearsalSong: RehearsalSong = {
      id: picked.id,
      title: picked.title,
      artist: picked.artist,
      duration: picked.duration_seconds
        ? `${Math.floor(picked.duration_seconds / 60)}:${String(picked.duration_seconds % 60).padStart(2, '0')}`
        : '0:00',
      priority: 'medium',
      type: 'song',
      category: picked.category,
    };
    if (!library.find(s => s.id === picked.id)) {
      setLibrary(prev => [rehearsalSong, ...prev]);
    }
    // A song is in the setlist once: picking one that's "In set" again is a no-op.
    setData(prev => (prev.setlist.some(s => s.id === rehearsalSong.id) ? prev : {
      ...prev,
      setlist: [...prev.setlist, rehearsalSong],
    }));
    setSongPickerOpen(false);
  };

  const handleAddToQueue = (templateId: string) => {
    setData(prev => ({
      ...prev,
      selectedTemplateIdsInOrder: [...(prev.selectedTemplateIdsInOrder || []), templateId]
    }));
  };

  const handleRemoveFromQueue = (index: number) => {
    setData(prev => ({
      ...prev,
      selectedTemplateIdsInOrder: (prev.selectedTemplateIdsInOrder || []).filter((_, i) => i !== index)
    }));
  };

  const handleBuildSnapshot = () => {
    const queueIds = data.selectedTemplateIdsInOrder || [];
    if (queueIds.length === 0) return;

    const existingSnapshot = data.setlistSnapshotFinal;
    const queueTemplates = queueIds.map(id => templates.find(t => t.id === id)).filter(Boolean) as SetlistTemplate[];

    const mergedSongs: RehearsalSetlistSnapshotFinal['songs'] = existingSnapshot ? [...existingSnapshot.songs] : [];
    const seenSongIds = new Set<string>(mergedSongs.map(s => s.songId));
    const skippedSongIds: string[] = [];
    const existingSources = existingSnapshot ? [...existingSnapshot.sources] : [];
    const existingSkipped = existingSnapshot?.mergeReport.duplicatesSkippedSongIds || [];

    queueTemplates.forEach(tpl => {
      tpl.songIds.forEach(sid => {
        if (seenSongIds.has(sid)) {
          skippedSongIds.push(sid);
        } else {
          seenSongIds.add(sid);
          const song = library.find(s => s.id === sid);
          if (song) {
            mergedSongs.push({
              songId: sid,
              titleAtSnapshot: song.title,
              artistAtSnapshot: song.artist,
              durationAtSnapshot: song.duration,
              sourceTemplateId: tpl.id
            });
          }
        }
      });
    });

    const allSources = [
      ...existingSources,
      ...queueTemplates
        .filter(t => !existingSources.some(s => s.templateId === t.id))
        .map(t => ({ templateId: t.id, templateName: t.name, templateVersion: t.version }))
    ];

    const allSkipped = [...existingSkipped, ...skippedSongIds];
    const totalBeforeDedupe = (existingSnapshot?.mergeReport.totalSongsBeforeDedupe || 0)
      + queueTemplates.reduce((acc, t) => acc + t.songIds.length, 0);

    const snapshot: RehearsalSetlistSnapshotFinal = {
      id: existingSnapshot?.id || `snap-${Date.now()}`,
      name: 'Rehearsal Setlist',
      createdAt: existingSnapshot?.createdAt || new Date().toISOString(),
      createdBy: existingSnapshot?.createdBy || currentUserInitials,
      sources: allSources,
      songs: mergedSongs,
      mergeReport: {
        totalImportedTemplates: allSources.length,
        totalSongsBeforeDedupe: totalBeforeDedupe,
        totalDuplicatesSkipped: allSkipped.length,
        duplicatesSkippedSongIds: allSkipped
      }
    };
    const legacySongs = mergedSongs.map(ms => library.find(s => s.id === ms.songId)).filter(Boolean) as RehearsalSong[];
    setData(prev => ({ ...prev, setlistSnapshotFinal: snapshot, setlist: legacySongs, selectedTemplateIdsInOrder: [] }));
    setIsSetlistConfirmed(false);
  };

  const handleUpdateSnapshot = (updatedSnapshot: RehearsalSetlistSnapshotFinal) => {
    const legacySongs = updatedSnapshot.songs
      .map(ms => library.find(s => s.id === ms.songId))
      .filter(Boolean) as RehearsalSong[];
    setData(prev => ({ ...prev, setlistSnapshotFinal: updatedSnapshot, setlist: legacySongs }));
  };

  const handleConfirmSetlist = () => {
    setIsSetlistConfirmed(true);
    setIsReviewSetlistOpen(false);
  };

  const handleDeselectSetlist = () => {
    setIsSetlistConfirmed(false);
    setData(prev => ({
      ...prev,
      setlistSnapshotFinal: undefined,
      setlist: [],
      selectedTemplateIdsInOrder: [],
    }));
    setIsReviewSetlistOpen(false);
  };

  const handleSaveProposalDetails = (id: string, reason: string, attachments: ProposalAttachment[]) => {
    setData(prev => ({
      ...prev,
      proposals: prev.proposals.map(p => p.id === id ? { ...p, reason, attachments } : p)
    }));
  };

  // Task logic
  const openTaskEdit = (task: RehearsalTask) => {
    setEditingTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleSaveTask = (updatedTask: RehearsalTask) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
  };

  const handleAddQuickTask = (text: string) => {
    const newTask: RehearsalTask = {
      id: `task-${Date.now()}`,
      text,
      completed: false,
      assignedTo: ['all'],
      type: 'prepare'
    };
    setData(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  };

  const handleAddNewTask = () => {
    if (!newTaskText.trim()) return;
    handleAddQuickTask(newTaskText.trim());
    setNewTaskText('');
  };

  const loadTaskTemplate = (tpl: TaskTemplateDB) => {
    const loaded: RehearsalTask[] = tpl.tasks.map((t, i) => ({
      id: `task-${Date.now()}-${i}`,
      text: t.title,
      completed: false,
      assignedTo: ['all'],
      type: t.required ? 'prepare' as const : 'other' as const,
    }));
    setData(prev => ({ ...prev, tasks: [...prev.tasks, ...loaded] }));
  };

  // ── Shared field groups ───────────────────────────────────

  const recurrenceOptions: { value: RecurrenceType; label: string }[] = [
    { value: 'once', label: 'One time' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const audienceCount = data.audienceIds.length === 0 ? data.members.length : data.audienceIds.length;
  const costNumber = parseFloat(data.totalCost || '0') || 0;
  const perPerson = costNumber / Math.max(audienceCount, 1);
  const perPersonLabel = `${sym().trim()} ${Number.isInteger(perPerson) ? perPerson : perPerson.toFixed(2)}`;

  const renderTypeTiles = () => (
    <div className="flex flex-col gap-2">
      <span id="session-type-label" className="bw-label-sm text-muted-foreground">
        Session type
      </span>
      <div role="radiogroup" aria-labelledby="session-type-label" className="grid grid-cols-2 gap-3">
        {TYPE_OPTIONS.map((opt, idx) => {
          const isSelected = data.type === opt.value;
          const isLastOdd = idx === TYPE_OPTIONS.length - 1 && TYPE_OPTIONS.length % 2 !== 0;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                handleTypeChange(opt.value);
                if (opt.value === 'custom') {
                  setIsRosterExpanded(true);
                }
              }}
              className={cn(
                'min-w-0 flex flex-col gap-1 p-4 rounded-[20px] border text-left transition-colors cursor-pointer active:scale-[0.98]',
                isLastOdd && 'col-span-2',
                isSelected
                  ? 'bg-accent-rehearsal text-accent-rehearsal-foreground border-accent-rehearsal'
                  : 'bg-card text-foreground border-border'
              )}
            >
              <span className="bw-label-md">{opt.label}</span>
              <span className={cn('bw-body-sm truncate', isSelected ? 'opacity-85' : 'text-muted-foreground')}>
                {opt.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderMemberRow = (member: RehearsalMember) => {
    const isSelected = data.audienceIds.length === 0 || data.audienceIds.includes(member.id);
    return (
      <li key={member.id}>
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={() => toggleAudienceMember(member.id)}
          className="w-full flex items-center gap-3 py-2 text-left cursor-pointer"
        >
          <DotCheck checked={isSelected} className={isSelected ? 'text-foreground' : 'text-muted-foreground'} />
          <Initials initials={member.initials} title={member.name} />
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className={cn('bw-label-md truncate', !isSelected && 'text-muted-foreground')}>
              {member.id === currentUserId ? 'You' : member.name}
            </span>
            <span className="bw-body-sm text-muted-foreground truncate">{member.role || 'Member'}</span>
          </span>
        </button>
      </li>
    );
  };

  const renderLocationField = (placeholder: string) => (
    <PillShell label="Location / studio" icon={<MapPin />}>
      <VenueAutocomplete
        value={data.location}
        onChange={val => setData(prev => ({ ...prev, location: val }))}
        onSelect={place => {
          // Location = venue (or street), Address = the rest: never the same text twice.
          const { location, address } = venueFields(place);
          setData(prev => ({ ...prev, location, address }));
        }}
        placeholder={placeholder}
        className="border-0 pb-0 h-11 text-lg font-medium normal-case tracking-normal text-foreground placeholder:text-muted-foreground/60"
      />
    </PillShell>
  );

  const renderDateTimeFields = () => (
    <>
      <PillShell label="Rehearsal date" htmlFor="rehearsal-date" icon={<Calendar />}>
        <DatePicker
          id="rehearsal-date"
          value={data.date}
          onChange={d => setData(prev => ({ ...prev, date: d }))}
          accentColor={activeAccentColor}
          placeholder="Select rehearsal date…"
          showIcon={false}
          events={pickerEvents}
          className="h-full border-0 pb-0 text-lg font-medium hover:border-0"
        />
      </PillShell>

      <div className="grid grid-cols-2 gap-3">
        <PillShell label="Start time" htmlFor="rehearsal-start" icon={<Clock />}>
          <TimePicker
            id="rehearsal-start"
            value={data.time}
            onChange={val => setData(prev => ({ ...prev, time: val }))}
            accentColor={activeAccentColor}
            textSize="bw-body-lg"
            showIcon={false}
            className="h-full border-0 pb-0 [&_span]:font-medium hover:border-0"
          />
        </PillShell>
        <PillShell
          label="End time"
          htmlFor="rehearsal-end"
          icon={<Clock />}
          aside={<span className="bw-label-sm text-foreground">{data.duration}</span>}
        >
          <TimePicker
            id="rehearsal-end"
            value={endTime}
            onChange={val => setEndTime(val)}
            accentColor={activeAccentColor}
            align="end"
            textSize="bw-body-lg"
            showIcon={false}
            className="h-full border-0 pb-0 [&_span]:font-medium hover:border-0"
          />
        </PillShell>
      </div>
    </>
  );

  const renderCostCard = (withSplit: boolean) => (
    <Card className="gap-4">
      <div className="flex items-end justify-between gap-3">
        <label className="flex flex-col gap-2 min-w-0">
          <span className="bw-label-sm text-muted-foreground">Total studio cost</span>
          <span className="flex items-baseline gap-2">
            <span className="bw-value-lg">{sym()}</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={data.totalCost}
              onChange={e => setData(prev => ({ ...prev, totalCost: e.target.value }))}
              className="w-28 min-w-0 bg-transparent outline-none bw-value-lg text-foreground placeholder:text-muted-foreground/40"
              placeholder="0"
            />
          </span>
        </label>
        <div className="flex flex-col gap-2 items-end text-right shrink-0">
          <span className="bw-label-sm text-muted-foreground">Per person</span>
          <span className="bw-value-md">{perPersonLabel}</span>
        </div>
      </div>
      {withSplit && (
        <div className="flex gap-2">
          <Selector selected={data.splitMethod === 'equal'} onClick={() => setData(prev => ({ ...prev, splitMethod: 'equal' }))}>
            Equal split
          </Selector>
          <Selector selected={data.splitMethod === 'custom'} onClick={() => setData(prev => ({ ...prev, splitMethod: 'custom' }))}>
            Custom
          </Selector>
        </div>
      )}
    </Card>
  );

  const songRowCls = 'flex items-center gap-3 pl-4 pr-1 py-2 rounded-[16px] bg-background';

  // ── STEP 0: SESSION & ROSTER ──────────────────────────────

  const renderSessionRosterStep = () => {
    const selectedCount = audienceCount;
    const totalAvailable = data.members.length;
    const visibleMembers = isRosterExpanded ? data.members : data.members.slice(0, 4);
    const hiddenCount = data.members.length - visibleMembers.length;

    return (
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Scheduling Mode */}
        {!isEditing && onOpenPollBuilder && isAdmin && (
          <Segmented
            label="Scheduling mode"
            value="direct"
            options={[
              { value: 'direct', label: 'Schedule directly' },
              { value: 'poll', label: 'Poll availability' },
            ]}
            onChange={(v) => {
              if (v === 'poll') {
                onClose();
                onOpenPollBuilder();
              }
            }}
          />
        )}

        <PillField
          label="Rehearsal title (optional)"
          value={data.title}
          onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="e.g. New setlist run-through"
        />

        {renderTypeTiles()}

        {/* Band roster */}
        <Card className="gap-1">
          <div className="flex items-center justify-between gap-3 min-h-9">
            <h3 className="bw-label-md">
              Band roster · {selectedCount} of {totalAvailable}
            </h3>
            <PillButton
              variant="ghost"
              size="sm"
              fullWidth={false}
              className="-mr-3"
              icon={<Check className="w-4 h-4" />}
              onClick={() => setData(prev => ({ ...prev, audienceIds: [] }))}
            >
              Select all
            </PillButton>
          </div>

          {data.members.length === 0 ? (
            <p className="bw-body-sm text-muted-foreground py-2">No band members yet.</p>
          ) : (
            <ul className="flex flex-col">{visibleMembers.map(renderMemberRow)}</ul>
          )}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setIsRosterExpanded(true)}
              className="self-start py-2 bw-label-sm text-muted-foreground hover:text-foreground cursor-pointer"
            >
              + {hiddenCount} more
            </button>
          )}
          {isRosterExpanded && data.members.length > 4 && (
            <button
              type="button"
              onClick={() => setIsRosterExpanded(false)}
              className="self-start py-2 bw-label-sm text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Show less
            </button>
          )}
        </Card>
      </div>
    );
  };

  // ── STEP 1: DATE & LOCATION ───────────────────────────────

  const renderDateLocationStep = () => (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {renderLocationField('Search venue or studio…')}

      {/* Quick-select chips */}
      <div className="flex flex-wrap gap-2 -mt-1">
        {['Band HQ', 'Studio A', 'Home Studio', 'TBD'].map((loc) => (
          <Selector key={loc} selected={data.location === loc} onClick={() => setData(prev => ({ ...prev, location: loc }))}>
            {loc}
          </Selector>
        ))}
      </div>

      {renderDateTimeFields()}

      <div className="flex flex-col gap-2">
        <span className="bw-label-sm text-muted-foreground">Recurrence</span>
        <Segmented
          label="Recurrence"
          value={data.recurrence}
          options={recurrenceOptions}
          onChange={(freq) => setData(prev => ({ ...prev, recurrence: freq }))}
        />
      </div>

      {/* Venue cost (admin only) */}
      {isAdmin && (
        <div className="flex flex-col gap-2">
          <span className="bw-label-sm text-muted-foreground">Venue cost</span>
          <Segmented
            label="Venue cost"
            value={data.venueType}
            options={[
              { value: 'free', label: 'Free' },
              { value: 'paid', label: 'Paid' },
            ]}
            onChange={(v) =>
              setData(prev => (v === 'free' ? { ...prev, venueType: 'free', totalCost: '0' } : { ...prev, venueType: 'paid' }))
            }
          />
          <AnimatePresence>
            {data.venueType === 'paid' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden pt-2"
              >
                {renderCostCard(false)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  // ── STEP 2: REVIEW & CONFIRM ──────────────────────────────

  const renderSongLists = () => (
    <>
      {data.setlist.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="bw-label-sm text-muted-foreground">Selected songs · {data.setlist.length}</span>
          <ol className="flex flex-col gap-2">
            {data.setlist.map((song, idx) => (
              <li key={`${song.id}-${idx}`} className={songRowCls}>
                <span className="bw-label-sm text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="bw-body-md truncate">{song.title}</span>
                  {song.artist && <span className="bw-body-sm text-muted-foreground truncate">{song.artist}</span>}
                </div>
                <span className="bw-label-sm text-muted-foreground shrink-0">{song.duration}</span>
                <IconButton
                  label={`Remove ${song.title}`}
                  icon={<X />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setData(prev => ({ ...prev, setlist: prev.setlist.filter((_, i) => i !== idx) }))}
                />
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.proposals.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="bw-label-sm text-muted-foreground">Proposed songs · {data.proposals.length}</span>
          <ul className="flex flex-col gap-2">
            {data.proposals.map((prop, idx) => (
              <li key={`${prop.id}-${idx}`} className={songRowCls}>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="bw-body-md truncate">{prop.title}</span>
                  <span className="bw-body-sm text-muted-foreground truncate">
                    {prop.artist} · By {prop.proposer}
                  </span>
                </div>
                <IconButton
                  label={`Remove proposal ${prop.title}`}
                  icon={<X />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setData(prev => ({ ...prev, proposals: prev.proposals.filter(p => p.id !== prop.id) }))}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  const renderReviewExtrasStep = () => {
    const selectedCount = audienceCount;
    const totalAvailable = data.members.length;
    const recurrenceLabel = data.recurrence === 'once' ? 'One-time' : data.recurrence.charAt(0).toUpperCase() + data.recurrence.slice(1);
    const typeLabel = TYPE_OPTIONS.find(o => o.value === data.type)?.label || 'Full Band';
    const isPaid = isAdmin && data.venueType === 'paid' && costNumber > 0;
    const songCount = data.setlist.length;

    return (
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Summary */}
        <Card className="gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag variant="rehearsal">{typeLabel}</Tag>
              <Tag variant="subtle">{recurrenceLabel}</Tag>
              <Tag variant="subtle" icon={isPaid ? <CurrencyIcon /> : undefined}>
                {isPaid ? data.totalCost : 'Free studio'}
              </Tag>
            </div>
            <h3 className="bw-h2 [overflow-wrap:anywhere]">{getEffectiveTitle()}</h3>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 shrink-0" />
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="bw-body-lg">{data.date ? formatDate(data.date) : 'Date TBD'}</span>
              <span className="bw-body-sm text-muted-foreground">
                {data.time || '19:00'} – {endTime || '21:00'} · {data.duration || '2h'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 shrink-0" />
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="bw-body-lg truncate">{data.location || 'Studio TBD'}</span>
              {data.address && <span className="bw-body-sm text-muted-foreground truncate">{data.address}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 shrink-0" />
            <span className="flex-1 min-w-0 bw-body-lg truncate">
              {selectedCount} of {totalAvailable} members
            </span>
            <div className="flex -space-x-1.5 shrink-0">
              {data.members
                .filter(m => data.audienceIds.length === 0 || data.audienceIds.includes(m.id))
                .slice(0, 5)
                .map(m => (
                  <Initials key={m.id} initials={m.initials} title={m.name} />
                ))}
              {selectedCount > 5 && <Initials initials={`+${selectedCount - 5}`} />}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <PillButton variant="outline" size="sm" fullWidth={false} icon={<Edit3 className="w-4 h-4" />} onClick={() => setStep(0)}>
              Session &amp; roster
            </PillButton>
            <PillButton variant="outline" size="sm" fullWidth={false} icon={<Edit3 className="w-4 h-4" />} onClick={() => setStep(1)}>
              Date &amp; studio
            </PillButton>
          </div>
        </Card>

        {/* Setlist & Song Proposals (optional) */}
        <RehearsalAccordionCard
          isOpen={isSetlistExpanded}
          onToggle={() => setIsSetlistExpanded(!isSetlistExpanded)}
          icon={<Music2 />}
          title="Setlist & proposals"
          optional
          summary={
            songCount + data.proposals.length === 0
              ? 'No songs yet'
              : `${songCount} ${songCount === 1 ? 'song' : 'songs'}${data.proposals.length > 0 ? ` · ${data.proposals.length} proposed` : ''}`
          }
        >
          <div className="flex flex-wrap gap-2">
            <PillButton variant="outline" size="sm" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={() => setSongPickerOpen(true)}>
              Add songs
            </PillButton>
            <PillButton
              variant="outline"
              size="sm"
              fullWidth={false}
              icon={<Layers className="w-4 h-4" />}
              onClick={() => {
                if (data.setlistSnapshotFinal) {
                  setIsReviewSetlistOpen(true);
                } else {
                  openSetlistEditor(null);
                }
              }}
            >
              Setlist template
            </PillButton>
            <PillButton variant="outline" size="sm" fullWidth={false} icon={<Sparkles className="w-4 h-4" />} onClick={() => setIsProposeModalOpen(true)}>
              Propose song
            </PillButton>
          </div>

          {renderSongLists()}

          {data.setlist.length === 0 && data.proposals.length === 0 && (
            <p className="bw-body-sm text-muted-foreground">
              Add songs from your catalog or propose new tracks to rehearse.
            </p>
          )}
        </RehearsalAccordionCard>

        {/* Band Preparation Tasks (optional) */}
        <RehearsalAccordionCard
          isOpen={isTasksExpanded}
          onToggle={() => setIsTasksExpanded(!isTasksExpanded)}
          icon={<CheckSquare />}
          title="Prep tasks"
          optional
          summary={data.tasks.length === 0 ? 'No tasks yet' : `${data.tasks.length} ${data.tasks.length === 1 ? 'task' : 'tasks'} assigned`}
        >
          <div className="flex flex-col gap-2">
            <span className="bw-label-sm text-muted-foreground">Quick add</span>
            <div className="flex flex-wrap gap-2">
              {[
                'Bring chord charts',
                'Set up PA early',
                'Record audio',
                'Review bridge vocal harmonies',
                'Bring spare cables',
              ].map(suggestion => (
                <Selector key={suggestion} selected={false} onClick={() => handleAddQuickTask(suggestion)}>
                  + {suggestion}
                </Selector>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PillField
              label="New task"
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
              placeholder="Add a preparation task…"
            />
            <PillButton variant="dark" size="md" fullWidth={false} onClick={handleAddNewTask} disabled={!newTaskText.trim()}>
              Add
            </PillButton>
          </div>

          {data.tasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="bw-label-sm text-muted-foreground">Band tasks · {data.tasks.length}</span>
              <ul className="flex flex-col gap-2">
                {data.tasks.map(task => (
                  <li key={task.id} className={songRowCls}>
                    <span className="flex-1 min-w-0 bw-body-md truncate">{task.text}</span>
                    <IconButton label={`Delete task ${task.text}`} icon={<X />} variant="ghost" size="sm" onClick={() => handleDeleteTask(task.id)} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="bw-body-sm text-muted-foreground">Add action items for the band to prepare ahead of time.</p>
          )}
        </RehearsalAccordionCard>
      </div>
    );
  };

  // ── ACCORDION EDIT VIEW (FOR isEditing === true) ───────────

  const renderEditAccordionView = () => {
    const queueIds = data.selectedTemplateIdsInOrder || [];
    const hasQueue = queueIds.length > 0;
    const selectedCount = audienceCount;
    const totalAvailable = data.members.length;
    const isAllSelected = data.audienceIds.length === 0 || data.audienceIds.length === data.members.length;

    return (
      <div className="flex flex-col gap-4">
        {/* Warnings */}
        {editingWarnings.length > 0 && (
          <div role="alert" className="flex items-start gap-3 p-4 rounded-[20px] border-2 border-warning">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="bw-label-sm text-warning">
                {editingWarnings.length} {editingWarnings.length === 1 ? 'field needs' : 'fields need'} attention
              </span>
              <span className="bw-body-sm">Please complete: {editingWarnings.join(', ')}.</span>
            </div>
          </div>
        )}

        {/* Section 1: Session type & recurrence */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.basics}
          onToggle={() => toggleEditSection('basics')}
          stepNumber="01"
          title="Session & recurrence"
          summary={`${(TYPE_OPTIONS.find(o => o.value === data.type)?.label || 'Full Band')} · ${recurrenceOptions.find(o => o.value === data.recurrence)?.label || 'One time'}`}
          hasWarning={!data.title.trim()}
          warningLabel="Missing title"
        >
          <PillField
            label="Session title"
            value={data.title}
            onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
            placeholder={getEffectiveTitle()}
          />
          {renderTypeTiles()}
          <div className="flex flex-col gap-2">
            <span className="bw-label-sm text-muted-foreground">Recurrence</span>
            <Segmented
              label="Recurrence"
              value={data.recurrence}
              options={recurrenceOptions}
              onChange={(freq) => setData(prev => ({ ...prev, recurrence: freq }))}
            />
          </div>
        </RehearsalAccordionCard>

        {/* Section 2: Date, time & studio */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.when_where}
          onToggle={() => toggleEditSection('when_where')}
          stepNumber="02"
          title="Date, time & studio"
          summary={`${formatDate(data.date)} · ${data.time} – ${endTime} · ${data.location || 'Location TBD'}`}
          hasWarning={!data.location.trim() || data.location === 'TBD' || !data.date}
        >
          {renderLocationField('Venue or studio name')}

          <div className="flex flex-col gap-2">
            <PillField
              label="Address"
              value={data.address}
              onChange={e => setData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Street, city, ZIP, country"
            />
            {data.address && (
              <div className="flex flex-wrap gap-1.5">
                {data.address.split(',').map((tag, i) =>
                  tag.trim() ? (
                    <Tag key={i} variant="outline">
                      {tag.trim()}
                    </Tag>
                  ) : null
                )}
              </div>
            )}
          </div>

          {renderDateTimeFields()}

          <div className="flex flex-col gap-2">
            <span className="bw-label-sm text-muted-foreground">Studio cost</span>
            <Segmented
              label="Studio cost"
              value={data.venueType}
              options={
                isAdmin
                  ? [
                      { value: 'free', label: 'Free' },
                      { value: 'paid', label: 'Paid' },
                    ]
                  : [{ value: 'free', label: 'Free' }]
              }
              onChange={(v) => setData(prev => ({ ...prev, venueType: v }))}
            />
            {data.venueType === 'paid' && isAdmin && <div className="pt-2">{renderCostCard(true)}</div>}
          </div>
        </RehearsalAccordionCard>

        {/* Section 3: Band roster */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.roster}
          onToggle={() => toggleEditSection('roster')}
          stepNumber="03"
          title="Band roster"
          summary={`${selectedCount} of ${totalAvailable} musicians selected`}
        >
          <div className="flex gap-2">
            <Selector size="md" selected={isAllSelected} onClick={() => setData(prev => ({ ...prev, audienceIds: [] }))}>
              Select all · {totalAvailable}
            </Selector>
            <Selector
              size="md"
              selected={!isAllSelected}
              onClick={() => {
                if (data.audienceIds.length === 0) {
                  setData(prev => ({ ...prev, audienceIds: prev.members.map(m => m.id) }));
                }
              }}
            >
              Custom
            </Selector>
          </div>
          <ul className="flex flex-col">{data.members.map(renderMemberRow)}</ul>
        </RehearsalAccordionCard>

        {/* Section 4: Setlist & proposals */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.setlist_proposals}
          onToggle={() => toggleEditSection('setlist_proposals')}
          stepNumber="04"
          title="Setlist & proposals"
          summary={(() => {
            const n = data.setlistSnapshotFinal?.songs.length || data.setlist.length;
            return `${n} ${n === 1 ? 'song' : 'songs'} · ${data.proposals.length} ${data.proposals.length === 1 ? 'proposal' : 'proposals'}`;
          })()}
        >
          {data.setlistSnapshotFinal ? (
            <button
              type="button"
              onClick={() => setIsReviewSetlistOpen(true)}
              className={cn(
                'w-full flex flex-col gap-3 p-4 rounded-[16px] text-left cursor-pointer active:scale-[0.99] transition-transform',
                isSetlistConfirmed ? 'bg-accent-rehearsal text-accent-rehearsal-foreground' : 'bg-background'
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className={cn('bw-label-sm', !isSetlistConfirmed && 'text-muted-foreground')}>Active setlist</span>
                <span className={cn('bw-label-sm', !isSetlistConfirmed && 'text-muted-foreground')}>Tap to edit</span>
              </span>
              <span className="flex items-baseline gap-2">
                <span className="bw-value-lg">{data.setlistSnapshotFinal.songs.length}</span>
                <span className="bw-label-sm">{data.setlistSnapshotFinal.songs.length === 1 ? 'Song' : 'Songs'}</span>
              </span>
              <span className="flex items-center gap-1.5 flex-wrap">
                <Tag variant={isSetlistConfirmed ? 'solid' : 'subtle'}>{totalDuration}</Tag>
                <Tag variant={isSetlistConfirmed ? 'solid' : 'subtle'}>
                  {data.setlistSnapshotFinal.sources.length} {data.setlistSnapshotFinal.sources.length === 1 ? 'source' : 'sources'}
                </Tag>
              </span>
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 p-4 rounded-[16px] bg-background">
              <span className="bw-label-sm text-muted-foreground">No setlist attached</span>
              <PillButton variant="dark" size="sm" fullWidth={false} icon={<Plus className="w-4 h-4" />} onClick={() => setSongPickerOpen(true)}>
                Add songs
              </PillButton>
            </div>
          )}

          {!data.setlistSnapshotFinal && renderSongLists()}

          {hasQueue && (
            <div className="flex flex-col gap-2 p-4 rounded-[16px] bg-background">
              <span className="bw-label-sm text-muted-foreground">Queue · {queueIds.length}</span>
              <ul className="flex flex-col gap-1">
                {queueIds.map((tid, i) => {
                  const t = templates.find(tp => tp.id === tid);
                  return (
                    <li key={`${tid}-${i}`} className="flex items-center gap-3">
                      <span className="flex-1 min-w-0 bw-body-md truncate">{t?.name || 'Unknown'}</span>
                      <IconButton label={`Remove ${t?.name || 'template'} from queue`} icon={<X />} variant="ghost" size="sm" onClick={() => handleRemoveFromQueue(i)} />
                    </li>
                  );
                })}
              </ul>
              <PillButton variant="dark" size="md" onClick={handleBuildSnapshot}>
                Merge into setlist
              </PillButton>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="bw-label-sm text-muted-foreground">Available setlists</span>
              <PillButton variant="ghost" size="sm" fullWidth={false} className="-mr-3" icon={<Plus className="w-4 h-4" />} onClick={() => openSetlistEditor(null)}>
                New setlist
              </PillButton>
            </div>
            {templates.length === 0 && <p className="bw-body-sm text-muted-foreground">No saved setlists yet.</p>}
            <ul className="flex flex-col gap-2">
              {templates.slice(0, 4).map(template => {
                const inQueue = queueIds.includes(template.id);
                return (
                  <li key={template.id} className="flex items-center gap-3 pl-4 pr-2 py-2 rounded-[16px] bg-background">
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-body-md truncate">{template.name}</span>
                      <span className="bw-body-sm text-muted-foreground">
                        {template.songIds.length} {template.songIds.length === 1 ? 'song' : 'songs'}
                      </span>
                    </span>
                    <PillButton
                      variant={inQueue ? 'dark' : 'outline'}
                      size="sm"
                      fullWidth={false}
                      icon={inQueue ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      onClick={() => handleAddToQueue(template.id)}
                    >
                      {inQueue ? 'Queued' : 'Add'}
                    </PillButton>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="bw-label-sm text-muted-foreground">
              {data.proposals.length} {data.proposals.length === 1 ? 'song proposal' : 'song proposals'}
            </span>
            <PillButton variant="outline" size="sm" fullWidth={false} icon={<Sparkles className="w-4 h-4" />} onClick={() => setIsProposeModalOpen(true)}>
              Propose song
            </PillButton>
          </div>
        </RehearsalAccordionCard>

        {/* Section 5: Gear, checklists & tasks */}
        <RehearsalAccordionCard
          isOpen={!!expandedEditSections.prep_tasks}
          onToggle={() => toggleEditSection('prep_tasks')}
          stepNumber="05"
          title="Gear & tasks"
          summary={`${data.tasks.length} ${data.tasks.length === 1 ? 'task' : 'tasks'} · ${checklistChecked.size} of ${data.defaultChecklist.length} gear checked`}
        >
          <div className="flex flex-col gap-2">
            <span className="bw-label-sm text-muted-foreground">My gear checklist</span>
            <div className="grid grid-cols-2 gap-2">
              {data.defaultChecklist.map((item, i) => {
                const checked = checklistChecked.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={checked}
                    className="flex items-center gap-3 p-3 rounded-[16px] bg-background text-left cursor-pointer"
                    onClick={() =>
                      setChecklistChecked(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  >
                    <DotCheck checked={checked} className={checked ? 'text-foreground' : 'text-muted-foreground'} />
                    <span className={cn('bw-body-sm truncate', !checked && 'text-muted-foreground')}>{item}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="bw-label-sm text-muted-foreground">Tasks · {data.tasks.length}</span>
              <PillButton variant="ghost" size="sm" fullWidth={false} className="-mr-3" icon={<Plus className="w-4 h-4" />} onClick={() => setIsAddTaskModalOpen(true)}>
                Add task
              </PillButton>
            </div>

            {taskTemplatesDB.length > 0 && data.tasks.length === 0 && (
              <div className="flex flex-col gap-2">
                <span className="bw-label-sm text-muted-foreground">Load template</span>
                <div className="flex flex-wrap gap-2">
                  {taskTemplatesDB.map(tpl => (
                    <Selector key={tpl.id} selected={false} onClick={() => loadTaskTemplate(tpl)}>
                      {tpl.name}
                    </Selector>
                  ))}
                </div>
              </div>
            )}

            <ul className="flex flex-col gap-2">
              {data.tasks.map(task => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => openTaskEdit(task)}
                    className="w-full flex items-center gap-3 p-4 rounded-[16px] bg-background text-left cursor-pointer"
                  >
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-body-md truncate">{task.text}</span>
                      <span className="bw-label-xs text-muted-foreground">{task.type}</span>
                    </span>
                    <DotCheck checked={task.completed} className={task.completed ? 'text-foreground' : 'text-muted-foreground'} />
                  </button>
                </li>
              ))}
            </ul>
            {data.tasks.length === 0 && <p className="bw-body-sm text-muted-foreground">No tasks assigned yet.</p>}
          </div>
        </RehearsalAccordionCard>
      </div>
    );
  };

  // ── MODALS (shared by both modes) ─────────────────────────

  const modals = (
    <>
      <RehearsalProposeSongModal
        isOpen={isProposeModalOpen}
        onClose={() => setIsProposeModalOpen(false)}
        currentUser={{ initials: currentUserInitials }}
        onPropose={(proposal) => setData(prev => ({ ...prev, proposals: [...prev.proposals, proposal] }))}
      />
      <RehearsalAddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        members={data.members}
        songs={data.setlist}
        onAdd={(task) => setData(prev => ({ ...prev, tasks: [...prev.tasks, task] }))}
      />
      <RehearsalSetlistEditorModal
        isOpen={isSetlistEditorOpen}
        onClose={() => setIsSetlistEditorOpen(false)}
        initialTemplate={editingTemplate}
        library={library}
        onSave={handleSaveTemplate}
        onCreate={handleCreateTemplate}
        currentUserInitials={currentUserInitials}
        bandId={selectedBand?.id}
        onSongCreated={(song) => {
          if (!library.find(s => s.id === song.id)) {
            setLibrary(prev => [song, ...prev]);
          }
        }}
      />
      <RehearsalEditProposalModal
        isOpen={isEditProposalOpen}
        onClose={() => setIsEditProposalOpen(false)}
        proposal={editingProposal}
        onSave={handleSaveProposalDetails}
      />
      <RehearsalTaskDetailModal
        isOpen={isTaskDetailOpen}
        onClose={() => setIsTaskDetailOpen(false)}
        task={editingTask}
        members={data.members}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
      <RehearsalReviewSetlistModal
        isOpen={isReviewSetlistOpen}
        onClose={() => setIsReviewSetlistOpen(false)}
        snapshot={data.setlistSnapshotFinal}
        totalDuration={totalDuration}
        onUpdateSnapshot={handleUpdateSnapshot}
        onConfirmSetlist={handleConfirmSetlist}
        onDeselectSetlist={handleDeselectSetlist}
        isConfirmed={isSetlistConfirmed}
      />
      <AnimatePresence>
        {songPickerOpen && (
          <SongPicker
            isOpen={songPickerOpen}
            onClose={() => setSongPickerOpen(false)}
            onSelect={handleSongPicked}
            selectedIds={data.setlist.map(s => s.id)}
            theme="blue"
          />
        )}
      </AnimatePresence>
    </>
  );

  // ── MAIN RENDER ───────────────────────────────────────────

  // iPhone Duo: the wizard's close sits in the system column under the clock
  // (Figma "Closed · Rehearsal / New – 1 Session & roster").
  const closeInRail = useRailAction(isEditing ? undefined : requestClose, {
    label: 'Close rehearsal wizard',
    icon: <X />,
    pane: true,
  });

  if (isEditing) {
    const typeLabel = TYPE_OPTIONS.find(o => o.value === data.type)?.label || 'Full Band';
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          data-wizard-type="rehearsal"
          style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
          className="bw-pane-detail fixed inset-0 z-[100] bg-background text-foreground flex flex-col h-full overflow-hidden"
        >
          {/* Header */}
          <header className="shrink-0 px-4 pb-4 flex flex-col gap-3" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
            <div className="flex items-center gap-3 min-h-11">
              <NavBackButton pane label="Close edit rehearsal" onClick={onClose} />
              {/* iPhone Duo: Back is in the rail, so the tag leads the row
                  (as in the gig edit header) instead of floating top-right. */}
              <div className="flex-1 [[data-bw-rail-host]_&]:hidden" />
              <Tag variant="rehearsal">Editing</Tag>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="bw-label-sm text-muted-foreground">
                {typeLabel}
                {data.recurrence !== 'once' && ` · ${recurrenceOptions.find(o => o.value === data.recurrence)?.label}`}
              </p>
              <h1 className="bw-h1 [overflow-wrap:anywhere]">{getEffectiveTitle()}</h1>
              <p className="bw-body-sm text-muted-foreground truncate">
                {formatDate(data.date)} · {data.time} – {endTime} · {data.location || 'Location TBD'}
              </p>
            </div>
          </header>

          {/* Scrollable body */}
          <PeekingScrollContainer className="flex-1 px-4 pt-1 pb-6 min-h-0">
            {renderEditAccordionView()}
          </PeekingScrollContainer>

          {/* CTA bar */}
          <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
            <div className="grid grid-cols-[2fr_3fr] gap-3">
              <PillButton variant="outline" onClick={onClose}>
                Cancel
              </PillButton>
              <PillButton
                onClick={handleSubmit}
                disabled={!data.location.trim()}
                loading={isSubmitting}
                icon={<Check className="w-[18px] h-[18px]" />}
              >
                Save rehearsal
              </PillButton>
            </div>
          </div>
        </motion.div>
        {modals}
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        data-wizard-type="rehearsal"
        style={{ '--wizard-accent': activeAccentColor } as React.CSSProperties}
        className="bw-pane-detail fixed inset-0 z-[100] bg-background text-foreground flex flex-col h-full overflow-hidden"
      >
        {/* Header: Top Bar + wizard steps (Figma "Rehearsal / New") */}
        <header className="shrink-0 px-4 pb-3 flex flex-col gap-3" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
          <div className="flex items-center gap-3 min-h-11">
            <NavBackButton pane label={step > 0 ? 'Back' : 'Cancel'} onClick={handleBack} />
            <h2 className="flex-1 min-w-0 bw-h1 truncate">New rehearsal</h2>
            {!closeInRail && (
              <IconButton label="Close rehearsal wizard" icon={<X />} variant="ghost" onClick={requestClose} />
            )}
          </div>
          <WizardSteps current={step} steps={STEPS} maxAccessibleStep={maxAccessibleStep} onSelectStep={(s) => setStep(s)} />
        </header>

        {/* Scrollable body */}
        <PeekingScrollContainer className="flex-1 px-4 pt-2 pb-6 min-h-0">
          {step === 0 && renderSessionRosterStep()}
          {step === 1 && renderDateLocationStep()}
          {step === 2 && renderReviewExtrasStep()}
        </PeekingScrollContainer>

        {/* CTA bar */}
        <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <PillButton variant="outline" onClick={step > 0 ? handleBack : requestClose}>
              {step > 0 ? 'Back' : 'Cancel'}
            </PillButton>
            {step < STEPS.length - 1 ? (
              <PillButton onClick={handleNext} disabled={!canProceed}>
                Next
                <ArrowUpRight className="w-5 h-5" />
              </PillButton>
            ) : (
              <PillButton onClick={handleSubmit} loading={isSubmitting} icon={<Check className="w-[18px] h-[18px]" />}>
                Create rehearsal
              </PillButton>
            )}
          </div>
        </div>
      </motion.div>
      {modals}
      {draftsEnabled && (
        <LeaveWizardSheet
          open={leaveOpen}
          what="rehearsal"
          onSaveDraft={handleSaveDraft}
          onDiscard={handleDiscardDraft}
          onKeepEditing={() => setLeaveOpen(false)}
          discardLabel={draft ? 'Delete draft' : undefined}
        />
      )}
    </>
  );
};
